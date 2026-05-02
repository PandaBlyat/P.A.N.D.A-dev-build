import type { Choice, Conversation, Turn } from './types';

export type CollabOpType = 'set' | 'del' | 'insert' | 'move';

export interface CollabOp {
  v: number;
  sessionId: string;
  authorId: string;
  ts: number;
  path: string;
  op: CollabOpType;
  value?: unknown;
  lockToken?: string;
}

export interface CollabParticipant {
  publisherId: string;
  username: string;
  isHost?: boolean;
  online?: boolean;
}

export interface CollabLock {
  path: string;
  authorId: string;
  username: string;
  token: string;
  expiresAt: number;
}

export interface CollabRemoteCursor {
  authorId: string;
  username: string;
  x: number;
  y: number;
  ts: number;
}

export interface CollabSnapshot {
  version: number;
  conversation: Conversation;
}

export interface CollabSession {
  id: string;
  host_publisher_id: string;
  conversation_id: number;
  conversation_label: string;
  participants: string[];
  participant_usernames: string[];
  status: 'open' | 'closed' | 'published';
  snapshot: Conversation | null;
  snapshot_version: number;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  max_users: number;
  guest_edit_count?: number;
  last_guest_edit_at?: string | null;
}

export interface CollabFrame {
  sessionId: string;
  authorId: string;
  ops?: CollabOp[];
  cursor?: CollabRemoteCursor;
}

export function encodeCollabPath(parts: Array<string | number>): string {
  return parts.map((part) => String(part).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
}

export function decodeCollabPath(path: string): string[] {
  if (!path.trim()) {
    return [];
  }
  return path.split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

export function cloneConversation<T>(conversation: T): T {
  if (conversation === undefined || conversation === null || typeof conversation !== 'object') {
    return conversation;
  }
  return structuredClone(conversation) as T;
}

export function nowCollabTs(): number {
  return Date.now();
}

export function isTextPath(path: string): boolean {
  const parts = decodeCollabPath(path);
  const last = parts[parts.length - 1];
  return typeof last === 'string' && /^(label|description|timeoutMessage|openingMessage|text|reply|replyRelHigh|replyRelLow)$/u.test(last);
}

export function getTurnNumberFromPath(path: string): number | null {
  const parts = decodeCollabPath(path);
  const index = parts.indexOf('turns');
  if (index < 0 || index + 1 >= parts.length) {
    return null;
  }
  const value = Number(parts[index + 1]);
  return Number.isFinite(value) ? value : null;
}

export function pathBelongsToTurn(path: string, turnNumber: number): boolean {
  return getTurnNumberFromPath(path) === turnNumber;
}

export function compareCollabOps(left: CollabOp, right: CollabOp): number {
  if (left.v !== right.v) {
    return left.v - right.v;
  }
  if (left.ts !== right.ts) {
    return left.ts - right.ts;
  }
  return left.authorId.localeCompare(right.authorId);
}

export function coalesceCollabOps(ops: CollabOp[]): CollabOp[] {
  const output: CollabOp[] = [];
  const latestTextSet = new Map<string, number>();
  for (const op of ops) {
    if (op.op === 'set' && isTextPath(op.path)) {
      const existingIndex = latestTextSet.get(op.path);
      if (existingIndex !== undefined) {
        output[existingIndex] = op;
        continue;
      }
      latestTextSet.set(op.path, output.length);
    }
    output.push(op);
  }
  return output;
}

export function getValueAtPath(conversation: Conversation, path: string): unknown {
  const resolved = resolvePath(conversation, decodeCollabPath(path));
  if (!resolved) {
    return undefined;
  }
  return Array.isArray(resolved.parent)
    ? resolved.parent[resolved.key as number]
    : resolved.parent[resolved.key as string];
}

export function invertCollabOp(before: Conversation, op: CollabOp): CollabOp {
  const previous = getValueAtPath(before, op.path);
  return {
    ...op,
    ts: nowCollabTs(),
    op: previous === undefined ? 'del' : 'set',
    value: cloneConversation(previous),
  };
}

export function applyCollabOpsToConversation(conversation: Conversation, ops: CollabOp[]): Conversation {
  const next = cloneConversation(conversation);
  for (const op of [...ops].sort(compareCollabOps)) {
    applyCollabOpToConversation(next, op);
  }
  return next;
}

export function applyCollabOpToConversation(conversation: Conversation, op: CollabOp): boolean {
  const parts = decodeCollabPath(op.path);
  if (!parts.length) {
    return false;
  }
  switch (op.op) {
    case 'set':
      return setPath(conversation, parts, op.value);
    case 'del':
      return deletePath(conversation, parts);
    case 'insert':
      return insertPath(conversation, parts, op.value);
    case 'move':
      return movePath(conversation, parts, op.value);
    default:
      return false;
  }
}

function setPath(conversation: Conversation, parts: string[], value: unknown): boolean {
  const resolved = resolvePath(conversation, parts);
  if (!resolved) {
    return false;
  }
  if (Array.isArray(resolved.parent)) {
    resolved.parent[resolved.key as number] = cloneConversation(value);
  } else {
    resolved.parent[resolved.key as string] = cloneConversation(value);
  }
  return true;
}

function deletePath(conversation: Conversation, parts: string[]): boolean {
  const resolved = resolvePath(conversation, parts);
  if (!resolved) {
    return false;
  }
  if (Array.isArray(resolved.parent)) {
    resolved.parent.splice(Number(resolved.key), 1);
  } else {
    delete resolved.parent[resolved.key];
  }
  return true;
}

function insertPath(conversation: Conversation, parts: string[], value: unknown): boolean {
  const resolved = resolveContainer(conversation, parts.slice(0, -1));
  const rawIndex = parts[parts.length - 1];
  if (!Array.isArray(resolved) || rawIndex === undefined) {
    return false;
  }
  const index = clampIndex(Number(rawIndex), 0, resolved.length);
  resolved.splice(index, 0, cloneConversation(value));
  return true;
}

function movePath(conversation: Conversation, parts: string[], value: unknown): boolean {
  const resolved = resolveContainer(conversation, parts.slice(0, -1));
  const from = Number(parts[parts.length - 1]);
  const to = Number(value);
  if (!Array.isArray(resolved) || !Number.isInteger(from) || !Number.isInteger(to)) {
    return false;
  }
  if (from < 0 || from >= resolved.length) {
    return false;
  }
  const [item] = resolved.splice(from, 1);
  resolved.splice(clampIndex(to, 0, resolved.length), 0, item);
  return true;
}

function resolvePath(conversation: Conversation, parts: string[]): { parent: Record<string, unknown> | unknown[]; key: string | number } | null {
  if (!parts.length) {
    return null;
  }
  const parent = resolveContainer(conversation, parts.slice(0, -1));
  if (!parent || (typeof parent !== 'object' && !Array.isArray(parent))) {
    return null;
  }
  const rawKey = parts[parts.length - 1];
  if (Array.isArray(parent)) {
    const key = Number(rawKey);
    if (!Number.isInteger(key) || key < 0 || key > parent.length) {
      return null;
    }
    return { parent, key };
  }
  return { parent: parent as Record<string, unknown>, key: rawKey };
}

function resolveContainer(conversation: Conversation, parts: string[]): unknown {
  let target: unknown = conversation;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (target == null) {
      return null;
    }
    if (part === 'turns') {
      if (index + 1 >= parts.length) {
        return (target as Conversation).turns;
      }
      const turnNumber = Number(parts[index + 1]);
      if (!Number.isFinite(turnNumber)) {
        return null;
      }
      const turns = (target as Conversation).turns;
      target = Array.isArray(turns) ? turns.find((turn) => turn.turnNumber === turnNumber) ?? null : null;
      index += 1;
      continue;
    }
    if (part === 'choices') {
      if (index + 1 >= parts.length) {
        return (target as Turn).choices;
      }
      const choiceIndex = Number(parts[index + 1]);
      const choices = (target as Turn).choices;
      if (!Array.isArray(choices) || !Number.isInteger(choiceIndex)) {
        return null;
      }
      target = choices[choiceIndex] ?? null;
      index += 1;
      continue;
    }
    if (Array.isArray(target)) {
      target = target[Number(part)];
    } else {
      target = (target as Record<string, unknown>)[part];
    }
  }
  return target;
}

function clampIndex(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return max;
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function createConversationSetOp(params: {
  sessionId: string;
  authorId: string;
  version: number;
  path: string;
  value: unknown;
  lockToken?: string;
}): CollabOp {
  return {
    v: params.version,
    sessionId: params.sessionId,
    authorId: params.authorId,
    ts: nowCollabTs(),
    path: params.path,
    op: 'set',
    value: cloneConversation(params.value),
    lockToken: params.lockToken,
  };
}

export function normalizeParticipants(ids: string[], usernames: string[], hostId: string): CollabParticipant[] {
  const seen = new Set<string>();
  return ids.reduce<CollabParticipant[]>((participants, publisherId, index) => {
    if (!publisherId || seen.has(publisherId)) {
      return participants;
    }
    seen.add(publisherId);
    participants.push({
      publisherId,
      username: usernames[index] || publisherId,
      isHost: publisherId === hostId,
      online: false,
    });
    return participants;
  }, []);
}

export function isChoice(value: unknown): value is Choice {
  return Boolean(value && typeof value === 'object' && 'text' in value && 'destinationTurn' in value);
}
