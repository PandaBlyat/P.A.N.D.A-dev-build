// P.A.N.D.A. Conversation Editor — Gamification Engine
// Achievements, streaks, daily challenges, and quality scoring with anti-abuse guards.

import type { Conversation } from './types';

// ─── Anti-Abuse Constants ────────────────────────────────────────────────────
const COOLDOWN_PREFIX = 'panda-gf-cd-';
const DAILY_XP_CAP_KEY = 'panda-gf-daily-xp';
const DAILY_XP_MAX = 500; // Max XP earnable from gamification events per day
const MILESTONE_COOLDOWN_MS = 5_000; // Min gap between milestone XP awards

// ─── Achievement Definitions ─────────────────────────────────────────────────

export type AchievementId =
  | 'first_publish'
  | 'branching_out'
  | 'web_of_lies'
  | 'faction_diplomat'
  | 'zone_encyclopedist'
  | 'popular_stalker'
  | 'community_favorite'
  | 'outcome_engineer'
  | 'precondition_master'
  | 'prolific_writer'
  | 'zone_veteran'
  | 'streak_3'
  | 'streak_10'
  | 'quality_crafter';

export type Achievement = {
  id: AchievementId;
  name: string;
  description: string;
  xp: number;
  icon: string; // emoji for now, simple and universal
  tier: 'bronze' | 'silver' | 'gold';
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_publish', name: 'First Steps', description: 'Publish your first conversation', xp: 25, icon: '\u{1F4AC}', tier: 'bronze' },
  { id: 'branching_out', name: 'Branching Out', description: 'Publish a conversation with 5+ branches', xp: 30, icon: '\u{1F333}', tier: 'bronze' },
  { id: 'web_of_lies', name: 'Web of Lies', description: 'Publish a conversation with 10+ turns', xp: 40, icon: '\u{1F578}', tier: 'silver' },
  { id: 'faction_diplomat', name: 'Faction Diplomat', description: 'Publish conversations for 3 different factions', xp: 75, icon: '\u{1F91D}', tier: 'silver' },
  { id: 'zone_encyclopedist', name: 'Zone Encyclopedist', description: 'Publish conversations for all factions', xp: 200, icon: '\u{1F4DA}', tier: 'gold' },
  { id: 'popular_stalker', name: 'Popular Stalker', description: 'Receive 50 total downloads', xp: 100, icon: '\u{1F4E5}', tier: 'silver' },
  { id: 'community_favorite', name: 'Community Favorite', description: 'Receive 25 total upvotes', xp: 100, icon: '\u{2B50}', tier: 'silver' },
  { id: 'outcome_engineer', name: 'Outcome Engineer', description: 'Use 4+ different outcome types in one conversation', xp: 50, icon: '\u{2699}', tier: 'silver' },
  { id: 'precondition_master', name: 'Precondition Master', description: 'Use 5+ preconditions in one conversation', xp: 50, icon: '\u{1F512}', tier: 'silver' },
  { id: 'prolific_writer', name: 'Prolific Writer', description: 'Publish 10 conversations', xp: 150, icon: '\u{270D}', tier: 'silver' },
  { id: 'zone_veteran', name: 'Zone Veteran', description: 'Publish 50 conversations', xp: 500, icon: '\u{1F396}', tier: 'gold' },
  { id: 'streak_3', name: 'On a Roll', description: 'Maintain a 3-week publish streak', xp: 100, icon: '\u{1F525}', tier: 'bronze' },
  { id: 'streak_10', name: 'Zone Regular', description: 'Maintain a 10-week publish streak', xp: 500, icon: '\u{1F31F}', tier: 'gold' },
  { id: 'quality_crafter', name: 'Quality Crafter', description: 'Publish a 5-star quality conversation', xp: 75, icon: '\u{1F48E}', tier: 'silver' },
];

export function getAchievementById(id: AchievementId): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

// ─── Local Achievement Storage (anti-abuse: tracked locally + server) ────────

const LOCAL_ACHIEVEMENTS_KEY = 'panda-gf-achievements';

export function getUnlockedAchievements(): AchievementId[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ACHIEVEMENTS_KEY);
    return raw ? JSON.parse(raw) as AchievementId[] : [];
  } catch {
    return [];
  }
}

export function isAchievementUnlocked(id: AchievementId): boolean {
  return getUnlockedAchievements().includes(id);
}

/** Marks an achievement as unlocked locally. Returns true if it was newly unlocked. */
export function unlockAchievementLocally(id: AchievementId): boolean {
  const current = getUnlockedAchievements();
  if (current.includes(id)) return false;
  current.push(id);
  window.localStorage.setItem(LOCAL_ACHIEVEMENTS_KEY, JSON.stringify(current));
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
}

function saveStreakData(data: StreakData): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_STREAK_KEY, JSON.stringify(data));
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

// ─── Daily Challenges ────────────────────────────────────────────────────────

export type DailyChallenge = {
  id: string;
  description: string;
  xp: number;
  check: (context: ChallengeContext) => boolean;
};

export type ChallengeContext = {
  conversation?: Conversation;
  branchCount?: number;
  faction?: string;
  outcomeTypes?: string[];
  publishCount?: number;
};

const CHALLENGE_POOL: DailyChallenge[] = [
  { id: 'use_reward_money', description: 'Publish a conversation using reward_money outcome', xp: 25,
    check: (ctx) => (ctx.outcomeTypes ?? []).includes('reward_money') },
  { id: 'three_branches', description: 'Publish a conversation with 3+ branches', xp: 20,
    check: (ctx) => (ctx.branchCount ?? 0) >= 3 },
  { id: 'five_branches', description: 'Publish a conversation with 5+ branches', xp: 30,
    check: (ctx) => (ctx.branchCount ?? 0) >= 5 },
  { id: 'use_rep_outcome', description: 'Publish a conversation with a reputation outcome', xp: 25,
    check: (ctx) => (ctx.outcomeTypes ?? []).some(t => t.includes('rep') || t.includes('goodwill')) },
  { id: 'long_conversation', description: 'Publish a conversation with 8+ turns', xp: 35,
    check: (ctx) => (ctx.conversation?.turns.length ?? 0) >= 8 },
  { id: 'use_precondition', description: 'Publish a conversation with at least one precondition', xp: 20,
    check: (ctx) => (ctx.conversation?.preconditions.length ?? 0) > 0 },
  { id: 'multi_outcome', description: 'Publish a conversation using 3+ different outcome types', xp: 30,
    check: (ctx) => new Set(ctx.outcomeTypes ?? []).size >= 3 },
  { id: 'short_and_sweet', description: 'Publish a short conversation (3 or fewer branches)', xp: 15,
    check: (ctx) => (ctx.branchCount ?? 0) <= 3 && (ctx.branchCount ?? 0) >= 1 },
];

const LOCAL_DAILY_CHALLENGE_KEY = 'panda-gf-daily-challenge';
const LOCAL_DAILY_COMPLETED_KEY = 'panda-gf-daily-completed';

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Deterministically pick today's challenge using date as seed. */
export function getTodayChallenge(): DailyChallenge {
  const today = getTodayDateString();
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(LOCAL_DAILY_CHALLENGE_KEY) : null;

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { date: string; id: string };
      if (parsed.date === today) {
        const challenge = CHALLENGE_POOL.find(c => c.id === parsed.id);
        if (challenge) return challenge;
      }
    } catch { /* regenerate */ }
  }

  // Seed-based selection: sum char codes of date string
  let seed = 0;
  for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i) * (i + 1);
  const index = seed % CHALLENGE_POOL.length;
  const challenge = CHALLENGE_POOL[index];

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_DAILY_CHALLENGE_KEY, JSON.stringify({ date: today, id: challenge.id }));
  }

  return challenge;
}

export function isDailyChallengeCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(LOCAL_DAILY_COMPLETED_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { date: string };
    return parsed.date === getTodayDateString();
  } catch {
    return false;
  }
}

/** Mark today's challenge as completed. Returns XP to award (0 if already completed). */
export function completeDailyChallenge(): number {
  if (isDailyChallengeCompleted()) return 0;
  const challenge = getTodayChallenge();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_DAILY_COMPLETED_KEY, JSON.stringify({ date: getTodayDateString() }));
  }
  return challenge.xp;
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
  challengeXp: number;
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

  const checks: Array<{ id: AchievementId; condition: boolean }> = [
    { id: 'first_publish', condition: publishCount >= 1 },
    { id: 'branching_out', condition: branchCount >= 5 },
    { id: 'web_of_lies', condition: branchCount >= 10 },
    { id: 'faction_diplomat', condition: new Set(publishedFactions).size >= 3 },
    { id: 'zone_encyclopedist', condition: new Set(publishedFactions).size >= 13 },
    { id: 'popular_stalker', condition: totalDownloads >= 50 },
    { id: 'community_favorite', condition: totalUpvotes >= 25 },
    { id: 'outcome_engineer', condition: outcomeTypes.length >= 4 },
    { id: 'precondition_master', condition: conversation.preconditions.length >= 5 },
    { id: 'prolific_writer', condition: publishCount >= 10 },
    { id: 'zone_veteran', condition: publishCount >= 50 },
    { id: 'quality_crafter', condition: quality.totalStars >= 5 },
  ];

  for (const { id, condition } of checks) {
    if (condition && !isAchievementUnlocked(id) && !isOnCooldown(`ach-${id}`)) {
      if (unlockAchievementLocally(id)) {
        const achievement = getAchievementById(id);
        if (achievement) {
          achievementsUnlocked.push(achievement);
          rawBonusXp += achievement.xp;
          setCooldown(`ach-${id}`);
        }
      }
    }
  }

  // ── Streak ──
  const streakInfo = recordPublishForStreak();
  const streak = getStreakData();

  // Check streak achievements
  if (streak.currentStreak >= 3 && !isAchievementUnlocked('streak_3')) {
    if (unlockAchievementLocally('streak_3')) {
      const a = getAchievementById('streak_3')!;
      achievementsUnlocked.push(a);
      rawBonusXp += a.xp;
    }
  }
  if (streak.currentStreak >= 10 && !isAchievementUnlocked('streak_10')) {
    if (unlockAchievementLocally('streak_10')) {
      const a = getAchievementById('streak_10')!;
      achievementsUnlocked.push(a);
      rawBonusXp += a.xp;
    }
  }

  // ── Daily Challenge ──
  let challengeXp = 0;
  if (!isDailyChallengeCompleted()) {
    const challenge = getTodayChallenge();
    const ctx: ChallengeContext = {
      conversation,
      branchCount,
      faction: conversation.faction,
      outcomeTypes,
      publishCount,
    };
    if (challenge.check(ctx)) {
      challengeXp = completeDailyChallenge();
      rawBonusXp += challengeXp;
    }
  }

  // ── Quality Score ──
  const qualityMultiplier = getQualityMultiplier(quality.totalStars);

  // ── Clamp total bonus XP by daily cap ──
  const totalBonusXp = clampBonusXp(rawBonusXp);

  return {
    achievementsUnlocked,
    challengeXp,
    qualityStars: quality.totalStars,
    qualityMultiplier,
    streakInfo,
    totalBonusXp,
  };
}

// ─── Login Streak (daily editor opens) ───────────────────────────────────────

const LOCAL_LOGIN_STREAK_KEY = 'panda-gf-login-streak';

export type LoginStreakData = {
  currentStreak: number;
  lastLoginDate: string; // YYYY-MM-DD
};

export function getLoginStreak(): LoginStreakData {
  if (typeof window === 'undefined') return { currentStreak: 0, lastLoginDate: '' };
  try {
    const raw = window.localStorage.getItem(LOCAL_LOGIN_STREAK_KEY);
    if (!raw) return { currentStreak: 0, lastLoginDate: '' };
    return JSON.parse(raw) as LoginStreakData;
  } catch {
    return { currentStreak: 0, lastLoginDate: '' };
  }
}

/**
 * Record a daily login. Returns bonus XP (0 if already logged in today).
 * XP scales: 5, 10, 15, 20... capped at 50 per day.
 */
export function recordDailyLogin(): { xp: number; streak: number; isNew: boolean } {
  const today = getTodayDateString();
  const data = getLoginStreak();

  if (data.lastLoginDate === today) {
    return { xp: 0, streak: data.currentStreak, isNew: false };
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

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCAL_LOGIN_STREAK_KEY, JSON.stringify(data));
  }

  const rawXp = Math.min(data.currentStreak * 5, 50);
  const xp = clampBonusXp(rawXp);
  return { xp, streak: data.currentStreak, isNew: true };
}
