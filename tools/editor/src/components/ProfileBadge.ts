// P.A.N.D.A. Conversation Editor — Profile Badge (Toolbar Widget)
// Shows the user's level, title, and XP progress in a compact toolbar element.

import {
  type UserProfile,
  type LeaderboardEntry,
  LEVEL_THRESHOLDS,
  getNextLevelThreshold,
  fetchLeaderboard,
} from '../lib/api-client';
import { createIcon } from './icons';

let cachedProfile: UserProfile | null = null;
let popoverOpen = false;
let leaderboardCache: LeaderboardEntry[] | null = null;

export function setProfileForBadge(profile: UserProfile | null): void {
  cachedProfile = profile;
}

export function renderProfileBadge(): HTMLElement | null {
  if (!cachedProfile) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'profile-badge';
  wrapper.title = `${cachedProfile.title} — ${cachedProfile.xp} XP`;

  const levelIcon = document.createElement('span');
  levelIcon.className = 'profile-badge-level';
  levelIcon.textContent = String(cachedProfile.level);

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

function openPopover(anchor: HTMLElement): void {
  closePopover();
  if (!cachedProfile) return;

  const popover = document.createElement('div');
  popover.className = 'profile-popover';

  // Header
  const header = document.createElement('div');
  header.className = 'profile-popover-header';

  const userIcon = createIcon('user');
  userIcon.classList.add('profile-popover-avatar');

  const info = document.createElement('div');
  info.className = 'profile-popover-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'profile-popover-name';
  nameEl.textContent = cachedProfile.username;

  const titleEl = document.createElement('div');
  titleEl.className = 'profile-popover-title';
  titleEl.textContent = `Lv.${cachedProfile.level} ${cachedProfile.title}`;

  info.append(nameEl, titleEl);
  header.append(userIcon, info);

  // XP progress bar
  const progressSection = document.createElement('div');
  progressSection.className = 'profile-popover-progress';

  const next = getNextLevelThreshold(cachedProfile.xp);
  const currentThreshold = LEVEL_THRESHOLDS.find(t => t.level === cachedProfile!.level);
  const currentMin = currentThreshold?.xp ?? 0;
  const nextXp = next?.xp ?? currentMin;
  const range = Math.max(nextXp - currentMin, 1);
  const progress = Math.min((cachedProfile.xp - currentMin) / range, 1);

  const barLabel = document.createElement('div');
  barLabel.className = 'profile-popover-bar-label';
  if (next) {
    barLabel.textContent = `${cachedProfile.xp} / ${next.xp} XP`;
  } else {
    barLabel.textContent = `${cachedProfile.xp} XP — MAX LEVEL`;
  }

  const barTrack = document.createElement('div');
  barTrack.className = 'profile-popover-bar-track';
  const barFill = document.createElement('div');
  barFill.className = 'profile-popover-bar-fill';
  barFill.style.width = `${Math.round(progress * 100)}%`;
  barTrack.appendChild(barFill);

  if (next) {
    const nextLabel = document.createElement('div');
    nextLabel.className = 'profile-popover-next';
    nextLabel.textContent = `Next: Lv.${next.level} ${next.title}`;
    progressSection.append(barLabel, barTrack, nextLabel);
  } else {
    progressSection.append(barLabel, barTrack);
  }

  // Leaderboard section
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

  popover.append(header, progressSection, leaderboardSection);
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

function renderLeaderboardList(container: HTMLElement, entries: LeaderboardEntry[]): void {
  container.textContent = '';
  if (entries.length === 0) {
    container.textContent = 'No stalkers ranked yet.';
    return;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const row = document.createElement('div');
    row.className = 'profile-popover-lb-row';

    const rank = document.createElement('span');
    rank.className = 'profile-popover-lb-rank';
    rank.textContent = `#${i + 1}`;

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

function closePopover(): void {
  const existing = document.querySelector('.profile-popover');
  if (existing) existing.remove();
  popoverOpen = false;
}

export function invalidateLeaderboardCache(): void {
  leaderboardCache = null;
}
