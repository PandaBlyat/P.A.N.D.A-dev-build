// P.A.N.D.A. Conversation Editor — Community Library API Client
// Calls Supabase REST API directly from the browser using the publishable anon key.
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.

import type { Conversation, FactionId } from './types';

export type CommunityConversation = {
  id: string;
  faction: FactionId;
  label: string;
  description: string;
  author: string;
  /** Single-conversation project snapshot: { version, faction, conversations: [conv] } */
  data: { version: string; faction: FactionId; conversations: Conversation[] };
  downloads: number;
  created_at: string;
};

export type PublishPayload = Omit<CommunityConversation, 'id' | 'downloads' | 'created_at'>;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TABLE = 'community_conversations';

function sbHeaders(): Record<string, string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  }
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

function sbEndpoint(path: string): string {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL is not set');
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

/**
 * Fetch community conversations, optionally filtered by faction.
 * Returns newest-first.
 */
export async function fetchConversations(faction?: FactionId): Promise<CommunityConversation[]> {
  const params = new URLSearchParams({ select: '*', order: 'created_at.desc' });
  if (faction) params.set('faction', `eq.${faction}`);

  const res = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? body.error ?? `Failed to load conversations (${res.status})`);
  }
  return res.json() as Promise<CommunityConversation[]>;
}

/**
 * Publish a conversation to the community library.
 */
export async function publishConversation(payload: PublishPayload): Promise<void> {
  const res = await fetch(sbEndpoint(TABLE), {
    method: 'POST',
    headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? body.error ?? `Failed to publish (${res.status})`);
  }
}

/**
 * Increment the download counter for a conversation.
 * Fails silently — download counter is best-effort.
 */
export async function incrementDownload(id: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_download`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ conv_id: id }),
    });
  } catch {
    // Best-effort — ignore errors
  }
}
