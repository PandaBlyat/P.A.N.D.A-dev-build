import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { CollabFrame, CollabParticipant, CollabRemoteCursor } from './collab-protocol';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type CollabIdentity = {
  publisherId: string;
  username: string;
};

export type CollabInviteOffer = {
  sessionId: string;
  conversationId: number;
  conversationLabel: string;
  hostPublisherId: string;
  hostUsername: string;
  sentAt: number;
};

export type CollabInviteReply = {
  sessionId: string;
  publisherId: string;
  username: string;
  accepted: boolean;
};

export type CollabSessionBroadcast =
  | { type: 'snapshot:commit'; sessionId: string; authorId: string; version: number; conversation: unknown }
  | { type: 'snapshot:propose'; sessionId: string; authorId: string; conversation: unknown }
  | { type: 'snapshot:request'; sessionId: string; authorId: string; reason?: string }
  | { type: 'lock:acquire'; sessionId: string; authorId: string; username: string; path: string; token: string; expiresAt: number }
  | { type: 'lock:release'; sessionId: string; authorId: string; path: string; token?: string }
  | { type: 'cursor'; sessionId: string; cursor: CollabRemoteCursor }
  | { type: 'frame'; frame: CollabFrame };

let client: SupabaseClient | null = null;
const outboxChannels = new Map<string, Promise<RealtimeChannel>>();

export function hasCollabRealtimeConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getCollabRealtimeClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return client;
}

export function openLobby(
  identity: CollabIdentity,
  onSync: (users: CollabParticipant[]) => void,
): { channel: RealtimeChannel | null; close: () => void; getUsers: () => CollabParticipant[] } {
  const realtime = getCollabRealtimeClient();
  if (!realtime) {
    return { channel: null, close: () => undefined, getUsers: () => [] };
  }
  let users: CollabParticipant[] = [];
  const channel = realtime.channel('panda:lobby', {
    config: { presence: { key: identity.publisherId } },
  });
  channel.on('presence', { event: 'sync' }, () => {
    users = presenceToParticipants(channel.presenceState(), null);
    onSync(users);
  });
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        publisherId: identity.publisherId,
        username: identity.username,
        onlineAt: new Date().toISOString(),
      });
    }
  });
  return {
    channel,
    close: () => {
      void channel.untrack();
      void realtime.removeChannel(channel);
    },
    getUsers: () => users,
  };
}

export function openInbox(
  publisherId: string,
  handlers: {
    onInviteOffer?: (offer: CollabInviteOffer) => void;
    onInviteAccept?: (reply: CollabInviteReply) => void;
    onInviteRefuse?: (reply: CollabInviteReply) => void;
  },
): { channel: RealtimeChannel | null; close: () => void } {
  const realtime = getCollabRealtimeClient();
  if (!realtime) {
    return { channel: null, close: () => undefined };
  }
  const channel = realtime.channel(`panda:inbox:${publisherId}`, {
    config: { broadcast: { self: false } },
  });
  channel
    .on('broadcast', { event: 'invite:offer' }, ({ payload }) => handlers.onInviteOffer?.(payload as CollabInviteOffer))
    .on('broadcast', { event: 'invite:accept' }, ({ payload }) => handlers.onInviteAccept?.(payload as CollabInviteReply))
    .on('broadcast', { event: 'invite:refuse' }, ({ payload }) => handlers.onInviteRefuse?.(payload as CollabInviteReply));
  channel.subscribe();
  return {
    channel,
    close: () => {
      void realtime.removeChannel(channel);
    },
  };
}

export async function sendInboxBroadcast(
  publisherId: string,
  event: 'invite:offer' | 'invite:accept' | 'invite:refuse',
  payload: CollabInviteOffer | CollabInviteReply,
): Promise<void> {
  const channel = await getOutboxChannel(`panda:inbox:${publisherId}`);
  if (!channel) return;
  await channel.send({ type: 'broadcast', event, payload });
}

export function openSession(
  sessionId: string,
  identity: CollabIdentity,
  handlers: {
    onPresence?: (participants: CollabParticipant[]) => void;
    onBroadcast?: (event: CollabSessionBroadcast) => void;
  },
): { channel: RealtimeChannel | null; send: (event: string, payload: unknown) => Promise<void>; close: () => void } {
  const realtime = getCollabRealtimeClient();
  if (!realtime) {
    return { channel: null, send: async () => undefined, close: () => undefined };
  }
  const channel = realtime.channel(`panda:session:${sessionId}`, {
    config: {
      broadcast: { self: false },
      presence: { key: identity.publisherId },
    },
  });
  channel.on('presence', { event: 'sync' }, () => {
    handlers.onPresence?.(presenceToParticipants(channel.presenceState(), null));
  });
  for (const event of ['snapshot:commit', 'snapshot:propose', 'snapshot:request', 'lock:acquire', 'lock:release', 'cursor', 'frame']) {
    channel.on('broadcast', { event }, ({ payload }) => handlers.onBroadcast?.(payload as CollabSessionBroadcast));
  }
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        publisherId: identity.publisherId,
        username: identity.username,
        onlineAt: new Date().toISOString(),
      });
    }
  });
  return {
    channel,
    send: async (event, payload) => {
      await channel.send({ type: 'broadcast', event, payload });
    },
    close: () => {
      void channel.untrack();
      void realtime.removeChannel(channel);
    },
  };
}

async function getOutboxChannel(name: string): Promise<RealtimeChannel | null> {
  const realtime = getCollabRealtimeClient();
  if (!realtime) return null;
  let promise = outboxChannels.get(name);
  if (!promise) {
    promise = new Promise<RealtimeChannel>((resolve) => {
      const channel = realtime.channel(name, { config: { broadcast: { self: false } } });
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          resolve(channel);
        }
      });
    });
    outboxChannels.set(name, promise);
  }
  return promise;
}

function presenceToParticipants(state: Record<string, unknown[]>, hostId: string | null): CollabParticipant[] {
  const participants: CollabParticipant[] = [];
  const seen = new Set<string>();
  for (const metas of Object.values(state)) {
    const meta = metas[metas.length - 1] as { publisherId?: string; username?: string } | undefined;
    const publisherId = meta?.publisherId;
    if (!publisherId || seen.has(publisherId)) {
      continue;
    }
    seen.add(publisherId);
    participants.push({
      publisherId,
      username: meta?.username || publisherId,
      isHost: hostId ? publisherId === hostId : undefined,
      online: true,
    });
  }
  return participants.sort((left, right) => left.username.localeCompare(right.username));
}
