// P.A.N.D.A. Community Library — API Server
// Thin proxy that keeps Supabase credentials server-side.

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
const TABLE = 'community_conversations';
const COLLAB_TABLE = 'collab_sessions';
const SUPPORT_TABLE = 'creator_support_metrics';
const ACTIVE_USERS_TABLE = 'creator_active_users';
const PROFILES_TABLE = 'user_profiles';
const STREAKS_TABLE = 'user_streaks';
const MISSIONS_TABLE = 'user_mission_progress';
const BUG_REPORTS_TABLE = 'editor_bug_reports';
const SUPPORT_ROW_ID = 'global';
const ADMIN_PUBLISHER_IDS = new Set(
  (process.env.ADMIN_PUBLISHER_IDS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean),
);
const COMMUNITY_REQUIRED_COLUMNS = ['id', 'faction', 'label', 'description', 'author', 'data', 'downloads', 'created_at'] as const;
const COMMUNITY_OPTIONAL_COLUMNS = ['summary', 'tags', 'branch_count', 'complexity', 'upvotes', 'updated_at', 'publisher_id', 'co_authors', 'co_author_usernames'] as const;

type CommunityLibraryStats = {
  published_conversations: number;
  published_publishers: number;
  updated_at: string;
};

type UserAchievement = {
  achievement_id: string;
  unlocked_at: string;
};

type UserStreakState = {
  publish_streak: number;
  longest_streak: number;
  last_publish_week: string;
  login_streak: number;
  last_login_date: string;
  updated_at?: string;
};

type LeaderboardEntry = {
  publisher_id: string;
  username: string;
  xp: number;
  level: number;
  title: string;
  achievements?: string[];
  avatar_icon?: string | null;
  avatar_color?: string | null;
  avatar_frame?: string | null;
  avatar_banner?: string | null;
  avatar_effect?: string | null;
};

type PublicProfileData = {
  profile: Record<string, unknown>;
  publish_count: number;
  authored_conversations: ReturnType<typeof normalizeConversationRow>[];
};

type BugReportStatus = 'open' | 'closed' | 'fixed';

type EditorBugReport = {
  id: string;
  subject: string;
  message: string;
  author_username: string | null;
  author_publisher_id: string | null;
  status: BugReportStatus;
  admin_reply: string;
  admin_publisher_id: string | null;
  admin_username: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type MissionSlot = 'daily_easy' | 'daily_medium' | 'daily_hard' | 'weekly';
type MissionCadence = 'daily' | 'weekly';
type MissionCategory = 'publishing' | 'faction' | 'outcomes' | 'preconditions' | 'community';
type MissionEventType = 'upvote_received' | 'download_milestone_reached';

type UserMissionProgressRecord = {
  mission_id: string;
  mission_slot: MissionSlot;
  cadence: MissionCadence;
  category: MissionCategory;
  progress: number;
  goal: number;
  period_key: string;
  completed_at: string | null;
  meta?: Record<string, unknown> | null;
  updated_at?: string;
};

type MissionDefinition = {
  id: string;
  slot: MissionSlot;
  cadence: MissionCadence;
  category: MissionCategory;
  goal: number;
  xp: number;
  evaluateProgress: (event: { type: MissionEventType; total: number }, state: UserMissionProgressRecord) => number;
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment.');
  console.error('Copy server/.env.example to server/.env and fill in your values.');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

function sbHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_KEY!,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY!}`,
    'Content-Type': 'application/json',
  };
}

function sbEndpoint(path: string): string {
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
  return body.message ?? body.error ?? `Database error: ${res.status} ${res.statusText}`;
}

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, c => `\\${c}`);
}

function normalizeConversationRow(row: Record<string, unknown>) {
  return {
    publisher_id: typeof row.publisher_id === 'string' ? row.publisher_id : '',
    co_authors: Array.isArray(row.co_authors) ? row.co_authors.filter((id): id is string => typeof id === 'string') : [],
    co_author_usernames: Array.isArray(row.co_author_usernames) ? row.co_author_usernames.filter((name): name is string => typeof name === 'string') : [],
    id: typeof row.id === 'string' ? row.id : '',
    faction: typeof row.faction === 'string' ? row.faction : '',
    label: typeof row.label === 'string' ? row.label : '',
    description: typeof row.description === 'string' ? row.description : '',
    summary: typeof row.summary === 'string' ? row.summary : '',
    author: typeof row.author === 'string' ? row.author : 'Anonymous',
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    branch_count: typeof row.branch_count === 'number' ? row.branch_count : 0,
    complexity: typeof row.complexity === 'string' ? row.complexity : null,
    downloads: typeof row.downloads === 'number' ? row.downloads : 0,
    upvotes: typeof row.upvotes === 'number' ? row.upvotes : 0,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updated_at: typeof row.updated_at === 'string'
      ? row.updated_at
      : typeof row.created_at === 'string'
        ? row.created_at
        : new Date(0).toISOString(),
    data: row.data ?? null,
  };
}

type CollabSessionRow = {
  id: string;
  host_publisher_id: string;
  conversation_id: number;
  conversation_label: string;
  participants: string[];
  participant_usernames: string[];
  status: 'open' | 'closed' | 'published';
  snapshot: unknown;
  snapshot_version: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  max_users: number;
  guest_edit_count: number;
  last_guest_edit_at: string | null;
};

function normalizeCollabSessionRow(row: Record<string, unknown>): CollabSessionRow {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    host_publisher_id: typeof row.host_publisher_id === 'string' ? row.host_publisher_id : '',
    conversation_id: typeof row.conversation_id === 'number' ? row.conversation_id : Number(row.conversation_id ?? 0),
    conversation_label: typeof row.conversation_label === 'string' ? row.conversation_label : '',
    participants: Array.isArray(row.participants) ? row.participants.filter((id): id is string => typeof id === 'string') : [],
    participant_usernames: Array.isArray(row.participant_usernames)
      ? row.participant_usernames.filter((name): name is string => typeof name === 'string')
      : [],
    status: row.status === 'closed' || row.status === 'published' ? row.status : 'open',
    snapshot: row.snapshot ?? null,
    snapshot_version: typeof row.snapshot_version === 'number' ? row.snapshot_version : 0,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
    closed_at: typeof row.closed_at === 'string' ? row.closed_at : null,
    max_users: typeof row.max_users === 'number' ? row.max_users : 2,
    guest_edit_count: typeof row.guest_edit_count === 'number' ? row.guest_edit_count : 0,
    last_guest_edit_at: typeof row.last_guest_edit_at === 'string' ? row.last_guest_edit_at : null,
  };
}

function sanitizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean) : [];
}

function normalizeUserStreak(row: Record<string, unknown> | null | undefined): UserStreakState | null {
  if (!row) return null;
  return {
    publish_streak: typeof row.publish_streak === 'number' ? row.publish_streak : 0,
    longest_streak: typeof row.longest_streak === 'number' ? row.longest_streak : 0,
    last_publish_week: typeof row.last_publish_week === 'string' ? row.last_publish_week : '',
    login_streak: typeof row.login_streak === 'number' ? row.login_streak : 0,
    last_login_date: typeof row.last_login_date === 'string' ? row.last_login_date : '',
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
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

function normalizeMissionRow(row: Record<string, unknown>): UserMissionProgressRecord {
  return {
    mission_id: typeof row.mission_id === 'string' ? row.mission_id : '',
    mission_slot: (typeof row.mission_slot === 'string' ? row.mission_slot : 'daily_easy') as MissionSlot,
    cadence: (typeof row.cadence === 'string' ? row.cadence : 'daily') as MissionCadence,
    category: (typeof row.category === 'string' ? row.category : 'community') as MissionCategory,
    progress: typeof row.progress === 'number' ? row.progress : 0,
    goal: typeof row.goal === 'number' ? row.goal : 1,
    period_key: typeof row.period_key === 'string' ? row.period_key : '',
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
    meta: row.meta && typeof row.meta === 'object' ? row.meta as Record<string, unknown> : {},
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
}

function normalizeActiveUsernamePayload(payload: unknown): string[] {
  const entries = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray((payload as { usernames?: unknown }).usernames))
      ? (payload as { usernames: unknown[] }).usernames
      : [];

  return Array.from(new Set(entries
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        const candidate = record.username ?? record.usernames ?? record.name;
        return typeof candidate === 'string' ? candidate.trim() : '';
      }
      return '';
    })
    .filter(Boolean)));
}

async function fetchPublisherIdsByUsername(usernames: string[]): Promise<Map<string, string>> {
  const names = Array.from(new Set(usernames.map(name => name.trim()).filter(Boolean)));
  const ids = new Map<string, string>();
  if (names.length === 0) return ids;

  const params = new URLSearchParams({
    select: 'publisher_id,username',
    username: `in.(${names.map(name => `"${name.replace(/"/g, '')}"`).join(',')})`,
  });
  const response = await fetch(`${sbEndpoint(PROFILES_TABLE)}?${params}`, { headers: sbHeaders() });
  if (!response.ok) return ids;
  const rows = await response.json() as Array<{ publisher_id?: string; username?: string }>;
  for (const row of rows) {
    const username = row.username?.trim().toLowerCase();
    const publisherId = row.publisher_id?.trim();
    if (username && publisherId) ids.set(username, publisherId);
  }
  return ids;
}

function isBugReportStatus(value: unknown): value is BugReportStatus {
  return value === 'open' || value === 'closed' || value === 'fixed';
}

function isAdminPublisherId(value: unknown): boolean {
  return typeof value === 'string' && ADMIN_PUBLISHER_IDS.has(value.trim());
}

async function verifyIsAdmin(publisherId: string): Promise<boolean> {
  const trimmed = publisherId.trim();
  if (!trimmed) return false;
  if (ADMIN_PUBLISHER_IDS.size > 0) return ADMIN_PUBLISHER_IDS.has(trimmed);
  try {
    const params = new URLSearchParams({
      publisher_id: `eq.${trimmed}`,
      select: 'username',
      limit: '1',
    });
    const res = await fetch(`${sbEndpoint(PROFILES_TABLE)}?${params}`, { headers: sbHeaders() });
    if (!res.ok) return false;
    const rows = await res.json() as Array<{ username?: string }>;
    if (!Array.isArray(rows) || rows.length === 0) return false;
    return (rows[0].username ?? '').toLowerCase() === 'panda';
  } catch {
    return false;
  }
}

function normalizeBugReport(row: Record<string, unknown>): EditorBugReport {
  return {
    id: typeof row.id === 'string' ? row.id : '',
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

function sanitizeBugReportText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function createCommunityMission(slot: MissionSlot, goal: number, xp: number, type: MissionEventType): MissionDefinition {
  return {
    id: `${slot}-${type === 'upvote_received' ? 'upvotes' : 'downloads'}-${goal}`,
    slot,
    cadence: slot === 'weekly' ? 'weekly' : 'daily',
    category: 'community',
    goal,
    xp,
    evaluateProgress: (event, state) => {
      if (event.type !== type) return 0;
      const absolute = Math.min(event.total, goal);
      return Math.max(0, absolute - state.progress);
    },
  };
}

const SERVER_MISSION_POOLS: Record<MissionSlot, MissionDefinition[]> = {
  daily_easy: [
    createCommunityMission('daily_easy', 1, 20, 'upvote_received'),
    createCommunityMission('daily_easy', 5, 20, 'download_milestone_reached'),
  ],
  daily_medium: [
    createCommunityMission('daily_medium', 10, 35, 'download_milestone_reached'),
  ],
  daily_hard: [],
  weekly: [
    createCommunityMission('weekly', 25, 100, 'download_milestone_reached'),
    createCommunityMission('weekly', 5, 100, 'upvote_received'),
  ],
};

function getMissionSeed(periodKey: string, slot: MissionSlot): number {
  const seedSource = `${periodKey}:${slot}`;
  let seed = 0;
  for (let i = 0; i < seedSource.length; i += 1) {
    seed += seedSource.charCodeAt(i) * (i + 1);
  }
  return seed;
}

function getActiveMissionDefinitions(date = new Date()): MissionDefinition[] {
  return (Object.keys(SERVER_MISSION_POOLS) as MissionSlot[])
    .map((slot) => {
      const pool = SERVER_MISSION_POOLS[slot];
      if (pool.length === 0) return null;
      const periodKey = slot === 'weekly' ? getIsoWeek(date) : getTodayDateString(date);
      return pool[getMissionSeed(periodKey, slot) % pool.length];
    })
    .filter((mission): mission is MissionDefinition => Boolean(mission));
}

async function fetchUserMissionProgress(publisherId: string): Promise<UserMissionProgressRecord[]> {
  const periodKeys = [getTodayDateString(), getIsoWeek(new Date())];
  const params = new URLSearchParams({
    select: 'mission_id,mission_slot,cadence,category,progress,goal,period_key,completed_at,meta,updated_at',
    publisher_id: `eq.${publisherId}`,
    order: 'updated_at.desc',
  });
  params.set('period_key', `in.(${periodKeys.map(key => `"${key}"`).join(',')})`);
  const r = await fetch(`${sbEndpoint(MISSIONS_TABLE)}?${params}`, { headers: sbHeaders() });
  if (!r.ok) {
    throw new Error(await readErrorMessage(r));
  }
  const rows = await r.json() as Array<Record<string, unknown>>;
  return rows.map(normalizeMissionRow);
}

async function upsertMissionProgress(records: Array<UserMissionProgressRecord & { publisher_id: string }>): Promise<void> {
  if (records.length === 0) return;
  const r = await fetch(sbEndpoint(MISSIONS_TABLE), {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(records.map(record => ({
      ...record,
      meta: record.meta ?? {},
    }))),
  });
  if (!r.ok) {
    throw new Error(await readErrorMessage(r));
  }
}

type RewardProfileSnapshot = {
  publisher_id: string;
  username: string;
  xp: number;
  level: number;
  title: string;
};

export type ServerProfileRewardResult = {
  profile: RewardProfileSnapshot | null;
  unlocked: UserAchievement[];
  publish_xp: number;
  achievement_xp: number;
  mission_xp: number;
  total_xp: number;
};

async function applyPublishRewards(conversationId: string): Promise<ServerProfileRewardResult | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/apply_publish_rewards`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ p_conversation_id: conversationId }),
  });
  if (!r.ok) return null;
  const rows = await r.json() as Array<Record<string, unknown>>;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;

  const unlockedRaw = Array.isArray(row.newly_unlocked) ? row.newly_unlocked as Array<Record<string, unknown>> : [];
  const unlocked: UserAchievement[] = unlockedRaw
    .map((entry) => typeof entry?.achievement_id === 'string' ? ({
      achievement_id: String(entry.achievement_id),
      unlocked_at: new Date().toISOString(),
    }) : null)
    .filter((entry): entry is UserAchievement => Boolean(entry));

  const profile: RewardProfileSnapshot | null = typeof row.publisher_id === 'string' ? {
    publisher_id: String(row.publisher_id),
    username: typeof row.username === 'string' ? row.username : '',
    xp: typeof row.xp === 'number' ? row.xp : 0,
    level: typeof row.level === 'number' ? row.level : 1,
    title: typeof row.title === 'string' ? row.title : '',
  } : null;

  const publishXp = typeof row.publish_xp === 'number' ? row.publish_xp : 0;
  const achXp = typeof row.achievement_xp === 'number' ? row.achievement_xp : 0;
  return {
    profile,
    unlocked,
    publish_xp: publishXp,
    achievement_xp: achXp,
    mission_xp: 0,
    total_xp: publishXp + achXp,
  };
}

async function awardXpCappedBucket(
  publisherId: string,
  amount: number,
  bucket: string,
  dailyCap: number,
): Promise<ServerProfileRewardResult | null> {
  if (amount <= 0) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/award_xp_capped_bucket`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({
      p_publisher_id: publisherId,
      p_amount: amount,
      p_bucket: bucket,
      p_daily_cap: dailyCap,
    }),
  });
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []) as Array<Record<string, unknown>>;
  const row = Array.isArray(rows) ? rows[0] : null;
  return {
    profile: row && typeof row.publisher_id === 'string' ? {
      publisher_id: String(row.publisher_id),
      username: typeof row.username === 'string' ? row.username : '',
      xp: typeof row.xp === 'number' ? row.xp : 0,
      level: typeof row.level === 'number' ? row.level : 1,
      title: typeof row.title === 'string' ? row.title : '',
    } : null,
    unlocked: [],
    publish_xp: typeof row?.awarded === 'number' ? row.awarded : amount,
    achievement_xp: 0,
    mission_xp: 0,
    total_xp: typeof row?.awarded === 'number' ? row.awarded : amount,
  };
}

async function applyMetricRewards(publisherId: string, metricType: 'downloads' | 'upvotes' | 'both'): Promise<ServerProfileRewardResult | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/apply_metric_rewards`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ p_publisher_id: publisherId, p_metric_type: metricType }),
  });
  if (!r.ok) return null;
  const rows = await r.json() as Array<Record<string, unknown>>;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  const unlockedRaw = Array.isArray(row.newly_unlocked) ? row.newly_unlocked as Array<Record<string, unknown>> : [];
  const unlocked: UserAchievement[] = unlockedRaw
    .map((entry) => typeof entry?.achievement_id === 'string' ? ({
      achievement_id: String(entry.achievement_id),
      unlocked_at: new Date().toISOString(),
    }) : null)
    .filter((entry): entry is UserAchievement => Boolean(entry));
  const achXp = typeof row.achievement_xp === 'number' ? row.achievement_xp : 0;
  return {
    profile: null,
    unlocked,
    publish_xp: 0,
    achievement_xp: achXp,
    mission_xp: 0,
    total_xp: achXp,
  };
}

async function advanceCommunityMissionProgress(publisherId: string, event: { type: MissionEventType; total: number }): Promise<void> {
  const activeMissions = getActiveMissionDefinitions();
  if (activeMissions.length === 0) return;

  const existingRecords = await fetchUserMissionProgress(publisherId).catch((): UserMissionProgressRecord[] => []);
  const existingMap = new Map<string, UserMissionProgressRecord>(existingRecords.map((record): [string, UserMissionProgressRecord] => [`${record.mission_id}:${record.period_key}`, record]));
  const changed: Array<UserMissionProgressRecord & { publisher_id: string }> = [];

  for (const mission of activeMissions) {
    const periodKey = mission.cadence === 'weekly' ? getIsoWeek(new Date()) : getTodayDateString();
    const current: UserMissionProgressRecord = existingMap.get(`${mission.id}:${periodKey}`) ?? {
      mission_id: mission.id,
      mission_slot: mission.slot,
      cadence: mission.cadence,
      category: mission.category,
      progress: 0,
      goal: mission.goal,
      period_key: periodKey,
      completed_at: null,
      meta: {},
    };
    const increment = mission.evaluateProgress(event, current);
    if (increment <= 0) continue;

    const nextProgress = Math.min(mission.goal, current.progress + increment);
    changed.push({
      publisher_id: publisherId,
      ...current,
      progress: nextProgress,
      goal: mission.goal,
      completed_at: current.completed_at ?? (nextProgress >= mission.goal ? new Date().toISOString() : null),
      updated_at: new Date().toISOString(),
    });
  }

  await upsertMissionProgress(changed);
}

async function fetchUserAchievements(publisherId: string): Promise<UserAchievement[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_achievements`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ p_publisher_id: publisherId }),
  });
  if (!r.ok) {
    throw new Error(await readErrorMessage(r));
  }
  return await r.json() as UserAchievement[];
}

async function fetchUserStreakState(publisherId: string): Promise<UserStreakState | null> {
  const params = new URLSearchParams({
    select: 'publish_streak,longest_streak,last_publish_week,login_streak,last_login_date,updated_at',
    publisher_id: `eq.${publisherId}`,
    limit: '1',
  });
  const r = await fetch(`${sbEndpoint(STREAKS_TABLE)}?${params}`, { headers: sbHeaders() });
  if (!r.ok) {
    throw new Error(await readErrorMessage(r));
  }
  const rows = await r.json() as Array<Record<string, unknown>>;
  return normalizeUserStreak(rows[0]);
}

async function fetchUserPublishCount(publisherId: string): Promise<number> {
  const params = new URLSearchParams({
    select: 'id',
    publisher_id: `eq.${publisherId}`,
  });

  const headResponse = await fetch(`${sbEndpoint(TABLE)}?${params}`, {
    headers: { ...sbHeaders(), Prefer: 'count=exact' },
    method: 'HEAD',
  });

  if (headResponse.ok) {
    const contentRange = headResponse.headers.get('content-range');
    const match = contentRange?.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }

  const fallbackResponse = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
  if (!fallbackResponse.ok) {
    throw new Error(await readErrorMessage(fallbackResponse));
  }

  const rows = await fallbackResponse.json() as Array<Record<string, unknown>>;
  return rows.length;
}

async function fetchAuthoredConversations(publisherId: string) {
  const params = new URLSearchParams({
    select: ['publisher_id', ...COMMUNITY_REQUIRED_COLUMNS, ...COMMUNITY_OPTIONAL_COLUMNS].join(','),
    publisher_id: `eq.${publisherId}`,
    order: 'created_at.desc',
  });

  let response = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
  if (!response.ok) {
    const errorMessage = await readErrorMessage(response);
    if (isMissingSchemaColumnError(errorMessage, 'publisher_id')) {
      return [];
    }
    if (isCommunitySchemaMismatchError(errorMessage) || isMissingOptionalCommunityColumnError(errorMessage)) {
      const fallbackParams = new URLSearchParams({
        select: ['publisher_id', ...COMMUNITY_REQUIRED_COLUMNS].join(','),
        publisher_id: `eq.${publisherId}`,
        order: 'created_at.desc',
      });
      response = await fetch(`${sbEndpoint(TABLE)}?${fallbackParams}`, { headers: sbHeaders() });
      if (!response.ok) return [];
    } else {
      throw new Error(errorMessage);
    }
  }
  if (!response.ok) {
    const errorMessage = await readErrorMessage(response);
    throw new Error(errorMessage);
  }

  const rows = await response.json() as Array<Record<string, unknown>>;
  const coAuthorParams = new URLSearchParams({
    select: ['publisher_id', ...COMMUNITY_REQUIRED_COLUMNS, ...COMMUNITY_OPTIONAL_COLUMNS].join(','),
    co_authors: `cs.{${publisherId}}`,
    order: 'created_at.desc',
  });
  const coAuthorRows = await fetch(`${sbEndpoint(TABLE)}?${coAuthorParams}`, { headers: sbHeaders() })
    .then(async (coAuthorResponse) => {
      if (!coAuthorResponse.ok) return [] as Array<Record<string, unknown>>;
      return await coAuthorResponse.json() as Array<Record<string, unknown>>;
    })
    .catch(() => [] as Array<Record<string, unknown>>);
  const deduped = new Map<string, ReturnType<typeof normalizeConversationRow>>();
  for (const row of [...rows, ...coAuthorRows].map(normalizeConversationRow)) {
    deduped.set(row.id, row);
  }
  return Array.from(deduped.values()).sort((left, right) => {
    const leftTime = Date.parse(left.updated_at ?? left.created_at);
    const rightTime = Date.parse(right.updated_at ?? right.created_at);
    return rightTime - leftTime;
  });
}

async function fetchPublicProfileData(publisherId: string): Promise<PublicProfileData | null> {
  const [profile, publishCount, authoredConversations] = await Promise.all([
    fetchHydratedUserProfile(publisherId),
    fetchUserPublishCount(publisherId).catch(() => 0),
    fetchAuthoredConversations(publisherId).catch(() => []),
  ]);

  if (!profile) return null;

  return {
    profile,
    publish_count: Math.max(publishCount, authoredConversations.length),
    authored_conversations: authoredConversations,
  };
}

async function fetchHydratedUserProfile(publisherId: string) {
  const [profileResponse, achievements, streaks, missions] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_profile`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_publisher_id: publisherId }),
    }),
    fetchUserAchievements(publisherId).catch(() => []),
    fetchUserStreakState(publisherId).catch(() => null),
    fetchUserMissionProgress(publisherId).catch(() => []),
  ]);

  if (!profileResponse.ok) {
    throw new Error(await readErrorMessage(profileResponse));
  }

  const rows = await profileResponse.json();
  const profile = Array.isArray(rows) ? rows[0] : rows;
  if (!profile) return null;

  return {
    ...profile,
    avatar_icon: typeof profile.avatar_icon === 'string' ? profile.avatar_icon : null,
    avatar_color: typeof profile.avatar_color === 'string' ? profile.avatar_color : null,
    avatar_frame: typeof profile.avatar_frame === 'string' ? profile.avatar_frame : null,
    avatar_banner: typeof profile.avatar_banner === 'string' ? profile.avatar_banner : null,
    achievement_records: achievements,
    achievements: achievements.map(record => record.achievement_id),
    streaks,
    missions,
  };
}

app.get('/api/community/stats', async (_req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_community_library_stats`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({}),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }

    const payload = await r.json() as CommunityLibraryStats[] | CommunityLibraryStats | null;
    const stats = Array.isArray(payload) ? payload[0] : payload;
    res.json(stats ?? {
      published_conversations: 0,
      published_publishers: 0,
      updated_at: new Date(0).toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/conversations', async (req, res) => {
  try {
    const params = new URLSearchParams({
      select: [...COMMUNITY_REQUIRED_COLUMNS, ...COMMUNITY_OPTIONAL_COLUMNS].join(','),
      order: 'updated_at.desc',
    });
    const { faction } = req.query;
    if (typeof faction === 'string' && faction) {
      params.set('faction', `eq.${faction}`);
    }

    let r = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
    if (!r.ok) {
      const errorMessage = await readErrorMessage(r);
      if (!isCommunitySchemaMismatchError(errorMessage) && !isMissingOptionalCommunityColumnError(errorMessage)) {
        res.status(r.status).json({ error: errorMessage });
        return;
      }

      const fallbackParams = new URLSearchParams({
        select: COMMUNITY_REQUIRED_COLUMNS.join(','),
        order: 'created_at.desc',
      });
      if (typeof faction === 'string' && faction) {
        fallbackParams.set('faction', `eq.${faction}`);
      }

      r = await fetch(`${sbEndpoint(TABLE)}?${fallbackParams}`, { headers: sbHeaders() });
      if (!r.ok) {
        res.status(r.status).json({ error: await readErrorMessage(r) });
        return;
      }
    }
    const rows = await r.json() as Array<Record<string, unknown>>;
    res.json(rows.map(normalizeConversationRow));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});


app.get('/api/support/upvotes', async (_req, res) => {
  try {
    const params = new URLSearchParams({
      select: 'id,upvotes,visitors,updated_at',
      id: `eq.${SUPPORT_ROW_ID}`,
      limit: '1',
    });

    const r = await fetch(`${sbEndpoint(SUPPORT_TABLE)}?${params}`, { headers: sbHeaders() });
    if (!r.ok) {
      res.status(r.status).json({ error: `Database error: ${r.status} ${r.statusText}` });
      return;
    }

    const rows = await r.json() as Array<{ id: string; upvotes: number; updated_at: string }>;
    res.json(rows[0] ?? { id: SUPPORT_ROW_ID, upvotes: 0, updated_at: new Date(0).toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const ACTIVE_USER_STALE_SECONDS = 120;

type ActiveUserRow = {
  user_id: string;
  username: string | null;
  last_seen_at: string;
};

type ActiveUsersPayload = {
  count: number;
  users: Array<ActiveUserRow & { publisher_id?: string }>;
  usernames: string[];
};

function normalizeActiveUserRows(rows: Array<Record<string, unknown>>, includeUsername: boolean): ActiveUserRow[] {
  return rows
    .map((row) => ({
      user_id: typeof row.user_id === 'string' ? row.user_id : '',
      username: includeUsername && typeof row.username === 'string' && row.username.trim() ? row.username.trim() : null,
      last_seen_at: typeof row.last_seen_at === 'string' ? row.last_seen_at : '',
    }))
    .filter((row) => row.user_id);
}

function sortActiveUsers(users: ActiveUserRow[]): ActiveUserRow[] {
  return [...users].sort((a, b) => {
    const aName = a.username?.toLowerCase() ?? '';
    const bName = b.username?.toLowerCase() ?? '';
    if (aName && bName && aName !== bName) return aName.localeCompare(bName);
    if (aName && !bName) return -1;
    if (!aName && bName) return 1;
    return (b.last_seen_at || '').localeCompare(a.last_seen_at || '');
  });
}

async function fetchActiveUsersFromTable(): Promise<ActiveUserRow[]> {
  const cutoff = new Date(Date.now() - ACTIVE_USER_STALE_SECONDS * 1000).toISOString();
  const baseParams = {
    last_seen_at: `gte.${cutoff}`,
    order: 'last_seen_at.desc',
    limit: '100',
  };

  const params = new URLSearchParams({
    ...baseParams,
    select: 'user_id,username,last_seen_at',
  });
  const response = await fetch(`${sbEndpoint(ACTIVE_USERS_TABLE)}?${params}`, { headers: sbHeaders() });
  if (response.ok) {
    const rows = await response.json() as Array<Record<string, unknown>>;
    return Array.isArray(rows) ? normalizeActiveUserRows(rows, true) : [];
  }

  const fallbackParams = new URLSearchParams({
    ...baseParams,
    select: 'user_id,last_seen_at',
  });
  const fallbackResponse = await fetch(`${sbEndpoint(ACTIVE_USERS_TABLE)}?${fallbackParams}`, { headers: sbHeaders() });
  if (!fallbackResponse.ok) return [];
  const fallbackRows = await fallbackResponse.json() as Array<Record<string, unknown>>;
  return Array.isArray(fallbackRows) ? normalizeActiveUserRows(fallbackRows, false) : [];
}

async function fetchActiveUsersFromRpc(): Promise<ActiveUserRow[] | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_active_creator_users`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ stale_after_seconds: ACTIVE_USER_STALE_SECONDS }),
    });
    if (!response.ok) return null;
    const rows = await response.json() as Array<Record<string, unknown>>;
    if (!Array.isArray(rows)) return null;
    return normalizeActiveUserRows(rows, true);
  } catch {
    return null;
  }
}

async function buildActiveUsersPayload(): Promise<ActiveUsersPayload> {
  const [tableRows, rpcRows] = await Promise.all([
    fetchActiveUsersFromTable().catch((): ActiveUserRow[] => []),
    fetchActiveUsersFromRpc(),
  ]);

  const combined = new Map<string, ActiveUserRow>();
  for (const source of [rpcRows ?? [], tableRows]) {
    for (const row of source) {
      if (!row.user_id) continue;
      const existing = combined.get(row.user_id);
      if (!existing || (row.last_seen_at && row.last_seen_at > existing.last_seen_at)) {
        combined.set(row.user_id, row);
      } else if (row.username && !existing.username) {
        combined.set(row.user_id, { ...existing, username: row.username });
      }
    }
  }

  let users = sortActiveUsers(Array.from(combined.values()));

  if (users.length === 0) {
    const fallback = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_active_creator_usernames`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ stale_after_seconds: ACTIVE_USER_STALE_SECONDS }),
    }).catch(() => null);
    if (fallback?.ok) {
      const fallbackPayload = await fallback.json().catch(() => null) as unknown;
      const usernames = normalizeActiveUsernamePayload(fallbackPayload);
      users = usernames.map(username => ({
        user_id: `username:${username.toLowerCase()}`,
        username,
        last_seen_at: '',
      }));
    }
  }

  const profileIds = await fetchPublisherIdsByUsername(users.map(user => user.username ?? '')).catch(() => new Map<string, string>());
  const enrichedUsers = users.map(user => {
    const publisherId = user.username ? profileIds.get(user.username.toLowerCase()) : null;
    return publisherId ? { ...user, publisher_id: publisherId } : user;
  });

  return {
    count: enrichedUsers.length,
    users: enrichedUsers,
    usernames: enrichedUsers.map(user => user.username).filter((username): username is string => Boolean(username)),
  };
}

app.get('/api/active-users', async (_req, res) => {
  try {
    res.json(await buildActiveUsersPayload());
  } catch {
    res.json({ count: 0, users: [], usernames: [] });
  }
});

app.post('/api/active-users/touch', async (req, res) => {
  const body = req.body ?? {};
  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
  const rawUsername = typeof body.username === 'string' ? body.username.trim() : '';
  const username = rawUsername ? rawUsername : null;

  if (!userId) {
    res.status(400).json({ error: 'Missing required field: user_id' });
    return;
  }

  let activeCount = 0;
  try {
    const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/touch_creator_active_user`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        active_user_id: userId,
        stale_after_seconds: ACTIVE_USER_STALE_SECONDS,
        active_username: username,
      }),
    });
    if (rpc.ok) {
      const count = await rpc.json().catch(() => 0);
      if (typeof count === 'number') activeCount = count;
    } else {
      const nowIso = new Date().toISOString();
      await fetch(sbEndpoint(ACTIVE_USERS_TABLE), {
        method: 'POST',
        headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ user_id: userId, username, last_seen_at: nowIso }]),
      }).catch(() => undefined);
    }
  } catch {
    // Presence is best-effort.
  }

  if (activeCount === 0) {
    const tableRows = await fetchActiveUsersFromTable().catch((): ActiveUserRow[] => []);
    activeCount = tableRows.length;
  }

  try {
    const payload = await buildActiveUsersPayload();
    res.json({ ...payload, count: Math.max(activeCount, payload.count) });
  } catch {
    res.json({ count: activeCount, users: [], usernames: [] });
  }
});

async function fetchCollabSessionById(id: string): Promise<CollabSessionRow | null> {
  const params = new URLSearchParams({
    select: '*',
    id: `eq.${id}`,
    limit: '1',
  });
  const response = await fetch(`${sbEndpoint(COLLAB_TABLE)}?${params}`, { headers: sbHeaders() });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows[0] ? normalizeCollabSessionRow(rows[0]) : null;
}

async function updateCollabSession(id: string, body: Record<string, unknown>): Promise<CollabSessionRow> {
  const response = await fetch(`${sbEndpoint(COLLAB_TABLE)}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const rows = await response.json() as Array<Record<string, unknown>>;
  if (!rows[0]) throw new Error('Collab session update returned no row.');
  return normalizeCollabSessionRow(rows[0]);
}

app.post('/api/collab/sessions', async (req, res) => {
  try {
    const { host_publisher_id, conversation_id, conversation_label, snapshot, username } = req.body ?? {};
    const host = typeof host_publisher_id === 'string' ? host_publisher_id.trim() : '';
    const label = typeof conversation_label === 'string' ? conversation_label.trim() : '';
    const conversationId = Number(conversation_id);
    if (!host || !Number.isFinite(conversationId) || !label || !snapshot) {
      res.status(400).json({ error: 'Missing required collab session fields.' });
      return;
    }
    const body = {
      id: randomUUID(),
      host_publisher_id: host,
      conversation_id: conversationId,
      conversation_label: label,
      participants: [host],
      participant_usernames: [typeof username === 'string' && username.trim() ? username.trim() : host],
      snapshot,
      snapshot_version: 0,
      status: 'open',
      max_users: 2,
    };
    const response = await fetch(sbEndpoint(COLLAB_TABLE), {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      res.status(response.status).json({ error: await readErrorMessage(response) });
      return;
    }
    const rows = await response.json() as Array<Record<string, unknown>>;
    res.status(201).json({ session: normalizeCollabSessionRow(rows[0] ?? {}) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/collab/sessions/:id', async (req, res) => {
  try {
    const session = await fetchCollabSessionById(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Collab session not found.' });
      return;
    }
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/collab/sessions/:id/join', async (req, res) => {
  try {
    const publisherId = typeof req.body?.publisher_id === 'string' ? req.body.publisher_id.trim() : '';
    const username = typeof req.body?.username === 'string' && req.body.username.trim() ? req.body.username.trim() : publisherId;
    if (!publisherId) {
      res.status(400).json({ error: 'Missing publisher_id.' });
      return;
    }
    const session = await fetchCollabSessionById(req.params.id);
    if (!session || session.status !== 'open') {
      res.status(404).json({ error: 'Open collab session not found.' });
      return;
    }
    const participants = [...session.participants];
    const usernames = [...session.participant_usernames];
    const existingIndex = participants.indexOf(publisherId);
    if (existingIndex < 0) {
      if (participants.length >= session.max_users) {
        res.status(409).json({ error: 'Collab session is full.' });
        return;
      }
      participants.push(publisherId);
      usernames.push(username);
    } else {
      usernames[existingIndex] = username;
    }
    const updated = await updateCollabSession(session.id, {
      participants,
      participant_usernames: usernames,
      updated_at: new Date().toISOString(),
    });
    res.json({ session: updated });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/collab/sessions/:id/close', async (req, res) => {
  try {
    const caller = typeof req.body?.caller === 'string' ? req.body.caller.trim() : '';
    const session = await fetchCollabSessionById(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Collab session not found.' });
      return;
    }
    if (session.host_publisher_id !== caller) {
      res.status(403).json({ error: 'Only host can close collab session.' });
      return;
    }
    const updated = await updateCollabSession(session.id, {
      status: 'closed',
      snapshot: req.body?.snapshot ?? session.snapshot,
      snapshot_version: typeof req.body?.snapshot_version === 'number' ? req.body.snapshot_version : session.snapshot_version,
      guest_edit_count: typeof req.body?.guest_edit_count === 'number' ? req.body.guest_edit_count : session.guest_edit_count,
      last_guest_edit_at: typeof req.body?.guest_edit_count === 'number' && req.body.guest_edit_count > 0 ? new Date().toISOString() : session.last_guest_edit_at,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    res.json({ session: updated });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/collab/sessions/:id/promote-host', async (req, res) => {
  try {
    const newHostId = typeof req.body?.new_host_id === 'string' ? req.body.new_host_id.trim() : '';
    const session = await fetchCollabSessionById(req.params.id);
    if (!session || session.status !== 'open') {
      res.status(404).json({ error: 'Open collab session not found.' });
      return;
    }
    if (!session.participants.includes(newHostId)) {
      res.status(403).json({ error: 'New host must be a participant.' });
      return;
    }
    const updated = await updateCollabSession(session.id, {
      host_publisher_id: newHostId,
      updated_at: new Date().toISOString(),
    });
    res.json({ session: updated });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function resolveCollabPublishContext(collabSessionId: unknown, publisherId: string | null): Promise<{
  session: CollabSessionRow | null;
  coAuthors: string[];
  coAuthorUsernames: string[];
}> {
  if (typeof collabSessionId !== 'string' || !collabSessionId.trim() || !publisherId) {
    return { session: null, coAuthors: [], coAuthorUsernames: [] };
  }
  const session = await fetchCollabSessionById(collabSessionId.trim());
  if (!session || (session.status !== 'open' && session.status !== 'closed')) {
    throw new Error('Collab session is not publishable.');
  }
  if (session.host_publisher_id !== publisherId) {
    throw new Error('Only the collab host can publish.');
  }
  const coAuthors = session.participants.filter(participant => participant && participant !== publisherId);
  if (coAuthors.length === 0) {
    return { session, coAuthors: [], coAuthorUsernames: [] };
  }
  const openForMs = Date.now() - Date.parse(session.created_at);
  if (openForMs < 90_000) {
    throw new Error('Collab session must be open for at least 90 seconds before co-author publish.');
  }
  if (session.guest_edit_count < 1) {
    throw new Error('Guest must make at least one edit before co-author publish.');
  }

  const sinceUtc = new Date();
  sinceUtc.setUTCHours(0, 0, 0, 0);
  for (const coAuthor of coAuthors) {
    const params = new URLSearchParams({
      select: 'id',
      publisher_id: `eq.${publisherId}`,
      co_authors: `cs.{${coAuthor}}`,
      created_at: `gte.${sinceUtc.toISOString()}`,
      limit: '4',
    });
    const response = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
    if (response.ok) {
      const rows = await response.json() as Array<Record<string, unknown>>;
      if (rows.length >= 3) {
        throw new Error('This host and guest pair already co-published 3 times today.');
      }
    }
  }

  const coAuthorUsernames = coAuthors.map((coAuthor) => {
    const index = session.participants.indexOf(coAuthor);
    return session.participant_usernames[index] || coAuthor;
  });
  return { session, coAuthors, coAuthorUsernames };
}

function getServerPublishXp(complexity: unknown): number {
  if (complexity === 'long') return 300;
  if (complexity === 'medium') return 225;
  return 150;
}

app.post('/api/conversations', async (req, res) => {
  try {
    const { faction, label, description, summary, author, data, tags, branch_count, complexity, publisher_id, collab_session_id } = req.body ?? {};
    const normalizedLabel = typeof label === 'string' ? label.trim() : '';
    if (!faction || !data || !normalizedLabel) {
      res.status(400).json({ error: 'Missing required fields: faction, label, data' });
      return;
    }

    const duplicateParams = new URLSearchParams({
      select: 'id',
      limit: '1',
      label: `ilike.${escapeIlike(normalizedLabel)}`,
    });
    const duplicate = await fetch(`${sbEndpoint(TABLE)}?${duplicateParams}`, { headers: sbHeaders() });
    if (duplicate.ok) {
      const rows = await duplicate.json() as Array<{ id: string }>;
      if (rows.length > 0) {
        res.status(409).json({ error: 'A community conversation with this title already exists.' });
        return;
      }
    }

    // Use return=representation so we can pluck the inserted row's ID and
    // then invoke apply_publish_rewards for server-authoritative rewards.
    const headers = { ...sbHeaders(), Prefer: 'return=representation' };
    const normalizedPublisherId = typeof publisher_id === 'string' && publisher_id.trim() ? publisher_id.trim() : null;
    let collabContext: Awaited<ReturnType<typeof resolveCollabPublishContext>>;
    try {
      collabContext = await resolveCollabPublishContext(collab_session_id, normalizedPublisherId);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
      return;
    }
    const publishBody = {
      faction,
      label: normalizedLabel,
      description: typeof description === 'string' ? description : '',
      summary: typeof summary === 'string' ? summary : '',
      author: typeof author === 'string' && author.trim() ? author.trim() : 'Anonymous',
      tags: Array.isArray(tags) ? tags : [],
      branch_count: typeof branch_count === 'number' ? branch_count : null,
      complexity: typeof complexity === 'string' ? complexity : null,
      publisher_id: normalizedPublisherId,
      co_authors: collabContext.coAuthors,
      co_author_usernames: collabContext.coAuthorUsernames,
      data,
    };

    let r = await fetch(sbEndpoint(TABLE), {
      method: 'POST',
      headers,
      body: JSON.stringify(publishBody),
    });
    if (!r.ok) {
      const errorMessage = await readErrorMessage(r);
      if (
        isMissingSchemaColumnError(errorMessage, 'branch_count')
        || isMissingSchemaColumnError(errorMessage, 'complexity')
        || isMissingSchemaColumnError(errorMessage, 'summary')
        || isMissingSchemaColumnError(errorMessage, 'tags')
        || isMissingSchemaColumnError(errorMessage, 'publisher_id')
        || isMissingSchemaColumnError(errorMessage, 'co_authors')
        || isMissingSchemaColumnError(errorMessage, 'co_author_usernames')
        || isCommunitySchemaMismatchError(errorMessage)
      ) {
        const {
          summary: _summary,
          tags: _tags,
          branch_count: _branchCount,
          complexity: _complexity,
          publisher_id: _publisherId,
          co_authors: _coAuthors,
          co_author_usernames: _coAuthorUsernames,
          ...fallbackBody
        } = publishBody;
        r = await fetch(sbEndpoint(TABLE), {
          method: 'POST',
          headers,
          body: JSON.stringify(fallbackBody),
        });
      }
    }

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }

    // Parse inserted row to pick up conversation id for reward flow.
    let insertedId: string | undefined;
    try {
      const rows = await r.json() as Array<{ id?: string }>;
      insertedId = Array.isArray(rows) && rows[0] ? rows[0].id : undefined;
    } catch {
      insertedId = undefined;
    }

    // Apply server-authoritative publish rewards. Silently best-effort:
    // a failure here must not roll back the publish.
    const rewards = insertedId && normalizedPublisherId
      ? await applyPublishRewards(insertedId).catch(() => null)
      : null;
    const coAuthorRewards: Array<{ publisher_id: string; rewards: ServerProfileRewardResult | null }> = [];
    const publishXp = Math.max(rewards?.publish_xp ?? 0, getServerPublishXp(complexity));
    if (publishXp > 0) {
      for (const coAuthor of collabContext.coAuthors) {
        const reward = await awardXpCappedBucket(coAuthor, publishXp, 'collab_coauthor_daily', 300).catch(() => null);
        coAuthorRewards.push({ publisher_id: coAuthor, rewards: reward });
      }
    }
    if (collabContext.session) {
      await updateCollabSession(collabContext.session.id, {
        status: 'published',
        updated_at: new Date().toISOString(),
      }).catch(() => null);
    }

    res.status(201).json({ ok: true, conversation_id: insertedId ?? null, rewards, co_author_rewards: coAuthorRewards });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function handleConversationReplace(req: express.Request, res: express.Response): Promise<void> {
  try {
    const id = req.params.id;
    const {
      label,
      description,
      summary,
      tags,
      branch_count,
      complexity,
      data,
      author,
      publisher_id,
    } = req.body ?? {};

    const normalizedPublisherId = typeof publisher_id === 'string' ? publisher_id.trim() : '';
    const normalizedLabel = typeof label === 'string' ? label.trim() : '';
    if (!id || !normalizedPublisherId || !normalizedLabel || !data) {
      res.status(400).json({ error: 'Missing required fields: id, publisher_id, label, data' });
      return;
    }

    const existingParams = new URLSearchParams({
      select: 'id,publisher_id,co_authors',
      id: `eq.${id}`,
      limit: '1',
    });
    let existingResponse = await fetch(`${sbEndpoint(TABLE)}?${existingParams}`, { headers: sbHeaders() });
    if (!existingResponse.ok) {
      const errorMessage = await readErrorMessage(existingResponse);
      if (isMissingSchemaColumnError(errorMessage, 'co_authors')) {
        existingParams.set('select', 'id,publisher_id');
        existingResponse = await fetch(`${sbEndpoint(TABLE)}?${existingParams}`, { headers: sbHeaders() });
      }
    }
    if (!existingResponse.ok) {
      res.status(existingResponse.status).json({ error: await readErrorMessage(existingResponse) });
      return;
    }
    const existingRows = await existingResponse.json() as Array<{ id: string; publisher_id?: string | null; co_authors?: string[] | null }>;
    const existing = existingRows[0];
    if (!existing) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    const existingCoAuthors = Array.isArray(existing.co_authors) ? existing.co_authors : [];
    if ((existing.publisher_id ?? '').trim() !== normalizedPublisherId && !existingCoAuthors.includes(normalizedPublisherId)) {
      res.status(403).json({ error: 'Forbidden: publisher mismatch.' });
      return;
    }

    const duplicateParams = new URLSearchParams({
      select: 'id',
      limit: '1',
      label: `ilike.${escapeIlike(normalizedLabel)}`,
      id: `neq.${id}`,
    });
    const duplicate = await fetch(`${sbEndpoint(TABLE)}?${duplicateParams}`, { headers: sbHeaders() });
    if (duplicate.ok) {
      const rows = await duplicate.json() as Array<{ id: string }>;
      if (rows.length > 0) {
        res.status(409).json({ error: 'A different community conversation with this title already exists.' });
        return;
      }
    }

    const headers = { ...sbHeaders(), Prefer: 'return=minimal' };
    const updateBody = {
      label: normalizedLabel,
      description: typeof description === 'string' ? description : '',
      summary: typeof summary === 'string' ? summary : '',
      tags: Array.isArray(tags) ? tags : [],
      branch_count: typeof branch_count === 'number' ? branch_count : null,
      complexity: typeof complexity === 'string' ? complexity : null,
      data,
      author: typeof author === 'string' && author.trim() ? author.trim() : undefined,
    };
    let r = await fetch(`${sbEndpoint(TABLE)}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updateBody),
    });

    if (!r.ok) {
      const errorMessage = await readErrorMessage(r);
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
        } = updateBody;
        r = await fetch(`${sbEndpoint(TABLE)}?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(fallbackBody),
        });
      }
    }

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }

    res.status(200).json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

app.patch('/api/conversations/:id', handleConversationReplace);
app.post('/api/conversations/:id', handleConversationReplace);
app.post('/api/conversations/:id/replace', handleConversationReplace);

// Download and upvote handlers moved below with XP-awarding versions.


app.patch('/api/support/upvote', async (_req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_creator_support_upvote`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ support_id: SUPPORT_ROW_ID }),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: `Database error: ${r.status} ${r.statusText}` });
      return;
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
    return;
  }
  res.json({ ok: true });
});

app.get('/api/visitor', async (_req, res) => {
  try {
    const params = new URLSearchParams({
      select: 'visitors',
      id: `eq.${SUPPORT_ROW_ID}`,
      limit: '1',
    });
    const r = await fetch(`${sbEndpoint(SUPPORT_TABLE)}?${params}`, { headers: sbHeaders() });
    if (!r.ok) {
      res.status(r.status).json({ error: `Database error: ${r.status}` });
      return;
    }
    const rows = await r.json() as Array<{ visitors?: number }>;
    res.json({ visitors: rows[0]?.visitors ?? 0 });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/visitors/recent', async (_req, res) => {
  try {
    const params = new URLSearchParams({
      select: 'user_id,username,last_seen_at,created_at',
      order: 'last_seen_at.desc',
      limit: '10',
    });
    const response = await fetch(`${sbEndpoint('site_visitor_log')}?${params}`, { headers: sbHeaders() });
    if (!response.ok) {
      res.json({ visitors: [] });
      return;
    }

    const rows = await response.json() as Array<Record<string, unknown>>;
    const visitors = Array.isArray(rows)
      ? rows
        .map((row) => ({
          user_id: typeof row.user_id === 'string' ? row.user_id : '',
          username: typeof row.username === 'string' && row.username.trim() ? row.username.trim() : null,
          last_seen_at: typeof row.last_seen_at === 'string' ? row.last_seen_at : '',
          created_at: typeof row.created_at === 'string' ? row.created_at : '',
        }))
        .filter((row) => row.user_id || row.username)
      : [];
    const profileIds = await fetchPublisherIdsByUsername(visitors.map(visitor => visitor.username ?? '')).catch(() => new Map<string, string>());
    res.json({
      visitors: visitors.map(visitor => {
        const publisherId = visitor.username ? profileIds.get(visitor.username.toLowerCase()) : null;
        return publisherId ? { ...visitor, publisher_id: publisherId } : visitor;
      }),
    });
  } catch {
    res.json({ visitors: [] });
  }
});

app.post('/api/visitor', async (_req, res) => {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_site_visitor`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ support_id: SUPPORT_ROW_ID }),
    });
  } catch {
    // Best-effort
  }
  res.json({ ok: true });
});

// ─── User Profiles & Gamification ────────────────────────────────────────

app.get('/api/bug-reports', async (req, res) => {
  try {
    const rawStatus = typeof req.query.status === 'string' ? req.query.status : 'all';
    const status = isBugReportStatus(rawStatus) ? rawStatus : 'all';
    const viewerPublisherId = typeof req.query.viewer_publisher_id === 'string' ? req.query.viewer_publisher_id : '';
    const params = new URLSearchParams({
      select: 'id,subject,message,author_username,author_publisher_id,status,admin_reply,admin_publisher_id,admin_username,metadata,created_at,updated_at',
      order: 'updated_at.desc',
      limit: '100',
    });
    if (status !== 'all') params.set('status', `eq.${status}`);

    const [response, isAdmin] = await Promise.all([
      fetch(`${sbEndpoint(BUG_REPORTS_TABLE)}?${params}`, { headers: sbHeaders() }),
      verifyIsAdmin(viewerPublisherId),
    ]);
    if (!response.ok) {
      res.status(response.status).json({ error: await readErrorMessage(response) });
      return;
    }

    const rows = await response.json() as Array<Record<string, unknown>>;
    res.json({
      reports: Array.isArray(rows) ? rows.map(normalizeBugReport).filter(report => report.id) : [],
      viewer_can_admin: isAdmin,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/bug-reports', async (req, res) => {
  try {
    const body = req.body ?? {};
    const subject = sanitizeBugReportText(body.subject, 120);
    const message = sanitizeBugReportText(body.message, 2500);
    if (!subject || !message) {
      res.status(400).json({ error: 'Missing required fields: subject, message' });
      return;
    }

    const payload = {
      subject,
      message,
      author_username: sanitizeBugReportText(body.author_username, 40) || null,
      author_publisher_id: sanitizeBugReportText(body.author_publisher_id, 120) || null,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    };

    const response = await fetch(sbEndpoint(BUG_REPORTS_TABLE), {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify([payload]),
    });
    if (!response.ok) {
      res.status(response.status).json({ error: await readErrorMessage(response) });
      return;
    }

    const rows = await response.json() as Array<Record<string, unknown>>;
    res.json({ report: rows[0] ? normalizeBugReport(rows[0]) : null });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.patch('/api/bug-reports/:id/admin', async (req, res) => {
  try {
    const reportId = req.params.id.trim();
    const body = req.body ?? {};
    const adminPublisherId = sanitizeBugReportText(body.publisher_id, 120);
    const adminUsername = sanitizeBugReportText(body.username, 40) || null;
    const status = isBugReportStatus(body.status) ? body.status : null;
    const adminReply = sanitizeBugReportText(body.admin_reply, 2500);

    if (!reportId) {
      res.status(400).json({ error: 'Missing report id.' });
      return;
    }

    if (!(await verifyIsAdmin(adminPublisherId))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const updatePayload: Record<string, unknown> = {
      admin_publisher_id: adminPublisherId,
      admin_username: adminUsername,
      admin_reply: adminReply,
    };
    if (status) updatePayload.status = status;

    const params = new URLSearchParams({
      id: `eq.${reportId}`,
      select: 'id,subject,message,author_username,author_publisher_id,status,admin_reply,admin_publisher_id,admin_username,metadata,created_at,updated_at',
    });
    const response = await fetch(`${sbEndpoint(BUG_REPORTS_TABLE)}?${params}`, {
      method: 'PATCH',
      headers: { ...sbHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(updatePayload),
    });
    if (!response.ok) {
      res.status(response.status).json({ error: await readErrorMessage(response) });
      return;
    }

    const rows = await response.json() as Array<Record<string, unknown>>;
    res.json({ report: rows[0] ? normalizeBugReport(rows[0]) : null });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.delete('/api/bug-reports/:id', async (req, res) => {
  try {
    const reportId = req.params.id.trim();
    const body = req.body ?? {};
    const adminPublisherId = sanitizeBugReportText(body.publisher_id, 120);

    if (!reportId) {
      res.status(400).json({ error: 'Missing report id' });
      return;
    }
    if (!(await verifyIsAdmin(adminPublisherId))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const params = new URLSearchParams({ id: `eq.${reportId}` });
    const response = await fetch(`${sbEndpoint(BUG_REPORTS_TABLE)}?${params}`, {
      method: 'DELETE',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    });
    if (!response.ok) {
      res.status(response.status).json({ error: await readErrorMessage(response) });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/profile/register', async (req, res) => {
  try {
    const { publisher_id, username, password } = req.body ?? {};
    if (!publisher_id || !username) {
      res.status(400).json({ error: 'Missing required fields: publisher_id, username' });
      return;
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_username`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        p_publisher_id: publisher_id,
        p_username: username,
        p_password: password ?? null,
      }),
    });

    if (!r.ok) {
      const msg = await readErrorMessage(r);
      res.status(r.status).json({ error: msg });
      return;
    }

    const rows = await r.json();
    const profile = Array.isArray(rows) ? rows[0] : rows;
    res.json(profile ?? null);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/profile/:publisherId/public', async (req, res) => {
  try {
    res.json(await fetchPublicProfileData(req.params.publisherId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/profile/:publisherId/conversations', async (req, res) => {
  try {
    res.json(await fetchAuthoredConversations(req.params.publisherId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/profile/:publisherId', async (req, res) => {
  try {
    const { publisherId } = req.params;
    res.json(await fetchHydratedUserProfile(publisherId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/profile/:publisherId/achievements', async (req, res) => {
  try {
    res.json(await fetchUserAchievements(req.params.publisherId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/profile/:publisherId/missions', async (req, res) => {
  try {
    res.json(await fetchUserMissionProgress(req.params.publisherId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/profile/missions', async (req, res) => {
  try {
    const missions = Array.isArray(req.body?.missions) ? req.body.missions : [];
    const normalized = missions.filter((mission): mission is Record<string, unknown> => Boolean(mission) && typeof mission === 'object').map((mission) => ({
      publisher_id: typeof mission.publisher_id === 'string' ? mission.publisher_id : '',
      mission_id: typeof mission.mission_id === 'string' ? mission.mission_id : '',
      mission_slot: typeof mission.mission_slot === 'string' ? mission.mission_slot : 'daily_easy',
      cadence: typeof mission.cadence === 'string' ? mission.cadence : 'daily',
      category: typeof mission.category === 'string' ? mission.category : 'publishing',
      progress: typeof mission.progress === 'number' ? mission.progress : 0,
      goal: typeof mission.goal === 'number' ? mission.goal : 1,
      period_key: typeof mission.period_key === 'string' ? mission.period_key : '',
      completed_at: typeof mission.completed_at === 'string' ? mission.completed_at : null,
      meta: mission.meta && typeof mission.meta === 'object' ? mission.meta : {},
    })).filter(mission => mission.publisher_id && mission.mission_id && mission.period_key);

    if (normalized.length === 0) {
      res.status(400).json({ error: 'Missing or invalid mission progress payload.' });
      return;
    }

    await upsertMissionProgress(normalized);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/profile/:publisherId/achievements/unlock', async (req, res) => {
  try {
    const { achievement_id } = req.body ?? {};
    if (typeof achievement_id !== 'string' || !achievement_id.trim()) {
      res.status(400).json({ error: 'Missing required field: achievement_id' });
      return;
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/unlock_achievement`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        p_publisher_id: req.params.publisherId,
        p_achievement_id: achievement_id.trim(),
      }),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }

    const payload = await r.json() as boolean | boolean[];
    const unlocked = Array.isArray(payload) ? Boolean(payload[0]) : Boolean(payload);
    res.json({ unlocked });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Admin-only historical catch-up for users who published before reward checks existed.
app.post('/api/profile/achievements/recheck', async (req, res) => {
  try {
    const adminPublisherId = typeof req.body?.publisher_id === 'string' ? req.body.publisher_id : '';
    if (!isAdminPublisherId(adminPublisherId)) {
      res.status(403).json({ error: 'Admin publisher id is not allowed.' });
      return;
    }

    const targetPublisherId = typeof req.body?.target_publisher_id === 'string'
      ? req.body.target_publisher_id.trim()
      : '';

    const rows: Array<Record<string, unknown>> = [];
    if (targetPublisherId) {
      const publishResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/recheck_publish_achievements`, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({ p_publisher_id: targetPublisherId }),
      });
      if (!publishResponse.ok) {
        res.status(publishResponse.status).json({ error: await readErrorMessage(publishResponse) });
        return;
      }
      const publishRows = await publishResponse.json() as Array<Record<string, unknown>>;
      rows.push(...(Array.isArray(publishRows) ? publishRows : []));

      const metricResult = await applyMetricRewards(targetPublisherId, 'both').catch(() => null);
      if (metricResult) {
        rows.push({
          publisher_id: targetPublisherId,
          achievement_xp: metricResult.achievement_xp,
          newly_unlocked: metricResult.unlocked,
        });
      }
    } else {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/recheck_all_user_achievements`, {
        method: 'POST',
        headers: sbHeaders(),
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        res.status(r.status).json({ error: await readErrorMessage(r) });
        return;
      }
      const payload = await r.json() as Array<Record<string, unknown>>;
      rows.push(...(Array.isArray(payload) ? payload : []));
    }

    const summary = rows.reduce<{ achievement_xp: number; newly_unlocked: number }>((acc, row) => {
      acc.achievement_xp += typeof row.achievement_xp === 'number' ? row.achievement_xp : 0;
      acc.newly_unlocked += Array.isArray(row.newly_unlocked) ? row.newly_unlocked.length : 0;
      return acc;
    }, { achievement_xp: 0, newly_unlocked: 0 });

    res.json({ ok: true, summary, rows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Record a daily login and unlock login_streak milestone achievements.
app.post('/api/profile/:publisherId/login', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_daily_login`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_publisher_id: req.params.publisherId }),
    });
    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }
    const rows = await r.json() as Array<Record<string, unknown>>;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      res.json({ login_streak: 0, newly_unlocked: [], achievement_xp: 0 });
      return;
    }
    const unlockedRaw = Array.isArray(row.newly_unlocked) ? row.newly_unlocked as Array<Record<string, unknown>> : [];
    const unlocked = unlockedRaw
      .map((entry) => typeof entry?.achievement_id === 'string' ? ({
        achievement_id: String(entry.achievement_id),
        unlocked_at: new Date().toISOString(),
      }) : null)
      .filter((entry): entry is UserAchievement => Boolean(entry));
    res.json({
      login_streak: typeof row.login_streak === 'number' ? row.login_streak : 0,
      last_login_date: typeof row.last_login_date === 'string' ? row.last_login_date : '',
      newly_unlocked: unlocked,
      achievement_xp: typeof row.achievement_xp === 'number' ? row.achievement_xp : 0,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/profile/:publisherId/streak', async (req, res) => {
  try {
    res.json(await fetchUserStreakState(req.params.publisherId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/profile/streak', async (req, res) => {
  try {
    const { publisher_id, publish_streak, longest_streak, last_publish_week, login_streak, last_login_date } = req.body ?? {};
    if (
      typeof publisher_id !== 'string'
      || typeof publish_streak !== 'number'
      || typeof longest_streak !== 'number'
      || typeof last_publish_week !== 'string'
      || typeof login_streak !== 'number'
      || typeof last_login_date !== 'string'
    ) {
      res.status(400).json({ error: 'Missing or invalid streak fields.' });
      return;
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_user_streak`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        p_publisher_id: publisher_id,
        p_publish_streak: publish_streak,
        p_longest_streak: longest_streak,
        p_last_publish_week: last_publish_week,
        p_login_streak: login_streak,
        p_last_login_date: last_login_date,
      }),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/profile/award-xp', async (req, res) => {
  try {
    const { publisher_id, amount } = req.body ?? {};
    if (!publisher_id || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'Missing or invalid fields: publisher_id, amount (positive int)' });
      return;
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/award_xp`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_publisher_id: publisher_id, p_amount: amount }),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }

    const rows = await r.json();
    const profile = Array.isArray(rows) ? rows[0] : rows;
    res.json(profile ?? null);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/profile/award-xp-capped', async (req, res) => {
  try {
    const { publisher_id, amount, daily_cap } = req.body ?? {};
    if (!publisher_id || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'Missing or invalid fields: publisher_id, amount (positive int)' });
      return;
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/award_xp_capped`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        p_publisher_id: publisher_id,
        p_amount: amount,
        p_daily_cap: typeof daily_cap === 'number' ? daily_cap : 500,
      }),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }

    const rows = await r.json();
    const profile = Array.isArray(rows) ? rows[0] : rows;
    res.json(profile ?? null);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Update a publisher's cosmetic avatar fields.
app.post('/api/profile/:publisherId/cosmetics', async (req, res) => {
  try {
    const { publisherId } = req.params;
    const { avatar_icon, avatar_color, avatar_frame, avatar_banner, avatar_effect } = req.body ?? {};

    const nullish = (value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      // Guard size to prevent abuse (colors are 7-char hex, ids are short slugs).
      if (trimmed.length > 64) return trimmed.slice(0, 64);
      return trimmed;
    };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_user_cosmetics`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        p_publisher_id: publisherId,
        p_avatar_icon: nullish(avatar_icon),
        p_avatar_color: nullish(avatar_color),
        p_avatar_frame: nullish(avatar_frame),
        p_avatar_banner: nullish(avatar_banner),
        p_avatar_effect: nullish(avatar_effect),
      }),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }

    const rows = await r.json();
    const profile = Array.isArray(rows) ? rows[0] : rows;
    res.json(profile ?? null);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const limitQuery = String(req.query.limit ?? '10').toLowerCase();
    const requestedLimit = limitQuery === 'all' ? 1000 : parseInt(limitQuery, 10) || 10;
    const limit = Math.min(Math.max(requestedLimit, 1), 1000);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_leaderboard`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_limit: limit }),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }

    const rows = await r.json() as Array<Record<string, unknown>>;
    const leaderboard: LeaderboardEntry[] = rows.map((row) => ({
      publisher_id: typeof row.publisher_id === 'string' ? row.publisher_id : '',
      username: typeof row.username === 'string' ? row.username : 'Unknown',
      xp: typeof row.xp === 'number' ? row.xp : 0,
      level: typeof row.level === 'number' ? row.level : 0,
      title: typeof row.title === 'string' ? row.title : '',
      achievements: Array.isArray(row.achievements)
        ? row.achievements.filter((item): item is string => typeof item === 'string')
        : undefined,
      avatar_icon: typeof row.avatar_icon === 'string' ? row.avatar_icon : null,
      avatar_color: typeof row.avatar_color === 'string' ? row.avatar_color : null,
      avatar_frame: typeof row.avatar_frame === 'string' ? row.avatar_frame : null,
      avatar_banner: typeof row.avatar_banner === 'string' ? row.avatar_banner : null,
      avatar_effect: typeof row.avatar_effect === 'string' ? row.avatar_effect : null,
    }));

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Award XP to publisher when their conversation gets downloaded
app.patch('/api/conversations/:id/download', async (req, res) => {
  const { id } = req.params;
  try {
    // Increment download counter
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_download`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ conv_id: id }),
    });

    // Look up publisher_id and apply metric rewards server-side.
    const lookupParams = new URLSearchParams({
      select: 'publisher_id,downloads',
      id: `eq.${id}`,
      limit: '1',
    });
    const lookup = await fetch(`${sbEndpoint(TABLE)}?${lookupParams}`, { headers: sbHeaders() });
    if (lookup.ok) {
      const rows = await lookup.json() as Array<{ publisher_id?: string; downloads?: number }>;
      const pubId = rows[0]?.publisher_id;
      if (pubId) {
        // Small per-event XP is still awarded for immediate feedback.
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/award_xp`, {
          method: 'POST',
          headers: sbHeaders(),
          body: JSON.stringify({ p_publisher_id: pubId, p_amount: 5 }),
        });
        // Server-authoritative milestone achievement unlocks.
        await applyMetricRewards(pubId, 'downloads').catch(() => null);
        await advanceCommunityMissionProgress(pubId, {
          type: 'download_milestone_reached',
          total: rows[0]?.downloads ?? 0,
        }).catch(() => undefined);
      }
    }
  } catch {
    // Best-effort
  }
  res.json({ ok: true });
});

// Award XP to publisher when their conversation gets upvoted
app.patch('/api/conversations/:id/upvote', async (req, res) => {
  const { id } = req.params;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_upvote`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ conv_id: id }),
    });

    if (!r.ok) {
      res.status(r.status).json({ error: await readErrorMessage(r) });
      return;
    }

    // Look up publisher_id and apply metric rewards server-side.
    const lookupParams = new URLSearchParams({
      select: 'publisher_id,upvotes',
      id: `eq.${id}`,
      limit: '1',
    });
    const lookup = await fetch(`${sbEndpoint(TABLE)}?${lookupParams}`, { headers: sbHeaders() });
    if (lookup.ok) {
      const rows = await lookup.json() as Array<{ publisher_id?: string; upvotes?: number }>;
      const pubId = rows[0]?.publisher_id;
      if (pubId) {
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/award_xp`, {
          method: 'POST',
          headers: sbHeaders(),
          body: JSON.stringify({ p_publisher_id: pubId, p_amount: 10 }),
        });
        await applyMetricRewards(pubId, 'upvotes').catch(() => null);
        await advanceCommunityMissionProgress(pubId, {
          type: 'upvote_received',
          total: rows[0]?.upvotes ?? 0,
        }).catch(() => undefined);
      }
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
    return;
  }
  res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────────────────────
// PASSWORD LOGIN
// ──────────────────────────────────────────────────────────────────────────

app.post('/api/profile/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      res.status(400).json({ error: 'Missing username or password.' });
      return;
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/login_user`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_username: username, p_password: password }),
    });

    if (!r.ok) {
      const msg = await readErrorMessage(r);
      res.status(r.status).json({ error: msg });
      return;
    }

    const rows = await r.json();
    const profile = Array.isArray(rows) ? rows[0] : rows;
    if (!profile || !profile.publisher_id) {
      res.status(401).json({ error: 'Invalid callsign or password.' });
      return;
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// ROADMAP
// ──────────────────────────────────────────────────────────────────────────

const ROADMAP_TABLE_NAME = 'roadmap_items';
const ROADMAP_UPVOTES_TABLE_NAME = 'roadmap_upvotes';

async function isRoadmapAdmin(req: import('express').Request): Promise<boolean> {
  const publisherId = (req.body?.publisher_id ?? req.query?.publisher_id ?? '') as string;
  return verifyIsAdmin(publisherId);
}

app.get('/api/roadmap', async (_req, res) => {
  try {
    const params = new URLSearchParams({
      select: 'id,title,description,status,category,priority,upvotes,created_at,updated_at',
      order: 'priority.desc,created_at.asc',
    });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${ROADMAP_TABLE_NAME}?${params}`, {
      headers: sbHeaders(),
    });
    if (!r.ok) {
      const msg = await readErrorMessage(r);
      res.status(r.status).json({ error: msg });
      return;
    }
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/roadmap', async (req, res) => {
  if (!(await isRoadmapAdmin(req))) {
    res.status(403).json({ error: 'Only the admin can create roadmap items.' });
    return;
  }
  try {
    const { title, description = '', status = 'planned', category = 'feature', priority = 0 } = req.body ?? {};
    if (!title?.trim()) {
      res.status(400).json({ error: 'title is required.' });
      return;
    }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${ROADMAP_TABLE_NAME}`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ title: title.trim(), description, status, category, priority }),
    });
    if (!r.ok) {
      const msg = await readErrorMessage(r);
      res.status(r.status).json({ error: msg });
      return;
    }
    const rows = await r.json();
    res.status(201).json(Array.isArray(rows) ? rows[0] : rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.patch('/api/roadmap/:itemId', async (req, res) => {
  if (!(await isRoadmapAdmin(req))) {
    res.status(403).json({ error: 'Only the admin can edit roadmap items.' });
    return;
  }
  try {
    const { itemId } = req.params;
    const { title, description, status, category, priority } = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (status !== undefined) patch.status = status;
    if (category !== undefined) patch.category = category;
    if (priority !== undefined) patch.priority = priority;

    const r = await fetch(`${SUPABASE_URL}/rest/v1/${ROADMAP_TABLE_NAME}?id=eq.${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers: { ...sbHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const msg = await readErrorMessage(r);
      res.status(r.status).json({ error: msg });
      return;
    }
    const rows = await r.json();
    res.json(Array.isArray(rows) ? rows[0] : rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.delete('/api/roadmap/:itemId', async (req, res) => {
  if (!(await isRoadmapAdmin(req))) {
    res.status(403).json({ error: 'Only the admin can delete roadmap items.' });
    return;
  }
  try {
    const { itemId } = req.params;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${ROADMAP_TABLE_NAME}?id=eq.${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      headers: sbHeaders(),
    });
    if (!r.ok) {
      const msg = await readErrorMessage(r);
      res.status(r.status).json({ error: msg });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/roadmap/:itemId/upvote', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { publisher_id } = req.body ?? {};

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_roadmap_upvote`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({
        p_item_id: itemId,
        p_publisher_id: publisher_id ?? null,
      }),
    });
    if (!r.ok) {
      const msg = await readErrorMessage(r);
      res.status(r.status).json({ error: msg });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`P.A.N.D.A. API server → http://localhost:${PORT}`);
  console.log(`Supabase project: ${SUPABASE_URL}`);
});
