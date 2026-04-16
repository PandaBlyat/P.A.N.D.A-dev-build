// P.A.N.D.A. Conversation Editor — Gamification Engine
// Achievements, streaks, daily challenges, and quality scoring with anti-abuse guards.

import type { Conversation } from './types';

// ─── Anti-Abuse Constants ────────────────────────────────────────────────────
const COOLDOWN_PREFIX = 'panda-gf-cd-';
const DAILY_XP_CAP_KEY = 'panda-gf-daily-xp';
const DAILY_XP_MAX = 500; // Max XP earnable from gamification events per day
const MILESTONE_COOLDOWN_MS = 5_000; // Min gap between milestone XP awards

// ─── Achievement Definitions ─────────────────────────────────────────────────

export type AchievementCategory =
  | 'onboarding'
  | 'social'
  | 'discovery'
  | 'mastery'
  | 'collection';

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export const ACHIEVEMENT_CATEGORY_ORDER: AchievementCategory[] = [
  'onboarding',
  'social',
  'discovery',
  'mastery',
  'collection',
];

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  onboarding: 'Onboarding',
  social: 'Social',
  discovery: 'Discovery',
  mastery: 'Mastery',
  collection: 'Collection',
};

export type AchievementId =
  | 'first_patrol'
  | 'login_streak_1'
  | 'challenge_apprentice'
  | 'mission_apprentice'
  | 'first_publish'
  | 'branching_out'
  | 'story_weaver'
  | 'web_of_lies'
  | 'new_faction_scout'
  | 'faction_diplomat'
  | 'zone_encyclopedist'
  | 'flow_restorer'
  | 'uncommon_operator'
  | 'popular_stalker'
  | 'first_upvote_received'
  | 'rising_signal'
  | 'community_favorite'
  | 'crowd_pleaser'
  | 'upvote_wave'
  | 'profile_spotlight'
  | 'cartographer'
  | 'outcome_engineer'
  | 'branch_architect'
  | 'precondition_master'
  | 'precondition_tactician'
  | 'quality_crafter'
  | 'systems_polymath'
  | 'clean_publish_streak'
  | 'four_star_streak'
  | 'prolific_writer'
  | 'zone_veteran'
  | 'streak_3'
  | 'streak_10'
  | 'bronze_complete'
  | 'onboarding_complete'
  | 'silver_complete'
  | 'faction_complete'
  | 'night_shift'
  | 'zone_whisperer'
  // ─── Extended catalog ────────────────────────────────────────────────────
  | 'callsign_chosen'
  | 'login_streak_7'
  | 'login_streak_30'
  | 'weekend_warrior'
  | 'dawn_patrol'
  | 'iron_scribe'
  | 'commentator'
  | 'library_patron'
  | 'first_friend'
  | 'download_centurion'
  | 'download_legion'
  | 'upvote_legend'
  | 'artifact_hunter'
  | 'mutant_mythographer'
  | 'zone_lorekeeper'
  | 'gold_circuit'
  | 'hidden_circuit'
  | 'chaos_director'
  | 'ironclad_finish'
  | 'speedrunner';

export type Achievement = {
  id: AchievementId;
  name: string;
  description: string;
  xp: number;
  icon: string; // emoji for now, simple and universal
  tier: AchievementTier;
  category: AchievementCategory;
  hidden?: boolean;
  featured?: boolean;
  /**
   * True when the achievement exists in the catalog but the server does not
   * yet evaluate an unlock trigger for it. These are rendered as
   * locked-hidden (mystery glyph) on the badge wall to avoid promising
   * a reward with no path to earning it, while preserving the ID so any
   * previously awarded unlock records stay intact.
   */
  unimplemented?: boolean;
};

/**
 * Achievement IDs that are present in the catalog but have no server-side
 * unlock trigger yet. We keep them listed (so historical unlocks remain
 * attributable) but filter them out of the visible badge wall. Update this
 * set when new server triggers ship.
 */
export const UNIMPLEMENTED_ACHIEVEMENT_IDS: ReadonlySet<AchievementId> = new Set<AchievementId>([
  'upvote_wave',
  'profile_spotlight',
  'story_weaver',
  'web_of_lies',
  'zone_encyclopedist',
  'flow_restorer',
  'uncommon_operator',
  'outcome_engineer',
  'precondition_master',
  'precondition_tactician',
  'quality_crafter',
  'systems_polymath',
  'clean_publish_streak',
  'four_star_streak',
  'streak_3',
  'streak_10',
  'weekend_warrior',
  'dawn_patrol',
  'iron_scribe',
  'commentator',
  'library_patron',
  'first_friend',
  'artifact_hunter',
  'mutant_mythographer',
  'zone_lorekeeper',
  'chaos_director',
  'ironclad_finish',
  'speedrunner',
  'mission_apprentice',
]);

export function isAchievementUnimplemented(achievement: Achievement): boolean {
  return Boolean(achievement.unimplemented) || UNIMPLEMENTED_ACHIEVEMENT_IDS.has(achievement.id);
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_patrol', name: 'First Patrol', description: 'Publish 2 conversations to establish your workflow', xp: 100, icon: '\u{1F6B6}', tier: 'bronze', category: 'onboarding', featured: true },
  { id: 'login_streak_1', name: 'Checking the PDA', description: 'Hit your first daily login streak milestone', xp: 100, icon: '\u{1F4F1}', tier: 'bronze', category: 'onboarding' },
  { id: 'challenge_apprentice', name: 'Challenge Accepted', description: 'Complete your first mission board challenge', xp: 150, icon: '\u{1F3AF}', tier: 'bronze', category: 'onboarding', featured: true },
  { id: 'mission_apprentice', name: 'Mission Cadet', description: 'Complete 3 mission board challenges', xp: 225, icon: '\u{1F9ED}', tier: 'silver', category: 'onboarding' },

  { id: 'first_upvote_received', name: 'Signal Received', description: 'Earn your first community upvote', xp: 100, icon: '\u{1F44D}', tier: 'bronze', category: 'social' },
  { id: 'rising_signal', name: 'Rising Signal', description: 'Receive 10 total upvotes', xp: 225, icon: '\u{1F4E3}', tier: 'bronze', category: 'social' },
  { id: 'upvote_wave', name: 'Signal Boost', description: 'Collect 10 upvotes in a single week', xp: 300, icon: '\u{1F4E1}', tier: 'silver', category: 'social' },
  { id: 'profile_spotlight', name: 'Eyes on You', description: 'Reach your first profile view milestone', xp: 225, icon: '\u{1F441}', tier: 'silver', category: 'social' },
  { id: 'popular_stalker', name: 'Popular Stalker', description: 'Receive 50 total downloads', xp: 500, icon: '\u{1F4E5}', tier: 'silver', category: 'social' },
  { id: 'community_favorite', name: 'Community Favorite', description: 'Receive 25 total upvotes', xp: 500, icon: '\u{2B50}', tier: 'silver', category: 'social', featured: true },
  { id: 'crowd_pleaser', name: 'Crowd Pleaser', description: 'Receive 75 total upvotes', xp: 800, icon: '\u{1F3C6}', tier: 'gold', category: 'social', featured: true },

  { id: 'first_publish', name: 'First Steps', description: 'Publish your first conversation', xp: 125, icon: '\u{1F4AC}', tier: 'bronze', category: 'discovery', featured: true },
  { id: 'branching_out', name: 'Branching Out', description: 'Publish a conversation with 5+ branches', xp: 150, icon: '\u{1F333}', tier: 'bronze', category: 'discovery' },
  { id: 'story_weaver', name: 'Story Weaver', description: 'Publish a conversation with 15+ turns', xp: 350, icon: '\u{1F9F5}', tier: 'gold', category: 'discovery' },
  { id: 'cartographer', name: 'Cartographer', description: 'Publish 5 conversations', xp: 325, icon: '\u{1F5FA}', tier: 'silver', category: 'discovery' },
  { id: 'web_of_lies', name: 'Web of Lies', description: 'Publish a conversation with 10+ turns', xp: 200, icon: '\u{1F578}', tier: 'silver', category: 'discovery' },
  { id: 'new_faction_scout', name: 'New Ground', description: 'Publish in a new faction for the first time', xp: 175, icon: '\u{1F9ED}', tier: 'bronze', category: 'discovery' },
  { id: 'faction_diplomat', name: 'Faction Diplomat', description: 'Publish conversations for 3 different factions', xp: 375, icon: '\u{1F91D}', tier: 'silver', category: 'discovery', featured: true },
  { id: 'zone_encyclopedist', name: 'Zone Encyclopedist', description: 'Publish conversations for all factions', xp: 1000, icon: '\u{1F4DA}', tier: 'gold', category: 'discovery', featured: true },
  { id: 'flow_restorer', name: 'Flow Restorer', description: 'Import a flow and improve it into something publishable', xp: 275, icon: '\u{1F527}', tier: 'silver', category: 'discovery' },
  { id: 'uncommon_operator', name: 'Odd Operator', description: 'Publish using uncommon command types', xp: 300, icon: '\u{1F9EA}', tier: 'silver', category: 'discovery' },

  { id: 'outcome_engineer', name: 'Outcome Engineer', description: 'Use 4+ different outcome types in one conversation', xp: 250, icon: '\u{2699}', tier: 'silver', category: 'mastery' },
  { id: 'branch_architect', name: 'Branch Architect', description: 'Publish a conversation with 8+ branches', xp: 350, icon: '\u{1F332}', tier: 'silver', category: 'mastery' },
  { id: 'precondition_master', name: 'Precondition Master', description: 'Use 5+ preconditions in one conversation', xp: 250, icon: '\u{1F512}', tier: 'silver', category: 'mastery' },
  { id: 'precondition_tactician', name: 'Condition Tactician', description: 'Use 8+ preconditions in one conversation', xp: 475, icon: '\u{1F3AF}', tier: 'gold', category: 'mastery' },
  { id: 'quality_crafter', name: 'Quality Crafter', description: 'Publish a 5-star quality conversation', xp: 375, icon: '\u{1F48E}', tier: 'silver', category: 'mastery', featured: true },
  { id: 'systems_polymath', name: 'Systems Polymath', description: 'Show strong variety across outcomes and preconditions in one publish', xp: 425, icon: '\u{1F9E0}', tier: 'gold', category: 'mastery' },
  { id: 'clean_publish_streak', name: 'Clean Hands', description: 'Chain together validation-clean publishes', xp: 450, icon: '\u{1F9FC}', tier: 'gold', category: 'mastery' },
  { id: 'four_star_streak', name: 'Reliable Signal', description: 'Publish consecutive 4-star-or-better conversations', xp: 450, icon: '\u{1F4F6}', tier: 'gold', category: 'mastery' },
  { id: 'prolific_writer', name: 'Prolific Writer', description: 'Publish 10 conversations', xp: 750, icon: '\u{270D}', tier: 'silver', category: 'mastery' },
  { id: 'zone_veteran', name: 'Zone Veteran', description: 'Publish 50 conversations', xp: 2500, icon: '\u{1F396}', tier: 'gold', category: 'mastery', featured: true },
  { id: 'streak_3', name: 'On a Roll', description: 'Maintain a 3-week publish streak', xp: 500, icon: '\u{1F525}', tier: 'bronze', category: 'mastery' },
  { id: 'streak_10', name: 'Zone Regular', description: 'Maintain a 10-week publish streak', xp: 2500, icon: '\u{1F31F}', tier: 'gold', category: 'mastery', featured: true },

  { id: 'bronze_complete', name: 'Bronze Circuit', description: 'Unlock every bronze achievement', xp: 600, icon: '\u{1F9F1}', tier: 'silver', category: 'collection' },
  { id: 'onboarding_complete', name: 'Onboarding Circuit', description: 'Unlock every onboarding achievement', xp: 700, icon: '\u{1F6E0}', tier: 'silver', category: 'collection' },
  { id: 'silver_complete', name: 'Silver Circuit', description: 'Unlock every silver achievement', xp: 1100, icon: '\u{1F48D}', tier: 'gold', category: 'collection', featured: true },
  { id: 'faction_complete', name: 'Faction Cabinet', description: 'Unlock every faction-focused achievement', xp: 900, icon: '\u{1F5C3}', tier: 'gold', category: 'collection' },

  { id: 'night_shift', name: 'Night Shift', description: 'Publish when the Zone should be asleep', xp: 225, icon: '\u{1F319}', tier: 'silver', category: 'discovery', hidden: true },
  { id: 'zone_whisperer', name: 'Zone Whisperer', description: 'Uncover one of the Zone\'s stranger secrets', xp: 625, icon: '\u{1F47B}', tier: 'gold', category: 'collection', hidden: true },

  // ─── Extended catalog ──────────────────────────────────────────────────────
  { id: 'callsign_chosen', name: 'Callsign Chosen', description: 'Set a community display name so stalkers know who they\'re hailing', xp: 75, icon: '\u{1F4DB}', tier: 'bronze', category: 'onboarding' },
  { id: 'login_streak_7', name: 'Weeklong Watch', description: 'Log in for 7 consecutive days', xp: 350, icon: '\u{1F5D3}', tier: 'silver', category: 'onboarding' },
  { id: 'login_streak_30', name: 'Zone Resident', description: 'Log in for 30 consecutive days', xp: 1300, icon: '\u{1F3E0}', tier: 'gold', category: 'onboarding', featured: true },
  { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Publish on both Saturday and Sunday of the same week', xp: 200, icon: '\u{1F3D5}', tier: 'silver', category: 'discovery' },
  { id: 'dawn_patrol', name: 'Dawn Patrol', description: 'Publish a conversation between 04:00 and 07:00 local time', xp: 250, icon: '\u{1F305}', tier: 'silver', category: 'discovery', hidden: true },
  { id: 'iron_scribe', name: 'Iron Scribe', description: 'Publish 25 conversations without missing a quality check', xp: 1000, icon: '\u{1F4DC}', tier: 'gold', category: 'mastery' },

  { id: 'commentator', name: 'Commentator', description: 'Leave constructive feedback on 10 community cards', xp: 250, icon: '\u{1F4AC}', tier: 'bronze', category: 'social' },
  { id: 'library_patron', name: 'Library Patron', description: 'Import a published flow and star the original', xp: 200, icon: '\u{1F4D6}', tier: 'bronze', category: 'social' },
  { id: 'first_friend', name: 'First Friend', description: 'Gain your first community follower', xp: 175, icon: '\u{1F91D}', tier: 'bronze', category: 'social' },
  { id: 'download_centurion', name: 'Download Centurion', description: 'Surpass 100 total downloads across your cards', xp: 900, icon: '\u{1F6F0}', tier: 'silver', category: 'social' },
  { id: 'download_legion', name: 'Download Legion', description: 'Surpass 500 total downloads across your cards', xp: 2250, icon: '\u{1F6F8}', tier: 'gold', category: 'social', featured: true },
  { id: 'upvote_legend', name: 'Upvote Legend', description: 'Receive 250 total upvotes', xp: 2000, icon: '\u{1F451}', tier: 'gold', category: 'social', featured: true },

  { id: 'artifact_hunter', name: 'Artifact Hunter', description: 'Reference 10 distinct artifact item IDs across your conversations', xp: 425, icon: '\u{1F52E}', tier: 'silver', category: 'discovery' },
  { id: 'mutant_mythographer', name: 'Mutant Mythographer', description: 'Mention every mutant type at least once across your published cards', xp: 800, icon: '\u{1F43A}', tier: 'gold', category: 'discovery' },
  { id: 'zone_lorekeeper', name: 'Zone Lorekeeper', description: 'Publish conversations set in 5 different Zone locations', xp: 550, icon: '\u{1F5FA}', tier: 'silver', category: 'discovery' },

  { id: 'gold_circuit', name: 'Gold Circuit', description: 'Unlock every gold-tier achievement', xp: 2500, icon: '\u{1F3C5}', tier: 'gold', category: 'collection', featured: true },
  { id: 'hidden_circuit', name: 'Hidden Circuit', description: 'Uncover every hidden achievement', xp: 1500, icon: '\u{1F5DD}', tier: 'gold', category: 'collection', hidden: true },
  { id: 'chaos_director', name: 'Chaos Director', description: 'Publish a single conversation with 12+ branches and 6+ outcome types', xp: 900, icon: '\u{1F39E}', tier: 'gold', category: 'mastery' },
  { id: 'ironclad_finish', name: 'Ironclad Finish', description: 'Publish 5 conversations in a row that all earn a quality score of 5', xp: 1100, icon: '\u{1F6E1}', tier: 'gold', category: 'mastery', featured: true },
  { id: 'speedrunner', name: 'Speedrunner', description: 'Publish three conversations in a single day without dropping quality', xp: 600, icon: '\u{23F1}', tier: 'silver', category: 'mastery' },
];

export function getAchievementById(id: AchievementId): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(achievement => achievement.category === category);
}

export function isAchievementRare(achievement: Achievement): boolean {
  return achievement.tier === 'gold' || Boolean(achievement.hidden);
}

export function getVisibleAchievementCatalog(): Achievement[] {
  return ACHIEVEMENTS.filter(achievement => !achievement.hidden && !isAchievementUnimplemented(achievement));
}

/**
 * Full catalog minus `unimplemented`. Hidden rewards stay included so the
 * mystery silhouettes still render on the wall.
 */
export function getWallAchievementCatalog(): Achievement[] {
  return ACHIEVEMENTS.filter(achievement => !isAchievementUnimplemented(achievement));
}

// ─── Local Achievement Storage (anti-abuse: tracked locally + server) ────────

const LOCAL_ACHIEVEMENTS_KEY = 'panda-gf-achievements';

export type UserMissionProgressRecord = {
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

type SyncedGamificationState = {
  achievements: AchievementId[];
  streaks: {
    publish_streak: number;
    longest_streak: number;
    last_publish_week: string;
    login_streak: number;
    last_login_date: string;
  } | null;
  missions: UserMissionProgressRecord[];
};

let syncedGamificationState: SyncedGamificationState | null = null;

function isAchievementId(value: string): value is AchievementId {
  return ACHIEVEMENTS.some(achievement => achievement.id === value);
}

function readCachedAchievements(): AchievementId[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ACHIEVEMENTS_KEY);
    const parsed = raw ? JSON.parse(raw) as string[] : [];
    return parsed.filter(isAchievementId);
  } catch {
    return [];
  }
}

function writeCachedAchievements(ids: AchievementId[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_ACHIEVEMENTS_KEY, JSON.stringify(Array.from(new Set(ids))));
}

export function setSyncedGamificationState(state: {
  achievements?: string[] | null;
  streaks?: {
    publish_streak: number;
    longest_streak: number;
    last_publish_week: string;
    login_streak: number;
    last_login_date: string;
  } | null;
  missions?: UserMissionProgressRecord[] | null;
} | null): void {
  if (!state) {
    syncedGamificationState = null;
    return;
  }

  const achievements = (state.achievements ?? []).filter(isAchievementId);
  syncedGamificationState = {
    achievements,
    streaks: state.streaks ?? null,
    missions: state.missions ?? [],
  };

  writeCachedAchievements(achievements);
  writeCachedMissionRecords(state.missions ?? []);

  if (state.streaks) {
    saveStreakData({
      ...getStreakData(),
      currentStreak: state.streaks.publish_streak,
      longestStreak: state.streaks.longest_streak,
      lastPublishWeek: state.streaks.last_publish_week,
    });
    saveLoginStreak({
      currentStreak: state.streaks.login_streak,
      lastLoginDate: state.streaks.last_login_date,
    });
  }
}

export function getUnlockedAchievements(): AchievementId[] {
  if (syncedGamificationState) return syncedGamificationState.achievements;
  return readCachedAchievements();
}

export function isAchievementUnlocked(id: AchievementId): boolean {
  return getUnlockedAchievements().includes(id);
}

/** Marks an achievement as unlocked locally. Returns true if it was newly unlocked. */
export function unlockAchievementLocally(id: AchievementId): boolean {
  const current = getUnlockedAchievements();
  if (current.includes(id)) return false;
  const updated = [...current, id];
  writeCachedAchievements(updated);
  if (syncedGamificationState) {
    syncedGamificationState = {
      ...syncedGamificationState,
      achievements: updated,
    };
  }
  return true;
}

// ─── Streak System ───────────────────────────────────────────────────────────

const LOCAL_STREAK_KEY = 'panda-gf-streak';

export type StreakData = {
  currentStreak: number;       // consecutive weeks with a publish
  lastPublishWeek: string;     // ISO week string "YYYY-WNN"
  longestStreak: number;
  shieldAvailable: boolean;    // one free miss, resets monthly
  shieldMonth: string;         // "YYYY-MM" when shield was last reset
};

function getIsoWeek(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Parse ISO week string into {year, week} */
function parseIsoWeek(weekStr: string): { year: number; week: number } | null {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  return { year: parseInt(match[1], 10), week: parseInt(match[2], 10) };
}

function weekDifference(a: string, b: string): number {
  const pa = parseIsoWeek(a);
  const pb = parseIsoWeek(b);
  if (!pa || !pb) return Infinity;
  return (pb.year - pa.year) * 52 + (pb.week - pa.week);
}

export function getStreakData(): StreakData {
  const fallback = (() => {
    if (typeof window === 'undefined') {
      return { currentStreak: 0, lastPublishWeek: '', longestStreak: 0, shieldAvailable: true, shieldMonth: '' };
    }
    try {
      const raw = window.localStorage.getItem(LOCAL_STREAK_KEY);
      if (!raw) return { currentStreak: 0, lastPublishWeek: '', longestStreak: 0, shieldAvailable: true, shieldMonth: '' };
      return JSON.parse(raw) as StreakData;
    } catch {
      return { currentStreak: 0, lastPublishWeek: '', longestStreak: 0, shieldAvailable: true, shieldMonth: '' };
    }
  })();

  if (!syncedGamificationState?.streaks) return fallback;

  return {
    currentStreak: syncedGamificationState.streaks.publish_streak,
    longestStreak: syncedGamificationState.streaks.longest_streak,
    lastPublishWeek: syncedGamificationState.streaks.last_publish_week,
    shieldAvailable: fallback.shieldAvailable,
    shieldMonth: fallback.shieldMonth,
  };
}

function saveStreakData(data: StreakData): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_STREAK_KEY, JSON.stringify(data));
  }
  if (syncedGamificationState) {
    syncedGamificationState = {
      ...syncedGamificationState,
      streaks: {
        publish_streak: data.currentStreak,
        longest_streak: data.longestStreak,
        last_publish_week: data.lastPublishWeek,
        login_streak: syncedGamificationState.streaks?.login_streak ?? getLoginStreak().currentStreak,
        last_login_date: syncedGamificationState.streaks?.last_login_date ?? getLoginStreak().lastLoginDate,
      },
    };
  }
}

/**
 * Call after a successful publish. Updates streak data and returns
 * { streakChanged, newStreak, shieldUsed } for UI feedback.
 */
export function recordPublishForStreak(): { streakChanged: boolean; newStreak: number; shieldUsed: boolean } {
  const now = new Date();
  const currentWeek = getIsoWeek(now);
  const currentMonth = getYearMonth(now);
  const data = getStreakData();

  // Reset shield monthly
  if (data.shieldMonth !== currentMonth) {
    data.shieldAvailable = true;
    data.shieldMonth = currentMonth;
  }

  // Already published this week — no streak change
  if (data.lastPublishWeek === currentWeek) {
    saveStreakData(data);
    return { streakChanged: false, newStreak: data.currentStreak, shieldUsed: false };
  }

  const gap = data.lastPublishWeek ? weekDifference(data.lastPublishWeek, currentWeek) : 0;
  let shieldUsed = false;

  if (gap === 1) {
    // Consecutive week — extend streak
    data.currentStreak += 1;
  } else if (gap === 2 && data.shieldAvailable) {
    // Missed one week but shield available
    data.shieldAvailable = false;
    data.currentStreak += 1;
    shieldUsed = true;
  } else if (data.lastPublishWeek === '') {
    // First ever publish
    data.currentStreak = 1;
  } else {
    // Streak broken
    data.currentStreak = 1;
  }

  data.lastPublishWeek = currentWeek;
  if (data.currentStreak > data.longestStreak) {
    data.longestStreak = data.currentStreak;
  }

  saveStreakData(data);
  return { streakChanged: true, newStreak: data.currentStreak, shieldUsed };
}

// ─── Missions: Daily + Weekly Progression ────────────────────────────────────

export type MissionSlot = 'daily_easy' | 'daily_medium' | 'daily_hard' | 'weekly';
export type MissionCadence = 'daily' | 'weekly';
export type MissionCategory = 'publishing' | 'faction' | 'outcomes' | 'preconditions' | 'community';
export type MissionEventType =
  | 'publish_created'
  | 'faction_published'
  | 'outcome_type_used'
  | 'precondition_count_reached'
  | 'upvote_received'
  | 'download_milestone_reached';

export type MissionEvent = {
  type: MissionEventType;
  count?: number;
  faction?: string;
  outcomeTypes?: string[];
  preconditionCount?: number;
  totalUpvotes?: number;
  totalDownloads?: number;
};

export type MissionDefinition = {
  id: string;
  name: string;
  description: string;
  xp: number;
  slot: MissionSlot;
  cadence: MissionCadence;
  goal: number;
  category: MissionCategory;
  rewardLabel?: string;
  evaluateProgress: (event: MissionEvent, state: UserMissionProgressRecord, nextState: UserMissionProgressRecord) => number;
};

export type ActiveMission = MissionDefinition & {
  progress: number;
  completed: boolean;
  progressRatio: number;
  periodKey: string;
  completedAt: string | null;
  meta: Record<string, unknown>;
};

export type MissionResetInfo = {
  dailyLabel: string;
  weeklyLabel: string;
  dailyHoursRemaining: number;
};

const LOCAL_MISSION_PROGRESS_KEY = 'panda-gf-mission-progress';

function getTodayDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function startOfNextUtcDay(from = new Date()): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1, 0, 0, 0, 0));
  return next;
}

function getCurrentUtcWeekKey(date = new Date()): string {
  return getIsoWeek(date);
}

function getMissionPeriodKey(cadence: MissionCadence, date = new Date()): string {
  return cadence === 'weekly' ? getCurrentUtcWeekKey(date) : getTodayDateString(date);
}

function ensureMissionMeta(meta: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return meta && typeof meta === 'object' ? { ...meta } : {};
}

function readCachedMissionRecords(): UserMissionProgressRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_MISSION_PROGRESS_KEY);
    return raw ? JSON.parse(raw) as UserMissionProgressRecord[] : [];
  } catch {
    return [];
  }
}

function writeCachedMissionRecords(records: UserMissionProgressRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_MISSION_PROGRESS_KEY, JSON.stringify(records));
}

function getMissionRecords(): UserMissionProgressRecord[] {
  if (syncedGamificationState) return syncedGamificationState.missions;
  return readCachedMissionRecords();
}

function saveMissionRecords(records: UserMissionProgressRecord[]): void {
  writeCachedMissionRecords(records);
  if (syncedGamificationState) {
    syncedGamificationState = {
      ...syncedGamificationState,
      missions: records,
    };
  }
}

function updateMissionRecord(record: UserMissionProgressRecord): void {
  const records = getMissionRecords();
  const idx = records.findIndex(entry => entry.mission_id === record.mission_id && entry.period_key === record.period_key);
  const next = [...records];
  if (idx >= 0) next[idx] = record;
  else next.push(record);
  saveMissionRecords(next);
}

function createPublishIncrementer(slot: MissionSlot, name: string, description: string, xp: number, goal: number): MissionDefinition {
  return {
    id: `${slot}-publish-${goal}`,
    slot,
    cadence: slot === 'weekly' ? 'weekly' : 'daily',
    name,
    description,
    xp,
    goal,
    category: 'publishing',
    rewardLabel: `+${xp} XP`,
    evaluateProgress: (event) => event.type === 'publish_created' ? Math.max(event.count ?? 1, 0) : 0,
  };
}

function createUniqueFactionMission(slot: MissionSlot, name: string, description: string, xp: number, goal: number): MissionDefinition {
  return {
    id: `${slot}-faction-${goal}`,
    slot,
    cadence: slot === 'weekly' ? 'weekly' : 'daily',
    name,
    description,
    xp,
    goal,
    category: 'faction',
    rewardLabel: `+${xp} XP`,
    evaluateProgress: (event, state, nextState) => {
      if (event.type !== 'faction_published' || !event.faction) return 0;
      const seen = new Set(Array.isArray(state.meta?.seen) ? state.meta.seen.filter((value): value is string => typeof value === 'string') : []);
      if (seen.has(event.faction)) return 0;
      seen.add(event.faction);
      nextState.meta = { ...ensureMissionMeta(nextState.meta), seen: Array.from(seen) };
      return 1;
    },
  };
}

function createUniqueOutcomeMission(slot: MissionSlot, name: string, description: string, xp: number, goal: number): MissionDefinition {
  return {
    id: `${slot}-outcomes-${goal}`,
    slot,
    cadence: slot === 'weekly' ? 'weekly' : 'daily',
    name,
    description,
    xp,
    goal,
    category: 'outcomes',
    rewardLabel: `+${xp} XP`,
    evaluateProgress: (event, state, nextState) => {
      if (event.type !== 'outcome_type_used') return 0;
      const seen = new Set(Array.isArray(state.meta?.seen) ? state.meta.seen.filter((value): value is string => typeof value === 'string') : []);
      let added = 0;
      for (const outcomeType of event.outcomeTypes ?? []) {
        if (!seen.has(outcomeType)) {
          seen.add(outcomeType);
          added += 1;
        }
      }
      if (added > 0) {
        nextState.meta = { ...ensureMissionMeta(nextState.meta), seen: Array.from(seen) };
      }
      return added;
    },
  };
}

function createPreconditionMission(slot: MissionSlot, name: string, description: string, xp: number, goal: number): MissionDefinition {
  return {
    id: `${slot}-preconditions-${goal}`,
    slot,
    cadence: slot === 'weekly' ? 'weekly' : 'daily',
    name,
    description,
    xp,
    goal,
    category: 'preconditions',
    rewardLabel: `+${xp} XP`,
    evaluateProgress: (event, state) => {
      if (event.type !== 'precondition_count_reached') return 0;
      const absolute = Math.min(event.preconditionCount ?? 0, goal);
      return Math.max(0, absolute - state.progress);
    },
  };
}

function createMilestoneMission(slot: MissionSlot, name: string, description: string, xp: number, goal: number, type: 'upvote_received' | 'download_milestone_reached'): MissionDefinition {
  return {
    id: `${slot}-${type === 'upvote_received' ? 'upvotes' : 'downloads'}-${goal}`,
    slot,
    cadence: slot === 'weekly' ? 'weekly' : 'daily',
    name,
    description,
    xp,
    goal,
    category: 'community',
    rewardLabel: `+${xp} XP`,
    evaluateProgress: (event, state) => {
      if (event.type !== type) return 0;
      const total = type === 'upvote_received' ? (event.totalUpvotes ?? 0) : (event.totalDownloads ?? 0);
      const absolute = Math.min(total, goal);
      return Math.max(0, absolute - state.progress);
    },
  };
}

const DAILY_EASY_MISSIONS: MissionDefinition[] = [
  createPublishIncrementer('daily_easy', 'Warm-Up Publish', 'Publish 1 conversation today.', 15, 1),
  createPreconditionMission('daily_easy', 'Light Setup', 'Use at least 1 precondition in a published conversation today.', 15, 1),
  createUniqueOutcomeMission('daily_easy', 'Quick Mix', 'Use 1 outcome type in a published conversation today.', 15, 1),
  createMilestoneMission('daily_easy', 'First Signal', 'Receive 1 upvote on your published work today.', 20, 1, 'upvote_received'),
  createMilestoneMission('daily_easy', 'Field Intel', 'Reach 5 total downloads on your published work today.', 20, 5, 'download_milestone_reached'),
];

const DAILY_MEDIUM_MISSIONS: MissionDefinition[] = [
  createPublishIncrementer('daily_medium', 'Active Patrol', 'Publish 2 conversations today.', 30, 2),
  createUniqueFactionMission('daily_medium', 'Cross-Faction Contact', 'Publish conversations for 2 different factions today.', 35, 2),
  createUniqueOutcomeMission('daily_medium', 'Outcome Variety', 'Use 2 different outcome types across your published conversations today.', 35, 2),
  createPreconditionMission('daily_medium', 'Prepared Route', 'Use 3 preconditions across your published conversations today.', 35, 3),
  createMilestoneMission('daily_medium', 'Audience Pickup', 'Reach 10 total downloads on your published work today.', 35, 10, 'download_milestone_reached'),
];

const DAILY_HARD_MISSIONS: MissionDefinition[] = [
  createPublishIncrementer('daily_hard', 'Deep Run', 'Publish 3 conversations today.', 50, 3),
  createUniqueFactionMission('daily_hard', 'Zone Tour', 'Publish conversations for 3 different factions today.', 55, 3),
  createUniqueOutcomeMission('daily_hard', 'Systems Engineer', 'Use 4 different outcome types across your published conversations today.', 55, 4),
  createPreconditionMission('daily_hard', 'Condition Stack', 'Hit 5 preconditions in a published conversation today.', 55, 5),
  createMilestoneMission('daily_hard', 'Crowd Checkpoint', 'Reach 3 total upvotes on your published work today.', 60, 3, 'upvote_received'),
];

const WEEKLY_MISSIONS: MissionDefinition[] = [
  createPublishIncrementer('weekly', 'Weekly Output', 'Publish 5 conversations this week.', 90, 5),
  createPublishIncrementer('weekly', 'Weekly Surge', 'Publish 8 conversations this week.', 120, 8),
  createUniqueFactionMission('weekly', 'Multi-Front Campaign', 'Publish conversations for 4 different factions this week.', 100, 4),
  createUniqueOutcomeMission('weekly', 'Outcome Arsenal', 'Use 6 different outcome types across your published conversations this week.', 100, 6),
  createPreconditionMission('weekly', 'Preparation Doctrine', 'Reach 12 total preconditions across your published conversations this week.', 110, 12),
  createMilestoneMission('weekly', 'Community Momentum', 'Reach 25 total downloads on your published work this week.', 100, 25, 'download_milestone_reached'),
  createMilestoneMission('weekly', 'Community Favorite Push', 'Reach 5 total upvotes on your published work this week.', 100, 5, 'upvote_received'),
];

const MISSION_POOLS: Record<MissionSlot, MissionDefinition[]> = {
  daily_easy: DAILY_EASY_MISSIONS,
  daily_medium: DAILY_MEDIUM_MISSIONS,
  daily_hard: DAILY_HARD_MISSIONS,
  weekly: WEEKLY_MISSIONS,
};

function getMissionSeed(periodKey: string, slot: MissionSlot): number {
  const seedSource = `${periodKey}:${slot}`;
  let seed = 0;
  for (let i = 0; i < seedSource.length; i += 1) {
    seed += seedSource.charCodeAt(i) * (i + 1);
  }
  return seed;
}

export function getMissionDefinition(slot: MissionSlot, date = new Date()): MissionDefinition {
  const pool = MISSION_POOLS[slot];
  const periodKey = getMissionPeriodKey(slot === 'weekly' ? 'weekly' : 'daily', date);
  return pool[getMissionSeed(periodKey, slot) % pool.length];
}

function buildMissionRecord(definition: MissionDefinition, existing?: UserMissionProgressRecord | null, date = new Date()): UserMissionProgressRecord {
  const periodKey = getMissionPeriodKey(definition.cadence, date);
  return {
    mission_id: definition.id,
    mission_slot: definition.slot,
    cadence: definition.cadence,
    category: definition.category,
    progress: Math.min(existing?.progress ?? 0, definition.goal),
    goal: definition.goal,
    period_key: periodKey,
    completed_at: existing?.completed_at ?? null,
    meta: ensureMissionMeta(existing?.meta),
    updated_at: existing?.updated_at,
  };
}

export function getActiveMissions(date = new Date()): ActiveMission[] {
  const records = getMissionRecords();
  return (Object.keys(MISSION_POOLS) as MissionSlot[]).map((slot) => {
    const definition = getMissionDefinition(slot, date);
    const periodKey = getMissionPeriodKey(definition.cadence, date);
    const existing = records.find(record => record.mission_id === definition.id && record.period_key === periodKey) ?? null;
    const state = buildMissionRecord(definition, existing, date);
    return {
      ...definition,
      progress: state.progress,
      completed: state.progress >= state.goal || Boolean(state.completed_at),
      progressRatio: Math.min(state.progress / Math.max(state.goal, 1), 1),
      periodKey,
      completedAt: state.completed_at,
      meta: ensureMissionMeta(state.meta),
    };
  });
}

export function getMissionResetInfo(now = new Date()): MissionResetInfo {
  const nextDailyReset = startOfNextUtcDay(now);
  const dailyMs = Math.max(nextDailyReset.getTime() - now.getTime(), 0);
  const dailyHours = Math.ceil(dailyMs / 3_600_000);
  const nextWeeklyDate = (() => {
    const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const day = cursor.getUTCDay();
    const daysUntilMonday = (8 - (day === 0 ? 7 : day)) % 7 || 7;
    cursor.setUTCDate(cursor.getUTCDate() + daysUntilMonday);
    return cursor;
  })();

  return {
    dailyLabel: `New daily missions in ${dailyHours}h`,
    weeklyLabel: `Weekly reset ${nextWeeklyDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    dailyHoursRemaining: dailyHours,
  };
}

export function isAnyDailyMissionCompleted(): boolean {
  return getActiveMissions().some(mission => mission.cadence === 'daily' && mission.completed);
}

export type MissionProgressResult = {
  activeMissions: ActiveMission[];
  changedMissions: UserMissionProgressRecord[];
  completedMissions: ActiveMission[];
  xpAwarded: number;
};

export function evaluateMissionProgress(event: MissionEvent, date = new Date()): MissionProgressResult {
  const activeMissions = getActiveMissions(date);
  const changedMissions: UserMissionProgressRecord[] = [];
  const completedMissions: ActiveMission[] = [];
  let xpAwarded = 0;

  for (const mission of activeMissions) {
    const baseline = buildMissionRecord(mission, {
      mission_id: mission.id,
      mission_slot: mission.slot,
      cadence: mission.cadence,
      category: mission.category,
      progress: mission.progress,
      goal: mission.goal,
      period_key: mission.periodKey,
      completed_at: mission.completedAt,
      meta: mission.meta,
    }, date);
    const nextState = buildMissionRecord(mission, baseline, date);
    const increment = mission.evaluateProgress(event, baseline, nextState);
    if (increment <= 0) continue;

    nextState.progress = Math.min(mission.goal, baseline.progress + increment);
    nextState.updated_at = new Date().toISOString();

    const wasCompleted = baseline.progress >= baseline.goal || Boolean(baseline.completed_at);
    const isCompleted = nextState.progress >= mission.goal;
    if (!wasCompleted && isCompleted) {
      nextState.completed_at = nextState.updated_at;
      xpAwarded += mission.xp;
      completedMissions.push({
        ...mission,
        progress: nextState.progress,
        completed: true,
        progressRatio: 1,
        completedAt: nextState.completed_at,
        meta: ensureMissionMeta(nextState.meta),
      });
    }

    updateMissionRecord(nextState);
    changedMissions.push(nextState);
  }

  return {
    activeMissions: getActiveMissions(date),
    changedMissions,
    completedMissions,
    xpAwarded,
  };
}

export function buildMissionEventsFromPublish(conversation: Conversation): MissionEvent[] {
  const allChoices = conversation.turns.flatMap(turn => turn.choices);
  const outcomeTypes = Array.from(new Set(allChoices.flatMap(choice => choice.outcomes).map(outcome => outcome.command).filter(Boolean)));
  return [
    { type: 'publish_created', count: 1 },
    { type: 'faction_published', faction: conversation.faction },
    { type: 'outcome_type_used', outcomeTypes },
    { type: 'precondition_count_reached', preconditionCount: conversation.preconditions.length },
  ];
}

export function getMissionCompletionHeadline(completedMissions: ActiveMission[]): string {
  if (completedMissions.length === 0) return 'Mission Complete!';
  if (completedMissions.length === 1) return completedMissions[0].name;
  return `${completedMissions.length} missions completed`;
}

// ─── Quality Score ───────────────────────────────────────────────────────────

export type QualityBreakdown = {
  branchDepth: number;    // 0-1 score
  outcomeVariety: number; // 0-1 score
  preconditions: number;  // 0-1 score
  turnCount: number;      // 0-1 score
  hasRelationship: number; // 0 or 1
  totalStars: number;     // 1-5 stars
};

export function calculateQualityScore(conversation: Conversation): QualityBreakdown {
  const turns = conversation.turns;
  const allChoices = turns.flatMap(t => t.choices);
  const allOutcomes = allChoices.flatMap(c => c.outcomes);

  // Branch depth: count unique continueTo targets (branching complexity)
  const branchTargets = new Set(allChoices.map(c => c.continueTo).filter(Boolean));
  const branchDepth = Math.min(branchTargets.size / 5, 1); // 5+ branches = max

  // Outcome variety: count unique outcome commands
  const outcomeTypes = new Set(allOutcomes.map(o => o.command));
  const outcomeVariety = Math.min(outcomeTypes.size / 4, 1); // 4+ types = max

  // Precondition count
  const preconditions = Math.min(conversation.preconditions.length / 3, 1); // 3+ = max

  // Turn count
  const turnCount = Math.min(turns.length / 6, 1); // 6+ turns = max

  // Relationship usage: check if any reply has relationship variants
  const hasRelationship = allChoices.some(c => c.replyRelHigh || c.replyRelLow) ? 1 : 0;

  // Weighted total → 0-5 stars
  const raw = (branchDepth * 0.25 + outcomeVariety * 0.25 + preconditions * 0.15 + turnCount * 0.25 + hasRelationship * 0.10) * 5;
  const totalStars = Math.max(1, Math.min(5, Math.round(raw)));

  return { branchDepth, outcomeVariety, preconditions, turnCount, hasRelationship, totalStars };
}

/** XP multiplier based on quality score (anti-abuse: low quality = no bonus) */
export function getQualityMultiplier(stars: number): number {
  if (stars <= 2) return 1.0;
  if (stars === 3) return 1.25;
  if (stars === 4) return 1.5;
  return 2.0; // 5 stars
}

// ─── Anti-Abuse: Daily XP Cap ────────────────────────────────────────────────

type DailyXpRecord = { date: string; earned: number };

function getDailyXpRecord(): DailyXpRecord {
  if (typeof window === 'undefined') return { date: getTodayDateString(), earned: 0 };
  try {
    const raw = window.localStorage.getItem(DAILY_XP_CAP_KEY);
    if (!raw) return { date: getTodayDateString(), earned: 0 };
    const parsed = JSON.parse(raw) as DailyXpRecord;
    if (parsed.date !== getTodayDateString()) {
      return { date: getTodayDateString(), earned: 0 }; // reset for new day
    }
    return parsed;
  } catch {
    return { date: getTodayDateString(), earned: 0 };
  }
}

function recordDailyXp(amount: number): void {
  const record = getDailyXpRecord();
  record.earned += amount;
  record.date = getTodayDateString();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DAILY_XP_CAP_KEY, JSON.stringify(record));
  }
}

/**
 * Clamp XP by daily cap. Returns the actual amount that can be awarded.
 * Core publish XP is exempt from the cap — only bonus gamification XP is capped.
 */
export function clampBonusXp(requestedAmount: number): number {
  const record = getDailyXpRecord();
  const remaining = Math.max(0, DAILY_XP_MAX - record.earned);
  const clamped = Math.min(requestedAmount, remaining);
  if (clamped > 0) recordDailyXp(clamped);
  return clamped;
}

// ─── Anti-Abuse: Cooldown Guard ──────────────────────────────────────────────

/** Returns true if the action is still on cooldown. */
export function isOnCooldown(actionKey: string): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(COOLDOWN_PREFIX + actionKey);
  if (!raw) return false;
  return Date.now() - parseInt(raw, 10) < MILESTONE_COOLDOWN_MS;
}

export function setCooldown(actionKey: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COOLDOWN_PREFIX + actionKey, String(Date.now()));
}

// ─── Publish Event: Check All Gamification Triggers ──────────────────────────

export type GamificationResult = {
  achievementsUnlocked: Achievement[];
  streakData: StreakData;
  missionXp: number;
  completedMissions: ActiveMission[];
  activeMissions: ActiveMission[];
  changedMissionRecords: UserMissionProgressRecord[];
  qualityStars: number;
  qualityMultiplier: number;
  streakInfo: { streakChanged: boolean; newStreak: number; shieldUsed: boolean };
  totalBonusXp: number;
};

/**
 * Evaluate all gamification triggers after a publish event.
 * This is the main entry point called from the publish flow.
 *
 * Anti-abuse measures:
 * - Achievements can only be unlocked once (local + server tracking)
 * - Daily challenge can only be completed once per day
 * - Bonus XP is capped at DAILY_XP_MAX per day
 * - Cooldowns prevent rapid-fire milestone claims
 * - Quality score prevents XP farming with empty/minimal conversations
 */
export function evaluatePublishGamification(
  conversation: Conversation,
  publishCount: number,
  totalDownloads: number,
  totalUpvotes: number,
  publishedFactions: string[],
): GamificationResult {
  const achievementsUnlocked: Achievement[] = [];
  let rawBonusXp = 0;

  // ── Achievements ──
  const branchCount = conversation.turns.length;
  const allChoices = conversation.turns.flatMap(t => t.choices);
  const allOutcomes = allChoices.flatMap(c => c.outcomes);
  const outcomeTypes = [...new Set(allOutcomes.map(o => o.command))];
  const quality = calculateQualityScore(conversation);
  const uniqueFactionCount = new Set(publishedFactions).size;
  const loginStreak = getLoginStreak().currentStreak;
  const uncommonOutcomeTypes = new Set([
    'spawn_custom_npc',
    'spawn_custom_npc_at',
    'teleport_npc_to_smart',
    'teleport_player_to_smart',
    'set_weather',
    'give_game_news',
    'give_task',
  ]);
  const currentHour = new Date().getHours();

  const checks: Array<{ id: AchievementId; condition: boolean }> = [
    { id: 'first_patrol', condition: publishCount >= 2 },
    { id: 'login_streak_1', condition: loginStreak >= 1 },
    { id: 'first_publish', condition: publishCount >= 1 },
    { id: 'branching_out', condition: branchCount >= 5 },
    { id: 'story_weaver', condition: branchCount >= 15 },
    { id: 'web_of_lies', condition: branchCount >= 10 },
    { id: 'new_faction_scout', condition: uniqueFactionCount >= 2 },
    { id: 'faction_diplomat', condition: uniqueFactionCount >= 3 },
    { id: 'zone_encyclopedist', condition: uniqueFactionCount >= 13 },
    { id: 'night_shift', condition: currentHour <= 4 },
    { id: 'popular_stalker', condition: totalDownloads >= 50 },
    { id: 'first_upvote_received', condition: totalUpvotes >= 1 },
    { id: 'rising_signal', condition: totalUpvotes >= 10 },
    { id: 'community_favorite', condition: totalUpvotes >= 25 },
    { id: 'crowd_pleaser', condition: totalUpvotes >= 75 },
    { id: 'outcome_engineer', condition: outcomeTypes.length >= 4 },
    { id: 'branch_architect', condition: branchCount >= 8 },
    { id: 'uncommon_operator', condition: outcomeTypes.some(type => uncommonOutcomeTypes.has(type)) },
    { id: 'precondition_master', condition: conversation.preconditions.length >= 5 },
    { id: 'precondition_tactician', condition: conversation.preconditions.length >= 8 },
    { id: 'systems_polymath', condition: outcomeTypes.length >= 4 && conversation.preconditions.length >= 3 },
    { id: 'cartographer', condition: publishCount >= 5 },
    { id: 'prolific_writer', condition: publishCount >= 10 },
    { id: 'zone_veteran', condition: publishCount >= 50 },
    { id: 'quality_crafter', condition: quality.totalStars >= 5 },
  ];

  for (const { id, condition } of checks) {
    if (condition && !isAchievementUnlocked(id) && !isOnCooldown(`ach-${id}`)) {
      const achievement = getAchievementById(id);
      if (achievement) {
        achievementsUnlocked.push(achievement);
        rawBonusXp += achievement.xp;
      }
    }
  }

  // ── Streak ──
  const streakInfo = recordPublishForStreak();
  const streak = getStreakData();

  // Check streak achievements
  if (streak.currentStreak >= 3 && !isAchievementUnlocked('streak_3')) {
    const a = getAchievementById('streak_3');
    if (a) {
      achievementsUnlocked.push(a);
      rawBonusXp += a.xp;
    }
  }
  if (streak.currentStreak >= 10 && !isAchievementUnlocked('streak_10')) {
    const a = getAchievementById('streak_10');
    if (a) {
      achievementsUnlocked.push(a);
      rawBonusXp += a.xp;
    }
  }

  const unlockedAfterChecks = new Set<AchievementId>([
    ...getUnlockedAchievements(),
    ...achievementsUnlocked.map(achievement => achievement.id),
  ]);
  const queueCollectionAchievement = (id: AchievementId, predicate: boolean) => {
    if (!predicate || unlockedAfterChecks.has(id) || isOnCooldown(`ach-${id}`)) return;
    const achievement = getAchievementById(id);
    if (!achievement) return;
    achievementsUnlocked.push(achievement);
    rawBonusXp += achievement.xp;
    unlockedAfterChecks.add(id);
  };
  // ── Mission Progress ──
  const missionResults = buildMissionEventsFromPublish(conversation).reduce<MissionProgressResult>((aggregate, event) => {
    const result = evaluateMissionProgress(event);
    const changedByKey = new Map<string, UserMissionProgressRecord>();
    for (const record of [...aggregate.changedMissions, ...result.changedMissions]) {
      changedByKey.set(`${record.mission_id}:${record.period_key}`, record);
    }
    const completedByKey = new Map<string, ActiveMission>();
    for (const mission of [...aggregate.completedMissions, ...result.completedMissions]) {
      completedByKey.set(`${mission.id}:${mission.periodKey}`, mission);
    }
    return {
      activeMissions: result.activeMissions,
      changedMissions: Array.from(changedByKey.values()),
      completedMissions: Array.from(completedByKey.values()),
      xpAwarded: aggregate.xpAwarded + result.xpAwarded,
    };
  }, {
    activeMissions: getActiveMissions(),
    changedMissions: [],
    completedMissions: [],
    xpAwarded: 0,
  });
  rawBonusXp += missionResults.xpAwarded;

  const completedMissionCount = getMissionRecords().filter((record) => Boolean(record.completed_at)).length;
  queueCollectionAchievement('challenge_apprentice', completedMissionCount >= 1);
  queueCollectionAchievement('mission_apprentice', completedMissionCount >= 3);

  const visibleBronzeIds = ACHIEVEMENTS.filter(achievement => achievement.tier === 'bronze' && !achievement.hidden).map(achievement => achievement.id);
  const visibleSilverIds = ACHIEVEMENTS.filter(achievement => achievement.tier === 'silver' && !achievement.hidden).map(achievement => achievement.id);
  const factionAchievementIds: AchievementId[] = ['new_faction_scout', 'faction_diplomat', 'zone_encyclopedist'];
  const onboardingAchievementIds: AchievementId[] = ['first_patrol', 'login_streak_1', 'challenge_apprentice', 'mission_apprentice'];
  queueCollectionAchievement('bronze_complete', visibleBronzeIds.every(id => unlockedAfterChecks.has(id)));
  queueCollectionAchievement('onboarding_complete', onboardingAchievementIds.every(id => unlockedAfterChecks.has(id)));
  queueCollectionAchievement('silver_complete', visibleSilverIds.every(id => unlockedAfterChecks.has(id)));
  queueCollectionAchievement('faction_complete', factionAchievementIds.every(id => unlockedAfterChecks.has(id)));

  // ── Quality Score ──
  const qualityMultiplier = getQualityMultiplier(quality.totalStars);

  return {
    achievementsUnlocked,
    missionXp: missionResults.xpAwarded,
    completedMissions: missionResults.completedMissions,
    activeMissions: missionResults.activeMissions,
    changedMissionRecords: missionResults.changedMissions,
    qualityStars: quality.totalStars,
    qualityMultiplier,
    streakInfo,
    streakData: streak,
    totalBonusXp: rawBonusXp,
  };
}

// ─── Login Streak (daily editor opens) ───────────────────────────────────────

const LOCAL_LOGIN_STREAK_KEY = 'panda-gf-login-streak';

export type LoginStreakData = {
  currentStreak: number;
  lastLoginDate: string; // YYYY-MM-DD
};

export function getLoginStreak(): LoginStreakData {
  const fallback = (() => {
    if (typeof window === 'undefined') return { currentStreak: 0, lastLoginDate: '' };
    try {
      const raw = window.localStorage.getItem(LOCAL_LOGIN_STREAK_KEY);
      if (!raw) return { currentStreak: 0, lastLoginDate: '' };
      return JSON.parse(raw) as LoginStreakData;
    } catch {
      return { currentStreak: 0, lastLoginDate: '' };
    }
  })();

  if (!syncedGamificationState?.streaks) return fallback;

  return {
    currentStreak: syncedGamificationState.streaks.login_streak,
    lastLoginDate: syncedGamificationState.streaks.last_login_date,
  };
}

function saveLoginStreak(data: LoginStreakData): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_LOGIN_STREAK_KEY, JSON.stringify(data));
  }
  if (syncedGamificationState) {
    syncedGamificationState = {
      ...syncedGamificationState,
      streaks: {
        publish_streak: syncedGamificationState.streaks?.publish_streak ?? getStreakData().currentStreak,
        longest_streak: syncedGamificationState.streaks?.longest_streak ?? getStreakData().longestStreak,
        last_publish_week: syncedGamificationState.streaks?.last_publish_week ?? getStreakData().lastPublishWeek,
        login_streak: data.currentStreak,
        last_login_date: data.lastLoginDate,
      },
    };
  }
}

/**
 * Record a daily login. Returns bonus XP (0 if already logged in today).
 * XP scales: 5, 10, 15, 20... capped at 50 per day.
 */
export function recordDailyLogin(): { xp: number; streak: number; isNew: boolean; loginStreakData: LoginStreakData } {
  const today = getTodayDateString();
  const data = getLoginStreak();

  if (data.lastLoginDate === today) {
    return { xp: 0, streak: data.currentStreak, isNew: false, loginStreakData: data };
  }

  // Check if yesterday — consecutive day
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (data.lastLoginDate === yesterdayStr) {
    data.currentStreak += 1;
  } else {
    data.currentStreak = 1;
  }
  data.lastLoginDate = today;

  saveLoginStreak(data);

  const xp = Math.min(data.currentStreak * 5, 50);
  return { xp, streak: data.currentStreak, isNew: true, loginStreakData: data };
}
