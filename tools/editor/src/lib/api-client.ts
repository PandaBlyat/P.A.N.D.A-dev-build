// P.A.N.D.A. Conversation Editor — Community Library API Client
// All requests go through the local API server (/api/*).
// Supabase credentials are kept server-side and never sent to the browser.

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

// In production, set VITE_API_URL to your deployed API server URL (e.g. https://my-api.railway.app).
// In dev, leave it unset — Vite proxies /api to localhost:3001 automatically.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

/**
 * Fetch community conversations, optionally filtered by faction.
 * Returns newest-first.
 */
export async function fetchConversations(faction?: FactionId): Promise<CommunityConversation[]> {
  const params = new URLSearchParams();
  if (faction) params.set('faction', faction);

  const res = await fetch(`${API_BASE}/api/conversations?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to load conversations (${res.status})`);
  }
  return res.json() as Promise<CommunityConversation[]>;
}

/**
 * Publish a conversation to the community library.
 */
export async function publishConversation(payload: PublishPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to publish (${res.status})`);
  }
}

/**
 * Increment the download counter for a conversation.
 * Fails silently — download counter is best-effort.
 */
export async function incrementDownload(id: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/conversations/${id}/download`, { method: 'PATCH' });
  } catch {
    // Best-effort — ignore errors
  }
}
