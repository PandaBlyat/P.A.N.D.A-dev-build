import type { Conversation, FactionId } from './types';

export type ConversationComplexity = 'short' | 'medium' | 'long';

export type PublishValidationErrorCode =
  | 'missing-conversation'
  | 'missing-title'
  | 'title-too-long'
  | 'author-too-long'
  | 'description-too-long'
  | 'summary-too-long'
  | 'too-many-tags'
  | 'tag-too-long'
  | 'contains-link'
  | 'too-many-branches'
  | 'duplicate-name'
  | 'rate-limited';

export class PublishValidationError extends Error {
  constructor(
    message: string,
    public readonly code: PublishValidationErrorCode,
  ) {
    super(message);
    this.name = 'PublishValidationError';
  }
}

export type CommunityConversation = {
  id: string;
  faction: FactionId;
  label: string;
  description: string;
  summary?: string;
  author: string;
  tags?: string[];
  branch_count?: number;
  complexity?: ConversationComplexity;
  downloads: number;
  upvotes?: number;
  created_at: string;
  updated_at?: string;
  /** Single-conversation project snapshot: { version, faction, conversations: [conv] } */
  data: { version: string; faction: FactionId; conversations: Conversation[] };
};

export type PublishPayload = Omit<CommunityConversation, 'id' | 'downloads' | 'upvotes' | 'created_at' | 'updated_at'>;

export type CreatorSupportStats = {
  id: string;
  upvotes: number;
  updated_at: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TABLE = 'community_conversations';
const SUPPORT_TABLE = 'creator_support_metrics';
const SUPPORT_ROW_ID = 'global';
const LOCAL_PUBLISH_COOLDOWN_MS = 60_000;
const LOCAL_PUBLISH_KEY = 'panda-community-last-publish-at';
const COMMUNITY_REQUIRED_COLUMNS = ['id', 'faction', 'label', 'description', 'author', 'data', 'downloads', 'created_at'] as const;
const COMMUNITY_OPTIONAL_COLUMNS = ['summary', 'tags', 'branch_count', 'complexity', 'upvotes', 'updated_at'] as const;


function apiCandidates(path: string): string[] {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const candidates: string[] = [];

  if (API_BASE_URL) candidates.push(`${API_BASE_URL}${normalizedPath}`);

  if (typeof window !== 'undefined') {
    const { hostname, origin, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      candidates.push(`http://localhost:3001${normalizedPath}`);
    }
    if (protocol !== 'file:') {
      candidates.push(`${origin}${normalizedPath}`);
    }
  }

  return Array.from(new Set(candidates));
}

async function fetchFromApi<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: unknown;

  for (const url of apiCandidates(path)) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`API request failed (${res.status})`);
      return await res.json() as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Unable to reach API endpoint: ${path}`);
}

async function sendToApi(path: string, init?: RequestInit): Promise<void> {
  let lastError: unknown;

  for (const url of apiCandidates(path)) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`API request failed (${res.status})`);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Unable to reach API endpoint: ${path}`);
}

function sbHeaders(): Record<string, string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  }
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

function sbEndpoint(path: string): string {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL is not set');
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

function isMissingSchemaColumnError(message: string, column: string): boolean {
  const normalized = message.toLowerCase();
  const normalizedColumn = column.toLowerCase();
  return (
    (normalized.includes('schema cache') && normalized.includes(`'${normalizedColumn}'`))
    || (normalized.includes('column') && normalized.includes('does not exist') && (
      normalized.includes(`${TABLE.toLowerCase()}.${normalizedColumn}`)
      || normalized.includes(`"${normalizedColumn}"`)
      || normalized.includes(`'${normalizedColumn}'`)
    ))
  );
}

function isCommunitySchemaMismatchError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('schema cache') && normalized.includes(`'${TABLE.toLowerCase()}'`);
}

function isMissingOptionalCommunityColumnError(message: string): boolean {
  return COMMUNITY_OPTIONAL_COLUMNS.some(column => isMissingSchemaColumnError(message, column));
}

async function readErrorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.message ?? body.error ?? `Request failed (${res.status})`;
}

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, c => `\\${c}`);
}

function hasSuspiciousLink(value: string): boolean {
  return /https?:\/\/|www\.|discord\.gg|bit\.ly/i.test(value);
}

function getConversationBranchCount(conversation: Conversation): number {
  return conversation.turns.length;
}

export function deriveConversationComplexity(branchCount: number): ConversationComplexity {
  if (branchCount <= 3) return 'short';
  if (branchCount <= 6) return 'medium';
  return 'long';
}

export function sanitizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map(tag => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 6);
}

export function createSummaryFromConversation(conversation: Conversation): string {
  const opening = conversation.turns.find(turn => turn.turnNumber === 1)?.openingMessage?.trim();
  if (opening) return opening.slice(0, 180);
  const firstChoice = conversation.turns.flatMap(turn => turn.choices).find(choice => choice.text.trim());
  if (firstChoice) return firstChoice.text.trim().slice(0, 180);
  return 'Branching conversation ready to import into the editor.';
}

function normalizeConversationRow(row: Partial<CommunityConversation>): CommunityConversation {
  return {
    id: String(row.id ?? ''),
    faction: row.faction as FactionId,
    label: typeof row.label === 'string' ? row.label : '',
    description: typeof row.description === 'string' ? row.description : '',
    summary: typeof row.summary === 'string' ? row.summary : '',
    author: typeof row.author === 'string' ? row.author : 'Anonymous',
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    branch_count: typeof row.branch_count === 'number' ? row.branch_count : 0,
    complexity: row.complexity,
    downloads: typeof row.downloads === 'number' ? row.downloads : 0,
    upvotes: typeof row.upvotes === 'number' ? row.upvotes : 0,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    data: row.data as CommunityConversation['data'],
  };
}

export async function fetchConversations(faction?: FactionId): Promise<CommunityConversation[]> {
  const params = new URLSearchParams({
    select: [...COMMUNITY_REQUIRED_COLUMNS, ...COMMUNITY_OPTIONAL_COLUMNS].join(','),
    order: 'updated_at.desc',
  });
  if (faction) params.set('faction', `eq.${faction}`);

  let res = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
  if (!res.ok) {
    const errorMessage = await readErrorMessage(res);
    if (!isCommunitySchemaMismatchError(errorMessage) && !isMissingOptionalCommunityColumnError(errorMessage)) {
      throw new Error(errorMessage);
    }

    const fallbackParams = new URLSearchParams({
      select: COMMUNITY_REQUIRED_COLUMNS.join(','),
      order: 'created_at.desc',
    });
    if (faction) fallbackParams.set('faction', `eq.${faction}`);
    res = await fetch(`${sbEndpoint(TABLE)}?${fallbackParams}`, { headers: sbHeaders() });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }
  }
  const rows = await res.json() as Array<Partial<CommunityConversation>>;
  return rows.map(normalizeConversationRow);
}

export async function conversationLabelExists(label: string): Promise<boolean> {
  const normalized = label.trim();
  if (!normalized) return false;

  const params = new URLSearchParams({
    select: 'id',
    limit: '1',
    label: `ilike.${escapeIlike(normalized)}`,
  });
  const res = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? body.error ?? `Failed to validate title (${res.status})`);
  }
  const rows = await res.json() as Array<{ id: string }>;
  return rows.length > 0;
}

export async function publishConversation(payload: PublishPayload): Promise<void> {
  const conversation = payload.data?.conversations?.[0];
  if (!conversation) {
    throw new PublishValidationError('No conversation selected to publish.', 'missing-conversation');
  }

  const label = payload.label.trim();
  const author = payload.author.trim() || 'Anonymous';
  const description = payload.description.trim();
  const summary = payload.summary?.trim() ?? '';
  const branchCount = payload.branch_count ?? getConversationBranchCount(conversation);
  const tags = sanitizeTags(payload.tags ?? []);

  if (!label) throw new PublishValidationError('Add a title before publishing.', 'missing-title');
  if (label.length > 70) throw new PublishValidationError('Keep the title under 70 characters.', 'title-too-long');
  if (author.length > 32) throw new PublishValidationError('Keep the author name under 32 characters.', 'author-too-long');
  if (description.length > 280) throw new PublishValidationError('Keep the description under 280 characters.', 'description-too-long');
  if (summary.length > 180) throw new PublishValidationError('Keep the summary under 180 characters.', 'summary-too-long');
  if (tags.length > 6) throw new PublishValidationError('Use up to 6 tags.', 'too-many-tags');
  if (tags.some(tag => tag.length > 20)) throw new PublishValidationError('Each tag must be 20 characters or fewer.', 'tag-too-long');
  if (branchCount > 12) throw new PublishValidationError('Anonymous publishing is limited to 12 branches per conversation.', 'too-many-branches');
  if ([label, author, description, summary, ...tags].some(hasSuspiciousLink)) {
    throw new PublishValidationError('Links and invite URLs are blocked for anonymous publishing.', 'contains-link');
  }

  if (typeof window !== 'undefined') {
    const lastPublishAt = Number(window.localStorage.getItem(LOCAL_PUBLISH_KEY) ?? '0');
    const remaining = LOCAL_PUBLISH_COOLDOWN_MS - (Date.now() - lastPublishAt);
    if (remaining > 0) {
      throw new PublishValidationError(`Please wait ${Math.ceil(remaining / 1000)}s before publishing again.`, 'rate-limited');
    }
  }

  if (await conversationLabelExists(label)) {
    throw new PublishValidationError('A community conversation with this title already exists. Rename it before publishing.', 'duplicate-name');
  }

  const publishBody = {
    ...payload,
    label,
    author,
    description,
    summary: summary || createSummaryFromConversation(conversation),
    tags,
    branch_count: branchCount,
    complexity: payload.complexity ?? deriveConversationComplexity(branchCount),
  };

  const headers = { ...sbHeaders(), Prefer: 'return=minimal' };
  let res = await fetch(sbEndpoint(TABLE), {
    method: 'POST',
    headers,
    body: JSON.stringify(publishBody),
  });

  if (!res.ok) {
    const errorMessage = await readErrorMessage(res);
    if (
      isMissingSchemaColumnError(errorMessage, 'branch_count')
      || isMissingSchemaColumnError(errorMessage, 'complexity')
      || isMissingSchemaColumnError(errorMessage, 'summary')
      || isMissingSchemaColumnError(errorMessage, 'tags')
      || isCommunitySchemaMismatchError(errorMessage)
    ) {
      const {
        summary: _summary,
        tags: _tags,
        branch_count: _branchCount,
        complexity: _complexity,
        ...fallbackBody
      } = publishBody;
      res = await fetch(sbEndpoint(TABLE), {
        method: 'POST',
        headers,
        body: JSON.stringify(fallbackBody),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
    } else {
      throw new Error(errorMessage);
    }
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_PUBLISH_KEY, String(Date.now()));
  }
}

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

export async function incrementUpvote(id: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_upvote`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ conv_id: id }),
    });
  } catch {
    // Best-effort — ignore errors
  }
}
export async function fetchCreatorSupportStats(): Promise<CreatorSupportStats> {
  const params = new URLSearchParams({
    select: 'id,upvotes,updated_at',
    id: `eq.${SUPPORT_ROW_ID}`,
    limit: '1',
  });
  const res = await fetch(`${sbEndpoint(SUPPORT_TABLE)}?${params}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Failed to load support stats (${res.status})`);
  const rows = await res.json() as CreatorSupportStats[];
  return rows[0] ?? { id: SUPPORT_ROW_ID, upvotes: 0, updated_at: new Date(0).toISOString() };
}

export async function incrementCreatorSupportUpvote(): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_creator_support_upvote`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ support_id: SUPPORT_ROW_ID }),
    });
  } catch {
    // Best-effort — ignore errors
  }
}
