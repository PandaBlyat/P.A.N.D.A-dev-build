import type { Conversation } from './types';
import type { CollabInviteOffer, CollabIdentity, CollabInviteReply } from './collab-realtime';
import type { CollabParticipant, CollabSession } from './collab-protocol';
import {
  closeCollabSession,
  createCollabSession,
  fetchCollabSession,
  getLocalPublisherId,
  joinCollabSession,
  promoteCollabSessionHost,
} from './api-client';
import {
  hasCollabRealtimeConfig,
  openInbox,
  openLobby,
  openSession,
  sendInboxBroadcast,
} from './collab-realtime';
import { normalizeParticipants } from './collab-protocol';
import { store } from './state';

const SNAPSHOT_BATCH_MS = 250;
const SNAPSHOT_INTERVAL_MS = 60_000;
const HOST_GRACE_MS = 15_000;
const LOCK_IDLE_MS = 10_000;
const CURSOR_INTERVAL_MS = 200;
const ACTIVE_SESSION_KEY = 'panda:collab-active-session:v1';

type Runtime = {
  identity: CollabIdentity;
  session: CollabSession;
  isHost: boolean;
  version: number;
  guestEditCount: number;
  channel: ReturnType<typeof openSession> | null;
  flushTimer: ReturnType<typeof setTimeout> | null;
  hostGraceTimer: ReturnType<typeof setTimeout> | null;
  lastSnapshotAt: number;
  lastCursorAt: number;
  framesThisSecond: number;
  secondStartedAt: number;
};

let identity: CollabIdentity | null = null;
let lobby: ReturnType<typeof openLobby> | null = null;
let inbox: ReturnType<typeof openInbox> | null = null;
let runtime: Runtime | null = null;
let applyingRemoteSnapshot = false;
let lastLobbyUsers: CollabParticipant[] = [];
const lobbyListeners = new Set<(users: CollabParticipant[]) => void>();

store.subscribe((change) => {
  if (!runtime || applyingRemoteSnapshot || !change.projectChanged) {
    return;
  }
  if (store.get().collab.conversationId !== runtime.session.conversation_id) {
    return;
  }
  queueSnapshotFlush();
});

setInterval(() => {
  store.clearExpiredCollabPresence();
}, 1000);

export function initializeCollabIdentity(nextIdentity: CollabIdentity, onInvite: (offer: CollabInviteOffer) => void): void {
  if (!hasCollabRealtimeConfig()) {
    return;
  }
  if (identity?.publisherId === nextIdentity.publisherId && identity.username === nextIdentity.username) {
    return;
  }
  closeIdentityChannels();
  identity = nextIdentity;
  lobby = openLobby(nextIdentity, (users) => {
    lastLobbyUsers = users;
    for (const listener of lobbyListeners) {
      listener(users);
    }
  });
  inbox = openInbox(nextIdentity.publisherId, {
    onInviteOffer: onInvite,
    onInviteAccept: (reply) => handleInviteReply(reply),
    onInviteRefuse: (reply) => handleInviteReply(reply),
  });
}

export function getCollabOnlineUsers(): CollabParticipant[] {
  return lastLobbyUsers.filter((user) => user.publisherId !== identity?.publisherId);
}

export function subscribeCollabLobby(listener: (users: CollabParticipant[]) => void): () => void {
  lobbyListeners.add(listener);
  listener(getCollabOnlineUsers());
  return () => lobbyListeners.delete(listener);
}

export function isInCollabSession(): boolean {
  return Boolean(runtime?.session.id);
}

export function isCollabHost(): boolean {
  return Boolean(runtime?.isHost);
}

export function getActiveCollabSessionId(): string | null {
  return runtime?.session.id ?? null;
}

export async function resumeStoredCollabSession(): Promise<boolean> {
  const stored = readStoredRuntimeSession();
  if (!stored) return false;
  if (runtime?.session.id === stored.sessionId) return true;
  const currentIdentity = requireIdentity();
  if (stored.publisherId !== currentIdentity.publisherId) {
    clearStoredRuntimeSession();
    return false;
  }
  const session = await fetchCollabSession(stored.sessionId).catch(() => null);
  if (!session || session.status !== 'open' || !session.participants.includes(currentIdentity.publisherId)) {
    clearStoredRuntimeSession();
    return false;
  }
  const joined = await joinCollabSession(session.id, currentIdentity.publisherId, currentIdentity.username);
  openRuntime(joined, joined.host_publisher_id === currentIdentity.publisherId, { select: true });
  if (joined.snapshot) {
    applySnapshot(joined.snapshot, joined.snapshot_version, { select: true });
  } else {
    void runtime?.channel?.send('snapshot:request', {
      type: 'snapshot:request',
      sessionId: joined.id,
      authorId: currentIdentity.publisherId,
      reason: 'resume',
    });
  }
  return true;
}

export async function startHostCollabSession(conversation: Conversation): Promise<CollabSession> {
  const currentIdentity = requireIdentity();
  if (runtime?.session.conversation_id === conversation.id) {
    return runtime.session;
  }
  const session = await createCollabSession({
    host_publisher_id: currentIdentity.publisherId,
    conversation_id: conversation.id,
    conversation_label: conversation.label,
    snapshot: conversation,
    username: currentIdentity.username,
  });
  openRuntime(session, true, { select: true });
  return session;
}

export async function inviteCollabUser(user: CollabParticipant, conversation: Conversation): Promise<void> {
  const currentIdentity = requireIdentity();
  const session = await startHostCollabSession(conversation);
  await sendInboxBroadcast(user.publisherId, 'invite:offer', {
    sessionId: session.id,
    conversationId: conversation.id,
    conversationLabel: conversation.label,
    hostPublisherId: currentIdentity.publisherId,
    hostUsername: currentIdentity.username,
    sentAt: Date.now(),
  });
}

export async function acceptCollabInvite(offer: CollabInviteOffer): Promise<void> {
  const currentIdentity = requireIdentity();
  const session = await joinCollabSession(offer.sessionId, currentIdentity.publisherId, currentIdentity.username);
  openRuntime(session, session.host_publisher_id === currentIdentity.publisherId, { select: true });
  if (session.snapshot) {
    applySnapshot(session.snapshot, session.snapshot_version, { select: true });
  } else {
    void runtime?.channel?.send('snapshot:request', {
      type: 'snapshot:request',
      sessionId: offer.sessionId,
      authorId: currentIdentity.publisherId,
      reason: 'join',
    });
  }
  await sendInboxBroadcast(offer.hostPublisherId, 'invite:accept', {
    sessionId: offer.sessionId,
    publisherId: currentIdentity.publisherId,
    username: currentIdentity.username,
    accepted: true,
  });
}

export async function refuseCollabInvite(offer: CollabInviteOffer): Promise<void> {
  const currentIdentity = requireIdentity();
  await sendInboxBroadcast(offer.hostPublisherId, 'invite:refuse', {
    sessionId: offer.sessionId,
    publisherId: currentIdentity.publisherId,
    username: currentIdentity.username,
    accepted: false,
  });
}

export async function leaveCollabSession(): Promise<void> {
  if (!runtime) return;
  const current = runtime;
  await flushSnapshotNow();
  if (current.isHost) {
    const snapshot = getActiveConversationSnapshot();
    if (snapshot) {
      await closeCollabSession(current.session.id, current.identity.publisherId, snapshot, current.version, current.guestEditCount).catch(() => current.session);
    }
  }
  closeRuntime();
  clearStoredRuntimeSession();
  store.endCollabSession();
}

export async function flushCollabSessionForPublish(): Promise<string | null> {
  if (!runtime) return null;
  if (!runtime.isHost) {
    throw new Error('Only the host can publish.');
  }
  await flushSnapshotNow();
  const snapshot = getActiveConversationSnapshot();
  if (!snapshot) return null;
  const session = await closeCollabSession(runtime.session.id, runtime.identity.publisherId, snapshot, runtime.version, runtime.guestEditCount);
  runtime.session = session;
  clearStoredRuntimeSession();
  return session.id;
}

export function getCollabPathForFieldKey(fieldKey: string | null | undefined): string | null {
  if (!fieldKey) return null;
  const conversationMatch = /^conversation-\d+-(label|timeout-message)$/u.exec(fieldKey);
  if (conversationMatch) {
    return conversationMatch[1] === 'timeout-message' ? 'timeoutMessage' : conversationMatch[1];
  }
  const turnMatch = /^conversation-\d+-turn-(\d+)-(opening-message)$/u.exec(fieldKey);
  if (turnMatch) {
    return `turns/${turnMatch[1]}/openingMessage`;
  }
  const choiceMatch = /^conversation-\d+-turn-(\d+)-choice-(\d+)-(text|reply|reply-rel-high|reply-rel-low)$/u.exec(fieldKey);
  if (choiceMatch) {
    const choiceArrayIndex = Math.max(0, Number(choiceMatch[2]) - 1);
    const field = toChoiceFieldPath(choiceMatch[3]);
    return `turns/${choiceMatch[1]}/choices/${choiceArrayIndex}/${field}`;
  }
  return null;
}

export function getCollabFieldLock(path: string | null | undefined) {
  if (!path) return null;
  const lock = store.get().collab.locks[path];
  if (!lock || lock.expiresAt <= Date.now()) return null;
  return lock;
}

export function collabCanEditPath(path: string | null | undefined): boolean {
  if (!path) return true;
  const lock = getCollabFieldLock(path);
  if (!lock) return true;
  return lock.authorId === identity?.publisherId;
}

export function acquireCollabLock(path: string | null | undefined): void {
  if (!runtime || !identity || !path) return;
  const token = `${identity.publisherId}:${path}:${Date.now()}`;
  const payload = {
    type: 'lock:acquire' as const,
    sessionId: runtime.session.id,
    authorId: identity.publisherId,
    username: identity.username,
    path,
    token,
    expiresAt: Date.now() + LOCK_IDLE_MS,
  };
  void runtime.channel?.send('lock:acquire', payload);
}

export function releaseCollabLock(path: string | null | undefined): void {
  if (!runtime || !identity || !path) return;
  const lock = store.get().collab.locks[path];
  void runtime.channel?.send('lock:release', {
    type: 'lock:release',
    sessionId: runtime.session.id,
    authorId: identity.publisherId,
    path,
    token: lock?.token,
  });
}

export function sendCollabCursorPing(point: { x: number; y: number }): void {
  if (!runtime || !identity) return;
  const now = Date.now();
  if (now - runtime.lastCursorAt < CURSOR_INTERVAL_MS) return;
  runtime.lastCursorAt = now;
  void runtime.channel?.send('cursor', {
    type: 'cursor',
    sessionId: runtime.session.id,
    cursor: {
      authorId: identity.publisherId,
      username: identity.username,
      x: Math.round(point.x),
      y: Math.round(point.y),
      ts: now,
    },
  });
}

export function notifyCollabLocalEdit(): void {
  if (!runtime || applyingRemoteSnapshot) return;
  queueSnapshotFlush();
}

function openRuntime(session: CollabSession, asHost: boolean, options: { select?: boolean } = {}): void {
  const currentIdentity = requireIdentity();
  closeRuntime();
  const participants = normalizeParticipants(session.participants, session.participant_usernames, session.host_publisher_id);
  runtime = {
    identity: currentIdentity,
    session,
    isHost: asHost,
    version: session.snapshot_version,
    guestEditCount: session.guest_edit_count ?? 0,
    channel: null,
    flushTimer: null,
    hostGraceTimer: null,
    lastSnapshotAt: Date.now(),
    lastCursorAt: 0,
    framesThisSecond: 0,
    secondStartedAt: Date.now(),
  };
  store.startCollabSession({
    sessionId: session.id,
    conversationId: session.conversation_id,
    hostId: session.host_publisher_id,
    localPublisherId: currentIdentity.publisherId,
    participants,
    version: session.snapshot_version,
    isHost: asHost,
  });
  if (options.select) {
    store.selectConversation(session.conversation_id);
  }
  persistRuntimeSession(session.id, currentIdentity);
  runtime.channel = openSession(session.id, currentIdentity, {
    onPresence: (onlineParticipants) => handlePresenceSync(onlineParticipants),
    onBroadcast: (event) => {
      if (!runtime || ('sessionId' in event && event.sessionId !== runtime.session.id)) return;
      switch (event.type) {
        case 'snapshot:propose':
          if (runtime.isHost && event.authorId !== currentIdentity.publisherId) {
            runtime.guestEditCount += 1;
            store.updateCollabSession({ guestEditCount: runtime.guestEditCount });
            runtime.version += 1;
            applySnapshot(event.conversation as Conversation, runtime.version);
            sendSnapshotCommit();
          }
          break;
        case 'snapshot:commit':
          if (event.authorId !== currentIdentity.publisherId) {
            runtime.version = Math.max(runtime.version, event.version);
            applySnapshot(event.conversation as Conversation, event.version);
          }
          break;
        case 'snapshot:request':
          if (runtime.isHost) {
            sendSnapshotCommit();
          }
          break;
        case 'lock:acquire':
          if (event.authorId !== currentIdentity.publisherId) {
            store.upsertCollabLock({
              path: event.path,
              authorId: event.authorId,
              username: event.username,
              token: event.token,
              expiresAt: event.expiresAt,
            });
          }
          break;
        case 'lock:release':
          store.removeCollabLock(event.path, event.authorId);
          break;
        case 'cursor':
          store.setCollabRemoteCursor(event.cursor);
          break;
        case 'frame':
          break;
      }
    },
  });
  if (asHost) {
    setTimeout(() => sendSnapshotCommit(), 300);
  }
}

function handleInviteReply(reply: CollabInviteReply): void {
  if (!runtime || reply.sessionId !== runtime.session.id) {
    return;
  }
  if (!reply.accepted) {
    store.updateCollabSession({ statusMessage: `${reply.username} declined invite.` });
    return;
  }
  const participants = mergeParticipants(store.get().collab.participants, [{
    publisherId: reply.publisherId,
    username: reply.username,
    online: true,
    isHost: false,
  }], runtime.session.host_publisher_id);
  store.setCollabParticipants(participants);
  sendSnapshotCommit();
}

function handlePresenceSync(onlineParticipants: CollabParticipant[]): void {
  if (!runtime) return;
  const participants = mergeParticipants(
    normalizeParticipants(runtime.session.participants, runtime.session.participant_usernames, runtime.session.host_publisher_id),
    onlineParticipants,
    runtime.session.host_publisher_id,
  );
  store.setCollabParticipants(participants);
  if (!runtime.isHost) {
    const hostOnline = onlineParticipants.some((participant) => participant.publisherId === runtime?.session.host_publisher_id);
    if (hostOnline) {
      if (runtime.hostGraceTimer) {
        clearTimeout(runtime.hostGraceTimer);
        runtime.hostGraceTimer = null;
      }
      store.updateCollabSession({ hostDisconnected: false, statusMessage: null });
    } else if (!runtime.hostGraceTimer) {
      store.updateCollabSession({ hostDisconnected: true, statusMessage: 'Host disconnected, promoting you...' });
      runtime.hostGraceTimer = setTimeout(() => {
        void promoteSelfToHost();
      }, HOST_GRACE_MS);
    }
  }
}

async function promoteSelfToHost(): Promise<void> {
  if (!runtime || !identity || runtime.isHost) return;
  const session = await promoteCollabSessionHost(runtime.session.id, identity.publisherId);
  runtime.session = session;
  runtime.isHost = true;
  runtime.version = session.snapshot_version;
  store.updateCollabSession({
    hostId: identity.publisherId,
    isHost: true,
    hostDisconnected: false,
    statusMessage: 'You are host now.',
  });
  sendSnapshotCommit();
}

function queueSnapshotFlush(): void {
  if (!runtime) return;
  if (runtime.flushTimer) return;
  const intervalElapsed = Date.now() - runtime.lastSnapshotAt >= SNAPSHOT_INTERVAL_MS;
  runtime.flushTimer = setTimeout(() => {
    void flushSnapshotNow();
  }, intervalElapsed ? 0 : SNAPSHOT_BATCH_MS);
}

async function flushSnapshotNow(): Promise<void> {
  if (!runtime) return;
  if (runtime.flushTimer) {
    clearTimeout(runtime.flushTimer);
    runtime.flushTimer = null;
  }
  const snapshot = getActiveConversationSnapshot();
  if (!snapshot) return;
  runtime.lastSnapshotAt = Date.now();
  runtime.framesThisSecond += 1;
  if (runtime.lastSnapshotAt - runtime.secondStartedAt >= 1000) {
    console.debug('[collab]', { opsPerSec: runtime.framesThisSecond, framesPerSec: runtime.framesThisSecond });
    runtime.framesThisSecond = 0;
    runtime.secondStartedAt = runtime.lastSnapshotAt;
  }
  if (runtime.isHost) {
    runtime.version += 1;
    await runtime.channel?.send('snapshot:commit', {
      type: 'snapshot:commit',
      sessionId: runtime.session.id,
      authorId: runtime.identity.publisherId,
      version: runtime.version,
      conversation: snapshot,
    });
    return;
  }
  runtime.guestEditCount += 1;
  await runtime.channel?.send('snapshot:propose', {
    type: 'snapshot:propose',
    sessionId: runtime.session.id,
    authorId: runtime.identity.publisherId,
    conversation: snapshot,
  });
}

function sendSnapshotCommit(): void {
  if (!runtime || !runtime.isHost) return;
  const snapshot = getActiveConversationSnapshot();
  if (!snapshot) return;
  runtime.version += 1;
  void runtime.channel?.send('snapshot:commit', {
    type: 'snapshot:commit',
    sessionId: runtime.session.id,
    authorId: runtime.identity.publisherId,
    version: runtime.version,
    conversation: snapshot,
  });
}

function applySnapshot(conversation: Conversation, version: number, options: { select?: boolean } = {}): void {
  if (!runtime) return;
  applyingRemoteSnapshot = true;
  try {
    store.applyCollabConversationSnapshot(runtime.session.conversation_id, conversation, version, options);
  } finally {
    applyingRemoteSnapshot = false;
  }
}

function getActiveConversationSnapshot(): Conversation | null {
  const state = store.get();
  const conversationId = runtime?.session.conversation_id ?? state.collab.conversationId;
  if (conversationId == null) return null;
  return state.project.conversations.find((conversation) => conversation.id === conversationId) ?? null;
}

function mergeParticipants(base: CollabParticipant[], online: CollabParticipant[], hostId: string): CollabParticipant[] {
  const byId = new Map<string, CollabParticipant>();
  for (const participant of base) {
    byId.set(participant.publisherId, {
      ...participant,
      isHost: participant.publisherId === hostId,
      online: participant.online ?? false,
    });
  }
  for (const participant of online) {
    byId.set(participant.publisherId, {
      ...byId.get(participant.publisherId),
      ...participant,
      isHost: participant.publisherId === hostId,
      online: true,
    });
  }
  return Array.from(byId.values()).sort((left, right) => {
    if (left.publisherId === hostId) return -1;
    if (right.publisherId === hostId) return 1;
    return left.username.localeCompare(right.username);
  });
}

function closeIdentityChannels(): void {
  lobby?.close();
  inbox?.close();
  lobby = null;
  inbox = null;
  lastLobbyUsers = [];
}

function closeRuntime(): void {
  if (runtime?.flushTimer) clearTimeout(runtime.flushTimer);
  if (runtime?.hostGraceTimer) clearTimeout(runtime.hostGraceTimer);
  runtime?.channel?.close();
  runtime = null;
}

function requireIdentity(): CollabIdentity {
  if (identity) return identity;
  const publisherId = getLocalPublisherId();
  const username = publisherId;
  initializeCollabIdentity({ publisherId, username }, () => undefined);
  if (!identity) {
    throw new Error('Collab identity unavailable.');
  }
  return identity;
}

function persistRuntimeSession(sessionId: string, currentIdentity: CollabIdentity): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
    sessionId,
    publisherId: currentIdentity.publisherId,
    username: currentIdentity.username,
  }));
}

function readStoredRuntimeSession(): { sessionId: string; publisherId: string; username: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{ sessionId: string; publisherId: string; username: string }>;
    if (!parsed.sessionId || !parsed.publisherId) return null;
    return {
      sessionId: parsed.sessionId,
      publisherId: parsed.publisherId,
      username: parsed.username || parsed.publisherId,
    };
  } catch {
    return null;
  }
}

function clearStoredRuntimeSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACTIVE_SESSION_KEY);
}

function toChoiceFieldPath(field: string): string {
  switch (field) {
    case 'reply-rel-high':
      return 'replyRelHigh';
    case 'reply-rel-low':
      return 'replyRelLow';
    default:
      return field;
  }
}
