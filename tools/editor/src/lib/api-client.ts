import type { Conversation, FactionId } from './types';
import type { UserMissionProgressRecord } from './gamification';

export type UserAchievement = {
  achievement_id: string;
  unlocked_at: string;
};

export type UserStreakState = {
  publish_streak: number;
  longest_streak: number;
  last_publish_week: string;
  login_streak: number;
  last_login_date: string;
  updated_at?: string;
};

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
  publisher_id?: string;
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

export type PublishPayload = Omit<CommunityConversation, 'id' | 'downloads' | 'upvotes' | 'created_at' | 'updated_at'> & {
  publisher_id?: string;
  replace_id?: string;
};

export type CommunityLibraryStats = {
  published_conversations: number;
  published_publishers: number;
  updated_at: string;
};

export type CreatorSupportStats = {
  id: string;
  upvotes: number;
  visitors?: number;
  active_users?: number;
  updated_at: string;
};

export type UserProfile = {
  publisher_id: string;
  username: string;
  xp: number;
  level: number;
  title: string;
  created_at: string;
  updated_at: string;
  achievements?: string[];
  achievement_records?: UserAchievement[];
  streaks?: UserStreakState | null;
  missions?: UserMissionProgressRecord[];
};

export type LeaderboardEntry = {
  publisher_id: string;
  username: string;
  xp: number;
  level: number;
  title: string;
};

export type PublicProfileData = {
  profile: UserProfile;
  publish_count: number;
  authored_conversations: CommunityConversation[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TABLE = 'community_conversations';
const SUPPORT_TABLE = 'creator_support_metrics';
const STREAKS_TABLE = 'user_streaks';
const MISSIONS_TABLE = 'user_mission_progress';
const SUPPORT_ROW_ID = 'global';
const LOCAL_PUBLISH_COOLDOWN_MS = 60_000;
const LOCAL_PUBLISH_KEY = 'panda-community-last-publish-at';
const LOCAL_PUBLISHER_ID_KEY = 'panda-community-publisher-id';
const COMMUNITY_REQUIRED_COLUMNS = ['id', 'faction', 'label', 'description', 'author', 'data', 'downloads', 'created_at'] as const;
const COMMUNITY_OPTIONAL_COLUMNS = ['summary', 'tags', 'branch_count', 'complexity', 'upvotes', 'updated_at', 'publisher_id'] as const;


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

function getTodayDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function getIsoWeek(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getActiveMissionPeriodKeys(date = new Date()): string[] {
  return [getTodayDateString(date), getIsoWeek(date)];
}

function getPublisherId(): string {
  if (typeof window === 'undefined') return 'server-publisher';

  const existing = window.localStorage.getItem(LOCAL_PUBLISHER_ID_KEY)?.trim();
  if (existing) return existing;

  const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `publisher-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(LOCAL_PUBLISHER_ID_KEY, generated);
  return generated;
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
    publisher_id: typeof row.publisher_id === 'string' ? row.publisher_id : '',
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

export async function fetchConversationById(id: string): Promise<CommunityConversation | null> {
  const params = new URLSearchParams({
    select: [...COMMUNITY_REQUIRED_COLUMNS, ...COMMUNITY_OPTIONAL_COLUMNS].join(','),
    id: `eq.${id}`,
    limit: '1',
  });

  let res = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
  if (!res.ok) {
    const errorMessage = await readErrorMessage(res);
    if (!isCommunitySchemaMismatchError(errorMessage) && !isMissingOptionalCommunityColumnError(errorMessage)) {
      throw new Error(errorMessage);
    }

    const fallbackParams = new URLSearchParams({
      select: COMMUNITY_REQUIRED_COLUMNS.join(','),
      id: `eq.${id}`,
      limit: '1',
    });
    res = await fetch(`${sbEndpoint(TABLE)}?${fallbackParams}`, { headers: sbHeaders() });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }
  }

  const rows = await res.json() as Array<Partial<CommunityConversation>>;
  return rows[0] ? normalizeConversationRow(rows[0]) : null;
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

  if (!payload.replace_id && await conversationLabelExists(label)) {
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
    publisher_id: payload.publisher_id?.trim() || getPublisherId(),
  };

  const replaceId = payload.replace_id?.trim();
  if (replaceId) {
    const replacePayload = {
      ...publishBody,
      replace_id: undefined,
      publisher_id: publishBody.publisher_id || getPublisherId(),
    };
    let lastError: unknown;
    let proxySucceeded = false;

    // Try the proxy server first (handles ownership checks server-side).
    for (const url of apiCandidates(`/api/conversations/${encodeURIComponent(replaceId)}`)) {
      try {
        const headers = { 'Content-Type': 'application/json' };
        let res = await fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(replacePayload),
        });

        if (res.status === 405) {
          res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(replacePayload),
          });
          if (res.status === 405) {
            const replaceUrl = `${url}/replace`;
            res = await fetch(replaceUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(replacePayload),
            });
          }
        }

        // If still 405, the proxy isn't available — skip to direct Supabase fallback.
        if (res.status === 405) {
          lastError = new Error(`Request failed (${res.status})`);
          continue;
        }

        if (!res.ok) {
          const msg = await readErrorMessage(res).catch(() => `API request failed (${res.status})`);
          if (res.status === 403) throw new Error('You can only update conversations published by your current publisher identity.');
          if (res.status === 404) throw new Error('Original community conversation was not found.');
          if (res.status === 409) throw new PublishValidationError('A different conversation already uses this title.', 'duplicate-name');
          throw new Error(msg);
        }
        proxySucceeded = true;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(LOCAL_PUBLISH_KEY, String(Date.now()));
        }
        return;
      } catch (error) {
        lastError = error;
      }
    }

    // Direct Supabase fallback when no proxy server is reachable (e.g. GitHub Pages).
    if (!proxySucceeded) {
      const headers = { ...sbHeaders(), Prefer: 'return=minimal' };
      const updateBody: Record<string, unknown> = {
        label: replacePayload.label,
        description: replacePayload.description,
        summary: replacePayload.summary,
        tags: replacePayload.tags,
        branch_count: replacePayload.branch_count,
        complexity: replacePayload.complexity,
        data: replacePayload.data,
        author: replacePayload.author,
      };

      let res = await fetch(`${sbEndpoint(TABLE)}?id=eq.${encodeURIComponent(replaceId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updateBody),
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
          const { summary: _s, tags: _t, branch_count: _b, complexity: _c, ...fallbackBody } = updateBody;
          res = await fetch(`${sbEndpoint(TABLE)}?id=eq.${encodeURIComponent(replaceId)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(fallbackBody),
          });
        }
        if (!res.ok) {
          throw new Error(await readErrorMessage(res).catch(() => `Update failed (${res.status})`));
        }
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LOCAL_PUBLISH_KEY, String(Date.now()));
      }
      return;
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to replace community conversation.');
  } else {
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
        || isMissingSchemaColumnError(errorMessage, 'publisher_id')
        || isCommunitySchemaMismatchError(errorMessage)
      ) {
        const {
          summary: _summary,
          tags: _tags,
          branch_count: _branchCount,
          complexity: _complexity,
          publisher_id: _publisherId,
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
    await sendToApi(`/api/conversations/${id}/upvote`, {
      method: 'PATCH',
    });
    return;
  } catch (apiError) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_upvote`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ conv_id: id }),
    });

    if (!res.ok) {
      const fallbackError = await readErrorMessage(res).catch(() => `Failed to increment upvote (${res.status})`);
      const apiMessage = apiError instanceof Error ? apiError.message : 'Unable to reach API endpoint';
      throw new Error(`${fallbackError}. API fallback also failed: ${apiMessage}`);
    }
  }
}
export async function fetchCommunityLibraryStats(): Promise<CommunityLibraryStats> {
  try {
    return await fetchFromApi<CommunityLibraryStats>('/api/community/stats');
  } catch (apiError) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_community_library_stats`, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Failed to load community stats (${res.status})`);
      const rows = await res.json() as CommunityLibraryStats[] | CommunityLibraryStats;
      const stats = Array.isArray(rows) ? rows[0] : rows;
      return stats ?? {
        published_conversations: 0,
        published_publishers: 0,
        updated_at: new Date(0).toISOString(),
      };
    } catch {
      throw apiError instanceof Error ? apiError : new Error('Failed to load community stats.');
    }
  }
}

export async function fetchCreatorSupportStats(): Promise<CreatorSupportStats> {
  try {
    return await fetchFromApi<CreatorSupportStats>('/api/support/upvotes');
  } catch (apiError) {
    const params = new URLSearchParams({
      select: 'id,upvotes,visitors,updated_at',
      id: `eq.${SUPPORT_ROW_ID}`,
      limit: '1',
    });

    try {
      const res = await fetch(`${sbEndpoint(SUPPORT_TABLE)}?${params}`, { headers: sbHeaders() });
      if (!res.ok) throw new Error(`Failed to load support stats (${res.status})`);
      const rows = await res.json() as CreatorSupportStats[];
      return rows[0] ?? { id: SUPPORT_ROW_ID, upvotes: 0, updated_at: new Date(0).toISOString() };
    } catch {
      throw apiError instanceof Error ? apiError : new Error('Failed to load support stats.');
    }
  }
}

export async function incrementCreatorSupportUpvote(): Promise<void> {
  try {
    await sendToApi('/api/support/upvote', {
      method: 'PATCH',
    });
    return;
  } catch {
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
}

const VISITOR_TRACKED_KEY = 'panda-visitor-tracked';
const ACTIVE_EDITOR_USER_ID_KEY = 'panda-active-editor-user-id';
const ACTIVE_EDITOR_PING_MS = 45_000;
const ACTIVE_EDITOR_STALE_SECONDS = 120;

export async function trackSiteVisitor(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(VISITOR_TRACKED_KEY)) return;

  window.localStorage.setItem(VISITOR_TRACKED_KEY, '1');

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_site_visitor`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ support_id: SUPPORT_ROW_ID }),
    });
  } catch {
    // Best-effort — ignore errors
  }
}

export async function fetchVisitorCount(): Promise<number> {
  try {
    const stats = await fetchCreatorSupportStats();
    return stats.visitors ?? 0;
  } catch {
    return 0;
  }
}

function getOrCreateActiveEditorUserId(): string {
  if (typeof window === 'undefined') return 'server-active-user';
  const existing = window.localStorage.getItem(ACTIVE_EDITOR_USER_ID_KEY)?.trim();
  if (existing) return existing;

  const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `active-user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(ACTIVE_EDITOR_USER_ID_KEY, generated);
  return generated;
}

export async function touchActiveEditorUser(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/touch_creator_active_user`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        active_user_id: getOrCreateActiveEditorUserId(),
        stale_after_seconds: ACTIVE_EDITOR_STALE_SECONDS,
      }),
    });
    if (!res.ok) throw new Error(`Failed to update active editor presence (${res.status})`);
    const count = await res.json() as number | null;
    return typeof count === 'number' ? count : 0;
  } catch {
    return 0;
  }
}

export async function fetchActiveEditorUserCount(): Promise<number> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_active_creator_user_count`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        stale_after_seconds: ACTIVE_EDITOR_STALE_SECONDS,
      }),
    });
    if (!res.ok) throw new Error(`Failed to fetch active editor users (${res.status})`);
    const count = await res.json() as number | null;
    return typeof count === 'number' ? count : 0;
  } catch {
    return 0;
  }
}

export function startActiveEditorPresenceTracking(onUpdate: (count: number) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let stopped = false;
  let timer: number | null = null;

  const ping = async (): Promise<void> => {
    const count = await touchActiveEditorUser();
    if (!stopped) onUpdate(count);
  };

  void ping();
  timer = window.setInterval(() => {
    void ping();
  }, ACTIVE_EDITOR_PING_MS);

  const handleVisibility = (): void => {
    if (document.visibilityState === 'visible') {
      void ping();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    stopped = true;
    if (timer != null) window.clearInterval(timer);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

// ─── User Profiles & Gamification ─────────────────────────────────────────

const LOCAL_USERNAME_KEY = 'panda-community-username';

export const XP_PUBLISH_SHORT = 150;
export const XP_PUBLISH_MEDIUM = 225;
export const XP_PUBLISH_LONG = 300;
export const XP_DOWNLOAD_RECEIVED = 50;
export const XP_UPVOTE_RECEIVED = 50;

export type LevelThreshold = { level: number; xp: number; title: string };
export type LevelMetadata = {
  currentLevelThreshold: LevelThreshold;
  nextLevelThreshold: LevelThreshold | null;
  progressFraction: number;
  displayTitle: string;
};

const LEVEL_RANKS = [
  'Novice',
  'Scavenger',
  'Drifter',
  'Tracker',
  'Hunter',
  'Skirmisher',
  'Veteran',
  'Elite',
  'Master',
  'Legend',
] as const;

const LEVEL_FACTIONS = [
  'Zombified',
  'Renegade',
  'Bandit',
  'Loner',
  'Sin',
  'Clear Sky',
  'Ecologist',
  'Duty',
  'Freedom',
  'Monolith',
] as const;

export const LEVEL_THRESHOLDS: LevelThreshold[] = (() => {
  let xp = 0;

  return LEVEL_FACTIONS.flatMap((faction, factionIndex) =>
    LEVEL_RANKS.map((rank, rankIndex) => {
      const level = factionIndex * LEVEL_RANKS.length + rankIndex + 1;
      const threshold: LevelThreshold = {
        level,
        xp,
        title: `${faction} ${rank}`,
      };

      xp += 100 + factionIndex * 75 + rankIndex * 30;
      return threshold;
    }),
  );
})();

export function getLevelTitle(level: number): string {
  if (!Number.isFinite(level)) return '';
  return LEVEL_THRESHOLDS.find(threshold => threshold.level === level)?.title ?? '';
}

export function getNextLevelThreshold(currentXp: number): LevelThreshold | null {
  for (const t of LEVEL_THRESHOLDS) {
    if (t.xp > currentXp) return t;
  }
  return null;
}

export function deriveLevelMetadata(currentXp: number): LevelMetadata {
  const baseThreshold = LEVEL_THRESHOLDS[0] ?? { level: 1, xp: 0, title: 'Novice' };

  let currentLevelThreshold = baseThreshold;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (threshold.xp <= currentXp) {
      currentLevelThreshold = threshold;
      continue;
    }
    break;
  }

  let nextLevelThreshold: LevelThreshold | null = null;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (threshold.xp > currentXp) {
      nextLevelThreshold = threshold;
      break;
    }
  }

  if (!nextLevelThreshold) {
    return {
      currentLevelThreshold,
      nextLevelThreshold: null,
      progressFraction: 1,
      displayTitle: currentLevelThreshold.title,
    };
  }

  const xpRange = nextLevelThreshold.xp - currentLevelThreshold.xp;
  const rawProgress = xpRange > 0 ? (currentXp - currentLevelThreshold.xp) / xpRange : 1;
  const progressFraction = Math.max(0, Math.min(rawProgress, 1));

  return {
    currentLevelThreshold,
    nextLevelThreshold,
    progressFraction,
    displayTitle: currentLevelThreshold.title,
  };
}

export function getStoredUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LOCAL_USERNAME_KEY)?.trim() || null;
}

export function setStoredUsername(username: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_USERNAME_KEY, username.trim());
}

export function clearStoredUsername(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LOCAL_USERNAME_KEY);
}

export async function registerUsername(publisherId: string, username: string): Promise<UserProfile> {
  try {
    const profile = await fetchFromApi<UserProfile>('/api/profile/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publisher_id: publisherId, username }),
    });
    setStoredUsername(username);
    return profile;
  } catch (apiError) {
    // Fallback to direct Supabase RPC
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_username`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_publisher_id: publisherId, p_username: username }),
    });
    if (!res.ok) {
      const msg = await readErrorMessage(res);
      throw new Error(msg);
    }
    const rows = await res.json() as UserProfile[] | UserProfile;
    const profile = Array.isArray(rows) ? rows[0] : rows;
    if (!profile) throw new Error('Registration failed.');
    setStoredUsername(username);
    return profile;
  }
}


export async function fetchAuthoredCommunityConversations(publisherId: string): Promise<CommunityConversation[]> {
  try {
    return await fetchFromApi<CommunityConversation[]>(`/api/profile/${encodeURIComponent(publisherId)}/conversations`);
  } catch {
    try {
      const params = new URLSearchParams({
        select: ['publisher_id', ...COMMUNITY_REQUIRED_COLUMNS, ...COMMUNITY_OPTIONAL_COLUMNS].join(','),
        publisher_id: `eq.${publisherId}`,
        order: 'created_at.desc',
      });
      const res = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
      if (!res.ok) {
        const errorMessage = await readErrorMessage(res);
        if (isMissingSchemaColumnError(errorMessage, 'publisher_id')) return [];
        if (!isCommunitySchemaMismatchError(errorMessage) && !isMissingOptionalCommunityColumnError(errorMessage)) {
          throw new Error(errorMessage);
        }

        return [];
      }

      const rows = await res.json() as Array<Partial<CommunityConversation>>;
      return rows.map(normalizeConversationRow);
    } catch {
      return [];
    }
  }
}

export async function fetchPublicProfileData(publisherId: string): Promise<PublicProfileData | null> {
  try {
    return await fetchFromApi<PublicProfileData | null>(`/api/profile/${encodeURIComponent(publisherId)}/public`);
  } catch {
    const [profile, publishCount, authoredConversations] = await Promise.all([
      fetchUserProfile(publisherId),
      fetchUserPublishCount(publisherId),
      fetchAuthoredCommunityConversations(publisherId),
    ]);

    if (!profile) return null;
    return {
      profile,
      publish_count: publishCount,
      authored_conversations: authoredConversations,
    };
  }
}

export async function fetchUserProfile(publisherId: string): Promise<UserProfile | null> {
  try {
    return await fetchFromApi<UserProfile | null>(`/api/profile/${encodeURIComponent(publisherId)}`);
  } catch {
    try {
      const [profileRes, achievementRecords, streaks, missions] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_profile`, {
          method: 'POST',
          headers: sbHeaders(),
          body: JSON.stringify({ p_publisher_id: publisherId }),
        }),
        fetchUserAchievements(publisherId),
        fetchUserStreakState(publisherId),
        fetchUserMissionProgress(publisherId),
      ]);
      if (!profileRes.ok) return null;
      const rows = await profileRes.json() as UserProfile[] | UserProfile | null;
      if (!rows) return null;
      const profile = Array.isArray(rows) ? rows[0] ?? null : rows;
      if (!profile) return null;
      return {
        ...profile,
        achievement_records: achievementRecords,
        achievements: achievementRecords.map(record => record.achievement_id),
        streaks,
        missions,
      };
    } catch {
      return null;
    }
  }
}

export async function fetchUserAchievements(publisherId: string): Promise<UserAchievement[]> {
  try {
    return await fetchFromApi<UserAchievement[]>(`/api/profile/${encodeURIComponent(publisherId)}/achievements`);
  } catch {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_achievements`, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({ p_publisher_id: publisherId }),
      });
      if (!res.ok) return [];
      return await res.json() as UserAchievement[];
    } catch {
      return [];
    }
  }
}

export async function unlockAchievement(publisherId: string, achievementId: string): Promise<boolean> {
  try {
    const response = await fetchFromApi<{ unlocked: boolean }>(`/api/profile/${encodeURIComponent(publisherId)}/achievements/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievement_id: achievementId }),
    });
    return response.unlocked;
  } catch {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/unlock_achievement`, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({ p_publisher_id: publisherId, p_achievement_id: achievementId }),
      });
      if (!res.ok) return false;
      const payload = await res.json() as boolean | boolean[];
      return Array.isArray(payload) ? Boolean(payload[0]) : Boolean(payload);
    } catch {
      return false;
    }
  }
}

export async function fetchUserStreakState(publisherId: string): Promise<UserStreakState | null> {
  try {
    return await fetchFromApi<UserStreakState | null>(`/api/profile/${encodeURIComponent(publisherId)}/streak`);
  } catch {
    try {
      const params = new URLSearchParams({
        select: 'publish_streak,longest_streak,last_publish_week,login_streak,last_login_date,updated_at',
        publisher_id: `eq.${publisherId}`,
        limit: '1',
      });
      const res = await fetch(`${sbEndpoint(STREAKS_TABLE)}?${params}`, { headers: sbHeaders() });
      if (!res.ok) return null;
      const rows = await res.json() as UserStreakState[];
      return rows[0] ?? null;
    } catch {
      return null;
    }
  }
}

export async function fetchUserMissionProgress(publisherId: string): Promise<UserMissionProgressRecord[]> {
  try {
    return await fetchFromApi<UserMissionProgressRecord[]>(`/api/profile/${encodeURIComponent(publisherId)}/missions`);
  } catch {
    try {
      const periodKeys = getActiveMissionPeriodKeys();
      const params = new URLSearchParams({
        select: 'mission_id,mission_slot,cadence,category,progress,goal,period_key,completed_at,meta,updated_at',
        publisher_id: `eq.${publisherId}`,
        order: 'updated_at.desc',
      });
      params.set('period_key', `in.(${periodKeys.map(key => `"${key}"`).join(',')})`);
      const res = await fetch(`${sbEndpoint(MISSIONS_TABLE)}?${params}`, { headers: sbHeaders() });
      if (!res.ok) return [];
      return await res.json() as UserMissionProgressRecord[];
    } catch {
      return [];
    }
  }
}

export async function syncUserMissionProgress(
  publisherId: string,
  missions: UserMissionProgressRecord[],
): Promise<void> {
  if (missions.length === 0) return;

  const body = missions.map((mission) => ({
    publisher_id: publisherId,
    mission_id: mission.mission_id,
    mission_slot: mission.mission_slot,
    cadence: mission.cadence,
    category: mission.category,
    progress: mission.progress,
    goal: mission.goal,
    period_key: mission.period_key,
    completed_at: mission.completed_at,
    meta: mission.meta ?? {},
  }));

  try {
    await sendToApi('/api/profile/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missions: body }),
    });
    return;
  } catch {
    const res = await fetch(sbEndpoint(MISSIONS_TABLE), {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }
  }
}

export async function updateUserStreak(
  publisherId: string,
  streak: UserStreakState,
): Promise<void> {
  const body = {
    publisher_id: publisherId,
    publish_streak: streak.publish_streak,
    longest_streak: streak.longest_streak,
    last_publish_week: streak.last_publish_week,
    login_streak: streak.login_streak,
    last_login_date: streak.last_login_date,
  };

  try {
    await sendToApi('/api/profile/streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return;
  } catch {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_user_streak`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        p_publisher_id: publisherId,
        p_publish_streak: streak.publish_streak,
        p_longest_streak: streak.longest_streak,
        p_last_publish_week: streak.last_publish_week,
        p_login_streak: streak.login_streak,
        p_last_login_date: streak.last_login_date,
      }),
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }
  }
}

export async function awardXp(publisherId: string, amount: number): Promise<UserProfile | null> {
  try {
    return await fetchFromApi<UserProfile | null>('/api/profile/award-xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publisher_id: publisherId, amount }),
    });
  } catch {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/award_xp`, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({ p_publisher_id: publisherId, p_amount: amount }),
      });
      if (!res.ok) return null;
      const rows = await res.json() as UserProfile[] | UserProfile | null;
      if (!rows) return null;
      return Array.isArray(rows) ? rows[0] ?? null : rows;
    } catch {
      return null;
    }
  }
}

export async function awardXpCapped(publisherId: string, amount: number, dailyCap = 500): Promise<UserProfile | null> {
  try {
    return await fetchFromApi<UserProfile | null>('/api/profile/award-xp-capped', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publisher_id: publisherId, amount, daily_cap: dailyCap }),
    });
  } catch {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/award_xp_capped`, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({ p_publisher_id: publisherId, p_amount: amount, p_daily_cap: dailyCap }),
      });
      if (!res.ok) return null;
      const rows = await res.json() as UserProfile[] | UserProfile | null;
      if (!rows) return null;
      return Array.isArray(rows) ? rows[0] ?? null : rows;
    } catch {
      return null;
    }
  }
}

export async function fetchLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  try {
    return await fetchFromApi<LeaderboardEntry[]>(`/api/leaderboard?limit=${limit}`);
  } catch {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_leaderboard`, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({ p_limit: limit }),
      });
      if (!res.ok) return [];
      return await res.json() as LeaderboardEntry[];
    } catch {
      return [];
    }
  }
}

export async function fetchUserPublishCount(publisherId: string): Promise<number> {
  try {
    const params = new URLSearchParams({
      select: 'id',
      publisher_id: `eq.${publisherId}`,
    });
    const res = await fetch(`${sbEndpoint(TABLE)}?${params}`, {
      headers: { ...sbHeaders(), Prefer: 'count=exact' },
      method: 'HEAD',
    });
    const count = res.headers.get('content-range');
    if (count) {
      const match = count.match(/\/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
    // Fallback: do a GET and count rows
    const getRes = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
    if (!getRes.ok) return 0;
    const rows = await getRes.json() as Array<{ id: string }>;
    return rows.length;
  } catch {
    return 0;
  }
}

export function getPublishXp(complexity: ConversationComplexity): number {
  switch (complexity) {
    case 'long': return XP_PUBLISH_LONG;
    case 'medium': return XP_PUBLISH_MEDIUM;
    default: return XP_PUBLISH_SHORT;
  }
}
