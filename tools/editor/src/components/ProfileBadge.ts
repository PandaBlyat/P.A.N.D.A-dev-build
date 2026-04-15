// P.A.N.D.A. Conversation Editor — Profile Badge (Toolbar Widget)
// Shows the user's level, title, and XP progress in a compact toolbar element.

import {
  type UserProfile,
  type LeaderboardEntry,
  deriveLevelMetadata,
  fetchLeaderboard,
  fetchPublicProfileData,
  fetchUserPublishCount,
  getLevelTitle,
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

function resolveProfileTitle(profile: Pick<UserProfile, 'level' | 'title'>): string {
  return getLevelTitle(profile.level) || profile.title;
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
  wrapper.title = `${resolveProfileTitle(cachedProfile)} — ${cachedProfile.xp} XP`;

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

function createHeroMetaStat(
  iconName: Parameters<typeof createIcon>[0],
  label: string,
  value: string,
  tone: 'default' | 'accent' = 'default',
): HTMLElement {
  const stat = document.createElement('div');
  stat.className = `profile-hero-meta-stat${tone === 'accent' ? ' profile-hero-meta-stat-accent' : ''}`;

  const icon = createIcon(iconName);
  icon.classList.add('profile-hero-meta-icon');

  const head = document.createElement('div');
  head.className = 'profile-hero-meta-head';

  const statLabel = document.createElement('span');
  statLabel.className = 'profile-hero-meta-label';
  statLabel.textContent = label;

  const statValue = document.createElement('span');
  statValue.className = 'profile-hero-meta-value';
  statValue.textContent = value;

  head.append(icon, statLabel);
  stat.append(head, statValue);
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
  avatarCircle.title = isSelfProfile ? 'Profile completion ring' : 'Operative status';

  const avatarInitial = document.createElement('span');
  avatarInitial.className = 'profile-popover-avatar-initial';
  avatarInitial.textContent = getUserInitial(profile.username);
  avatarCircle.appendChild(avatarInitial);

  const statusRing = document.createElement('span');
  statusRing.className = 'profile-popover-avatar-status-ring';
  statusRing.setAttribute('aria-hidden', 'true');
  avatarCircle.appendChild(statusRing);

  const info = document.createElement('div');
  info.className = 'profile-popover-info';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'profile-popover-eyebrow';
  eyebrow.textContent = `Level ${profile.level} operative`;

  const titleEl = document.createElement('div');
  titleEl.className = 'profile-popover-title';
  titleEl.textContent = resolveProfileTitle(profile);

  const unlocked = getUnlockedAchievementIdsForProfile(profile);
  const featuredBadges = getFeaturedAchievements(unlocked);
  const nameRow = document.createElement('div');
  nameRow.className = 'profile-popover-name-row';
  const nameEl = document.createElement('div');
  nameEl.className = 'profile-popover-name';
  nameEl.textContent = profile.username;
  nameRow.appendChild(nameEl);
  if (featuredBadges.length > 0) {
    const unlockedBadgeStrip = document.createElement('div');
    unlockedBadgeStrip.className = 'profile-popover-name-badges';
    featuredBadges.forEach((achievement) => {
      const badge = document.createElement('span');
      badge.className = `profile-popover-name-badge profile-popover-name-badge-${achievement.tier}`;
      badge.title = `${achievement.name} · ${achievement.tier}`;
      badge.appendChild(createAchievementIcon(achievement.id, 'profile-achievement-inline-icon'));
      unlockedBadgeStrip.appendChild(badge);
    });
    nameRow.appendChild(unlockedBadgeStrip);
  }

  const rareUnlockedCount = getRareAchievementCount(unlocked);
  const headerHighlights = document.createElement('div');
  headerHighlights.className = 'profile-popover-header-highlights';
  const highlightPills: HTMLElement[] = [
    createMetaChip('Badges', `${unlocked.length}/${ACHIEVEMENTS.length}`),
    createMetaChip('Rare', String(rareUnlockedCount), rareUnlockedCount > 0 ? 'accent' : 'muted'),
    createMetaChip('Title', `Lv.${profile.level}`, 'accent'),
  ];

  let activePillIndex = -1;
  highlightPills.forEach((pill, idx) => {
    pill.classList.add('profile-popover-filter-pill');
    pill.setAttribute('role', 'button');
    pill.tabIndex = 0;
    pill.title = idx === 0
      ? 'Shows unlocked badge progress'
      : idx === 1
        ? 'Shows rare badge unlock progress'
        : 'Shows current title tier';
    const toggle = () => {
      const shouldActivate = activePillIndex !== idx;
      highlightPills.forEach((node, nodeIndex) => {
        node.classList.toggle('is-active', shouldActivate && nodeIndex === idx);
      });
      activePillIndex = shouldActivate ? idx : -1;
    };
    pill.addEventListener('click', toggle);
    pill.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
    headerHighlights.appendChild(pill);
  });

  const metaRow = document.createElement('div');
  metaRow.className = 'profile-popover-meta-row';
  metaRow.append(
    createHeroMetaStat('star', 'XP total', profile.xp.toLocaleString(), 'accent'),
    createHeroMetaStat('flame', 'Publish streak', `${streak.publish} weeks`),
    createHeroMetaStat('user', 'Daily login', `${streak.login} days`),
    createHeroMetaStat('clock', 'Joined', formatMemberSince(profile.created_at)),
  );

  const infoTop = document.createElement('div');
  infoTop.className = 'profile-popover-info-top';
  infoTop.append(eyebrow, nameRow);

  const infoBottom = document.createElement('div');
  infoBottom.className = 'profile-popover-info-bottom';
  infoBottom.append(headerHighlights, metaRow);

  info.append(infoTop, titleEl, infoBottom);
  identity.append(avatarCircle, info);

  header.append(identity, buildProgressSection(profile));
  return header;
}

function buildProgressSection(profile: UserProfile): HTMLElement {
  const progressSection = document.createElement('div');
  progressSection.className = 'profile-popover-progress';

  const levelMeta = deriveLevelMetadata(profile.xp);
  const currentThreshold = levelMeta.currentLevelThreshold;
  const nextThreshold = levelMeta.nextLevelThreshold;
  const currentMin = currentThreshold.xp;
  const nextXp = nextThreshold?.xp ?? currentThreshold.xp;
  const progressPercent = Math.round(levelMeta.progressFraction * 100);
  const xpToGo = Math.max((nextThreshold?.xp ?? profile.xp) - profile.xp, 0);

  const progressTop = document.createElement('div');
  progressTop.className = 'profile-popover-progress-top';

  const levelBadge = document.createElement('div');
  levelBadge.className = 'profile-popover-level-badge';
  levelBadge.textContent = `Lv.${currentThreshold.level}`;

  const progressCopy = document.createElement('div');
  progressCopy.className = 'profile-popover-progress-copy';

  const progressKicker = document.createElement('span');
  progressKicker.className = 'profile-popover-progress-kicker';
  progressKicker.textContent = nextThreshold ? 'Progress to next title' : 'Progress complete';

  const levelLabel = document.createElement('span');
  levelLabel.className = 'profile-popover-level-label';
  levelLabel.textContent = nextThreshold ? `${progressPercent}% to Level ${nextThreshold.level}` : 'Max level reached';

  const xpNumbers = document.createElement('span');
  xpNumbers.className = 'profile-popover-bar-label';
  xpNumbers.textContent = nextThreshold
    ? `${profile.xp.toLocaleString()} / ${nextThreshold.xp.toLocaleString()} XP`
    : `${profile.xp.toLocaleString()} XP`;

  progressCopy.append(progressKicker, levelLabel, xpNumbers);
  progressTop.append(levelBadge, progressCopy);

  const barTrack = document.createElement('div');
  barTrack.className = 'profile-popover-bar-track';
  barTrack.title = nextThreshold
    ? `${xpToGo.toLocaleString()} XP needed for Level ${nextThreshold.level}`
    : 'Max level reached';
  const barFill = document.createElement('div');
  barFill.className = 'profile-popover-bar-fill';
  barFill.style.width = `${progressPercent}%`;
  barFill.style.setProperty('--progress-width', `${progressPercent}%`);
  const milestoneNotch = document.createElement('span');
  milestoneNotch.className = 'profile-popover-bar-notch';
  milestoneNotch.setAttribute('aria-hidden', 'true');
  barTrack.append(barFill, milestoneNotch);

  const barMarkers = document.createElement('div');
  barMarkers.className = 'profile-popover-bar-markers';
  const leftMarker = document.createElement('span');
  leftMarker.className = 'profile-popover-bar-marker';
  leftMarker.textContent = `${currentMin.toLocaleString()} XP`;
  const rightMarker = document.createElement('span');
  rightMarker.className = 'profile-popover-bar-marker';
  rightMarker.textContent = `${nextXp.toLocaleString()} XP`;
  barMarkers.append(leftMarker, rightMarker);

  const progressFooter = document.createElement('div');
  progressFooter.className = 'profile-popover-progress-footer';

  const nextLabel = document.createElement('div');
  nextLabel.className = 'profile-popover-next';
  nextLabel.textContent = nextThreshold
    ? `Next title: ${nextThreshold.title}`
    : 'All level rewards unlocked';

  const progressTarget = document.createElement('div');
  progressTarget.className = 'profile-popover-progress-target';
  progressTarget.textContent = nextThreshold ? `${xpToGo.toLocaleString()} XP to go` : 'Legend status achieved';

  progressFooter.append(nextLabel, progressTarget);
  progressSection.append(progressTop, barTrack, barMarkers, progressFooter);

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
  statsSection.classList.add('profile-dashboard-card', 'profile-dashboard-progress-highlights');
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
  xpBreakdownSection.classList.add('profile-dashboard-card', 'profile-dashboard-how-to-earn-xp');

  const xpBreakdownHeaderCopy = document.createElement('div');
  xpBreakdownHeaderCopy.className = 'profile-popover-section-header';
  const starIcon = createIcon('star');
  const xpBreakdownTitle = document.createElement('span');
  xpBreakdownTitle.textContent = 'How to Earn XP';
  const xpBreakdownMeta = document.createElement('span');
  xpBreakdownMeta.className = 'profile-popover-summary-meta';
  xpBreakdownMeta.textContent = '3 quick sources';
  xpBreakdownHeaderCopy.append(starIcon, xpBreakdownTitle, xpBreakdownMeta);

  const xpRows = document.createElement('div');
  xpRows.className = 'profile-popover-xp-rows';

  const xpItems: [string, string | number][] = [
    ['Publish conversations', `+${XP_PUBLISH_SHORT} to +${XP_PUBLISH_LONG} XP`],
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
    rowValue.textContent = typeof amount === 'number' ? `+${amount} XP` : amount;
    row.append(rowLabel, rowValue);
    xpRows.appendChild(row);
  }

  xpBreakdownSection.append(xpBreakdownHeaderCopy, xpRows);
  return xpBreakdownSection;
}

type AchievementTarget = {
  achievement: Achievement;
  reason: string;
  progressCurrent: number;
  progressGoal: number;
  progressLabel: string;
};

type AchievementProgress = {
  current: number;
  goal: number;
  label: string;
};

function getAchievementIconName(achievementId: Achievement['id']): IconName {
  switch (achievementId) {
    case 'first_patrol': return 'export';
    case 'login_streak_1': return 'clock';
    case 'challenge_apprentice': return 'target';
    case 'mission_apprentice': return 'target';
    case 'first_upvote_received': return 'sparkle';
    case 'rising_signal': return 'share';
    case 'upvote_wave': return 'share';
    case 'profile_spotlight': return 'eye';
    case 'popular_stalker': return 'download';
    case 'community_favorite': return 'star';
    case 'crowd_pleaser': return 'trophy';
    case 'first_publish': return 'export';
    case 'branching_out': return 'target';
    case 'story_weaver': return 'brand';
    case 'cartographer': return 'locate';
    case 'web_of_lies': return 'share';
    case 'new_faction_scout': return 'sparkle';
    case 'faction_diplomat': return 'user';
    case 'zone_encyclopedist': return 'database';
    case 'flow_restorer': return 'restart';
    case 'uncommon_operator': return 'help';
    case 'outcome_engineer': return 'support';
    case 'branch_architect': return 'brand';
    case 'precondition_master': return 'shield';
    case 'precondition_tactician': return 'shield';
    case 'quality_crafter': return 'medal';
    case 'systems_polymath': return 'database';
    case 'clean_publish_streak': return 'check';
    case 'four_star_streak': return 'star';
    case 'prolific_writer': return 'export';
    case 'zone_veteran': return 'trophy';
    case 'streak_3': return 'flame';
    case 'streak_10': return 'flame';
    case 'bronze_complete': return 'medal';
    case 'onboarding_complete': return 'medal';
    case 'silver_complete': return 'medal';
    case 'faction_complete': return 'database';
    case 'night_shift': return 'clock';
    case 'zone_whisperer': return 'sparkle';
    default: return 'medal';
  }
}

function createAchievementIcon(achievementId: Achievement['id'], className: string): HTMLElement {
  const icon = createIcon(getAchievementIconName(achievementId));
  icon.classList.add(className);
  return icon;
}

function getAchievementProgress(profile: UserProfile, unlockedIds: string[], achievementId: Achievement['id']): AchievementProgress {
  const publishCount = profile.publisher_id === cachedProfile?.publisher_id ? (publishCountCache ?? 0) : 0;
  const loginStreak = profile.streaks?.login_streak ?? (profile.publisher_id === cachedProfile?.publisher_id ? getLoginStreak().currentStreak : 0);
  const publishStreak = profile.streaks?.publish_streak ?? (profile.publisher_id === cachedProfile?.publisher_id ? getStreakData().currentStreak : 0);
  const completedMissionCount = (profile.missions ?? []).filter((mission) => Boolean(mission.completed_at)).length;
  const unlockedCount = unlockedIds.length;

  const completion = (current: number, goal: number): AchievementProgress => ({
    current: Math.min(current, goal),
    goal,
    label: `${Math.min(current, goal)}/${goal}`,
  });

  switch (achievementId) {
    case 'first_patrol': return completion(publishCount, 2);
    case 'first_publish': return completion(publishCount, 1);
    case 'story_weaver': return completion(0, 1);
    case 'cartographer': return completion(publishCount, 5);
    case 'prolific_writer': return completion(publishCount, 10);
    case 'zone_veteran': return completion(publishCount, 50);
    case 'login_streak_1': return completion(loginStreak, 1);
    case 'challenge_apprentice': return completion(completedMissionCount, 1);
    case 'mission_apprentice': return completion(completedMissionCount, 3);
    case 'streak_3': return completion(publishStreak, 3);
    case 'streak_10': return completion(publishStreak, 10);
    case 'bronze_complete': {
      const bronzeTotal = ACHIEVEMENTS.filter((achievement) => achievement.tier === 'bronze').length;
      const bronzeUnlocked = ACHIEVEMENTS.filter((achievement) => achievement.tier === 'bronze' && unlockedIds.includes(achievement.id)).length;
      return completion(bronzeUnlocked, bronzeTotal);
    }
    case 'silver_complete': {
      const silverTotal = ACHIEVEMENTS.filter((achievement) => achievement.tier === 'silver').length;
      const silverUnlocked = ACHIEVEMENTS.filter((achievement) => achievement.tier === 'silver' && unlockedIds.includes(achievement.id)).length;
      return completion(silverUnlocked, silverTotal);
    }
    case 'faction_complete': {
      const factionTotal = 3;
      const factionUnlocked = ['new_faction_scout', 'faction_diplomat', 'zone_encyclopedist']
        .filter((id) => unlockedIds.includes(id))
        .length;
      return completion(factionUnlocked, factionTotal);
    }
    case 'onboarding_complete': {
      const onboardingIds = ['first_patrol', 'login_streak_1', 'challenge_apprentice', 'mission_apprentice'];
      const onboardingUnlocked = onboardingIds.filter((id) => unlockedIds.includes(id)).length;
      return completion(onboardingUnlocked, onboardingIds.length);
    }
    default:
      return {
        current: 0,
        goal: 1,
        label: unlockedCount > 0 ? 'Not started' : 'Track starts after first unlock',
      };
  }
}

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

function buildNextGoalsPanel(profile: UserProfile): HTMLElement {
  const section = document.createElement('section');
  section.className = 'profile-focus-panel profile-surface-section';

  const header = document.createElement('div');
  header.className = 'profile-focus-header';
  const targetIcon = createIcon('target');
  const titleWrap = document.createElement('div');
  titleWrap.className = 'profile-focus-title-wrap';
  const title = document.createElement('div');
  title.className = 'profile-popover-section-header profile-focus-title';
  title.append(targetIcon, document.createTextNode('Next goals'));

  const unlockedIds = getUnlockedAchievementIdsForProfile(profile);
  const nextTargets = getNextAchievementTargets(profile, unlockedIds);

  const subtitle = document.createElement('p');
  subtitle.className = 'profile-focus-subtitle';
  subtitle.textContent = nextTargets.length > 0
    ? `${nextTargets.length} suggested unlocks based on your progression.`
    : 'No suggested goals right now — new achievements will appear as you progress.';
  titleWrap.append(title, subtitle);
  header.appendChild(titleWrap);

  const cards = document.createElement('div');
  cards.className = 'profile-focus-cards profile-focus-goal-cards';

  if (nextTargets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'profile-focus-card profile-surface-card';
    const emptyLabel = document.createElement('div');
    emptyLabel.className = 'profile-focus-card-label';
    emptyLabel.textContent = 'No goals queued';
    const emptyTitle = document.createElement('div');
    emptyTitle.className = 'profile-focus-card-title';
    emptyTitle.textContent = 'You are caught up';
    const emptyDesc = document.createElement('p');
    emptyDesc.className = 'profile-focus-card-desc';
    emptyDesc.textContent = 'Publish, complete missions, or keep your streak alive to surface fresh targets.';
    empty.append(emptyLabel, emptyTitle, emptyDesc);
    cards.appendChild(empty);
  } else {
    const visibleTargets = nextTargets.slice(0, 5);
    const panelId = `profile-goal-panel-${profile.publisher_id}`;

    const queue = document.createElement('div');
    queue.className = 'profile-focus-goal-queue';
    queue.setAttribute('role', 'tablist');
    queue.setAttribute('aria-label', 'Next goals queue');
    queue.setAttribute('aria-orientation', 'vertical');

    const detailCard = document.createElement('article');
    detailCard.className = 'profile-focus-card profile-surface-card profile-focus-goal-detail';
    detailCard.setAttribute('role', 'tabpanel');
    detailCard.id = panelId;

    const detailHeader = document.createElement('div');
    detailHeader.className = 'profile-focus-goal-detail-head';
    const detailTop = document.createElement('div');
    detailTop.className = 'profile-focus-goal-top';
    const detailIcon = document.createElement('span');
    detailIcon.className = 'profile-focus-goal-icon profile-focus-goal-icon-large';
    const detailTitle = document.createElement('div');
    detailTitle.className = 'profile-focus-card-title';
    detailTop.append(detailIcon, detailTitle);

    const detailPill = document.createElement('div');
    detailPill.className = 'profile-focus-goal-detail-pill';
    detailHeader.append(detailTop, detailPill);

    const detailDesc = document.createElement('p');
    detailDesc.className = 'profile-focus-card-desc profile-focus-goal-detail-desc';

    const detailReason = document.createElement('p');
    detailReason.className = 'profile-focus-goal-insight';

    const detailProgress = document.createElement('div');
    detailProgress.className = 'profile-focus-goal-progress';
    const detailProgressLabel = document.createElement('span');
    detailProgressLabel.className = 'profile-focus-goal-progress-label';
    const detailProgressValue = document.createElement('span');
    detailProgressValue.className = 'profile-focus-goal-progress-value';
    const detailProgressTrack = document.createElement('div');
    detailProgressTrack.className = 'profile-focus-goal-progress-track';
    const detailProgressBar = document.createElement('span');
    detailProgressBar.className = 'profile-focus-goal-progress-bar';
    detailProgressTrack.appendChild(detailProgressBar);
    detailProgress.append(detailProgressLabel, detailProgressValue, detailProgressTrack);

    const detailAction = document.createElement('div');
    detailAction.className = 'profile-focus-goal-action';
    const detailActionLabel = document.createElement('div');
    detailActionLabel.className = 'profile-focus-goal-action-label';
    const detailActionLabelIcon = createIcon('sparkle');
    detailActionLabelIcon.classList.add('profile-focus-goal-action-label-icon');
    detailActionLabel.append(detailActionLabelIcon, document.createTextNode('Next step'));
    const detailActionBody = document.createElement('p');
    detailActionBody.className = 'profile-focus-goal-action-body';

    const detailNav = document.createElement('div');
    detailNav.className = 'profile-focus-goal-nav';
    const navPrev = document.createElement('button');
    navPrev.type = 'button';
    navPrev.className = 'profile-focus-goal-nav-btn';
    navPrev.setAttribute('aria-label', 'Show previous goal');
    navPrev.append(createIcon('undo'), document.createTextNode('Prev'));
    const navCounter = document.createElement('span');
    navCounter.className = 'profile-focus-goal-nav-counter';
    const navNext = document.createElement('button');
    navNext.type = 'button';
    navNext.className = 'profile-focus-goal-nav-btn';
    navNext.setAttribute('aria-label', 'Show next goal');
    navNext.append(document.createTextNode('Next'), createIcon('redo'));
    detailNav.append(navPrev, navCounter, navNext);

    detailAction.append(detailActionLabel, detailActionBody);
    detailCard.append(detailHeader, detailDesc, detailReason, detailProgress, detailAction, detailNav);

    const tabs: HTMLButtonElement[] = [];
    let activeIndex = 0;

    const renderActiveTarget = (index: number) => {
      const normalized = Math.max(0, Math.min(index, visibleTargets.length - 1));
      activeIndex = normalized;
      const { achievement, reason, progressCurrent, progressGoal, progressLabel } = visibleTargets[normalized];
      const activeTab = tabs[normalized];
      detailCard.classList.remove('profile-focus-goal-card-bronze', 'profile-focus-goal-card-silver', 'profile-focus-goal-card-gold');
      detailCard.classList.add(`profile-focus-goal-card-${achievement.tier}`);
      if (activeTab) {
        detailCard.setAttribute('aria-labelledby', activeTab.id);
      }
      detailPill.textContent = `${ACHIEVEMENT_CATEGORY_LABELS[achievement.category]} · ${achievement.tier} · +${achievement.xp} XP`;
      detailIcon.textContent = '';
      detailIcon.appendChild(createAchievementIcon(achievement.id, 'profile-achievement-inline-icon'));
      detailTitle.textContent = achievement.name;
      detailDesc.textContent = achievement.description;
      detailReason.textContent = reason;
      detailActionBody.textContent = getGoalActionHint(achievement.id, profile);
      detailProgressLabel.textContent = 'Goal progress';
      detailProgressValue.textContent = progressLabel;
      const progress = Math.min((progressCurrent / Math.max(progressGoal, 1)) * 100, 100);
      detailProgressBar.style.width = `${progress}%`;
      navCounter.textContent = `Goal ${normalized + 1}/${visibleTargets.length}`;
      navPrev.disabled = visibleTargets.length <= 1;
      navNext.disabled = visibleTargets.length <= 1;

      tabs.forEach((tab, tabIndex) => {
        const isActive = tabIndex === normalized;
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.tabIndex = isActive ? 0 : -1;
        tab.classList.toggle('is-active', isActive);
      });
    };

    visibleTargets.forEach(({ achievement, reason }, index) => {
      const goalTab = document.createElement('button');
      goalTab.type = 'button';
      goalTab.className = `profile-focus-card profile-surface-card profile-focus-goal-card profile-focus-goal-card-${achievement.tier} profile-focus-goal-queue-item`;
      goalTab.title = `${achievement.name} — ${achievement.description}`;
      goalTab.setAttribute('role', 'tab');
      goalTab.id = `profile-goal-tab-${profile.publisher_id}-${achievement.id}`;
      goalTab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      goalTab.setAttribute('aria-controls', panelId);
      goalTab.tabIndex = index === 0 ? 0 : -1;

      const goalTop = document.createElement('div');
      goalTop.className = 'profile-focus-goal-top';
      const goalIcon = document.createElement('span');
      goalIcon.className = 'profile-focus-goal-icon';
      goalIcon.appendChild(createAchievementIcon(achievement.id, 'profile-achievement-inline-icon'));
      const goalTitle = document.createElement('div');
      goalTitle.className = 'profile-focus-card-title';
      goalTitle.textContent = achievement.name;
      goalTop.append(goalIcon, goalTitle);

      const goalMeta = document.createElement('div');
      goalMeta.className = 'profile-focus-card-meta';
      goalMeta.textContent = `${ACHIEVEMENT_CATEGORY_LABELS[achievement.category]} · +${achievement.xp} XP`;

      const goalDesc = document.createElement('p');
      goalDesc.className = 'profile-focus-card-desc';
      goalDesc.textContent = reason;

      const goalQueueHint = document.createElement('div');
      goalQueueHint.className = 'profile-focus-goal-queue-hint';
      goalQueueHint.textContent = index === 0 ? 'Recommended next unlock' : `Queue slot ${index + 1}`;

      goalTab.append(goalTop, goalMeta, goalQueueHint);
      goalTab.addEventListener('click', () => renderActiveTarget(index));
      goalTab.addEventListener('focus', () => renderActiveTarget(index));
      goalTab.addEventListener('keydown', (event) => {
        if (
          event.key !== 'ArrowRight'
          && event.key !== 'ArrowLeft'
          && event.key !== 'ArrowDown'
          && event.key !== 'ArrowUp'
          && event.key !== 'Home'
          && event.key !== 'End'
        ) return;
        event.preventDefault();
        let next = activeIndex;
        if (event.key === 'Home') {
          next = 0;
        } else if (event.key === 'End') {
          next = visibleTargets.length - 1;
        } else {
          const dir = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
          next = (activeIndex + dir + visibleTargets.length) % visibleTargets.length;
        }
        renderActiveTarget(next);
        tabs[next]?.focus();
      });

      tabs.push(goalTab);
      queue.appendChild(goalTab);
    });

    navPrev.addEventListener('click', () => {
      const prev = (activeIndex - 1 + visibleTargets.length) % visibleTargets.length;
      renderActiveTarget(prev);
      tabs[prev]?.focus();
    });
    navNext.addEventListener('click', () => {
      const next = (activeIndex + 1) % visibleTargets.length;
      renderActiveTarget(next);
      tabs[next]?.focus();
    });

    renderActiveTarget(0);
    cards.append(queue, detailCard);
  }

  section.append(header, cards);
  return section;
}

function getGoalActionHint(achievementId: Achievement['id'], profile: UserProfile): string {
  const publishCount = profile.publisher_id === cachedProfile?.publisher_id ? (publishCountCache ?? 0) : 0;
  const loginStreak = profile.streaks?.login_streak ?? (profile.publisher_id === cachedProfile?.publisher_id ? getLoginStreak().currentStreak : 0);
  const publishStreak = profile.streaks?.publish_streak ?? (profile.publisher_id === cachedProfile?.publisher_id ? getStreakData().currentStreak : 0);
  const unlockedCount = getUnlockedAchievementIdsForProfile(profile).length;

  switch (achievementId) {
    case 'first_patrol':
      return publishCount >= 2 ? 'Momentum check: your publishing cadence already clears this goal.' : 'Action: publish two conversations to lock in your onboarding momentum.';
    case 'first_publish':
      return publishCount > 0 ? 'Momentum check: you already published — keep stacking discovery goals.' : 'Action: publish one conversation to unlock this immediately.';
    case 'login_streak_1':
      return loginStreak > 0 ? `Momentum check: ${loginStreak}-day login streak already active.` : 'Action: return tomorrow to kick off your streak.';
    case 'streak_3':
      return publishStreak > 0 ? `Momentum check: currently on a ${publishStreak}-week publish streak.` : 'Action: publish weekly to start your streak ladder.';
    case 'challenge_apprentice':
      return 'Action: finish any active mission board card to unlock this onboarding milestone.';
    case 'mission_apprentice':
      return 'Action: complete three mission cards (daily or weekly) to finish this tier.';
    case 'bronze_complete':
      return `Action: focus on bronze goals first (${unlockedCount} total achievements unlocked so far).`;
    default:
      return 'Action: complete the requirement shown above, then return for the next recommendation.';
  }
}

function getNextAchievementTargets(profile: UserProfile, unlockedIds: string[]): AchievementTarget[] {
  const loginStreak = profile.streaks?.login_streak ?? (profile.publisher_id === cachedProfile?.publisher_id ? getLoginStreak().currentStreak : 0);
  const publishStreak = profile.streaks?.publish_streak ?? (profile.publisher_id === cachedProfile?.publisher_id ? getStreakData().currentStreak : 0);
  const publishCount = profile.publisher_id === cachedProfile?.publisher_id ? (publishCountCache ?? 0) : 0;
  const lockedVisible = getVisibleAchievementCatalog().filter((achievement) => !unlockedIds.includes(achievement.id));
  const isLikelyAlreadyDone = (achievementId: Achievement['id']): boolean => {
    const completedMissionCount = (profile.missions ?? []).filter((mission) => Boolean(mission.completed_at)).length;
    switch (achievementId) {
      case 'first_patrol': return publishCount >= 2;
      case 'first_publish': return publishCount >= 1;
      case 'cartographer': return publishCount >= 5;
      case 'prolific_writer': return publishCount >= 10;
      case 'zone_veteran': return publishCount >= 50;
      case 'login_streak_1': return loginStreak >= 1;
      case 'challenge_apprentice': return completedMissionCount >= 1;
      case 'mission_apprentice': return completedMissionCount >= 3;
      case 'streak_3': return publishStreak >= 3;
      case 'streak_10': return publishStreak >= 10;
      default: return false;
    }
  };

  const hints = new Map<string, { score: number; reason: string }>([
    ['first_patrol', { score: publishCount >= 1 ? 97 : 84, reason: publishCount >= 1 ? 'One more publish secures a strong onboarding foothold.' : 'Two publishes establish your baseline operating rhythm.' }],
    ['login_streak_1', { score: loginStreak > 0 ? 96 : 82, reason: loginStreak > 0 ? `You already have a ${loginStreak}-day login streak going.` : 'A quick streak milestone is one return visit away.' }],
    ['challenge_apprentice', { score: 95, reason: 'Mission board completions are meant to be an early momentum builder.' }],
    ['mission_apprentice', { score: 90, reason: 'Stacking three mission clears gives reliable XP and unlock pacing.' }],
    ['first_upvote_received', { score: 88, reason: 'A single community reaction unlocks your first social badge.' }],
    ['rising_signal', { score: 84, reason: 'Ten upvotes is a realistic social step before higher-tier crowd goals.' }],
    ['profile_spotlight', { score: 78, reason: 'Featured badges and activity make profile milestones easier to hit.' }],
    ['crowd_pleaser', { score: 72, reason: 'Sustained upvotes lock in one of the strongest social badges.' }],
    ['first_publish', { score: publishCount === 0 ? 99 : 5, reason: publishCount === 0 ? 'Your first publish unlocks discovery progression immediately.' : 'Already completed in your publish history.' }],
    ['branching_out', { score: 90, reason: 'A five-branch conversation is the fastest visible discovery target.' }],
    ['story_weaver', { score: 76, reason: 'A deep 15-turn conversation unlocks a standout discovery milestone.' }],
    ['cartographer', { score: publishCount >= 2 ? 88 : 58, reason: 'Five publishes gives you durable catalog momentum and unlocks discovery progression.' }],
    ['new_faction_scout', { score: publishCount > 0 ? 92 : 72, reason: publishCount > 0 ? 'Publishing in a fresh faction broadens your discovery set.' : 'After your first publish, try a second faction for quick breadth.' }],
    ['faction_diplomat', { score: publishCount >= 2 ? 84 : 60, reason: 'Three factions is a clear medium-term route into collection badges.' }],
    ['uncommon_operator', { score: 83, reason: 'Trying one uncommon command type opens a more expressive discovery lane.' }],
    ['outcome_engineer', { score: 89, reason: 'Mixing four outcome types is an approachable mastery target.' }],
    ['branch_architect', { score: 84, reason: 'An eight-branch structure is a clean midpoint between basic and expert conversation depth.' }],
    ['precondition_master', { score: 86, reason: 'Adding layered preconditions strengthens systemic depth.' }],
    ['precondition_tactician', { score: 77, reason: 'Pushing to eight preconditions sharpens complex scenario control.' }],
    ['quality_crafter', { score: 80, reason: 'A polished five-star publish is a strong mastery milestone.' }],
    ['systems_polymath', { score: 74, reason: 'Outcome and precondition variety together unlock a rare mastery badge.' }],
    ['streak_3', { score: publishStreak > 0 ? 87 : 68, reason: publishStreak > 0 ? `Your ${publishStreak}-week publish streak can grow into this badge.` : 'Weekly consistency opens the streak ladder.' }],
    ['prolific_writer', { score: publishCount > 0 ? 70 : 42, reason: 'This remains a long-term milestone, but now it sits beside broader goals.' }],
    ['bronze_complete', { score: unlockedIds.length >= 4 ? 79 : 36, reason: 'Bronze cleanup is a natural collection target after a few early wins.' }],
  ]);

  const scored = lockedVisible
    .filter((achievement) => !isLikelyAlreadyDone(achievement.id))
    .map((achievement) => {
      const hint = hints.get(achievement.id);
      const progress = getAchievementProgress(profile, unlockedIds, achievement.id);
      const progressRatio = progress.goal > 0 ? Math.min(progress.current / progress.goal, 1) : 0;
      const progressBoost = Math.round(progressRatio * 12);
      return {
        achievement,
        score: (hint?.score ?? (achievement.category === 'onboarding' ? 50 : achievement.category === 'collection' ? 35 : 45)) + progressBoost,
        reason: hint?.reason ?? 'A visible next step that broadens your badge mix.',
        progressCurrent: progress.current,
        progressGoal: progress.goal,
        progressLabel: progress.label,
      };
    })
    .filter((target) => !unlockedIds.includes(target.achievement.id))
    .filter((target) => target.progressCurrent < target.progressGoal);

  const buckets = new Map<AchievementCategory, typeof scored>();
  for (const target of scored) {
    const existing = buckets.get(target.achievement.category) ?? [];
    existing.push(target);
    buckets.set(target.achievement.category, existing);
  }

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => b.score - a.score || getAchievementTierRank(a.achievement) - getAchievementTierRank(b.achievement) || a.achievement.xp - b.achievement.xp);
  }

  const categoryQueue = ACHIEVEMENT_CATEGORY_ORDER.filter((category) => (buckets.get(category)?.length ?? 0) > 0);
  const picks: typeof scored = [];

  while (picks.length < 5 && categoryQueue.length > 0) {
    for (let index = 0; index < categoryQueue.length && picks.length < 5; index += 1) {
      const category = categoryQueue[index];
      const bucket = buckets.get(category) ?? [];
      const nextTarget = bucket.shift();
      if (nextTarget) picks.push(nextTarget);
      if (bucket.length === 0) {
        categoryQueue.splice(index, 1);
        index -= 1;
      }
    }
  }

  return picks;
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

    const icon = createAchievementIcon(achievement.id, 'profile-achievement-featured-icon');

    const text = document.createElement('span');
    text.className = 'profile-achievement-featured-name';
    text.textContent = achievement.name;

    badge.append(icon, text);
    badges.appendChild(badge);
  });

  strip.appendChild(badges);
  return strip;
}

type AchievementFilter = 'all' | 'unlocked' | 'locked' | 'rare' | 'hidden';

function buildAchievementsSection(profile: UserProfile = cachedProfile!): HTMLElement {
  const section = document.createElement('div');
  section.className = 'profile-popover-achievements profile-surface-section profile-popover-achievements-v2';
  section.classList.add('profile-dashboard-card', 'profile-dashboard-achievements');

  const unlocked = getUnlockedAchievementIdsForProfile(profile);
  const visibleGoalCount = getVisibleAchievementCatalog().length;
  const hiddenGoalCount = ACHIEVEMENTS.filter(achievement => achievement.hidden).length;
  const rareUnlockedCount = getRareAchievementCount(unlocked);
  const xpFromAchievements = ACHIEVEMENTS.reduce(
    (sum, a) => sum + (unlocked.includes(a.id) ? a.xp : 0),
    0,
  );
  const totalXpPossible = ACHIEVEMENTS.reduce((sum, a) => sum + a.xp, 0);
  const progressRatio = unlocked.length / Math.max(ACHIEVEMENTS.length, 1);

  // ── Enhanced hero header with progress ring ───────────────────────────────
  const hero = document.createElement('div');
  hero.className = 'profile-achievements-hero';

  const ring = buildAchievementProgressRing(progressRatio, unlocked.length, ACHIEVEMENTS.length);
  hero.appendChild(ring);

  const heroText = document.createElement('div');
  heroText.className = 'profile-achievements-hero-text';

  const heroHeader = document.createElement('div');
  heroHeader.className = 'profile-popover-section-header';
  const medalIcon = createIcon('medal');
  const title = document.createElement('span');
  title.textContent = 'Achievements';
  heroHeader.append(medalIcon, title);
  heroText.appendChild(heroHeader);

  const heroSub = document.createElement('div');
  heroSub.className = 'profile-achievements-hero-sub';
  heroSub.textContent = `${unlocked.length} of ${ACHIEVEMENTS.length} unlocked · ${xpFromAchievements} / ${totalXpPossible} XP earned`;
  heroText.appendChild(heroSub);

  // Tier pill strip: Bronze / Silver / Gold unlocked counts
  const tierStrip = buildTierSummaryStrip(unlocked);
  heroText.appendChild(tierStrip);

  hero.appendChild(heroText);
  section.appendChild(hero);

  // ── Filter chips ──────────────────────────────────────────────────────────
  const filterBar = document.createElement('div');
  filterBar.className = 'profile-achievements-filter-bar';
  filterBar.setAttribute('role', 'tablist');

  const filters: Array<{ id: AchievementFilter; label: string; count: number; tone?: 'accent' | 'muted' }> = [
    { id: 'all', label: 'All', count: ACHIEVEMENTS.length },
    { id: 'unlocked', label: 'Unlocked', count: unlocked.length, tone: 'accent' },
    { id: 'locked', label: 'Locked', count: ACHIEVEMENTS.length - unlocked.length, tone: 'muted' },
    { id: 'rare', label: 'Rare', count: rareUnlockedCount },
    { id: 'hidden', label: 'Surprise', count: hiddenGoalCount, tone: 'muted' },
  ];

  const filterState: { current: AchievementFilter } = { current: 'all' };
  const filterButtons: HTMLButtonElement[] = [];

  for (const f of filters) {
    if (f.id !== 'all' && f.count === 0) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `profile-achievements-filter-chip${f.tone === 'accent' ? ' is-accent' : ''}${f.tone === 'muted' ? ' is-muted' : ''}`;
    btn.dataset.filter = f.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', f.id === 'all' ? 'true' : 'false');
    if (f.id === 'all') btn.classList.add('is-active');

    const chipLabel = document.createElement('span');
    chipLabel.className = 'profile-achievements-filter-chip-label';
    chipLabel.textContent = f.label;

    const chipCount = document.createElement('span');
    chipCount.className = 'profile-achievements-filter-chip-count';
    chipCount.textContent = String(f.count);

    btn.append(chipLabel, chipCount);
    btn.addEventListener('click', () => {
      filterState.current = f.id;
      for (const b of filterButtons) {
        const active = b.dataset.filter === f.id;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      }
      applyAchievementFilter(section, f.id);
    });
    filterButtons.push(btn);
    filterBar.appendChild(btn);
  }

  section.appendChild(filterBar);

  // Keep a small summary row in muted style for at-a-glance meta beyond chips
  const summaryRow = document.createElement('div');
  summaryRow.className = 'profile-achievement-summary-row';
  summaryRow.append(
    createMetaChip('Rare', String(rareUnlockedCount), rareUnlockedCount > 0 ? 'accent' : 'default'),
    createMetaChip('Visible', String(visibleGoalCount), 'muted'),
    createMetaChip('Surprise', String(hiddenGoalCount), 'muted'),
  );
  section.appendChild(summaryRow);

  const featuredStrip = buildFeaturedBadgeStrip(unlocked);
  if (featuredStrip) section.appendChild(featuredStrip);

  const categoryGrid = document.createElement('div');
  categoryGrid.className = 'profile-achievement-category-grid';

  ACHIEVEMENT_CATEGORY_ORDER.forEach((category: AchievementCategory) => {
    const categoryAchievements = getAchievementsByCategory(category);
    const unlockedCount = categoryAchievements.filter(achievement => unlocked.includes(achievement.id)).length;

    // Collapsible <details> wrapper for each category
    const categoryDetails = document.createElement('details');
    categoryDetails.className = 'profile-achievement-category-details';
    categoryDetails.style.setProperty('--category-accent', ACHIEVEMENT_CATEGORY_COLORS[category]);
    const defaultOpen = unlockedCount > 0;
    categoryDetails.dataset.defaultOpen = defaultOpen ? '1' : '0';

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
    categoryStatus.append(categoryProgress, categoryCount);

    categoryHeader.appendChild(categoryTitle);
    categorySummary.append(categoryHeader, categoryStatus);
    categoryDetails.appendChild(categorySummary);
    categoryDetails.open = defaultOpen;

    const grid = document.createElement('div');
    grid.className = 'profile-popover-achievement-grid profile-achievement-category-rail';

    categoryAchievements.forEach((achievement) => {
      const isUnlocked = unlocked.includes(achievement.id);
      const isHiddenLocked = achievement.hidden && !isUnlocked;
      const isRare = isAchievementRare(achievement);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.dataset.state = isUnlocked ? 'unlocked' : 'locked';
      cell.dataset.tier = achievement.tier;
      cell.dataset.rare = isRare ? '1' : '0';
      cell.dataset.hiddenAchievement = achievement.hidden ? '1' : '0';
      cell.className = `profile-achievement-cell profile-achievement-cell-${achievement.tier}${isUnlocked ? ' profile-achievement-unlocked' : ' profile-achievement-locked'}${achievement.hidden ? ' profile-achievement-hidden' : ''}${!isUnlocked && !achievement.hidden ? ' profile-achievement-visible-locked' : ''}`;
      cell.title = isUnlocked
        ? `${achievement.name} — ${achievement.description} (+${achievement.xp} XP)`
        : isHiddenLocked
          ? 'Hidden achievement — keep exploring the Zone.'
          : `${achievement.name} — ${achievement.description}`;

      cell.setAttribute('aria-label', isUnlocked || !achievement.hidden ? achievement.name : 'Surprise achievement');
      bindMouseSpotlight(cell);

      const identity = document.createElement('span');
      identity.className = 'profile-achievement-badge';

      const badgeIcon = isUnlocked
        ? createAchievementIcon(achievement.id, 'profile-achievement-emoji')
        : createIcon(isHiddenLocked ? 'help' : 'shield');
      badgeIcon.classList.add('profile-achievement-emoji');
      badgeIcon.setAttribute('aria-hidden', 'true');
      identity.appendChild(badgeIcon);

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

function buildAchievementProgressRing(ratio: number, unlocked: number, total: number): HTMLElement {
  const svgNs = 'http://www.w3.org/2000/svg';
  const wrap = document.createElement('div');
  wrap.className = 'profile-achievements-ring';

  const size = 72;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, ratio));
  const dashOffset = circumference * (1 - clamped);

  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('profile-achievements-ring-svg');

  const track = document.createElementNS(svgNs, 'circle');
  track.setAttribute('cx', String(size / 2));
  track.setAttribute('cy', String(size / 2));
  track.setAttribute('r', String(radius));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke-width', String(stroke));
  track.classList.add('profile-achievements-ring-track');

  const fill = document.createElementNS(svgNs, 'circle');
  fill.setAttribute('cx', String(size / 2));
  fill.setAttribute('cy', String(size / 2));
  fill.setAttribute('r', String(radius));
  fill.setAttribute('fill', 'none');
  fill.setAttribute('stroke-width', String(stroke));
  fill.setAttribute('stroke-linecap', 'round');
  fill.setAttribute('stroke-dasharray', String(circumference));
  fill.setAttribute('stroke-dashoffset', String(dashOffset));
  fill.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  fill.classList.add('profile-achievements-ring-fill');

  svg.append(track, fill);
  wrap.appendChild(svg);

  const center = document.createElement('div');
  center.className = 'profile-achievements-ring-center';

  const pct = document.createElement('span');
  pct.className = 'profile-achievements-ring-percent';
  pct.textContent = `${Math.round(clamped * 100)}%`;

  const sub = document.createElement('span');
  sub.className = 'profile-achievements-ring-sub';
  sub.textContent = `${unlocked}/${total}`;

  center.append(pct, sub);
  wrap.appendChild(center);

  return wrap;
}

function buildTierSummaryStrip(unlocked: string[]): HTMLElement {
  const strip = document.createElement('div');
  strip.className = 'profile-achievements-tier-strip';

  const tiers: Array<{ id: 'bronze' | 'silver' | 'gold'; label: string }> = [
    { id: 'bronze', label: 'Bronze' },
    { id: 'silver', label: 'Silver' },
    { id: 'gold', label: 'Gold' },
  ];

  for (const tier of tiers) {
    const tierAchievements = ACHIEVEMENTS.filter(a => a.tier === tier.id);
    const tierUnlocked = tierAchievements.filter(a => unlocked.includes(a.id)).length;
    const pill = document.createElement('div');
    pill.className = `profile-achievements-tier-pill profile-achievements-tier-pill-${tier.id}`;

    const dot = document.createElement('span');
    dot.className = 'profile-achievements-tier-dot';

    const text = document.createElement('span');
    text.className = 'profile-achievements-tier-text';
    text.textContent = `${tier.label} ${tierUnlocked}/${tierAchievements.length}`;

    pill.append(dot, text);
    strip.appendChild(pill);
  }

  return strip;
}

function applyAchievementFilter(section: HTMLElement, filter: AchievementFilter): void {
  const cells = section.querySelectorAll<HTMLElement>('.profile-achievement-cell');
  const categoryDetails = section.querySelectorAll<HTMLDetailsElement>('.profile-achievement-category-details');

  cells.forEach((cell) => {
    const state = cell.dataset.state;
    const rare = cell.dataset.rare === '1';
    const isHidden = cell.dataset.hiddenAchievement === '1';

    let visible = true;
    switch (filter) {
      case 'all': visible = true; break;
      case 'unlocked': visible = state === 'unlocked'; break;
      case 'locked': visible = state === 'locked'; break;
      case 'rare': visible = rare; break;
      case 'hidden': visible = isHidden; break;
    }
    cell.classList.toggle('is-filtered-out', !visible);
  });

  // Auto-open categories that have any visible cells and collapse those that don't
  categoryDetails.forEach((det) => {
    const anyVisible = det.querySelector('.profile-achievement-cell:not(.is-filtered-out)') !== null;
    det.classList.toggle('is-empty', !anyVisible);
    det.open = filter === 'all'
      ? det.dataset.defaultOpen === '1'
      : anyVisible;
  });
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


function bindMouseSpotlight(cell: HTMLElement): void {
  cell.classList.add('mouse-glow-card');
  cell.addEventListener('pointermove', (event: PointerEvent) => {
    const rect = cell.getBoundingClientRect();
    cell.style.setProperty('--spotlight-x', `${event.clientX - rect.left}px`);
    cell.style.setProperty('--spotlight-y', `${event.clientY - rect.top}px`);
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

  const metaLeft = document.createElement('div');
  metaLeft.className = 'profile-mission-meta-left';
  metaLeft.appendChild(slot);

  const title = document.createElement('div');
  title.className = 'profile-mission-title';
  title.textContent = mission.name;

  const reward = document.createElement('span');
  reward.className = 'profile-mission-reward';
  reward.textContent = mission.completed ? 'Complete' : (mission.rewardLabel ?? `+${mission.xp} XP`);

  const infoRow = document.createElement('div');
  infoRow.className = 'profile-mission-info-row';
  const description = document.createElement('div');
  description.className = 'profile-mission-desc';
  description.textContent = mission.description;

  const progressMeta = document.createElement('div');
  progressMeta.className = 'profile-mission-progress-meta';
  progressMeta.textContent = `${mission.progress}/${mission.goal} · ${mission.category}`;

  topRow.append(metaLeft, title, reward);
  infoRow.append(description, progressMeta);

  card.append(topRow, infoRow);

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

function buildStreakChallengeSection(profile: UserProfile = cachedProfile!, options: { compact?: boolean } = {}): HTMLElement {
  const section = document.createElement('section');
  section.className = 'profile-popover-streak-challenge profile-surface-section';
  section.classList.add('profile-dashboard-card', 'profile-dashboard-streak-challenge');
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
  headingTitle.textContent = options.compact
    ? (isSelfProfile ? 'Next objective' : 'Mission snapshot')
    : (isSelfProfile ? 'Mission board' : 'Mission snapshot');
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
  missionTitle.textContent = options.compact
    ? (isSelfProfile ? 'Priority objective' : 'Visible objective')
    : (isSelfProfile ? 'Priority objectives' : 'Visible objectives');
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
  const visibleMissions = options.compact
    ? [...missions].sort((a, b) => Number(a.completed) - Number(b.completed)).slice(0, 1)
    : missions;
  visibleMissions.forEach(mission => missionList.appendChild(buildMissionCard(mission, isSelfProfile)));

  missionPanel.append(missionHeader, missionList);

  section.append(sectionHeading, missionPanel);
  return section;
}

function buildLeaderboardSection(profile: UserProfile): HTMLElement {
  const leaderboardSection = document.createElement('section');
  leaderboardSection.className = 'profile-popover-leaderboard profile-surface-section';
  leaderboardSection.classList.add('profile-dashboard-card', 'profile-dashboard-leaderboard-snapshot');

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
    lbMeta.textContent = rank >= 0
      ? (rank < 10 ? `You are #${rank + 1}` : `You are #${rank + 1} · top 10 shown`)
      : 'Top 10 snapshot';
    renderLeaderboardList(lbList, entries.slice(0, 10));
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

type SelfProfileTabId = 'overview' | 'badges' | 'missions' | 'activity';

type SelfProfileTab = {
  id: SelfProfileTabId;
  label: string;
  build: (profile: UserProfile) => HTMLElement;
  /** Overview is the default "fits without scrolling" tab; others may scroll. */
  allowScroll: boolean;
};

function buildOverviewTab(profile: UserProfile): HTMLElement {
  const pane = document.createElement('div');
  pane.className = 'profile-popover-pane profile-popover-pane-overview';

  const heroRow = document.createElement('div');
  heroRow.className = 'profile-popover-hero-row profile-popover-hero-row-v2';
  heroRow.append(buildProfileHeader(profile));

  // Compact "next goal" + mission snapshot + stats — no leaderboard, no
  // full catalog. The full badge wall lives on the Badges tab.
  const sideRow = document.createElement('div');
  sideRow.className = 'profile-popover-side-grid';
  sideRow.append(buildStatsSection(profile), buildStreakChallengeSection(profile, { compact: true }));

  pane.append(heroRow, sideRow);
  return pane;
}

function buildBadgesTab(profile: UserProfile): HTMLElement {
  const pane = document.createElement('div');
  pane.className = 'profile-popover-pane profile-popover-pane-badges profile-popover-pane-scroll';
  pane.appendChild(buildAchievementsSection(profile));
  return pane;
}

function buildMissionsTab(profile: UserProfile): HTMLElement {
  const pane = document.createElement('div');
  pane.className = 'profile-popover-pane profile-popover-pane-missions profile-popover-pane-scroll';
  pane.appendChild(buildStreakChallengeSection(profile));
  return pane;
}

function buildActivityTab(profile: UserProfile): HTMLElement {
  const pane = document.createElement('div');
  pane.className = 'profile-popover-pane profile-popover-pane-activity profile-popover-pane-scroll';
  pane.append(buildXpBreakdownSection(), buildStatsSection(profile));
  return pane;
}

const SELF_PROFILE_TABS: SelfProfileTab[] = [
  { id: 'overview', label: 'Overview', build: buildOverviewTab, allowScroll: false },
  { id: 'badges', label: 'Badges', build: buildBadgesTab, allowScroll: true },
  { id: 'missions', label: 'Missions', build: buildMissionsTab, allowScroll: true },
  { id: 'activity', label: 'Activity', build: buildActivityTab, allowScroll: true },
];

let lastActiveSelfTab: SelfProfileTabId = 'overview';

function buildSelfProfileContent(profile: UserProfile): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'profile-popover-shell profile-popover-shell-v2 profile-popover-shell-tabbed';

  const tabBar = document.createElement('div');
  tabBar.className = 'profile-popover-tabbar';
  tabBar.setAttribute('role', 'tablist');

  const body = document.createElement('div');
  body.className = 'profile-popover-body profile-popover-body-v2';

  const pills: HTMLButtonElement[] = [];
  const activate = (index: number) => {
    const tab = SELF_PROFILE_TABS[index];
    lastActiveSelfTab = tab.id;
    for (let i = 0; i < pills.length; i++) {
      const isActive = i === index;
      pills[i].classList.toggle('is-active', isActive);
      pills[i].setAttribute('aria-selected', String(isActive));
      pills[i].tabIndex = isActive ? 0 : -1;
    }
    body.textContent = '';
    body.dataset.tab = tab.id;
    body.classList.toggle('allow-scroll', tab.allowScroll);
    body.appendChild(tab.build(profile));
  };

  SELF_PROFILE_TABS.forEach((tab, index) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'profile-popover-tab-pill';
    pill.setAttribute('role', 'tab');
    pill.dataset.tab = tab.id;
    pill.textContent = tab.label;
    pill.addEventListener('click', () => activate(index));
    pill.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        activate((index + 1) % SELF_PROFILE_TABS.length);
        pills[(index + 1) % SELF_PROFILE_TABS.length].focus();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const prev = (index - 1 + SELF_PROFILE_TABS.length) % SELF_PROFILE_TABS.length;
        activate(prev);
        pills[prev].focus();
      }
    });
    pills.push(pill);
    tabBar.appendChild(pill);
  });

  shell.append(tabBar, body);

  const initial = Math.max(0, SELF_PROFILE_TABS.findIndex(tab => tab.id === lastActiveSelfTab));
  activate(initial);
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
    const resolvedTitle = getLevelTitle(entry.level) || entry.title;
    xp.textContent = `Lv.${entry.level} · ${resolvedTitle} · ${entry.xp} XP`;

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

    subtitle.textContent = `${profile.username} · ${resolveProfileTitle(profile)}`;
    body.appendChild(renderPublicProfileView({ data: publicProfile, leaderboardRank }));
  } catch {
    if (activePublicProfilePublisherId !== publisherId || publicProfileOverlay !== overlay) {
      return;
    }
    subtitle.textContent = 'Profile unavailable';
    body.textContent = 'The Zone went quiet before this profile could be fetched.';
  }
}

export async function openPublicProfile(publisherId: string, trigger: HTMLButtonElement, leaderboardRank?: number): Promise<void> {
  await openPublicProfileOverlay(publisherId, trigger, leaderboardRank);
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
