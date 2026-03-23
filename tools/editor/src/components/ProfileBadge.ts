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

function buildProfileHeader(profile: UserProfile): HTMLElement {
  const header = document.createElement('div');
  header.className = 'profile-popover-header';

  const tierColor = getLevelTierColor(profile.level);
  const unlocked = getUnlockedAchievementIdsForProfile(profile);
  const rareUnlocked = getRareAchievementCount(unlocked);
  const publishStreak = profile.streaks?.publish_streak ?? (profile.publisher_id === cachedProfile?.publisher_id ? getStreakData().currentStreak : 0);

  const avatarCircle = document.createElement('div');
  avatarCircle.className = 'profile-popover-avatar-circle';
  avatarCircle.style.setProperty('--tier-color', tierColor);

  const avatarInitial = document.createElement('span');
  avatarInitial.className = 'profile-popover-avatar-initial';
  avatarInitial.textContent = getUserInitial(profile.username);

  const avatarLevelBadge = document.createElement('span');
  avatarLevelBadge.className = 'profile-popover-avatar-badge';
  avatarLevelBadge.textContent = String(profile.level);
  avatarLevelBadge.style.background = tierColor;

  avatarCircle.append(avatarInitial, avatarLevelBadge);

  const identity = document.createElement('div');
  identity.className = 'profile-popover-identity';

  const info = document.createElement('div');
  info.className = 'profile-popover-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'profile-popover-name';
  nameEl.textContent = profile.username;

  const titleEl = document.createElement('div');
  titleEl.className = 'profile-popover-title';
  titleEl.textContent = profile.title;

  const metaRow = document.createElement('div');
  metaRow.className = 'profile-popover-meta-row';

  const levelPill = document.createElement('span');
  levelPill.className = 'profile-popover-meta-pill';
  levelPill.textContent = `Lv.${profile.level}`;

  const memberPill = document.createElement('span');
  memberPill.className = 'profile-popover-meta-pill profile-popover-meta-pill-muted';
  memberPill.textContent = `Joined ${formatMemberSince(profile.created_at)}`;

  metaRow.append(levelPill, memberPill);
  info.append(nameEl, titleEl, metaRow);
  identity.append(avatarCircle, info);

  const highlights = document.createElement('div');
  highlights.className = 'profile-popover-highlights';

  const highlightDefs: Array<{
    icon: IconName;
    label: string;
    value: string;
    tone?: 'accent' | 'rare';
  }> = [
    { icon: 'star', label: 'XP', value: profile.xp.toLocaleString(), tone: 'accent' },
    { icon: 'medal', label: 'Badges', value: `${unlocked.length}/${ACHIEVEMENTS.length}` },
    { icon: 'sparkle', label: 'Rare', value: `${rareUnlocked}`, tone: rareUnlocked > 0 ? 'rare' : undefined },
    { icon: 'flame', label: 'Streak', value: `${publishStreak}w` },
  ];

  highlightDefs.forEach((item) => {
    const card = document.createElement('div');
    card.className = `profile-popover-highlight${item.tone ? ` profile-popover-highlight-${item.tone}` : ''}`;

    const icon = createIcon(item.icon);
    icon.classList.add('profile-popover-highlight-icon');

    const content = document.createElement('span');
    content.className = 'profile-popover-highlight-content';

    const value = document.createElement('span');
    value.className = 'profile-popover-highlight-value';
    value.textContent = item.value;

    const label = document.createElement('span');
    label.className = 'profile-popover-highlight-label';
    label.textContent = item.label;

    content.append(value, label);
    card.append(icon, content);
    highlights.appendChild(card);
  });

  header.append(identity, highlights);
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

  const barHeader = document.createElement('div');
  barHeader.className = 'profile-popover-bar-header';

  const levelLabel = document.createElement('span');
  levelLabel.className = 'profile-popover-level-label';
  levelLabel.textContent = `Level ${profile.level}`;

  const xpNumbers = document.createElement('span');
  xpNumbers.className = 'profile-popover-bar-label';
  if (next) {
    xpNumbers.textContent = `${profile.xp} / ${next.xp} XP`;
  } else {
    xpNumbers.textContent = `${profile.xp} XP — MAX LEVEL`;
  }

  barHeader.append(levelLabel, xpNumbers);

  const barTrack = document.createElement('div');
  barTrack.className = 'profile-popover-bar-track';
  const barFill = document.createElement('div');
  barFill.className = 'profile-popover-bar-fill';
  barFill.style.width = `${Math.round(progress * 100)}%`;
  barTrack.appendChild(barFill);

  progressSection.append(barHeader, barTrack);

  if (next) {
    const nextLabel = document.createElement('div');
    nextLabel.className = 'profile-popover-next';
    nextLabel.textContent = `Next: Lv.${next.level} ${next.title}`;
    progressSection.appendChild(nextLabel);
  }

  return progressSection;
}

function buildStatCard(iconName: Parameters<typeof createIcon>[0], value: string, label: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'profile-stat-card';

  const icon = createIcon(iconName);
  icon.classList.add('profile-stat-icon');

  const valEl = document.createElement('div');
  valEl.className = 'profile-stat-value';
  valEl.textContent = value;

  const labelEl = document.createElement('div');
  labelEl.className = 'profile-stat-label';
  labelEl.textContent = label;

  card.append(icon, valEl, labelEl);
  return card;
}

function buildStatsSection(profile: UserProfile): HTMLElement {
  const statsSection = document.createElement('div');
  statsSection.className = 'profile-popover-stats';

  const totalXpStat = buildStatCard('star', `${profile.xp}`, 'Total XP');
  const levelStat = buildStatCard('trophy', `${profile.level}`, 'Level');
  const publishStat = buildStatCard('export', '...', 'Published');
  const memberStat = buildStatCard('clock', formatMemberSince(profile.created_at), 'Member Since');

  statsSection.append(totalXpStat, levelStat, publishStat, memberStat);

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
  const xpBreakdownSection = document.createElement('div');
  xpBreakdownSection.className = 'profile-popover-xp-breakdown';

  const xpBreakdownHeader = document.createElement('div');
  xpBreakdownHeader.className = 'profile-popover-section-header';
  const starIcon = createIcon('star');
  const xpBreakdownTitle = document.createElement('span');
  xpBreakdownTitle.textContent = 'How to Earn XP';
  xpBreakdownHeader.append(starIcon, xpBreakdownTitle);

  const xpRows = document.createElement('div');
  xpRows.className = 'profile-popover-xp-rows';

  const xpItems: [string, number][] = [
    ['Publish (short)', XP_PUBLISH_SHORT],
    ['Publish (medium)', XP_PUBLISH_MEDIUM],
    ['Publish (long)', XP_PUBLISH_LONG],
    ['Download received', XP_DOWNLOAD_RECEIVED],
    ['Upvote received', XP_UPVOTE_RECEIVED],
  ];

  for (const [label, amount] of xpItems) {
    const row = document.createElement('div');
    row.className = 'profile-popover-xp-row';
    const rowLabel = document.createElement('span');
    rowLabel.className = 'profile-popover-xp-row-label';
    rowLabel.textContent = label;
    const rowValue = document.createElement('span');
    rowValue.className = 'profile-popover-xp-row-value';
    rowValue.textContent = `+${amount} XP`;
    row.append(rowLabel, rowValue);
    xpRows.appendChild(row);
  }

  xpBreakdownSection.append(xpBreakdownHeader, xpRows);
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
  strip.className = 'profile-achievement-featured-strip';

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
    badge.className = `profile-achievement-featured-badge profile-achievement-featured-badge-${achievement.tier}`;
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
  section.className = 'profile-popover-achievements';

  const header = document.createElement('div');
  header.className = 'profile-popover-section-header';
  const medalIcon = createIcon('medal');
  const title = document.createElement('span');
  const unlocked = getUnlockedAchievementIdsForProfile(profile);
  title.textContent = `Achievements (${unlocked.length}/${ACHIEVEMENTS.length})`;
  header.append(medalIcon, title);
  section.appendChild(header);

  const summaryLine = document.createElement('div');
  summaryLine.className = 'profile-achievement-summary-line';
  const visibleGoalCount = getVisibleAchievementCatalog().length;
  const hiddenGoalCount = ACHIEVEMENTS.filter(achievement => achievement.hidden).length;
  const rareUnlockedCount = getRareAchievementCount(unlocked);
  summaryLine.textContent = `${unlocked.length} earned • ${rareUnlockedCount} rare • ${visibleGoalCount} visible goals • ${hiddenGoalCount} surprise badge${hiddenGoalCount === 1 ? '' : 's'}`;
  section.appendChild(summaryLine);

  const featuredStrip = buildFeaturedBadgeStrip(unlocked);
  if (featuredStrip) section.appendChild(featuredStrip);

  const nextTargets = getNextAchievementTargets(profile, unlocked);
  if (nextTargets.length > 0) {
    const nextSection = document.createElement('details');
    nextSection.className = 'profile-achievement-next';

    const nextHeader = document.createElement('summary');
    nextHeader.className = 'profile-achievement-next-summary';

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
      card.className = `profile-achievement-next-card profile-achievement-next-card-${achievement.tier}`;
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

  ACHIEVEMENT_CATEGORY_ORDER.forEach((category: AchievementCategory) => {
    const categoryAchievements = getAchievementsByCategory(category);
    const unlockedCount = categoryAchievements.filter(achievement => unlocked.includes(achievement.id)).length;
    const categorySection = document.createElement('div');
    categorySection.className = 'profile-achievement-category';

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

    const categoryCount = document.createElement('div');
    categoryCount.className = 'profile-achievement-category-count';
    categoryCount.textContent = `${unlockedCount}/${categoryAchievements.length}`;

    categoryHeader.append(categoryTitle, categoryCount);

    const grid = document.createElement('div');
    grid.className = 'profile-popover-achievement-grid';

    categoryAchievements.forEach((achievement) => {
      const isUnlocked = unlocked.includes(achievement.id);
      const isHiddenLocked = achievement.hidden && !isUnlocked;
      const cell = document.createElement('div');
      cell.className = `profile-achievement-cell${isUnlocked ? '' : ' profile-achievement-locked'}${achievement.hidden ? ' profile-achievement-hidden' : ''}`;
      cell.title = isUnlocked
        ? `${achievement.name} — ${achievement.description} (+${achievement.xp} XP)`
        : isHiddenLocked
          ? 'Hidden achievement — keep exploring the Zone.'
          : `${achievement.name} — ${achievement.description}`;

      const iconPanel = document.createElement('span');
      iconPanel.className = 'profile-achievement-icon-panel';

      const emoji = document.createElement('span');
      emoji.className = 'profile-achievement-emoji';
      emoji.textContent = isUnlocked ? achievement.icon : (isHiddenLocked ? '\u{2753}' : '\u{1F512}');
      emoji.setAttribute('aria-hidden', 'true');
      iconPanel.appendChild(emoji);

      cell.setAttribute('aria-label', isUnlocked || !achievement.hidden ? achievement.name : 'Surprise achievement');

      const tierDot = document.createElement('span');
      tierDot.className = `profile-achievement-tier profile-achievement-tier-${achievement.tier}`;

      const shortLabel = document.createElement('span');
      shortLabel.className = 'profile-achievement-cell-label';
      shortLabel.textContent = isUnlocked || !achievement.hidden ? achievement.name : 'Surprise';

      cell.append(iconPanel, tierDot, shortLabel);
      grid.appendChild(cell);
    });

    categorySection.append(categoryHeader, grid);
    section.appendChild(categorySection);
  });

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
  card.className = `profile-mission-card${mission.completed ? ' profile-mission-card-complete' : ''}${isSelfProfile ? '' : ' profile-mission-card-public'}`;

  const header = document.createElement('div');
  header.className = 'profile-mission-card-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'profile-mission-title-wrap';

  const slot = document.createElement('span');
  slot.className = `profile-mission-slot profile-mission-slot-${mission.slot}`;
  slot.textContent = mission.slot === 'weekly'
    ? 'Weekly'
    : mission.slot === 'daily_easy'
      ? 'Daily · Easy'
      : mission.slot === 'daily_medium'
        ? 'Daily · Medium'
        : 'Daily · Hard';

  const title = document.createElement('div');
  title.className = 'profile-mission-title';
  title.textContent = mission.name;

  titleWrap.append(slot, title);

  const reward = document.createElement('span');
  reward.className = 'profile-mission-reward';
  reward.textContent = mission.completed ? 'Complete' : (mission.rewardLabel ?? `+${mission.xp} XP`);

  header.append(titleWrap, reward);

  const desc = document.createElement('div');
  desc.className = 'profile-mission-desc';
  desc.textContent = mission.description;

  const progressMeta = document.createElement('div');
  progressMeta.className = 'profile-mission-progress-meta';
  progressMeta.textContent = `${mission.progress} / ${mission.goal} · ${mission.category}`;

  const bar = document.createElement('div');
  bar.className = 'profile-mission-progress-bar';
  const fill = document.createElement('div');
  fill.className = 'profile-mission-progress-fill';
  fill.style.width = `${Math.round(mission.progressRatio * 100)}%`;
  bar.appendChild(fill);

  card.append(header, desc, progressMeta, bar);
  return card;
}

function buildStreakChallengeSection(profile: UserProfile = cachedProfile!): HTMLElement {
  const section = document.createElement('div');
  section.className = 'profile-popover-streak-challenge';
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

  const streakRow = document.createElement('div');
  streakRow.className = 'profile-popover-streak-row';

  const flameIcon = createIcon('flame');
  flameIcon.classList.add('profile-streak-icon');

  const streakLabel = document.createElement('span');
  streakLabel.className = 'profile-streak-label';
  streakLabel.textContent = 'Publish Streak';

  const streakValue = document.createElement('span');
  streakValue.className = 'profile-streak-value';
  streakValue.textContent = `${streak.currentStreak} week${streak.currentStreak !== 1 ? 's' : ''}`;

  const shieldBadge = document.createElement('span');
  shieldBadge.className = `profile-streak-shield${streak.shieldAvailable ? ' profile-streak-shield-active' : ''}`;
  shieldBadge.title = streak.shieldAvailable
    ? 'Streak Shield available — miss one week without losing your streak'
    : isSelfProfile
      ? 'Streak Shield used this month'
      : 'Streak Shield unavailable for public profiles';
  const shieldIcon = createIcon('shield');
  shieldBadge.appendChild(shieldIcon);

  streakRow.append(flameIcon, streakLabel, streakValue, shieldBadge);

  const loginRow = document.createElement('div');
  loginRow.className = 'profile-popover-streak-row';

  const clockIcon = createIcon('clock');
  clockIcon.classList.add('profile-streak-icon');

  const loginLabel = document.createElement('span');
  loginLabel.className = 'profile-streak-label';
  loginLabel.textContent = 'Daily Login';

  const loginValue = document.createElement('span');
  loginValue.className = 'profile-streak-value';
  loginValue.textContent = `${loginStreak.currentStreak} day${loginStreak.currentStreak !== 1 ? 's' : ''}`;

  loginRow.append(clockIcon, loginLabel, loginValue);

  const missionPanel = document.createElement('div');
  missionPanel.className = 'profile-mission-panel';

  const missionHeader = document.createElement('div');
  missionHeader.className = 'profile-mission-panel-header';
  const targetIcon = createIcon('target');
  targetIcon.classList.add('profile-challenge-icon');
  const headerText = document.createElement('div');
  headerText.className = 'profile-mission-panel-copy';
  const missionTitle = document.createElement('div');
  missionTitle.className = 'profile-challenge-header';
  missionTitle.textContent = isSelfProfile ? 'Mission Board' : 'Mission Snapshot';
  const missionSub = document.createElement('div');
  missionSub.className = 'profile-challenge-desc';
  missionSub.textContent = isSelfProfile
    ? 'Daily easy / medium / hard plus one weekly mission.'
    : 'Latest visible mission progress captured for this stalker.';
  headerText.append(missionTitle, missionSub);
  missionHeader.append(targetIcon, headerText);

  const missionList = document.createElement('div');
  missionList.className = 'profile-mission-list';
  const missions = getProfileMissions(profile, isSelfProfile);
  missions.forEach(mission => missionList.appendChild(buildMissionCard(mission, isSelfProfile)));

  const cadence = document.createElement('div');
  cadence.className = 'profile-mission-reset';
  const resetInfo = getMissionResetInfo();
  cadence.textContent = `${resetInfo.dailyLabel} · ${resetInfo.weeklyLabel}`;

  missionPanel.append(missionHeader, missionList, cadence);

  section.append(streakRow, loginRow, missionPanel);
  return section;
}

function buildLeaderboardSection(): HTMLElement {
  const leaderboardSection = document.createElement('div');
  leaderboardSection.className = 'profile-popover-leaderboard';

  const lbHeader = document.createElement('div');
  lbHeader.className = 'profile-popover-lb-header';
  const trophyIcon = createIcon('trophy');
  const lbTitle = document.createElement('span');
  lbTitle.textContent = 'Top Stalkers';
  lbHeader.append(trophyIcon, lbTitle);

  const lbList = document.createElement('div');
  lbList.className = 'profile-popover-lb-list';
  lbList.textContent = 'Loading…';

  leaderboardSection.append(lbHeader, lbList);

  if (leaderboardCache) {
    renderLeaderboardList(lbList, leaderboardCache);
  } else {
    void fetchLeaderboard(5).then((entries) => {
      leaderboardCache = entries;
      renderLeaderboardList(lbList, entries);
    });
  }

  return leaderboardSection;
}

function buildSelfProfileContent(profile: UserProfile): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'profile-popover-shell';

  const hero = document.createElement('section');
  hero.className = 'profile-popover-hero';
  hero.append(buildProfileHeader(profile), buildProgressSection(profile));

  const body = document.createElement('div');
  body.className = 'profile-popover-body';

  const main = document.createElement('div');
  main.className = 'profile-popover-main';
  main.append(buildAchievementsSection(profile), buildStreakChallengeSection(profile));

  const side = document.createElement('aside');
  side.className = 'profile-popover-side';
  side.append(buildStatsSection(profile), buildXpBreakdownSection(), buildLeaderboardSection());

  body.append(main, side);
  shell.append(hero, body);
  return shell;
}

function openPopover(anchor: HTMLElement): void {
  closePopover();
  if (!cachedProfile) return;

  const popover = document.createElement('div');
  popover.className = 'profile-popover';
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
    row.className = 'profile-popover-lb-row';
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
