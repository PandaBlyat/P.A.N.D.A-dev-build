// P.A.N.D.A. Conversation Editor — XP Toast Notification
// Brief popup showing XP gains after actions like publishing.

import { createIcon } from './icons';

const TOAST_DURATION_MS = 3500;
const TOAST_FADE_MS = 400;
const TOAST_CONTAINER_ID = 'xp-toast-container';

let containerEl: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (containerEl && document.body.contains(containerEl)) return containerEl;

  containerEl = document.createElement('div');
  containerEl.id = TOAST_CONTAINER_ID;
  containerEl.className = 'xp-toast-container';
  document.body.appendChild(containerEl);
  return containerEl;
}

export function showXpToast(amount: number, reason: string): void {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = 'xp-toast';

  const icon = createIcon('star');
  icon.classList.add('xp-toast-icon');

  const text = document.createElement('span');
  text.className = 'xp-toast-text';
  text.textContent = `+${amount} XP`;

  const detail = document.createElement('span');
  detail.className = 'xp-toast-detail';
  detail.textContent = reason;

  toast.append(icon, text, detail);
  container.appendChild(toast);

  // Trigger entrance animation
  requestAnimationFrame(() => toast.classList.add('xp-toast-visible'));

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('xp-toast-visible');
    toast.classList.add('xp-toast-exit');
    setTimeout(() => toast.remove(), TOAST_FADE_MS);
  }, TOAST_DURATION_MS);
}

export function showLevelUpToast(newLevel: number, newTitle: string): void {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = 'xp-toast xp-toast-levelup';

  const icon = createIcon('trophy');
  icon.classList.add('xp-toast-icon');

  const text = document.createElement('span');
  text.className = 'xp-toast-text';
  text.textContent = `Level ${newLevel}!`;

  const detail = document.createElement('span');
  detail.className = 'xp-toast-detail';
  detail.textContent = newTitle;

  toast.append(icon, text, detail);
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('xp-toast-visible'));

  setTimeout(() => {
    toast.classList.remove('xp-toast-visible');
    toast.classList.add('xp-toast-exit');
    setTimeout(() => toast.remove(), TOAST_FADE_MS);
  }, 5000); // Level up stays longer
}
