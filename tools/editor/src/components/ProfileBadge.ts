// P.A.N.D.A. Conversation Editor — Profile Badge (Toolbar Widget)
// Shows the user's level, title, and XP progress in a compact toolbar element.

import {
  type UserProfile,
  type LeaderboardEntry,
  LEVEL_THRESHOLDS,
  getNextLevelThreshold,
  fetchLeaderboard,
  fetchUserPublishCount,
  XP_PUBLISH_SHORT,
  XP_PUBLISH_MEDIUM,
  XP_PUBLISH_LONG,
  XP_DOWNLOAD_RECEIVED,
  XP_UPVOTE_RECEIVED,
} from '../lib/api-client';
import {
  ACHIEVEMENTS,
  getUnlockedAchievements,
  getStreakData,
  getLoginStreak,
  getTodayChallenge,
  isDailyChallengeCompleted,
  type Achievement,
} from '../lib/gamification';
import { createIcon } from './icons';

let cachedProfile: UserProfile | null = null;
let popoverOpen = false;
let leaderboardCache: LeaderboardEntry[] | null = null;
let publishCountCache: number | null = null;

function getLevelTierColor(level: number): string {
  if (level >= 91) return '#c4a040'; // gold — Monolith / Tier IV apex
  if (level >= 71) return '#8a5eaa'; // purple — Duty & Freedom / Tier III
  if (level >= 51) return '#3aaa8a'; // teal — Clear Sky & Ecologists / Tier II
  return '#5eaa3a';                  // green — early Zone factions / Tier I
}

function getUserInitial(username: string): string {
  return username.trim().charAt(0).toUpperCase() || '?';
}

export function setProfileForBadge(profile: UserProfile | null): void {
  cachedProfile = profile;
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

function openPopover(anchor: HTMLElement): void {
  closePopover();
  if (!cachedProfile) return;

  const popover = document.createElement('div');
  popover.className = 'profile-popover';

  // ── Header with avatar circle ──────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'profile-popover-header';

  const tierColor = getLevelTierColor(cachedProfile.level);

  const avatarCircle = document.createElement('div');
  avatarCircle.className = 'profile-popover-avatar-circle';
  avatarCircle.style.setProperty('--tier-color', tierColor);

  const avatarInitial = document.createElement('span');
  avatarInitial.className = 'profile-popover-avatar-initial';
  avatarInitial.textContent = getUserInitial(cachedProfile.username);

  const avatarLevelBadge = document.createElement('span');
  avatarLevelBadge.className = 'profile-popover-avatar-badge';
  avatarLevelBadge.textContent = String(cachedProfile.level);
  avatarLevelBadge.style.background = tierColor;

  avatarCircle.append(avatarInitial, avatarLevelBadge);

  const info = document.createElement('div');
  info.className = 'profile-popover-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'profile-popover-name';
  nameEl.textContent = cachedProfile.username;

  const titleEl = document.createElement('div');
  titleEl.className = 'profile-popover-title';
  titleEl.textContent = cachedProfile.title;

  info.append(nameEl, titleEl);
  header.append(avatarCircle, info);

  // ── XP progress bar ────────────────────────────────────────────────
  const progressSection = document.createElement('div');
  progressSection.className = 'profile-popover-progress';

  const next = getNextLevelThreshold(cachedProfile.xp);
  const currentThreshold = LEVEL_THRESHOLDS.find(t => t.level === cachedProfile!.level);
  const currentMin = currentThreshold?.xp ?? 0;
  const nextXp = next?.xp ?? currentMin;
  const range = Math.max(nextXp - currentMin, 1);
  const progress = Math.min((cachedProfile.xp - currentMin) / range, 1);

  const barHeader = document.createElement('div');
  barHeader.className = 'profile-popover-bar-header';

  const levelLabel = document.createElement('span');
  levelLabel.className = 'profile-popover-level-label';
  levelLabel.textContent = `Level ${cachedProfile.level}`;

  const xpNumbers = document.createElement('span');
  xpNumbers.className = 'profile-popover-bar-label';
  if (next) {
    xpNumbers.textContent = `${cachedProfile.xp} / ${next.xp} XP`;
  } else {
    xpNumbers.textContent = `${cachedProfile.xp} XP — MAX LEVEL`;
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

  // ── Stats grid ─────────────────────────────────────────────────────
  const statsSection = document.createElement('div');
  statsSection.className = 'profile-popover-stats';

  const totalXpStat = buildStatCard('star', `${cachedProfile.xp}`, 'Total XP');
  const levelStat = buildStatCard('trophy', `${cachedProfile.level}`, 'Level');

  const publishStat = buildStatCard('export', '...', 'Published');
  const memberStat = buildStatCard('clock', formatMemberSince(cachedProfile.created_at), 'Member Since');

  statsSection.append(totalXpStat, levelStat, publishStat, memberStat);

  // Load publish count async
  if (publishCountCache !== null) {
    const valEl = publishStat.querySelector('.profile-stat-value');
    if (valEl) valEl.textContent = String(publishCountCache);
  } else {
    void fetchUserPublishCount(cachedProfile.publisher_id).then(count => {
      publishCountCache = count;
      const valEl = publishStat.querySelector('.profile-stat-value');
      if (valEl) valEl.textContent = String(count);
    });
  }

  // ── XP breakdown ───────────────────────────────────────────────────
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

  // ── Achievements section ─────────────────────────────────────────
  const achievementsSection = buildAchievementsSection();

  // ── Streak & Challenge section ──────────────────────────────────
  const streakChallengeSection = buildStreakChallengeSection();

  // ── Leaderboard section ────────────────────────────────────────────
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

  // Load leaderboard
  if (leaderboardCache) {
    renderLeaderboardList(lbList, leaderboardCache);
  } else {
    void fetchLeaderboard(5).then((entries) => {
      leaderboardCache = entries;
      renderLeaderboardList(lbList, entries);
    });
  }

  popover.append(header, progressSection, statsSection, achievementsSection, streakChallengeSection, xpBreakdownSection, leaderboardSection);
  anchor.appendChild(popover);
  popoverOpen = true;

  // Close on outside click
  const close = (e: MouseEvent) => {
    if (!anchor.contains(e.target as Node)) {
      closePopover();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
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

function renderLeaderboardList(container: HTMLElement, entries: LeaderboardEntry[]): void {
  container.textContent = '';
  if (entries.length === 0) {
    container.textContent = 'No stalkers ranked yet.';
    return;
  }

  const currentUsername = cachedProfile?.username;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const row = document.createElement('div');
    row.className = 'profile-popover-lb-row';
    if (entry.username === currentUsername) {
      row.classList.add('profile-popover-lb-row-self');
    }

    const rank = document.createElement('span');
    rank.className = 'profile-popover-lb-rank';
    const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}']; // 🥇🥈🥉
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

function buildAchievementsSection(): HTMLElement {
  const section = document.createElement('div');
  section.className = 'profile-popover-achievements';

  const header = document.createElement('div');
  header.className = 'profile-popover-section-header';
  const medalIcon = createIcon('medal');
  const title = document.createElement('span');
  const unlocked = getUnlockedAchievements();
  title.textContent = `Achievements (${unlocked.length}/${ACHIEVEMENTS.length})`;
  header.append(medalIcon, title);

  const grid = document.createElement('div');
  grid.className = 'profile-popover-achievement-grid';

  for (const achievement of ACHIEVEMENTS) {
    const isUnlocked = unlocked.includes(achievement.id);
    const cell = document.createElement('div');
    cell.className = `profile-achievement-cell${isUnlocked ? '' : ' profile-achievement-locked'}`;
    cell.title = isUnlocked
      ? `${achievement.name} — ${achievement.description} (+${achievement.xp} XP)`
      : `??? — ${achievement.description}`;

    const emoji = document.createElement('span');
    emoji.className = 'profile-achievement-emoji';
    emoji.textContent = isUnlocked ? achievement.icon : '\u{1F512}';

    const tierDot = document.createElement('span');
    tierDot.className = `profile-achievement-tier profile-achievement-tier-${achievement.tier}`;

    cell.append(emoji, tierDot);
    grid.appendChild(cell);
  }

  section.append(header, grid);
  return section;
}

function buildStreakChallengeSection(): HTMLElement {
  const section = document.createElement('div');
  section.className = 'profile-popover-streak-challenge';

  // Publish streak
  const streak = getStreakData();
  const loginStreak = getLoginStreak();

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
    : 'Streak Shield used this month';
  const shieldIcon = createIcon('shield');
  shieldBadge.appendChild(shieldIcon);

  streakRow.append(flameIcon, streakLabel, streakValue, shieldBadge);

  // Login streak
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

  // Daily challenge
  const challenge = getTodayChallenge();
  const completed = isDailyChallengeCompleted();

  const challengeRow = document.createElement('div');
  challengeRow.className = `profile-popover-challenge${completed ? ' profile-popover-challenge-done' : ''}`;

  const targetIcon = createIcon('target');
  targetIcon.classList.add('profile-challenge-icon');

  const challengeBody = document.createElement('div');
  challengeBody.className = 'profile-challenge-body';

  const challengeHeader = document.createElement('div');
  challengeHeader.className = 'profile-challenge-header';
  challengeHeader.textContent = completed ? 'Daily Challenge Complete!' : "Today's Challenge";

  const challengeDesc = document.createElement('div');
  challengeDesc.className = 'profile-challenge-desc';
  challengeDesc.textContent = challenge.description;

  const challengeXp = document.createElement('span');
  challengeXp.className = 'profile-challenge-xp';
  challengeXp.textContent = completed ? 'Done' : `+${challenge.xp} XP`;

  challengeBody.append(challengeHeader, challengeDesc);
  challengeRow.append(targetIcon, challengeBody, challengeXp);

  section.append(streakRow, loginRow, challengeRow);
  return section;
}

function closePopover(): void {
  const existing = document.querySelector('.profile-popover');
  if (existing) existing.remove();
  popoverOpen = false;
}

export function invalidateLeaderboardCache(): void {
  leaderboardCache = null;
  publishCountCache = null;
}
