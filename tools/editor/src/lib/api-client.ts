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

/**
 * Server-authoritative reward payload returned from the publish / metric
 * endpoints. The client should replace its cached profile state with
 * `profile` and flash toasts for each entry in `unlocked`.
 */
export type ProfileRewardResult = {
  profile: UserProfile | null;
  unlocked: UserAchievement[];
  publish_xp: number;
  achievement_xp: number;
  mission_xp: number;
  total_xp: number;
};

export type PublishConversationResult = {
  conversation_id?: string;
  rewards?: ProfileRewardResult | null;
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

export type UserCosmetics = {
  avatar_icon?: string | null;
  avatar_color?: string | null;
  avatar_frame?: string | null;
  avatar_banner?: string | null;
  avatar_effect?: string | null;
  avatar_effect_color?: string | null;
  avatar_effect_intensity?: number | null;
  avatar_effect_speed?: number | null;
  avatar_effect_saturation?: number | null;
  avatar_effect_size?: number | null;
  avatar_effect_alpha?: number | null;
  avatar_frame_intensity?: number | null;
  avatar_frame_color?: string | null;
  avatar_banner_opacity?: number | null;
  avatar_banner_speed?: number | null;
  featured_achievements?: string[] | null;
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
} & UserCosmetics;

export type LeaderboardEntry = {
  publisher_id: string;
  username: string;
  xp: number;
  level: number;
  title: string;
  achievements?: string[];
} & UserCosmetics;

export type PublicProfileData = {
  profile: UserProfile;
  publish_count: number;
  authored_conversations: CommunityConversation[];
};

export type ActiveEditorPresence = {
  count: number;
  users: ActiveEditorUser[];
  usernames: string[];
};

export type BugReportStatus = 'all' | 'open' | 'closed' | 'fixed';

export type EditorBugReport = {
  id: string;
  subject: string;
  message: string;
  author_username: string | null;
  author_publisher_id: string | null;
  status: Exclude<BugReportStatus, 'all'>;
  admin_reply: string;
  admin_publisher_id: string | null;
  admin_username: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BugReportsResponse = {
  reports: EditorBugReport[];
  viewer_can_admin: boolean;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TABLE = 'community_conversations';
const SUPPORT_TABLE = 'creator_support_metrics';
const ACTIVE_USERS_TABLE = 'creator_active_users';
const STREAKS_TABLE = 'user_streaks';
const MISSIONS_TABLE = 'user_mission_progress';
const BUG_REPORTS_TABLE = 'editor_bug_reports';
const ROADMAP_TABLE = 'roadmap_items';
const ROADMAP_UPVOTES_TABLE = 'roadmap_upvotes';
const SUPPORT_ROW_ID = 'global';
const LOCAL_PUBLISH_COOLDOWN_MS = 60_000;
const LOCAL_ROADMAP_UPVOTES_KEY = 'panda-roadmap-upvotes';
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

export function getLocalPublisherId(): string {
  return getPublisherId();
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

export async function publishConversation(payload: PublishPayload): Promise<PublishConversationResult> {
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
        // Replacements do not award publish-rewards (they are for existing
        // conversations). Return the conversation id if the server surfaced
        // one, otherwise omit so callers know no rewards were applied.
        const replaceJson = await res.json().catch(() => ({}));
        return {
          conversation_id: typeof replaceJson?.id === 'string' ? replaceJson.id : replaceId,
          rewards: null,
        };
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
      return { conversation_id: replaceId, rewards: null };
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to replace community conversation.');
  } else {
    // Try the proxy server first — this is where server-authoritative reward
    // evaluation happens. Fall back to direct Supabase for static-only
    // deployments where no proxy is reachable (GitHub Pages, etc.).
    let proxySucceeded = false;
    let proxyResult: PublishConversationResult | null = null;
    let lastProxyError: unknown = null;
    for (const url of apiCandidates('/api/conversations')) {
      try {
        const proxyRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(publishBody),
        });
        if (proxyRes.status === 404 || proxyRes.status === 405) {
          lastProxyError = new Error(`Proxy unavailable (${proxyRes.status})`);
          continue;
        }
        if (!proxyRes.ok) {
          const msg = await readErrorMessage(proxyRes).catch(() => `Publish failed (${proxyRes.status})`);
          if (proxyRes.status === 409) {
            throw new PublishValidationError('A community conversation with this title already exists.', 'duplicate-name');
          }
          throw new Error(msg);
        }
        const body = await proxyRes.json().catch(() => ({}));
        const rewards = body && typeof body === 'object' && 'rewards' in body ? (body as { rewards: ProfileRewardResult | null }).rewards : null;
        const conversationId = body && typeof body === 'object' && typeof (body as { conversation_id?: string }).conversation_id === 'string'
          ? (body as { conversation_id: string }).conversation_id
          : undefined;
        proxyResult = { conversation_id: conversationId, rewards };
        proxySucceeded = true;
        break;
      } catch (error) {
        if (error instanceof PublishValidationError) throw error;
        lastProxyError = error;
      }
    }

    if (proxySucceeded && proxyResult) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LOCAL_PUBLISH_KEY, String(Date.now()));
      }
      return proxyResult;
    }

    // Static-mode fallback: write directly to Supabase. No server rewards
    // are applied here; the client must rely on cached/local display state.
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
          if (lastProxyError) {
            // Surface the proxy error if Supabase also fails — it is usually
            // more actionable than the REST error string.
            throw lastProxyError instanceof Error ? lastProxyError : new Error(String(lastProxyError));
          }
          throw new Error(await readErrorMessage(res));
        }
      } else {
        if (lastProxyError instanceof PublishValidationError) throw lastProxyError;
        throw new Error(errorMessage);
      }
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCAL_PUBLISH_KEY, String(Date.now()));
    }
    return { conversation_id: undefined, rewards: null };
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

export type ActiveEditorUser = {
  userId: string;
  username: string | null;
  lastSeenAt: string;
  publisherId?: string | null;
};

export type RecentVisitor = {
  userId: string;
  username: string | null;
  lastSeenAt: string;
  firstSeenAt: string;
  publisherId?: string | null;
};

export function getActiveEditorLocalUserId(): string {
  return getActiveEditorPresenceUserId();
}

function getActiveEditorPresenceUserId(): string {
  return getStoredUsername() ? getPublisherId() : getOrCreateActiveEditorUserId();
}

function normalizeActivePresence(payload: unknown): ActiveEditorPresence {
  const count = payload && typeof payload === 'object' && typeof (payload as { count?: unknown }).count === 'number'
    ? Math.max(0, (payload as { count: number }).count)
    : 0;
  const users = normalizeActiveUsers(payload);
  const usernames = Array.from(new Set([
    ...normalizeActiveUsernames(payload),
    ...users.map(user => user.username ?? '').filter(Boolean),
  ]));
  return {
    count: Math.max(count, users.length),
    users,
    usernames,
  };
}

async function fetchActiveEditorUsersFromRpc(): Promise<ActiveEditorUser[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_active_creator_users`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        stale_after_seconds: ACTIVE_EDITOR_STALE_SECONDS,
      }),
    });
    if (!res.ok) throw new Error(`Failed to fetch active editor users (${res.status})`);
    const rows = await res.json() as Array<{ user_id: string; username: string | null; last_seen_at: string }> | null;
    if (!Array.isArray(rows)) return [];
    return enrichActiveUsersWithPublisherIds(rows.map(row => ({
      userId: row.user_id,
      username: row.username?.trim() ? row.username.trim() : null,
      lastSeenAt: row.last_seen_at,
    })));
  } catch {
    return [];
  }
}

export async function fetchActiveEditorPresence(): Promise<ActiveEditorPresence> {
  try {
    const payload = await fetchFromApi<unknown>('/api/active-users');
    const presence = normalizeActivePresence(payload);
    if (presence.count > 0 || presence.users.length > 0) return presence;
  } catch {
    // Fall through to direct Supabase reads.
  }

  const rpcUsers = await fetchActiveEditorUsersFromRpc();
  if (rpcUsers.length > 0) {
    return {
      count: rpcUsers.length,
      users: rpcUsers,
      usernames: rpcUsers.map(user => user.username ?? '').filter(Boolean),
    };
  }

  const tableUsers = await fetchActiveEditorUsersFromTable();
  return {
    count: tableUsers.length,
    users: tableUsers,
    usernames: tableUsers.map(user => user.username ?? '').filter(Boolean),
  };
}

export async function touchActiveEditorUser(): Promise<ActiveEditorPresence> {
  if (typeof window === 'undefined') return { count: 0, users: [], usernames: [] };
  const userId = getActiveEditorPresenceUserId();
  const username = getStoredUsername();

  // Prefer the API so presence persists even when the browser can't reach
  // Supabase directly (CORS, RLS, or missing RPC in self-hosted setups).
  try {
    const payload = await fetchFromApi<unknown>('/api/active-users/touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, username }),
    });
    const presence = normalizeActivePresence(payload);
    if (presence.count > 0 || presence.users.length > 0) return presence;
  } catch {
    // Fall through to direct Supabase RPC fallback.
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/touch_creator_active_user`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        active_user_id: userId,
        stale_after_seconds: ACTIVE_EDITOR_STALE_SECONDS,
        active_username: username,
      }),
    });
    if (!res.ok) throw new Error(`Failed to update active editor presence (${res.status})`);
    const count = await res.json() as number | null;
    const presence = await fetchActiveEditorPresence();
    return { ...presence, count: Math.max(typeof count === 'number' ? count : 0, presence.count) };
  } catch {
    return { count: 0, users: [], usernames: [] };
  }
}

export async function fetchActiveEditorUserCount(): Promise<number> {
  return (await fetchActiveEditorPresence()).count;
}

export async function fetchActiveEditorUsers(): Promise<ActiveEditorUser[]> {
  try {
    const payload = await fetchFromApi<unknown>('/api/active-users');
    const apiUsers = normalizeActiveUsers(payload);
    if (apiUsers.length > 0) return apiUsers;
  } catch {
    // Fall through to direct RPC fallback.
  }

  const rpcUsers = await fetchActiveEditorUsersFromRpc();
  return rpcUsers.length > 0 ? rpcUsers : fetchActiveEditorUsersFromTable();
}

function normalizeActiveUsers(payload: unknown): ActiveEditorUser[] {
  const entries = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray((payload as { users?: unknown }).users))
      ? (payload as { users: unknown[] }).users
      : (payload && typeof payload === 'object' && Array.isArray((payload as { usernames?: unknown }).usernames))
        ? (payload as { usernames: unknown[] }).usernames
        : [];

  const users: ActiveEditorUser[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    let userId = '';
    let username: string | null = null;
    let lastSeenAt = '';

    if (typeof entry === 'string') {
      username = entry.trim() || null;
      userId = username ? `username:${username.toLowerCase()}` : '';
    } else if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      const rawUserId = record.user_id ?? record.userId ?? record.id;
      const rawUsername = record.username ?? record.usernames ?? record.name;
      const rawLastSeen = record.last_seen_at ?? record.lastSeenAt ?? record.last_seen;
      const rawPublisherId = record.publisher_id ?? record.publisherId;
      userId = typeof rawUserId === 'string' ? rawUserId.trim() : '';
      username = typeof rawUsername === 'string' && rawUsername.trim() ? rawUsername.trim() : null;
      lastSeenAt = typeof rawLastSeen === 'string' ? rawLastSeen : '';
      const publisherId = typeof rawPublisherId === 'string' && rawPublisherId.trim() ? rawPublisherId.trim() : null;
      if (publisherId && !userId) userId = publisherId;
      if (publisherId) {
        if (seen.has(userId)) continue;
        seen.add(userId);
        users.push({ userId, username, lastSeenAt, publisherId });
        continue;
      }
    }

    if (!userId && username) userId = `username:${username.toLowerCase()}`;
    if (!userId) continue;
    if (seen.has(userId)) continue;
    seen.add(userId);
    users.push({ userId, username, lastSeenAt });
  }

  return users;
}

async function fetchActiveEditorUsersFromTable(limit = 50): Promise<ActiveEditorUser[]> {
  try {
    const cutoff = new Date(Date.now() - ACTIVE_EDITOR_STALE_SECONDS * 1000).toISOString();
    const params = new URLSearchParams({
      select: 'user_id,username,last_seen_at,created_at',
      last_seen_at: `gte.${cutoff}`,
      order: 'last_seen_at.desc',
      limit: String(limit),
    });
    const res = await fetch(`${sbEndpoint(ACTIVE_USERS_TABLE)}?${params}`, { headers: sbHeaders() });
    if (!res.ok) return [];
    const rows = await res.json() as Array<{ user_id: string; username: string | null; last_seen_at: string }> | null;
    if (!Array.isArray(rows)) return [];
    return enrichActiveUsersWithPublisherIds(rows.map(row => ({
      userId: row.user_id,
      username: row.username?.trim() ? row.username.trim() : null,
      lastSeenAt: row.last_seen_at,
    })));
  } catch {
    return [];
  }
}

async function fetchPublisherIdsByUsername(usernames: string[]): Promise<Map<string, string>> {
  const names = Array.from(new Set(usernames.map(name => name.trim()).filter(Boolean)));
  const profileIds = new Map<string, string>();
  if (names.length === 0) return profileIds;

  try {
    const params = new URLSearchParams({
      select: 'publisher_id,username',
      username: `in.(${names.map(name => `"${name.replace(/"/g, '')}"`).join(',')})`,
    });
    const res = await fetch(`${sbEndpoint('user_profiles')}?${params}`, { headers: sbHeaders() });
    if (!res.ok) return profileIds;
    const rows = await res.json() as Array<{ publisher_id?: string; username?: string }> | null;
    if (!Array.isArray(rows)) return profileIds;
    for (const row of rows) {
      if (row.username && row.publisher_id) {
        profileIds.set(row.username.trim().toLowerCase(), row.publisher_id.trim());
      }
    }
  } catch {
    // Best-effort enrichment only.
  }

  return profileIds;
}

async function enrichActiveUsersWithPublisherIds(users: ActiveEditorUser[]): Promise<ActiveEditorUser[]> {
  const profileIds = await fetchPublisherIdsByUsername(users.map(user => user.username ?? ''));
  return users.map(user => {
    const publisherId = user.publisherId ?? (user.username ? profileIds.get(user.username.toLowerCase()) : null);
    return publisherId ? { ...user, publisherId } : user;
  });
}

export async function fetchRecentVisitors(): Promise<RecentVisitor[]> {
  try {
    const payload = await fetchFromApi<unknown>('/api/visitors/recent');
    const visitors = normalizeRecentVisitors(payload);
    if (visitors.length > 0) return visitors;
  } catch {
    // Fall through to direct table read.
  }

  try {
    const params = new URLSearchParams({
      select: 'user_id,username,last_seen_at,created_at',
      order: 'last_seen_at.desc',
      limit: '100',
    });
    const res = await fetch(`${sbEndpoint('site_visitor_log')}?${params}`, { headers: sbHeaders() });
    if (!res.ok) return [];
    const rows = await res.json() as Array<{ user_id: string; username: string | null; last_seen_at: string; created_at: string }> | null;
    const visitors = normalizeRecentVisitors(rows ?? []);
    const profileIds = await fetchPublisherIdsByUsername(visitors.map(visitor => visitor.username ?? ''));
    return visitors.map(visitor => {
      const publisherId = visitor.publisherId ?? (visitor.username ? profileIds.get(visitor.username.toLowerCase()) : null);
      return publisherId ? { ...visitor, publisherId } : visitor;
    });
  } catch {
    return [];
  }
}

function normalizeRecentVisitors(payload: unknown): RecentVisitor[] {
  const entries = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray((payload as { visitors?: unknown }).visitors))
      ? (payload as { visitors: unknown[] }).visitors
      : [];

  return entries
    .map((entry): RecentVisitor | null => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const userId = typeof (record.user_id ?? record.userId ?? record.id) === 'string'
        ? String(record.user_id ?? record.userId ?? record.id).trim()
        : '';
      const username = typeof (record.username ?? record.name) === 'string' && String(record.username ?? record.name).trim()
        ? String(record.username ?? record.name).trim()
        : null;
      const lastSeenAt = typeof (record.last_seen_at ?? record.lastSeenAt ?? record.visited_at ?? record.visitedAt) === 'string'
        ? String(record.last_seen_at ?? record.lastSeenAt ?? record.visited_at ?? record.visitedAt)
        : '';
      const firstSeenAt = typeof (record.created_at ?? record.firstSeenAt) === 'string'
        ? String(record.created_at ?? record.firstSeenAt)
        : lastSeenAt;
      const publisherId = typeof (record.publisher_id ?? record.publisherId) === 'string' && String(record.publisher_id ?? record.publisherId).trim()
        ? String(record.publisher_id ?? record.publisherId).trim()
        : null;
      if (!userId && !username) return null;
      return { userId: userId || `username:${username?.toLowerCase()}`, username, lastSeenAt, firstSeenAt, publisherId };
    })
    .filter((visitor): visitor is RecentVisitor => Boolean(visitor))
    .slice(0, 10);
}

function isBugReportStatus(value: unknown): value is Exclude<BugReportStatus, 'all'> {
  return value === 'open' || value === 'closed' || value === 'fixed';
}

function normalizeBugReport(row: Record<string, unknown>): EditorBugReport | null {
  const id = typeof row.id === 'string' ? row.id : '';
  if (!id) return null;
  return {
    id,
    subject: typeof row.subject === 'string' ? row.subject : '',
    message: typeof row.message === 'string' ? row.message : '',
    author_username: typeof row.author_username === 'string' ? row.author_username : null,
    author_publisher_id: typeof row.author_publisher_id === 'string' ? row.author_publisher_id : null,
    status: isBugReportStatus(row.status) ? row.status : 'open',
    admin_reply: typeof row.admin_reply === 'string' ? row.admin_reply : '',
    admin_publisher_id: typeof row.admin_publisher_id === 'string' ? row.admin_publisher_id : null,
    admin_username: typeof row.admin_username === 'string' ? row.admin_username : null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : '',
  };
}

function normalizeBugReportsResponse(payload: unknown): BugReportsResponse {
  const records = payload && typeof payload === 'object' && Array.isArray((payload as { reports?: unknown }).reports)
    ? (payload as { reports: unknown[] }).reports
    : Array.isArray(payload)
      ? payload
      : [];
  const reports = records
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map(normalizeBugReport)
    .filter((report): report is EditorBugReport => Boolean(report));
  const viewerCanAdmin = Boolean(payload && typeof payload === 'object' && (payload as { viewer_can_admin?: unknown }).viewer_can_admin);
  return { reports, viewer_can_admin: viewerCanAdmin };
}

export async function fetchBugReports(status: BugReportStatus = 'all', viewerPublisherId = getPublisherId()): Promise<BugReportsResponse> {
  const normalizedStatus = isBugReportStatus(status) ? status : 'all';
  const query = new URLSearchParams({
    status: normalizedStatus,
    viewer_publisher_id: viewerPublisherId,
  });

  try {
    return normalizeBugReportsResponse(await fetchFromApi<unknown>(`/api/bug-reports?${query}`));
  } catch {
    const params = new URLSearchParams({
      select: 'id,subject,message,author_username,author_publisher_id,status,admin_reply,admin_publisher_id,admin_username,metadata,created_at,updated_at',
      order: 'updated_at.desc',
      limit: '100',
    });
    if (normalizedStatus !== 'all') params.set('status', `eq.${normalizedStatus}`);
    try {
      const res = await fetch(`${sbEndpoint(BUG_REPORTS_TABLE)}?${params}`, { headers: sbHeaders() });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      return normalizeBugReportsResponse(await res.json());
    } catch {
      return { reports: [], viewer_can_admin: false };
    }
  }
}

export async function submitBugReport(payload: {
  subject: string;
  message: string;
  author_username?: string | null;
  author_publisher_id?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<EditorBugReport | null> {
  try {
    const response = await fetchFromApi<{ report?: unknown }>('/api/bug-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.report && typeof response.report === 'object'
      ? normalizeBugReport(response.report as Record<string, unknown>)
      : null;
  } catch {
    const body = {
      subject: payload.subject.trim().slice(0, 120),
      message: payload.message.trim().slice(0, 2500),
      author_username: payload.author_username?.trim() || null,
      author_publisher_id: payload.author_publisher_id?.trim() || null,
      metadata: payload.metadata ?? {},
    };
    const res = await fetch(sbEndpoint(BUG_REPORTS_TABLE), {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify([body]),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    const rows = await res.json() as Array<Record<string, unknown>>;
    return rows[0] ? normalizeBugReport(rows[0]) : null;
  }
}

export async function updateBugReportAdmin(
  reportId: string,
  payload: {
    publisher_id: string;
    username?: string | null;
    status: Exclude<BugReportStatus, 'all'>;
    admin_reply: string;
  },
): Promise<EditorBugReport | null> {
  try {
    const response = await fetchFromApi<{ report?: unknown }>(`/api/bug-reports/${encodeURIComponent(reportId)}/admin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.report && typeof response.report === 'object'
      ? normalizeBugReport(response.report as Record<string, unknown>)
      : null;
  } catch (err) {
    if (!isProxyUnavailableError(err)) throw err;
  }
  const updateBody: Record<string, unknown> = {
    admin_publisher_id: payload.publisher_id,
    admin_username: payload.username ?? null,
    admin_reply: payload.admin_reply,
    status: payload.status,
  };
  const params = new URLSearchParams({
    id: `eq.${reportId}`,
    select: 'id,subject,message,author_username,author_publisher_id,status,admin_reply,admin_publisher_id,admin_username,metadata,created_at,updated_at',
  });
  const res = await fetch(`${sbEndpoint(BUG_REPORTS_TABLE)}?${params}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(updateBody),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const rows = await res.json() as Array<Record<string, unknown>>;
  return rows[0] ? normalizeBugReport(rows[0]) : null;
}

export async function deleteBugReport(
  reportId: string,
  publisherId: string,
): Promise<void> {
  try {
    await fetchFromApi<unknown>(`/api/bug-reports/${encodeURIComponent(reportId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publisher_id: publisherId }),
    });
    return;
  } catch (err) {
    if (!isProxyUnavailableError(err)) throw err;
  }
  const params = new URLSearchParams({ id: `eq.${reportId}` });
  const res = await fetch(`${sbEndpoint(BUG_REPORTS_TABLE)}?${params}`, {
    method: 'DELETE',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

function normalizeActiveUsernames(payload: unknown): string[] {
  const entries = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray((payload as { usernames?: unknown }).usernames))
      ? (payload as { usernames: unknown[] }).usernames
      : [];

  const usernames = entries
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        const candidate = record.username ?? record.usernames ?? record.name;
        return typeof candidate === 'string' ? candidate.trim() : '';
      }
      return '';
    })
    .filter(Boolean);

  return Array.from(new Set(usernames));
}

export async function fetchActiveEditorUsernames(): Promise<string[]> {
  try {
    const response = await fetchFromApi<{ usernames?: string[] } | string[]>('/api/active-users');
    const apiNames = normalizeActiveUsernames(response);
    const users = await fetchActiveEditorUsers();
    const directNames = Array.from(new Set(users.map(user => user.username?.trim() ?? '').filter(Boolean)));
    const merged = Array.from(new Set([...apiNames, ...directNames]));
    if (merged.length > 0) return merged;
  } catch {
    // Fall through to direct RPC fallback.
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_active_creator_usernames`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        stale_after_seconds: ACTIVE_EDITOR_STALE_SECONDS,
      }),
    });
    if (!res.ok) return [];
    const payload = await res.json() as unknown;
    return normalizeActiveUsernames(payload);
  } catch {
    return [];
  }
}

export function startActiveEditorPresenceTracking(onUpdate: (presence: ActiveEditorPresence) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let stopped = false;
  let timer: number | null = null;

  const ping = async (): Promise<void> => {
    const presence = await touchActiveEditorUser();
    if (!stopped) onUpdate(presence);
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

export async function updateUserCosmetics(publisherId: string, cosmetics: UserCosmetics): Promise<UserProfile | null> {
  const body = {
    avatar_icon: cosmetics.avatar_icon ?? null,
    avatar_color: cosmetics.avatar_color ?? null,
    avatar_frame: cosmetics.avatar_frame ?? null,
    avatar_banner: cosmetics.avatar_banner ?? null,
    avatar_effect: cosmetics.avatar_effect ?? null,
    avatar_effect_color: cosmetics.avatar_effect_color ?? null,
    avatar_effect_intensity: cosmetics.avatar_effect_intensity ?? null,
    avatar_effect_speed: cosmetics.avatar_effect_speed ?? null,
    avatar_effect_saturation: cosmetics.avatar_effect_saturation ?? null,
    avatar_effect_size: cosmetics.avatar_effect_size ?? null,
    avatar_effect_alpha: cosmetics.avatar_effect_alpha ?? null,
    avatar_frame_intensity: cosmetics.avatar_frame_intensity ?? null,
    avatar_frame_color: cosmetics.avatar_frame_color ?? null,
    avatar_banner_opacity: cosmetics.avatar_banner_opacity ?? null,
    avatar_banner_speed: cosmetics.avatar_banner_speed ?? null,
    featured_achievements: cosmetics.featured_achievements ?? null,
  };

  // 1. Try the proxy API (server-authoritative, handles auth/RLS).
  try {
    return await fetchFromApi<UserProfile | null>(`/api/profile/${encodeURIComponent(publisherId)}/cosmetics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch { /* fall through */ }

  // 2. Try Supabase RPC (may not exist in all deployments).
  try {
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_user_cosmetics`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        p_publisher_id: publisherId,
        p_avatar_icon: body.avatar_icon,
        p_avatar_color: body.avatar_color,
        p_avatar_frame: body.avatar_frame,
        p_avatar_frame_color: body.avatar_frame_color,
        p_avatar_frame_intensity: body.avatar_frame_intensity,
        p_avatar_banner: body.avatar_banner,
        p_avatar_banner_opacity: body.avatar_banner_opacity,
        p_avatar_banner_speed: body.avatar_banner_speed,
        p_avatar_effect: body.avatar_effect,
        p_avatar_effect_color: body.avatar_effect_color,
        p_avatar_effect_intensity: body.avatar_effect_intensity,
        p_avatar_effect_speed: body.avatar_effect_speed,
        p_avatar_effect_saturation: body.avatar_effect_saturation,
        p_avatar_effect_size: body.avatar_effect_size,
        p_avatar_effect_alpha: body.avatar_effect_alpha,
      }),
    });
    if (rpcRes.ok) {
      const rows = await rpcRes.json() as UserProfile[] | UserProfile | null;
      if (rows) return Array.isArray(rows) ? rows[0] ?? null : rows;
    }
  } catch { /* fall through */ }

  // 3. Fallback: direct PATCH to the user_profiles table.
  // Works in static deployments where neither proxy nor RPC is available.
  try {
    const patchRes = await fetch(
      `${sbEndpoint('user_profiles')}?publisher_id=eq.${encodeURIComponent(publisherId)}`,
      {
        method: 'PATCH',
        headers: { ...sbHeaders(), Prefer: 'return=representation' },
        body: JSON.stringify(body),
      },
    );
    if (!patchRes.ok) return null;
    const rows = await patchRes.json() as UserProfile[] | UserProfile | null;
    if (!rows) return null;
    return Array.isArray(rows) ? rows[0] ?? null : rows;
  } catch {
    return null;
  }
}

export async function updateFeaturedAchievements(publisherId: string, achievementIds: string[]): Promise<UserProfile | null> {
  const clamped = achievementIds.slice(0, 5);
  return updateUserCosmetics(publisherId, { featured_achievements: clamped });
}

export async function registerUsername(publisherId: string, username: string, password?: string): Promise<UserProfile> {
  try {
    const profile = await fetchFromApi<UserProfile>('/api/profile/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publisher_id: publisherId, username, password }),
    });
    setStoredUsername(username);
    return profile;
  } catch (apiError) {
    // Fallback to direct Supabase RPC
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_username`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_publisher_id: publisherId, p_username: username, p_password: password ?? null }),
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

export type AchievementUnlockStat = {
  achievementId: string;
  unlockCount: number;
  totalUsers: number;
  percent: number;
};

let _achievementStatsCache: Map<string, AchievementUnlockStat> | null = null;
let _achievementStatsCacheAt = 0;
const ACHIEVEMENT_STATS_TTL_MS = 5 * 60 * 1000;

export async function fetchAchievementUnlockStats(): Promise<Map<string, AchievementUnlockStat>> {
  if (_achievementStatsCache && Date.now() - _achievementStatsCacheAt < ACHIEVEMENT_STATS_TTL_MS) {
    return _achievementStatsCache;
  }

  const normalize = (rows: Array<Record<string, unknown>>): Map<string, AchievementUnlockStat> => {
    const out = new Map<string, AchievementUnlockStat>();
    for (const row of rows) {
      const id = String(row.achievement_id ?? row.achievementId ?? '').trim();
      if (!id) continue;
      const unlockCount = Number(row.unlock_count ?? row.unlockCount ?? 0);
      const totalUsers = Number(row.total_users ?? row.totalUsers ?? 0);
      const percent = totalUsers > 0 ? (unlockCount / totalUsers) * 100 : Number(row.percent ?? 0);
      out.set(id, { achievementId: id, unlockCount, totalUsers, percent });
    }
    return out;
  };

  try {
    const payload = await fetchFromApi<Array<Record<string, unknown>>>('/api/achievements/stats');
    const map = normalize(payload ?? []);
    _achievementStatsCache = map;
    _achievementStatsCacheAt = Date.now();
    return map;
  } catch {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_achievement_unlock_stats`, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const rows = await res.json() as Array<Record<string, unknown>>;
        const map = normalize(rows ?? []);
        _achievementStatsCache = map;
        _achievementStatsCacheAt = Date.now();
        return map;
      }
    } catch {
      // Swallow — caller gets empty map and handles gracefully.
    }
  }

  _achievementStatsCache = new Map();
  _achievementStatsCacheAt = Date.now();
  return _achievementStatsCache;
}

export async function unlockAchievement(publisherId: string, achievementId: string): Promise<boolean> {
  try {
    const response = await fetchFromApi<{ unlocked: boolean }>(`/api/profile/${encodeURIComponent(publisherId)}/achievements/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievement_id: achievementId }),
    });
    if (response.unlocked) _achievementStatsCache = null;
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
      const unlocked = Array.isArray(payload) ? Boolean(payload[0]) : Boolean(payload);
      if (unlocked) _achievementStatsCache = null;
      return unlocked;
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

// ════════════════════════════════════════════════════════════════════════════
// ROADMAP
// ════════════════════════════════════════════════════════════════════════════

export type RoadmapStatus = 'development' | 'planned' | 'considering' | 'completed' | 'dropped';
export type RoadmapCategory = 'feature' | 'improvement' | 'community' | 'bug';

export type RoadmapItem = {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  category: RoadmapCategory;
  priority: number;
  upvotes: number;
  created_at: string;
  updated_at: string;
};

function getLocalUpvotedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(LOCAL_ROADMAP_UPVOTES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveLocalUpvotedId(itemId: string): void {
  try {
    const ids = getLocalUpvotedIds();
    ids.add(itemId);
    window.localStorage.setItem(LOCAL_ROADMAP_UPVOTES_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

export function hasUpvotedRoadmapItem(itemId: string, publisherId: string | null): boolean {
  if (getLocalUpvotedIds().has(itemId)) return true;
  return false;
}

export async function fetchRoadmapItems(): Promise<RoadmapItem[]> {
  try {
    return await fetchFromApi<RoadmapItem[]>('/api/roadmap');
  } catch {
    try {
      const params = new URLSearchParams({
        select: 'id,title,description,status,category,priority,upvotes,created_at,updated_at',
        order: 'priority.desc,created_at.asc',
      });
      const res = await fetch(`${sbEndpoint(ROADMAP_TABLE)}?${params}`, { headers: sbHeaders() });
      if (!res.ok) return [];
      return await res.json() as RoadmapItem[];
    } catch {
      return [];
    }
  }
}

export async function upvoteRoadmapItem(itemId: string, publisherId: string | null): Promise<void> {
  saveLocalUpvotedId(itemId);
  try {
    await sendToApi(`/api/roadmap/${encodeURIComponent(itemId)}/upvote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publisher_id: publisherId }),
    });
    return;
  } catch { /* fallthrough to direct Supabase */ }

  try {
    const res = await fetch(`${sbEndpoint(ROADMAP_TABLE)}?id=eq.${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ upvotes: { raw: 'upvotes + 1' } }),
    });
    if (!res.ok) {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_roadmap_upvote`, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({ p_item_id: itemId }),
      });
    }
  } catch { /* best-effort */ }
}

function isProxyUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : '';
  return msg.includes('(405)') || msg.includes('(404)') || msg.startsWith('Unable to reach API endpoint');
}

export async function createRoadmapItem(
  payload: Omit<RoadmapItem, 'id' | 'upvotes' | 'created_at' | 'updated_at'>,
): Promise<RoadmapItem> {
  try {
    return await fetchFromApi<RoadmapItem>('/api/roadmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, publisher_id: getPublisherId() }),
    });
  } catch (err) {
    if (!isProxyUnavailableError(err)) throw err;
  }
  const res = await fetch(sbEndpoint(ROADMAP_TABLE), {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const rows = await res.json() as RoadmapItem[];
  if (!rows[0]) throw new Error('Failed to create roadmap item.');
  return rows[0];
}

export async function updateRoadmapItem(
  itemId: string,
  payload: Partial<Omit<RoadmapItem, 'id' | 'upvotes' | 'created_at' | 'updated_at'>>,
): Promise<RoadmapItem> {
  try {
    return await fetchFromApi<RoadmapItem>(`/api/roadmap/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, publisher_id: getPublisherId() }),
    });
  } catch (err) {
    if (!isProxyUnavailableError(err)) throw err;
  }
  const res = await fetch(`${sbEndpoint(ROADMAP_TABLE)}?id=eq.${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const rows = await res.json() as RoadmapItem[];
  if (!rows[0]) throw new Error('Failed to update roadmap item.');
  return rows[0];
}

export async function deleteRoadmapItem(itemId: string): Promise<void> {
  try {
    await sendToApi(`/api/roadmap/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publisher_id: getPublisherId() }),
    });
    return;
  } catch (err) {
    if (!isProxyUnavailableError(err)) throw err;
  }
  const res = await fetch(`${sbEndpoint(ROADMAP_TABLE)}?id=eq.${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}

// ════════════════════════════════════════════════════════════════════════════
// PASSWORD LOGIN
// ════════════════════════════════════════════════════════════════════════════

export async function loginWithPassword(username: string, password: string): Promise<UserProfile> {
  try {
    return await fetchFromApi<UserProfile>('/api/profile/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch (apiError) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/login_user`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_username: username, p_password: password }),
    });
    if (!res.ok) {
      const msg = await readErrorMessage(res);
      throw new Error(msg);
    }
    const rows = await res.json() as UserProfile[] | UserProfile | null;
    if (!rows) throw new Error('Invalid username or password.');
    const profile = Array.isArray(rows) ? rows[0] : rows;
    if (!profile) throw new Error('Invalid username or password.');
    return profile;
  }
}
