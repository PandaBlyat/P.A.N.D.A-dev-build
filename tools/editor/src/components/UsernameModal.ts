// P.A.N.D.A. Conversation Editor — Username Registration Modal
// Shown on first visit to let the user choose a callsign.

import { registerUsername, getStoredUsername, type UserProfile } from '../lib/api-client';
import { createIcon } from './icons';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';

const MODAL_MOUNT_ID = 'app-modal-host';

type UsernameModalOptions = {
  publisherId: string;
  onRegistered: (profile: UserProfile) => void;
  onSkip?: () => void;
};

let modalEl: HTMLElement | null = null;
let focusTrapCtrl: FocusTrapController | null = null;

function getMount(): HTMLElement {
  return document.getElementById(MODAL_MOUNT_ID) ?? document.body;
}

export function isUsernameModalOpen(): boolean {
  return modalEl != null;
}

export function openUsernameModal(options: UsernameModalOptions): void {
  if (modalEl) return;

  const mount = getMount();

  const overlay = document.createElement('div');
  overlay.className = 'username-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Choose your stalker callsign');

  const card = document.createElement('div');
  card.className = 'username-modal-card';

  const header = document.createElement('div');
  header.className = 'username-modal-header';
  const icon = createIcon('user');
  icon.classList.add('username-modal-icon');
  const title = document.createElement('h2');
  title.className = 'username-modal-title';
  title.textContent = 'Choose your Callsign';
  const subtitle = document.createElement('p');
  subtitle.className = 'username-modal-subtitle';
  subtitle.textContent = 'Pick a name to track your XP and level in the Zone.';
  header.append(icon, title, subtitle);

  const form = document.createElement('form');
  form.className = 'username-modal-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'username-modal-input';
  input.placeholder = 'e.g. Strelok_42';
  input.minLength = 3;
  input.maxLength = 20;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.pattern = '[A-Za-z0-9_\\-\\.]+';
  input.required = true;

  const hint = document.createElement('p');
  hint.className = 'username-modal-hint';
  hint.textContent = '3–20 characters. Letters, numbers, underscores, hyphens, dots.';

  const errorMsg = document.createElement('p');
  errorMsg.className = 'username-modal-error';
  errorMsg.hidden = true;

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'username-modal-submit';
  submitBtn.textContent = 'Enter the Zone';

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'username-modal-skip';
  skipBtn.textContent = 'Skip for now';
  skipBtn.onclick = () => {
    closeUsernameModal();
    options.onSkip?.();
  };

  form.append(input, hint, errorMsg, submitBtn, skipBtn);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const username = input.value.trim();
    if (username.length < 3 || username.length > 20) {
      errorMsg.textContent = 'Username must be 3–20 characters.';
      errorMsg.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering…';
    errorMsg.hidden = true;

    try {
      const profile = await registerUsername(options.publisherId, username);
      closeUsernameModal();
      options.onRegistered(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      // Surface Supabase unique constraint errors nicely
      if (message.toLowerCase().includes('unique') || message.toLowerCase().includes('duplicate')) {
        errorMsg.textContent = 'That callsign is already taken. Try another.';
      } else {
        errorMsg.textContent = message;
      }
      errorMsg.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enter the Zone';
    }
  };

  card.append(header, form);
  overlay.appendChild(card);
  mount.appendChild(overlay);
  mount.setAttribute('aria-hidden', 'false');

  modalEl = overlay;
  focusTrapCtrl = trapFocus(overlay);
  input.focus();
}

export function closeUsernameModal(): void {
  if (!modalEl) return;
  focusTrapCtrl?.release();
  focusTrapCtrl = null;
  modalEl.remove();
  modalEl = null;

  const mount = getMount();
  if (mount.children.length === 0) {
    mount.setAttribute('aria-hidden', 'true');
  }
}
