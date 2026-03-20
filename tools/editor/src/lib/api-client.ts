// P.A.N.D.A. Conversation Editor — Community Library API Client
// Communicates with a Supabase PostgREST backend.
// Configure via VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.

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
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TABLE = 'community_conversations';

/** Returns true if Supabase env vars are configured. */
export function isConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function headers(): Record<string, string> {
  return {
    'apikey': SUPABASE_KEY!,
    'Authorization': `Bearer ${SUPABASE_KEY!}`,
    'Content-Type': 'application/json',
  };
}

function endpoint(path: string): string {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

/**
 * Fetch community conversations, optionally filtered by faction.
 * Returns newest-first.
 */
export async function fetchConversations(faction?: FactionId): Promise<CommunityConversation[]> {
  if (!isConfigured()) return [];

  const params = new URLSearchParams({ select: '*', order: 'created_at.desc' });
  if (faction) params.set('faction', `eq.${faction}`);

  const res = await fetch(`${endpoint(TABLE)}?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`Failed to fetch conversations: ${res.status} ${res.statusText}`);

  return res.json() as Promise<CommunityConversation[]>;
}

/**
 * Publish a conversation to the community library.
 */
export async function publishConversation(payload: PublishPayload): Promise<void> {
  if (!isConfigured()) throw new Error('Community Library is not configured.');

  const res = await fetch(endpoint(TABLE), {
    method: 'POST',
    headers: { ...headers(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to publish: ${res.status} ${res.statusText}`);
}

/**
 * Increment the download counter for a conversation.
 * Fails silently — download counter is best-effort.
 */
export async function incrementDownload(id: string): Promise<void> {
  if (!isConfigured()) return;

  try {
    const params = new URLSearchParams({ id: `eq.${id}` });
    await fetch(`${endpoint(TABLE)}?${params}`, {
      method: 'PATCH',
      headers: { ...headers(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ downloads: 'downloads + 1' }),
    });
  } catch {
    // Best-effort — ignore errors
  }
}
