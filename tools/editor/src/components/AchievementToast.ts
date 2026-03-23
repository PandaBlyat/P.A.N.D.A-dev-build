// P.A.N.D.A. Conversation Editor — Achievement Toast Notification
// Celebrates achievement unlocks with a distinct visual style from XP toasts.

import type { Achievement } from '../lib/gamification';
import { createIcon } from './icons';

const TOAST_DURATION_MS = 5000;
const TOAST_FADE_MS = 500;
const TOAST_STAGGER_MS = 800;
const TOAST_CONTAINER_ID = 'achievement-toast-container';

let containerEl: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (containerEl && document.body.contains(containerEl)) return containerEl;
  containerEl = document.createElement('div');
  containerEl.id = TOAST_CONTAINER_ID;
  containerEl.className = 'achievement-toast-container';
  document.body.appendChild(containerEl);
  return containerEl;
}

function tierColor(tier: Achievement['tier']): string {
  switch (tier) {
    case 'gold': return '#c4a040';
    case 'silver': return '#a0a8b8';
    default: return '#b87333';
  }
}

export function showAchievementToast(achievement: Achievement): void {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `achievement-toast achievement-toast-${achievement.tier}`;
  toast.style.setProperty('--achievement-color', tierColor(achievement.tier));

  const iconWrap = document.createElement('span');
  iconWrap.className = 'achievement-toast-emoji';
  iconWrap.textContent = achievement.icon;

  const body = document.createElement('div');
  body.className = 'achievement-toast-body';

  const header = document.createElement('div');
  header.className = 'achievement-toast-header';

  const medalIcon = createIcon('medal');
  medalIcon.classList.add('achievement-toast-medal');

  const label = document.createElement('span');
  label.className = 'achievement-toast-label';
  label.textContent = 'Achievement Unlocked';

  header.append(medalIcon, label);

  const name = document.createElement('div');
  name.className = 'achievement-toast-name';
  name.textContent = achievement.name;

  const desc = document.createElement('div');
  desc.className = 'achievement-toast-desc';
  desc.textContent = achievement.description;

  const xp = document.createElement('span');
  xp.className = 'achievement-toast-xp';
  xp.textContent = `+${achievement.xp} XP`;

  body.append(header, name, desc, xp);
  toast.append(iconWrap, body);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('achievement-toast-visible'));

  setTimeout(() => {
    toast.classList.remove('achievement-toast-visible');
    toast.classList.add('achievement-toast-exit');
    setTimeout(() => toast.remove(), TOAST_FADE_MS);
  }, TOAST_DURATION_MS);
}

/**
 * Show multiple achievement toasts with staggered timing so they don't
 * all appear at once (prevents visual overload and feels more rewarding).
 */
export function showAchievementToasts(achievements: Achievement[]): void {
  achievements.forEach((achievement, i) => {
    setTimeout(() => showAchievementToast(achievement), i * TOAST_STAGGER_MS);
  });
}

/** Show a generic gamification toast (streak, challenge, etc.) */
export function showGamificationToast(
  emoji: string,
  title: string,
  description: string,
  xpAmount?: number,
): void {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = 'achievement-toast achievement-toast-info';

  const iconWrap = document.createElement('span');
  iconWrap.className = 'achievement-toast-emoji';
  iconWrap.textContent = emoji;

  const body = document.createElement('div');
  body.className = 'achievement-toast-body';

  const name = document.createElement('div');
  name.className = 'achievement-toast-name';
  name.textContent = title;

  const desc = document.createElement('div');
  desc.className = 'achievement-toast-desc';
  desc.textContent = description;

  body.append(name, desc);

  if (xpAmount && xpAmount > 0) {
    const xp = document.createElement('span');
    xp.className = 'achievement-toast-xp';
    xp.textContent = `+${xpAmount} XP`;
    body.appendChild(xp);
  }

  toast.append(iconWrap, body);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('achievement-toast-visible'));

  setTimeout(() => {
    toast.classList.remove('achievement-toast-visible');
    toast.classList.add('achievement-toast-exit');
    setTimeout(() => toast.remove(), TOAST_FADE_MS);
  }, TOAST_DURATION_MS);
}
