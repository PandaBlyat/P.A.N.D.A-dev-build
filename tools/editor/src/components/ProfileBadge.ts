// P.A.N.D.A. Conversation Editor — Profile Badge (Toolbar Widget)
// Shows the user's level, title, and XP progress in a compact toolbar element.

import {
  type UserProfile,
  type LeaderboardEntry,
  LEVEL_THRESHOLDS,
  getNextLevelThreshold,
  fetchLeaderboard,
  fetchPublicProfileData,
  fetchUserPublishCount,
  XP_PUBLISH_SHORT,
  XP_PUBLISH_MEDIUM,
  XP_PUBLISH_LONG,
  XP_DOWNLOAD_RECEIVED,
  XP_UPVOTE_RECEIVED,
} from '../lib/api-client';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_CATEGORY_ORDER,
  getAchievementsByCategory,
  getUnlockedAchievements,
  getStreakData,
  getLoginStreak,
  getActiveMissions,
  getMissionResetInfo,
  getVisibleAchievementCatalog,
  isAchievementRare,
  setSyncedGamificationState,
  type Achievement,
  type AchievementCategory,
  type ActiveMission,
} from '../lib/gamification';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { createIcon, type IconName } from './icons';
import { renderPublicProfileView } from './PublicProfileView';

const PROFILE_MODAL_MOUNT_ID = 'app-modal-host';

let cachedProfile: UserProfile | null = null;
let popoverOpen = false;
let leaderboardCache: LeaderboardEntry[] | null = null;
let publishCountCache: number | null = null;
let publicProfileOverlay: HTMLElement | null = null;
let publicProfileFocusTrap: FocusTrapController | null = null;
let activePublicProfilePublisherId: string | null = null;
let activeLeaderboardRow: HTMLButtonElement | null = null;

const ACHIEVEMENT_CATEGORY_ICONS: Record<AchievementCategory, IconName> = {
  onboarding: 'sparkle',
  social: 'user',
  discovery: 'target',
  mastery: 'trophy',
  collection: 'database',
};

const ACHIEVEMENT_CATEGORY_COLORS: Record<AchievementCategory, string> = {
  onboarding: '#60a5fa',
  social: '#f59e0b',
  discovery: '#22c55e',
  mastery: '#a855f7',
  collection: '#f97316',
};

function getLevelTierColor(level: number): string {
  if (level >= 91) return '#c4a040'; // gold — Monolith / Tier IV apex
  if (level >= 71) return '#8a5eaa'; // purple — Duty & Freedom / Tier III
  if (level >= 51) return '#3aaa8a'; // teal — Clear Sky & Ecologists / Tier II
  return '#5eaa3a';                  // green — early Zone factions / Tier I
}

function getUserInitial(username: string): string {
  return username.trim().charAt(0).toUpperCase() || '?';
}

function getProfileModalMount(): HTMLElement {
  return document.getElementById(PROFILE_MODAL_MOUNT_ID) ?? document.body;
}

export function setProfileForBadge(profile: UserProfile | null): void {
  cachedProfile = profile;
  setSyncedGamificationState(profile ? {
    achievements: profile.achievements ?? [],
    streaks: profile.streaks ?? null,
    missions: profile.missions ?? [],
  } : null);
  publishCountCache = null; // invalidate on profile update
}

export function renderProfileBadge(): HTMLElement | null {
  if (!cachedProfile) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'profile-badge';
  wrapper.title = `${cachedProfile.title} — ${cachedProfile.xp} XP`;

  const tierColor = getLevelTierColor(cachedProfile.level);

  const levelIcon = document.createElement('span');
  levelIcon.className = 'profile-badge-level';
  levelIcon.textContent = getUserInitial(cachedProfile.username);
  levelIcon.style.background = tierColor;

  const levelBadge = document.createElement('span');
  levelBadge.className = 'profile-badge-level-num';
  levelBadge.textContent = String(cachedProfile.level);
  levelIcon.appendChild(levelBadge);

  const name = document.createElement('span');
  name.className = 'profile-badge-name';
  name.textContent = cachedProfile.username;

  const xpLabel = document.createElement('span');
  xpLabel.className = 'profile-badge-xp';
  xpLabel.textContent = `${cachedProfile.xp} XP`;

  wrapper.append(levelIcon, name, xpLabel);

  // Popover on click
  wrapper.onclick = (e) => {
    e.stopPropagation();
    if (popoverOpen) {
      closePopover();
      return;
    }
    openPopover(wrapper);
  };

  return wrapper;
}

function formatMemberSince(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

function createMetaChip(label: string, value: string, tone: 'default' | 'muted' | 'accent' = 'default'): HTMLElement {
  const chip = document.createElement('span');
  chip.className = `profile-popover-meta-pill profile-surface-token${tone === 'muted' ? ' profile-popover-meta-pill-muted' : ''}${tone === 'accent' ? ' profile-popover-meta-pill-accent' : ''}`;

  const chipLabel = document.createElement('span');
  chipLabel.className = 'profile-popover-meta-pill-label';
  chipLabel.textContent = label;

  const chipValue = document.createElement('span');
  chipValue.className = 'profile-popover-meta-pill-value';
  chipValue.textContent = value;

  chip.append(chipLabel, chipValue);
  return chip;
}

function createHeroMetaStat(label: string, value: string, tone: 'default' | 'accent' = 'default'): HTMLElement {
  const stat = document.createElement('div');
  stat.className = `profile-hero-meta-stat${tone === 'accent' ? ' profile-hero-meta-stat-accent' : ''}`;

  const statLabel = document.createElement('span');
  statLabel.className = 'profile-hero-meta-label';
  statLabel.textContent = label;

  const statValue = document.createElement('span');
  statValue.className = 'profile-hero-meta-value';
  statValue.textContent = value;

  stat.append(statLabel, statValue);
  return stat;
}

function buildProfileHeader(profile: UserProfile): HTMLElement {
  const header = document.createElement('section');
  header.className = 'profile-popover-header profile-surface-section';

  const tierColor = getLevelTierColor(profile.level);
  const isSelfProfile = profile.publisher_id === cachedProfile?.publisher_id;
  const streak = profile.streaks
    ? {
        publish: profile.streaks.publish_streak,
        login: profile.streaks.login_streak,
      }
    : {
        publish: isSelfProfile ? getStreakData().currentStreak : 0,
        login: isSelfProfile ? getLoginStreak().currentStreak : 0,
      };

  const identity = document.createElement('div');
  identity.className = 'profile-popover-identity';

  const avatarCircle = document.createElement('div');
  avatarCircle.className = 'profile-popover-avatar-circle';
  avatarCircle.style.setProperty('--tier-color', tierColor);

  const avatarInitial = document.createElement('span');
  avatarInitial.className = 'profile-popover-avatar-initial';
  avatarInitial.textContent = getUserInitial(profile.username);
  avatarCircle.appendChild(avatarInitial);

  const info = document.createElement('div');
  info.className = 'profile-popover-info';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'profile-popover-eyebrow';
  eyebrow.textContent = `Level ${profile.level} operative`;

  const nameEl = document.createElement('div');
  nameEl.className = 'profile-popover-name';
  nameEl.textContent = profile.username;

  const titleEl = document.createElement('div');
  titleEl.className = 'profile-popover-title';
  titleEl.textContent = profile.title;

  const metaRow = document.createElement('div');
  metaRow.className = 'profile-popover-meta-row';
  metaRow.append(
    createHeroMetaStat('XP total', profile.xp.toLocaleString(), 'accent'),
    createHeroMetaStat('Publish streak', `${streak.publish} weeks`),
    createHeroMetaStat('Daily login', `${streak.login} days`),
    createHeroMetaStat('Joined', formatMemberSince(profile.created_at)),
  );

  info.append(eyebrow, nameEl, titleEl, metaRow);
  identity.append(avatarCircle, info);

  header.append(identity, buildProgressSection(profile));
  return header;
}

function buildProgressSection(profile: UserProfile): HTMLElement {
  const progressSection = document.createElement('div');
  progressSection.className = 'profile-popover-progress';

  const next = getNextLevelThreshold(profile.xp);
  const currentThreshold = LEVEL_THRESHOLDS.find(t => t.level === profile.level);
  const currentMin = currentThreshold?.xp ?? 0;
  const nextXp = next?.xp ?? currentMin;
  const range = Math.max(nextXp - currentMin, 1);
  const progress = Math.min((profile.xp - currentMin) / range, 1);
  const progressPercent = Math.round(progress * 100);
  const xpToGo = Math.max(nextXp - profile.xp, 0);

  const progressTop = document.createElement('div');
  progressTop.className = 'profile-popover-progress-top';

  const levelBadge = document.createElement('div');
  levelBadge.className = 'profile-popover-level-badge';
  levelBadge.textContent = `Lv.${profile.level}`;

  const progressCopy = document.createElement('div');
  progressCopy.className = 'profile-popover-progress-copy';

  const progressKicker = document.createElement('span');
  progressKicker.className = 'profile-popover-progress-kicker';
  progressKicker.textContent = next ? 'Progress to next title' : 'Progress complete';

  const levelLabel = document.createElement('span');
  levelLabel.className = 'profile-popover-level-label';
  levelLabel.textContent = next ? `${progressPercent}% to Level ${next.level}` : 'Max level reached';

  const xpNumbers = document.createElement('span');
  xpNumbers.className = 'profile-popover-bar-label';
  xpNumbers.textContent = next
    ? `${profile.xp.toLocaleString()} / ${next.xp.toLocaleString()} XP`
    : `${profile.xp.toLocaleString()} XP`;

  progressCopy.append(progressKicker, levelLabel, xpNumbers);
  progressTop.append(levelBadge, progressCopy);

  const barTrack = document.createElement('div');
  barTrack.className = 'profile-popover-bar-track';
  const barFill = document.createElement('div');
  barFill.className = 'profile-popover-bar-fill';
  barFill.style.width = `${progressPercent}%`;
  barTrack.appendChild(barFill);

  const progressFooter = document.createElement('div');
  progressFooter.className = 'profile-popover-progress-footer';

  const nextLabel = document.createElement('div');
  nextLabel.className = 'profile-popover-next';
  nextLabel.textContent = next
    ? `Next title: ${next.title}`
    : 'All level rewards unlocked';

  const progressTarget = document.createElement('div');
  progressTarget.className = 'profile-popover-progress-target';
  progressTarget.textContent = next ? `${xpToGo.toLocaleString()} XP to go` : 'Legend status achieved';

  progressFooter.append(nextLabel, progressTarget);
  progressSection.append(progressTop, barTrack, progressFooter);

  return progressSection;
}

function buildStatCard(iconName: Parameters<typeof createIcon>[0], value: string, label: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'profile-stat-card profile-surface-card';

  const icon = createIcon(iconName);
  icon.classList.add('profile-stat-icon');

  const copy = document.createElement('div');
  copy.className = 'profile-stat-copy';

  const labelEl = document.createElement('div');
  labelEl.className = 'profile-stat-label';
  labelEl.textContent = label;

  const valEl = document.createElement('div');
  valEl.className = 'profile-stat-value';
  valEl.textContent = value;

  copy.append(labelEl, valEl);
  card.append(icon, copy);
  return card;
}

function buildStatsSection(profile: UserProfile): HTMLElement {
  const statsSection = document.createElement('section');
  statsSection.className = 'profile-popover-stats profile-surface-section';
  const unlocked = getUnlockedAchievementIdsForProfile(profile);
  const rareUnlockedCount = getRareAchievementCount(unlocked);
  const longestStreak = profile.streaks?.longest_streak ?? (profile.publisher_id === cachedProfile?.publisher_id ? getStreakData().longestStreak : 0);

  const headerBlock = document.createElement('div');
  headerBlock.className = 'profile-section-heading-block';

  const header = document.createElement('div');
  header.className = 'profile-popover-section-header';
  const statsIcon = createIcon('database');
  const title = document.createElement('span');
  title.textContent = 'Progress highlights';
  header.append(statsIcon, title);

  const statsGrid = document.createElement('div');
  statsGrid.className = 'profile-popover-stats-grid';

  const publishStat = buildStatCard('export', '...', 'Published conversations');
  publishStat.classList.add('profile-stat-card-featured');
  const badgesStat = buildStatCard('medal', `${unlocked.length}/${ACHIEVEMENTS.length}`, 'Badges unlocked');
  const rareStat = buildStatCard('sparkle', String(rareUnlockedCount), 'Rare unlocks');
  const longestStat = buildStatCard('flame', `${longestStreak}w`, 'Best publish streak');

  statsGrid.append(publishStat, badgesStat, rareStat, longestStat);
  statsSection.append(headerBlock);
  headerBlock.append(header);
  statsSection.append(statsGrid);

  if (profile.publisher_id === cachedProfile?.publisher_id && publishCountCache !== null) {
    const valEl = publishStat.querySelector('.profile-stat-value');
    if (valEl) valEl.textContent = String(publishCountCache);
  } else {
    void fetchUserPublishCount(profile.publisher_id).then(count => {
      if (profile.publisher_id === cachedProfile?.publisher_id) {
        publishCountCache = count;
      }
      const valEl = publishStat.querySelector('.profile-stat-value');
      if (valEl) valEl.textContent = String(count);
    });
  }

  return statsSection;
}

function buildXpBreakdownSection(): HTMLElement {
  const xpBreakdownSection = document.createElement('section');
  xpBreakdownSection.className = 'profile-popover-xp-breakdown profile-surface-section';

  const xpBreakdownHeaderCopy = document.createElement('div');
  xpBreakdownHeaderCopy.className = 'profile-popover-section-header';
  const starIcon = createIcon('star');
  const xpBreakdownTitle = document.createElement('span');
  xpBreakdownTitle.textContent = 'How to Earn XP';
  const xpBreakdownMeta = document.createElement('span');
  xpBreakdownMeta.className = 'profile-popover-summary-meta';
  xpBreakdownMeta.textContent = '5 quick sources';
  xpBreakdownHeaderCopy.append(starIcon, xpBreakdownTitle, xpBreakdownMeta);

  const xpRows = document.createElement('div');
  xpRows.className = 'profile-popover-xp-rows';

  const xpItems: [string, number][] = [
    ['Publish · Short', XP_PUBLISH_SHORT],
    ['Publish · Medium', XP_PUBLISH_MEDIUM],
    ['Publish · Long', XP_PUBLISH_LONG],
    ['Download received', XP_DOWNLOAD_RECEIVED],
    ['Upvote received', XP_UPVOTE_RECEIVED],
  ];

  for (const [label, amount] of xpItems) {
    const row = document.createElement('div');
    row.className = 'profile-popover-xp-row profile-surface-row';
    const rowLabel = document.createElement('span');
    rowLabel.className = 'profile-popover-xp-row-label';
    rowLabel.textContent = label;
    const rowValue = document.createElement('span');
    rowValue.className = 'profile-popover-xp-row-value';
    rowValue.textContent = `+${amount} XP`;
    row.append(rowLabel, rowValue);
    xpRows.appendChild(row);
  }

  xpBreakdownSection.append(xpBreakdownHeaderCopy, xpRows);
  return xpBreakdownSection;
}

type AchievementTarget = {
  achievement: Achievement;
  reason: string;
};

function getUnlockedAchievementIdsForProfile(profile: UserProfile): string[] {
  return profile.achievements ?? (profile.publisher_id === cachedProfile?.publisher_id ? getUnlockedAchievements() : []);
}

function getAchievementTierRank(achievement: Achievement): number {
  return achievement.tier === 'gold' ? 3 : achievement.tier === 'silver' ? 2 : 1;
}

function getFeaturedAchievements(unlockedIds: string[]): Achievement[] {
  return ACHIEVEMENTS
    .filter(achievement => unlockedIds.includes(achievement.id) && (achievement.featured || isAchievementRare(achievement)))
    .sort((a, b) => getAchievementTierRank(b) - getAchievementTierRank(a) || b.xp - a.xp)
    .slice(0, 3);
}

function getRareAchievementCount(unlockedIds: string[]): number {
  return ACHIEVEMENTS.filter(achievement => unlockedIds.includes(achievement.id) && isAchievementRare(achievement)).length;
}

function buildProfileFocusSection(profile: UserProfile): HTMLElement {
  const section = document.createElement('section');
  section.className = 'profile-focus-panel profile-surface-section';

  const header = document.createElement('div');
  header.className = 'profile-focus-header';
  const targetIcon = createIcon('target');
  const titleWrap = document.createElement('div');
  titleWrap.className = 'profile-focus-title-wrap';
  const title = document.createElement('div');
  title.className = 'profile-popover-section-header profile-focus-title';
  title.append(targetIcon, document.createTextNode('Recommended next move'));
  titleWrap.append(title);
  header.appendChild(titleWrap);

  const isSelfProfile = profile.publisher_id === cachedProfile?.publisher_id;
  const missions = getProfileMissions(profile, isSelfProfile);
  const featuredMission = missions.find(mission => !mission.completed) ?? missions[0] ?? null;
  const unlockedIds = getUnlockedAchievementIdsForProfile(profile);
  const nextTarget = getNextAchievementTargets(profile, unlockedIds)[0] ?? null;
  const featuredBadge = getFeaturedAchievements(unlockedIds)[0] ?? null;

  const cards = document.createElement('div');
  cards.className = 'profile-focus-cards';

  const actionCard = document.createElement('div');
  actionCard.className = 'profile-focus-card profile-surface-card profile-focus-card-primary';
  const actionLabel = document.createElement('div');
  actionLabel.className = 'profile-focus-card-label';
  actionLabel.textContent = 'Do next';
  const actionTitle = document.createElement('div');
  actionTitle.className = 'profile-focus-card-title';
  actionTitle.textContent = featuredMission?.name ?? 'No missions queued';
  const actionMeta = document.createElement('div');
  actionMeta.className = 'profile-focus-card-meta';
  actionMeta.textContent = featuredMission
    ? `${featuredMission.rewardLabel ?? `+${featuredMission.xp} XP`} · ${featuredMission.progress}/${featuredMission.goal} complete`
    : 'Open the mission board when new assignments appear.';
  actionCard.append(actionLabel, actionTitle, actionMeta);

  const badgeCard = document.createElement('div');
  badgeCard.className = 'profile-focus-card profile-surface-card';
  const badgeLabel = document.createElement('div');
  badgeLabel.className = 'profile-focus-card-label';
  badgeLabel.textContent = featuredBadge ? 'Showcase badge' : 'Badge in reach';
  const badgeTitle = document.createElement('div');
  badgeTitle.className = 'profile-focus-card-title';
  badgeTitle.textContent = featuredBadge?.name ?? nextTarget?.achievement.name ?? 'More achievements soon';
  const badgeMeta = document.createElement('div');
  badgeMeta.className = 'profile-focus-card-meta';
  badgeMeta.textContent = featuredBadge
    ? `Unlocked · ${featuredBadge.tier} · +${featuredBadge.xp} XP`
    : nextTarget
      ? `${ACHIEVEMENT_CATEGORY_LABELS[nextTarget.achievement.category]} · ${nextTarget.achievement.tier} · +${nextTarget.achievement.xp} XP`
      : 'Keep exploring the Zone.';
  badgeCard.append(badgeLabel, badgeTitle, badgeMeta);

  const rankCard = document.createElement('div');
  rankCard.className = 'profile-focus-card profile-surface-card';
  const rankLabel = document.createElement('div');
  rankLabel.className = 'profile-focus-card-label';
  rankLabel.textContent = 'Community standing';
  const rankTitle = document.createElement('div');
  rankTitle.className = 'profile-focus-card-title';
  rankTitle.textContent = 'Loading rank…';
  const rankMeta = document.createElement('div');
  rankMeta.className = 'profile-focus-card-meta';
  rankMeta.textContent = 'Fetching leaderboard snapshot';
  rankCard.append(rankLabel, rankTitle, rankMeta);

  const updateRankCard = (entries: LeaderboardEntry[]) => {
    const rank = entries.findIndex(entry => entry.publisher_id === profile.publisher_id);
    const nearestAbove = rank > 0 ? entries[rank - 1] : null;
    rankTitle.textContent = rank >= 0 ? `#${rank + 1} in the Zone` : 'Unranked for now';
    rankMeta.textContent = rank >= 0
      ? `${profile.xp.toLocaleString()} XP${nearestAbove ? ` · ${Math.max(nearestAbove.xp - profile.xp, 0).toLocaleString()} XP to pass ${nearestAbove.username}` : ' · holding the top spot'}`
      : `${profile.xp.toLocaleString()} XP · publish and earn reactions to climb`;
  };

  if (leaderboardCache) {
    updateRankCard(leaderboardCache);
  } else {
    void fetchLeaderboard(10).then((entries) => {
      leaderboardCache = entries;
      updateRankCard(entries);
    });
  }

  cards.append(actionCard, badgeCard, rankCard);
  section.append(header, cards);
  return section;
}

function getNextAchievementTargets(profile: UserProfile, unlockedIds: string[]): AchievementTarget[] {
  const loginStreak = profile.streaks?.login_streak ?? (profile.publisher_id === cachedProfile?.publisher_id ? getLoginStreak().currentStreak : 0);
  const publishStreak = profile.streaks?.publish_streak ?? (profile.publisher_id === cachedProfile?.publisher_id ? getStreakData().currentStreak : 0);
  const publishCount = profile.publisher_id === cachedProfile?.publisher_id ? (publishCountCache ?? 0) : 0;
  const lockedVisible = getVisibleAchievementCatalog().filter(achievement => !unlockedIds.includes(achievement.id));

  const hints = new Map<string, { score: number; reason: string }>([
    ['profile_seeded', { score: 100, reason: 'One-time setup win that anchors the onboarding track.' }],
    ['login_streak_1', { score: loginStreak > 0 ? 96 : 82, reason: loginStreak > 0 ? `You already have a ${loginStreak}-day login streak going.` : 'A quick streak milestone is one return visit away.' }],
    ['challenge_apprentice', { score: 95, reason: 'Mission board completions are meant to be an early momentum builder.' }],
    ['first_upvote_received', { score: 88, reason: 'A single community reaction unlocks your first social badge.' }],
    ['profile_spotlight', { score: 78, reason: 'Featured badges and activity make profile milestones easier to hit.' }],
    ['first_publish', { score: publishCount === 0 ? 99 : 15, reason: publishCount === 0 ? 'Your first publish unlocks discovery progression immediately.' : 'Already cleared once you publish.' }],
    ['branching_out', { score: 90, reason: 'A five-branch conversation is the fastest visible discovery target.' }],
    ['new_faction_scout', { score: publishCount > 0 ? 92 : 72, reason: publishCount > 0 ? 'Publishing in a fresh faction broadens your discovery set.' : 'After your first publish, try a second faction for quick breadth.' }],
    ['faction_diplomat', { score: publishCount >= 2 ? 84 : 60, reason: 'Three factions is a clear medium-term route into collection badges.' }],
    ['uncommon_operator', { score: 83, reason: 'Trying one uncommon command type opens a more expressive discovery lane.' }],
    ['outcome_engineer', { score: 89, reason: 'Mixing four outcome types is an approachable mastery target.' }],
    ['precondition_master', { score: 86, reason: 'Adding layered preconditions strengthens systemic depth.' }],
    ['quality_crafter', { score: 80, reason: 'A polished five-star publish is a strong mastery milestone.' }],
    ['systems_polymath', { score: 74, reason: 'Outcome and precondition variety together unlock a rare mastery badge.' }],
    ['streak_3', { score: publishStreak > 0 ? 87 : 68, reason: publishStreak > 0 ? `Your ${publishStreak}-week publish streak can grow into this badge.` : 'Weekly consistency opens the streak ladder.' }],
    ['prolific_writer', { score: publishCount > 0 ? 70 : 42, reason: 'This remains a long-term milestone, but now it sits beside broader goals.' }],
    ['bronze_complete', { score: unlockedIds.length >= 4 ? 79 : 36, reason: 'Bronze cleanup is a natural collection target after a few early wins.' }],
  ]);

  return lockedVisible
    .map((achievement) => ({
      achievement,
      score: hints.get(achievement.id)?.score ?? (achievement.category === 'onboarding' ? 50 : achievement.category === 'collection' ? 35 : 45),
      reason: hints.get(achievement.id)?.reason ?? 'A visible next step that broadens your badge mix.',
    }))
    .sort((a, b) => b.score - a.score || getAchievementTierRank(a.achievement) - getAchievementTierRank(b.achievement) || a.achievement.xp - b.achievement.xp)
    .slice(0, 3)
    .map(({ achievement, reason }) => ({ achievement, reason }));
}

function buildFeaturedBadgeStrip(unlockedIds: string[]): HTMLElement | null {
  const featured = getFeaturedAchievements(unlockedIds);
  if (featured.length === 0) return null;

  const strip = document.createElement('div');
  strip.className = 'profile-achievement-featured-strip profile-surface-section';

  const labelRow = document.createElement('div');
  labelRow.className = 'profile-achievement-featured-label-row';

  const label = document.createElement('div');
  label.className = 'profile-achievement-mini-header';
  label.textContent = 'Featured badges';

  const count = document.createElement('span');
  count.className = 'profile-achievement-featured-count';
  count.textContent = `${featured.length} shown`;

  labelRow.append(label, count);
  strip.appendChild(labelRow);

  const badges = document.createElement('div');
  badges.className = 'profile-achievement-featured-badges';

  featured.forEach((achievement) => {
    const badge = document.createElement('div');
    badge.className = `profile-achievement-featured-badge profile-surface-token profile-achievement-featured-badge-${achievement.tier}`;
    badge.title = `${achievement.name} — ${achievement.description}`;

    const icon = document.createElement('span');
    icon.className = 'profile-achievement-featured-icon';
    icon.textContent = achievement.icon;

    const text = document.createElement('span');
    text.className = 'profile-achievement-featured-name';
    text.textContent = achievement.name;

    badge.append(icon, text);
    badges.appendChild(badge);
  });

  strip.appendChild(badges);
  return strip;
}

function buildAchievementsSection(profile: UserProfile = cachedProfile!): HTMLElement {
  const section = document.createElement('div');
  section.className = 'profile-popover-achievements profile-surface-section';

  const header = document.createElement('div');
  header.className = 'profile-popover-section-header';
  const medalIcon = createIcon('medal');
  const title = document.createElement('span');
  const unlocked = getUnlockedAchievementIdsForProfile(profile);
  title.textContent = `Achievements (${unlocked.length}/${ACHIEVEMENTS.length})`;
  header.append(medalIcon, title);
  section.appendChild(header);

  const visibleGoalCount = getVisibleAchievementCatalog().length;
  const hiddenGoalCount = ACHIEVEMENTS.filter(achievement => achievement.hidden).length;
  const rareUnlockedCount = getRareAchievementCount(unlocked);

  const summaryRow = document.createElement('div');
  summaryRow.className = 'profile-achievement-summary-row';
  summaryRow.append(
    createMetaChip('Earned', String(unlocked.length)),
    createMetaChip('Rare', String(rareUnlockedCount), rareUnlockedCount > 0 ? 'accent' : 'default'),
    createMetaChip('Visible', String(visibleGoalCount), 'muted'),
    createMetaChip('Surprise', String(hiddenGoalCount), 'muted'),
  );
  section.appendChild(summaryRow);

  const featuredStrip = buildFeaturedBadgeStrip(unlocked);
  if (featuredStrip) section.appendChild(featuredStrip);

  const nextTargets = getNextAchievementTargets(profile, unlocked);
  if (nextTargets.length > 0) {
    const nextSection = document.createElement('details');
    nextSection.className = 'profile-achievement-next';

    const nextHeader = document.createElement('summary');
    nextHeader.className = 'profile-achievement-next-summary profile-surface-row';

    const nextHeaderCopy = document.createElement('div');
    nextHeaderCopy.className = 'profile-achievement-next-summary-copy';

    const nextHeaderTitle = document.createElement('span');
    nextHeaderTitle.className = 'profile-achievement-mini-header';
    nextHeaderTitle.textContent = 'Next goals';

    const nextHeaderMeta = document.createElement('span');
    nextHeaderMeta.className = 'profile-achievement-next-summary-meta';
    nextHeaderMeta.textContent = `${nextTargets.length} suggested`;

    nextHeaderCopy.append(nextHeaderTitle, nextHeaderMeta);
    nextHeader.appendChild(nextHeaderCopy);
    nextSection.appendChild(nextHeader);

    const nextList = document.createElement('div');
    nextList.className = 'profile-achievement-next-list';

    nextTargets.forEach(({ achievement, reason }) => {
      const card = document.createElement('div');
      card.className = `profile-achievement-next-card profile-surface-card profile-achievement-next-card-${achievement.tier}`;
      card.title = `${achievement.name} — ${achievement.description}`;

      const topRow = document.createElement('div');
      topRow.className = 'profile-achievement-next-top';

      const icon = document.createElement('span');
      icon.className = 'profile-achievement-next-icon';
      icon.textContent = achievement.icon;

      const copy = document.createElement('div');
      copy.className = 'profile-achievement-next-copy';

      const name = document.createElement('div');
      name.className = 'profile-achievement-next-name';
      name.textContent = achievement.name;

      const meta = document.createElement('div');
      meta.className = 'profile-achievement-next-meta';
      meta.textContent = `${ACHIEVEMENT_CATEGORY_LABELS[achievement.category]} · ${achievement.tier} · +${achievement.xp} XP`;

      const desc = document.createElement('div');
      desc.className = 'profile-achievement-next-desc';
      desc.textContent = reason;

      copy.append(name, meta, desc);
      topRow.append(icon, copy);
      card.appendChild(topRow);
      nextList.appendChild(card);
    });

    nextSection.appendChild(nextList);
    section.appendChild(nextSection);
  }

  const categoryGrid = document.createElement('div');
  categoryGrid.className = 'profile-achievement-category-grid';

  ACHIEVEMENT_CATEGORY_ORDER.forEach((category: AchievementCategory) => {
    const categoryAchievements = getAchievementsByCategory(category);
    const unlockedCount = categoryAchievements.filter(achievement => unlocked.includes(achievement.id)).length;

    // Collapsible <details> wrapper for each category
    const categoryDetails = document.createElement('details');
    categoryDetails.className = 'profile-achievement-category-details';
    categoryDetails.style.setProperty('--category-accent', ACHIEVEMENT_CATEGORY_COLORS[category]);

    const categorySummary = document.createElement('summary');

    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'profile-achievement-category-header';

    const categoryTitle = document.createElement('div');
    categoryTitle.className = 'profile-achievement-category-title';
    categoryTitle.title = ACHIEVEMENT_CATEGORY_LABELS[category];
    categoryTitle.setAttribute('aria-label', ACHIEVEMENT_CATEGORY_LABELS[category]);

    const categoryIconWrap = document.createElement('span');
    categoryIconWrap.className = 'profile-achievement-category-icon-wrap';
    const categoryIcon = createIcon(ACHIEVEMENT_CATEGORY_ICONS[category]);
    categoryIcon.classList.add('profile-achievement-category-icon');
    categoryIconWrap.appendChild(categoryIcon);

    const categoryText = document.createElement('span');
    categoryText.className = 'profile-achievement-category-text';
    categoryText.textContent = ACHIEVEMENT_CATEGORY_LABELS[category];

    categoryTitle.append(categoryIconWrap, categoryText);

    const categoryStatus = document.createElement('div');
    categoryStatus.className = 'profile-achievement-category-status';

    const categoryCount = document.createElement('span');
    categoryCount.className = 'profile-achievement-category-count';
    categoryCount.textContent = `${unlockedCount}/${categoryAchievements.length} unlocked`;

    const categoryProgress = document.createElement('div');
    categoryProgress.className = 'profile-achievement-category-progress';

    const categoryProgressFill = document.createElement('div');
    categoryProgressFill.className = 'profile-achievement-category-progress-fill';
    categoryProgressFill.style.width = `${Math.round((unlockedCount / Math.max(categoryAchievements.length, 1)) * 100)}%`;

    categoryProgress.appendChild(categoryProgressFill);
    categoryStatus.append(categoryCount, categoryProgress);

    categoryHeader.append(categoryTitle, categoryStatus);
    categorySummary.appendChild(categoryHeader);
    categoryDetails.appendChild(categorySummary);

    const grid = document.createElement('div');
    grid.className = 'profile-popover-achievement-grid profile-achievement-category-rail';

    categoryAchievements.forEach((achievement) => {
      const isUnlocked = unlocked.includes(achievement.id);
      const isHiddenLocked = achievement.hidden && !isUnlocked;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `profile-achievement-cell profile-achievement-cell-${achievement.tier}${isUnlocked ? ' profile-achievement-unlocked' : ' profile-achievement-locked'}${achievement.hidden ? ' profile-achievement-hidden' : ''}${!isUnlocked && !achievement.hidden ? ' profile-achievement-visible-locked' : ''}`;
      cell.title = isUnlocked
        ? `${achievement.name} — ${achievement.description} (+${achievement.xp} XP)`
        : isHiddenLocked
          ? 'Hidden achievement — keep exploring the Zone.'
          : `${achievement.name} — ${achievement.description}`;

      cell.setAttribute('aria-label', isUnlocked || !achievement.hidden ? achievement.name : 'Surprise achievement');

      const identity = document.createElement('span');
      identity.className = 'profile-achievement-badge';

      const emoji = document.createElement('span');
      emoji.className = 'profile-achievement-emoji';
      emoji.textContent = isUnlocked ? achievement.icon : (isHiddenLocked ? '\u{2753}' : '\u{1F512}');
      emoji.setAttribute('aria-hidden', 'true');
      identity.appendChild(emoji);

      const tooltip = document.createElement('span');
      tooltip.className = 'profile-achievement-tooltip';
      tooltip.setAttribute('role', 'tooltip');

      const tooltipName = document.createElement('span');
      tooltipName.className = 'profile-achievement-tooltip-name';
      tooltipName.textContent = isUnlocked || !achievement.hidden ? achievement.name : 'Surprise achievement';

      const tooltipMeta = document.createElement('span');
      tooltipMeta.className = 'profile-achievement-tooltip-meta';
      tooltipMeta.textContent = isUnlocked
        ? `${ACHIEVEMENT_CATEGORY_LABELS[achievement.category]} · ${achievement.tier} · +${achievement.xp} XP`
        : isHiddenLocked
          ? 'Hidden achievement · keep exploring'
          : `${ACHIEVEMENT_CATEGORY_LABELS[achievement.category]} · ${achievement.tier}`;

      const tooltipDesc = document.createElement('span');
      tooltipDesc.className = 'profile-achievement-tooltip-desc';
      tooltipDesc.textContent = isHiddenLocked ? 'A hidden badge is still waiting in the Zone.' : achievement.description;

      tooltip.append(tooltipName, tooltipMeta, tooltipDesc);
      cell.append(identity, tooltip);
      grid.appendChild(cell);
    });

    categoryDetails.appendChild(grid);
    categoryGrid.appendChild(categoryDetails);
  });

  section.appendChild(categoryGrid);
  return section;
}

function getProfileMissions(profile: UserProfile, isSelfProfile: boolean): ActiveMission[] {
  const active = getActiveMissions();
  if (isSelfProfile) return active;

  const progressByKey = new Map((profile.missions ?? []).map(mission => [`${mission.mission_id}:${mission.period_key}`, mission]));
  return active.map((mission) => {
    const state = progressByKey.get(`${mission.id}:${mission.periodKey}`);
    const progress = Math.min(state?.progress ?? 0, mission.goal);
    return {
      ...mission,
      progress,
      completed: progress >= mission.goal || Boolean(state?.completed_at),
      completedAt: state?.completed_at ?? mission.completedAt,
      progressRatio: Math.min(progress / Math.max(mission.goal, 1), 1),
    };
  });
}

function buildMissionCard(mission: ActiveMission, isSelfProfile: boolean): HTMLElement {
  const card = document.createElement('div');
  card.className = `profile-mission-card profile-surface-card${mission.completed ? ' profile-mission-card-complete' : ''}${isSelfProfile ? '' : ' profile-mission-card-public'}`;

  const topRow = document.createElement('div');
  topRow.className = 'profile-mission-card-header';

  const slot = document.createElement('span');
  slot.className = `profile-mission-slot profile-surface-token profile-mission-slot-${mission.slot}`;
  slot.textContent = mission.slot === 'weekly'
    ? 'Weekly'
    : mission.slot === 'daily_easy'
      ? 'Easy'
      : mission.slot === 'daily_medium'
        ? 'Medium'
        : 'Hard';

  const title = document.createElement('div');
  title.className = 'profile-mission-title';
  title.textContent = mission.name;

  const reward = document.createElement('span');
  reward.className = 'profile-mission-reward';
  reward.textContent = mission.completed ? 'Complete' : (mission.rewardLabel ?? `+${mission.xp} XP`);

  topRow.append(slot, title, reward);

  const progressMeta = document.createElement('div');
  progressMeta.className = 'profile-mission-progress-meta';
  progressMeta.textContent = `${mission.progress}/${mission.goal} · ${mission.category}`;

  card.append(topRow, progressMeta);

  if (mission.goal > 1 || mission.progress > 0) {
    const bar = document.createElement('div');
    bar.className = 'profile-mission-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'profile-mission-progress-fill';
    fill.style.width = `${Math.round(mission.progressRatio * 100)}%`;
    bar.appendChild(fill);
    card.appendChild(bar);
  }

  return card;
}

function buildStreakChallengeSection(profile: UserProfile = cachedProfile!): HTMLElement {
  const section = document.createElement('section');
  section.className = 'profile-popover-streak-challenge profile-surface-section';
  const isSelfProfile = profile.publisher_id === cachedProfile?.publisher_id;

  const streak = profile.streaks
    ? {
        currentStreak: profile.streaks.publish_streak,
        longestStreak: profile.streaks.longest_streak,
        lastPublishWeek: profile.streaks.last_publish_week,
        shieldAvailable: isSelfProfile ? getStreakData().shieldAvailable : false,
        shieldMonth: isSelfProfile ? getStreakData().shieldMonth : '',
      }
    : (isSelfProfile ? getStreakData() : {
        currentStreak: 0,
        longestStreak: 0,
        lastPublishWeek: '',
        shieldAvailable: false,
        shieldMonth: '',
      });
  const loginStreak = profile.streaks
    ? {
        currentStreak: profile.streaks.login_streak,
        lastLoginDate: profile.streaks.last_login_date,
      }
    : (isSelfProfile ? getLoginStreak() : {
        currentStreak: 0,
        lastLoginDate: '',
      });

  const sectionHeading = document.createElement('div');
  sectionHeading.className = 'profile-section-heading-block';
  const heading = document.createElement('div');
  heading.className = 'profile-popover-section-header';
  const headingIcon = createIcon('target');
  const headingTitle = document.createElement('span');
  headingTitle.textContent = isSelfProfile ? 'Mission board' : 'Mission snapshot';
  heading.append(headingIcon, headingTitle);
  sectionHeading.append(heading);

  const missionPanel = document.createElement('div');
  missionPanel.className = 'profile-mission-panel profile-surface-card';

  const streakMeta = document.createElement('div');
  streakMeta.className = 'profile-mission-header-meta';

  // Only show streak chip when there's a meaningful streak to display
  if (streak.longestStreak > 0) {
    const streakSummary = document.createElement('span');
    streakSummary.className = 'profile-mission-header-pill profile-surface-token';
    streakSummary.textContent = `Best ${streak.longestStreak}w`;
    streakMeta.appendChild(streakSummary);
  }

  // Only show shield when it's active/available (actionable info)
  if (streak.shieldAvailable) {
    const shieldBadge = document.createElement('span');
    shieldBadge.className = 'profile-mission-header-pill profile-surface-token profile-mission-header-pill-active';
    shieldBadge.title = 'Streak Shield available — miss one week without losing your streak';
    shieldBadge.textContent = 'Shield ready';
    streakMeta.appendChild(shieldBadge);
  }

  const loginSummary = document.createElement('span');
  loginSummary.className = 'profile-mission-header-pill profile-surface-token';
  loginSummary.textContent = `${loginStreak.currentStreak}d login`;

  streakMeta.appendChild(loginSummary);

  const missionHeader = document.createElement('div');
  missionHeader.className = 'profile-mission-panel-header';
  const headerText = document.createElement('div');
  headerText.className = 'profile-mission-panel-copy';
  const missionTitleRow = document.createElement('div');
  missionTitleRow.className = 'profile-mission-title-row';
  const missionTitle = document.createElement('div');
  missionTitle.className = 'profile-challenge-header';
  missionTitle.textContent = isSelfProfile ? 'Priority objectives' : 'Visible objectives';
  const resetInfo = getMissionResetInfo();
  const cadence = document.createElement('span');
  cadence.className = 'profile-mission-reset';
  cadence.textContent = `${resetInfo.dailyLabel} · ${resetInfo.weeklyLabel}`;
  missionTitleRow.append(missionTitle, cadence);
  headerText.append(missionTitleRow);
  missionHeader.append(headerText, streakMeta);

  const missionList = document.createElement('div');
  missionList.className = 'profile-mission-list';
  const missions = getProfileMissions(profile, isSelfProfile);
  missions.forEach(mission => missionList.appendChild(buildMissionCard(mission, isSelfProfile)));

  missionPanel.append(missionHeader, missionList);

  section.append(sectionHeading, missionPanel);
  return section;
}

function buildLeaderboardSection(profile: UserProfile): HTMLElement {
  const leaderboardSection = document.createElement('section');
  leaderboardSection.className = 'profile-popover-leaderboard profile-surface-section';

  const lbHeader = document.createElement('div');
  lbHeader.className = 'profile-popover-lb-header';
  const trophyIcon = createIcon('trophy');
  const lbTitle = document.createElement('span');
  lbTitle.textContent = 'Leaderboard snapshot';
  const lbMeta = document.createElement('span');
  lbMeta.className = 'profile-popover-summary-meta';
  lbMeta.textContent = 'Loading your rank…';
  lbHeader.append(trophyIcon, lbTitle, lbMeta);

  const lbList = document.createElement('div');
  lbList.className = 'profile-popover-lb-list';
  lbList.textContent = 'Loading…';

  leaderboardSection.append(lbHeader, lbList);

  const renderSnapshot = (entries: LeaderboardEntry[]) => {
    const rank = entries.findIndex(entry => entry.publisher_id === profile.publisher_id);
    lbMeta.textContent = rank >= 0 ? `You are #${rank + 1}` : 'Top 3 + your standing';

    const topEntries = entries.slice(0, 3);
    const selfEntry = rank >= 3 ? entries[rank] : null;
    const snapshot = [...topEntries];
    if (selfEntry) snapshot.push(selfEntry);
    renderLeaderboardList(lbList, snapshot);
  };

  if (leaderboardCache) {
    renderSnapshot(leaderboardCache);
  } else {
    void fetchLeaderboard(10).then((entries) => {
      leaderboardCache = entries;
      renderSnapshot(entries);
    });
  }

  return leaderboardSection;
}

function buildSelfProfileContent(profile: UserProfile): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'profile-popover-shell';

  const body = document.createElement('div');
  body.className = 'profile-popover-body';

  const heroRow = document.createElement('div');
  heroRow.className = 'profile-popover-hero-row';
  heroRow.append(buildProfileHeader(profile), buildProfileFocusSection(profile));

  const actionRow = document.createElement('div');
  actionRow.className = 'profile-popover-action-row';
  actionRow.append(buildStreakChallengeSection(profile), buildStatsSection(profile));

  const footerRow = document.createElement('div');
  footerRow.className = 'profile-popover-footer-row';
  footerRow.append(buildLeaderboardSection(profile), buildXpBreakdownSection());

  body.append(heroRow, actionRow, buildAchievementsSection(profile), footerRow);
  shell.append(body);
  return shell;
}

function openPopover(anchor: HTMLElement): void {
  closePopover();
  if (!cachedProfile) return;

  const popover = document.createElement('div');
  popover.className = 'profile-popover';
  popover.onclick = (e: MouseEvent) => e.stopPropagation();
  popover.appendChild(buildSelfProfileContent(cachedProfile));

  anchor.appendChild(popover);
  popoverOpen = true;

  const close = (e: MouseEvent) => {
    if (!anchor.contains(e.target as Node)) {
      closePopover();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}

function renderLeaderboardList(container: HTMLElement, entries: LeaderboardEntry[]): void {
  container.textContent = '';
  if (entries.length === 0) {
    container.textContent = 'No stalkers ranked yet.';
    return;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'profile-popover-lb-row profile-surface-row';
    row.setAttribute('aria-label', `View ${entry.username}\'s public profile`);
    if (entry.publisher_id === cachedProfile?.publisher_id) {
      row.classList.add('profile-popover-lb-row-self');
      row.setAttribute('aria-label', `View your profile, ${entry.username}`);
    }

    row.onclick = (event) => {
      event.stopPropagation();
      void handleLeaderboardProfileSelection(entry, row, i + 1);
    };

    const rank = document.createElement('span');
    rank.className = 'profile-popover-lb-rank';
    const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
    rank.textContent = i < 3 ? medals[i] : `#${i + 1}`;
    if (i < 3) rank.classList.add(`profile-popover-lb-rank-medal-${i + 1}`);

    const name = document.createElement('span');
    name.className = 'profile-popover-lb-name';
    name.textContent = entry.username;

    const xp = document.createElement('span');
    xp.className = 'profile-popover-lb-xp';
    xp.textContent = `Lv.${entry.level} · ${entry.xp} XP`;

    row.append(rank, name, xp);
    container.appendChild(row);
  }
}

async function handleLeaderboardProfileSelection(entry: LeaderboardEntry, trigger: HTMLButtonElement, leaderboardRank?: number): Promise<void> {
  if (!cachedProfile) return;

  if (entry.publisher_id === cachedProfile.publisher_id) {
    closePublicProfileOverlay();
    trigger.blur();
    return;
  }

  activeLeaderboardRow?.classList.remove('is-loading');
  activeLeaderboardRow = trigger;
  activeLeaderboardRow.classList.add('is-loading');
  activeLeaderboardRow.setAttribute('aria-busy', 'true');

  await openPublicProfileOverlay(entry.publisher_id, trigger, leaderboardRank);

  activeLeaderboardRow.classList.remove('is-loading');
  activeLeaderboardRow.removeAttribute('aria-busy');
}

async function openPublicProfileOverlay(publisherId: string, trigger: HTMLButtonElement, leaderboardRank?: number): Promise<void> {
  closePublicProfileOverlay();
  activePublicProfilePublisherId = publisherId;

  const overlay = document.createElement('div');
  overlay.className = 'public-profile-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.onclick = (event) => {
    if (event.target === overlay) {
      closePublicProfileOverlay();
    }
  };

  const modal = document.createElement('section');
  modal.className = 'public-profile-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'public-profile-title');
  modal.onclick = event => event.stopPropagation();

  const header = document.createElement('div');
  header.className = 'public-profile-modal-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'public-profile-modal-title-wrap';
  const title = document.createElement('h2');
  title.className = 'public-profile-modal-title';
  title.id = 'public-profile-title';
  title.textContent = 'Stalker profile';
  const subtitle = document.createElement('p');
  subtitle.className = 'public-profile-modal-subtitle';
  subtitle.textContent = 'Loading public profile…';
  titleWrap.append(title, subtitle);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'public-profile-modal-close';
  closeButton.setAttribute('aria-label', 'Close public profile');
  closeButton.appendChild(createIcon('close'));
  closeButton.onclick = () => closePublicProfileOverlay();

  header.append(titleWrap, closeButton);

  const body = document.createElement('div');
  body.className = 'public-profile-modal-body';
  body.textContent = 'Fetching the latest signal from the Zone…';

  modal.append(header, body);
  overlay.appendChild(modal);
  getProfileModalMount().appendChild(overlay);

  publicProfileOverlay = overlay;
  publicProfileFocusTrap = trapFocus(modal, {
    restoreFocus: trigger,
    initialFocus: closeButton,
    onEscape: () => closePublicProfileOverlay(),
  });

  try {
    const publicProfile = await fetchPublicProfileData(publisherId);
    if (activePublicProfilePublisherId !== publisherId || publicProfileOverlay !== overlay) {
      return;
    }

    body.textContent = '';
    if (!publicProfile) {
      subtitle.textContent = 'Profile unavailable';
      const emptyState = document.createElement('div');
      emptyState.className = 'public-profile-empty';
      emptyState.textContent = 'Unable to retrieve this stalker\'s public profile right now.';
      body.appendChild(emptyState);
      return;
    }

    const { profile } = publicProfile;

    if (cachedProfile && profile.publisher_id === cachedProfile.publisher_id) {
      subtitle.textContent = 'This is you';
      body.appendChild(buildSelfProfileContent(profile));
      return;
    }

    subtitle.textContent = `${profile.username} · ${profile.title}`;
    body.appendChild(renderPublicProfileView({ data: publicProfile, leaderboardRank }));
  } catch {
    if (activePublicProfilePublisherId !== publisherId || publicProfileOverlay !== overlay) {
      return;
    }
    subtitle.textContent = 'Profile unavailable';
    body.textContent = 'The Zone went quiet before this profile could be fetched.';
  }
}

function closePublicProfileOverlay(): void {
  activePublicProfilePublisherId = null;
  publicProfileFocusTrap?.release();
  publicProfileFocusTrap = null;
  publicProfileOverlay?.remove();
  publicProfileOverlay = null;
  activeLeaderboardRow?.classList.remove('is-loading');
  activeLeaderboardRow?.removeAttribute('aria-busy');
  activeLeaderboardRow = null;
}

function closePopover(): void {
  const existing = document.querySelector('.profile-popover');
  if (existing) existing.remove();
  closePublicProfileOverlay();
  popoverOpen = false;
}

export function invalidateLeaderboardCache(): void {
  leaderboardCache = null;
  publishCountCache = null;
}
