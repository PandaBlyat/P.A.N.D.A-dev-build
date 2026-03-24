// P.A.N.D.A. Community Library — API Server
// Thin proxy that keeps Supabase credentials server-side.

import express from 'express';
import cors from 'cors';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
const TABLE = 'community_conversations';
const SUPPORT_TABLE = 'creator_support_metrics';
const PROFILES_TABLE = 'user_profiles';
const STREAKS_TABLE = 'user_streaks';
const MISSIONS_TABLE = 'user_mission_progress';
const SUPPORT_ROW_ID = 'global';
const COMMUNITY_REQUIRED_COLUMNS = ['id', 'faction', 'label', 'description', 'author', 'data', 'downloads', 'created_at'] as const;
const COMMUNITY_OPTIONAL_COLUMNS = ['summary', 'tags', 'branch_count', 'complexity', 'upvotes', 'updated_at'] as const;

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
};

type PublicProfileData = {
  profile: Record<string, unknown>;
  publish_count: number;
  authored_conversations: ReturnType<typeof normalizeConversationRow>[];
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

  const response = await fetch(`${sbEndpoint(TABLE)}?${params}`, { headers: sbHeaders() });
  if (!response.ok) {
    const errorMessage = await readErrorMessage(response);
    if (isMissingSchemaColumnError(errorMessage, 'publisher_id')) {
      return [];
    }
    throw new Error(errorMessage);
  }

  const rows = await response.json() as Array<Record<string, unknown>>;
  return rows.map(normalizeConversationRow);
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
    publish_count: publishCount,
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

app.post('/api/conversations', async (req, res) => {
  try {
    const { faction, label, description, summary, author, data, tags, branch_count, complexity, publisher_id } = req.body ?? {};
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

    const headers = { ...sbHeaders(), Prefer: 'return=minimal' };
    const publishBody = {
      faction,
      label: normalizedLabel,
      description: typeof description === 'string' ? description : '',
      summary: typeof summary === 'string' ? summary : '',
      author: typeof author === 'string' && author.trim() ? author.trim() : 'Anonymous',
      tags: Array.isArray(tags) ? tags : [],
      branch_count: typeof branch_count === 'number' ? branch_count : null,
      complexity: typeof complexity === 'string' ? complexity : null,
      publisher_id: typeof publisher_id === 'string' && publisher_id.trim() ? publisher_id.trim() : null,
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
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.patch('/api/conversations/:id', async (req, res) => {
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
      select: 'id,publisher_id',
      id: `eq.${id}`,
      limit: '1',
    });
    const existingResponse = await fetch(`${sbEndpoint(TABLE)}?${existingParams}`, { headers: sbHeaders() });
    if (!existingResponse.ok) {
      res.status(existingResponse.status).json({ error: await readErrorMessage(existingResponse) });
      return;
    }
    const existingRows = await existingResponse.json() as Array<{ id: string; publisher_id?: string | null }>;
    const existing = existingRows[0];
    if (!existing) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    if ((existing.publisher_id ?? '').trim() !== normalizedPublisherId) {
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
});

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

app.post('/api/profile/register', async (req, res) => {
  try {
    const { publisher_id, username } = req.body ?? {};
    if (!publisher_id || !username) {
      res.status(400).json({ error: 'Missing required fields: publisher_id, username' });
      return;
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_username`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_publisher_id: publisher_id, p_username: username }),
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

app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '10'), 10) || 10, 1), 50);
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

    // Look up publisher_id and award XP
    const lookupParams = new URLSearchParams({
      select: 'publisher_id',
      id: `eq.${id}`,
      limit: '1',
    });
    const lookup = await fetch(`${sbEndpoint(TABLE)}?${lookupParams}`, { headers: sbHeaders() });
    if (lookup.ok) {
      const rows = await lookup.json() as Array<{ publisher_id?: string }>;
      const pubId = rows[0]?.publisher_id;
      if (pubId) {
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/award_xp`, {
          method: 'POST',
          headers: sbHeaders(),
          body: JSON.stringify({ p_publisher_id: pubId, p_amount: 5 }),
        });

        const totalsParams = new URLSearchParams({
          select: 'downloads',
          id: `eq.${id}`,
          limit: '1',
        });
        const totalsLookup = await fetch(`${sbEndpoint(TABLE)}?${totalsParams}`, { headers: sbHeaders() });
        if (totalsLookup.ok) {
          const totalsRows = await totalsLookup.json() as Array<{ downloads?: number }>;
          await advanceCommunityMissionProgress(pubId, {
            type: 'download_milestone_reached',
            total: totalsRows[0]?.downloads ?? 0,
          }).catch(() => undefined);
        }
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

    // Look up publisher_id and award XP
    const lookupParams = new URLSearchParams({
      select: 'publisher_id',
      id: `eq.${id}`,
      limit: '1',
    });
    const lookup = await fetch(`${sbEndpoint(TABLE)}?${lookupParams}`, { headers: sbHeaders() });
    if (lookup.ok) {
      const rows = await lookup.json() as Array<{ publisher_id?: string }>;
      const pubId = rows[0]?.publisher_id;
      if (pubId) {
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/award_xp`, {
          method: 'POST',
          headers: sbHeaders(),
          body: JSON.stringify({ p_publisher_id: pubId, p_amount: 10 }),
        });

        const totalsParams = new URLSearchParams({
          select: 'upvotes',
          id: `eq.${id}`,
          limit: '1',
        });
        const totalsLookup = await fetch(`${sbEndpoint(TABLE)}?${totalsParams}`, { headers: sbHeaders() });
        if (totalsLookup.ok) {
          const totalsRows = await totalsLookup.json() as Array<{ upvotes?: number }>;
          await advanceCommunityMissionProgress(pubId, {
            type: 'upvote_received',
            total: totalsRows[0]?.upvotes ?? 0,
          }).catch(() => undefined);
        }
      }
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
    return;
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`P.A.N.D.A. API server → http://localhost:${PORT}`);
  console.log(`Supabase project: ${SUPABASE_URL}`);
});
