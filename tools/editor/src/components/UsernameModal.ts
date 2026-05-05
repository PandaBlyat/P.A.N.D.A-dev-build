// P.A.N.D.A. Conversation Editor — Login / Registration Modal

import { registerUsername, loginWithPassword, getStoredUsername, setStoredUsername, type UserProfile } from '../lib/api-client';
import { createIcon } from './icons';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { t } from '../lib/i18n';

const MODAL_MOUNT_ID = 'app-modal-host';

type UsernameModalOptions = {
  publisherId: string;
  onRegistered: (profile: UserProfile) => void;
  onSkip?: () => void;
};

type ModalMode = 'register' | 'login';

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
  overlay.setAttribute('aria-label', t('usernameModal.aria'));

  const card = document.createElement('div');
  card.className = 'username-modal-card';

  // ── Tab switcher ──────────────────────────────────────────────────
  const tabs = document.createElement('div');
  tabs.className = 'username-modal-tabs';

  const registerTab = document.createElement('button');
  registerTab.type = 'button';
  registerTab.className = 'username-modal-tab is-active';
  registerTab.dataset.mode = 'register';
  registerTab.textContent = t('usernameModal.tab.register');

  const loginTab = document.createElement('button');
  loginTab.type = 'button';
  loginTab.className = 'username-modal-tab';
  loginTab.dataset.mode = 'login';
  loginTab.textContent = t('usernameModal.tab.login');

  tabs.append(registerTab, loginTab);

  // ── Header ────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'username-modal-header';
  const icon = createIcon('user');
  icon.classList.add('username-modal-icon');
  const title = document.createElement('h2');
  title.className = 'username-modal-title';
  const subtitle = document.createElement('p');
  subtitle.className = 'username-modal-subtitle';
  header.append(icon, title, subtitle);

  // ── Form ──────────────────────────────────────────────────────────
  const form = document.createElement('form');
  form.className = 'username-modal-form';

  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.className = 'username-modal-input';
  usernameInput.placeholder = t('usernameModal.input.username.placeholder');
  usernameInput.minLength = 3;
  usernameInput.maxLength = 20;
  usernameInput.autocomplete = 'username';
  usernameInput.spellcheck = false;
  usernameInput.pattern = '[A-Za-z0-9_\\-\\.]+';
  usernameInput.required = true;

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.className = 'username-modal-input username-modal-password';
  passwordInput.placeholder = t('usernameModal.input.password.min6.placeholder');
  passwordInput.autocomplete = 'current-password';
  passwordInput.minLength = 6;

  const hint = document.createElement('p');
  hint.className = 'username-modal-hint';

  const errorMsg = document.createElement('p');
  errorMsg.className = 'username-modal-error';
  errorMsg.hidden = true;

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'username-modal-submit';

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'username-modal-skip';
  skipBtn.textContent = t('usernameModal.action.skip');
  skipBtn.onclick = () => {
    closeUsernameModal();
    options.onSkip?.();
  };

  form.append(usernameInput, passwordInput, hint, errorMsg, submitBtn, skipBtn);

  card.append(tabs, header, form);
  overlay.appendChild(card);
  mount.appendChild(overlay);
  mount.setAttribute('aria-hidden', 'false');

  modalEl = overlay;
  focusTrapCtrl = trapFocus(overlay);
  usernameInput.focus();

  // ── Mode switching ────────────────────────────────────────────────
  let currentMode: ModalMode = 'register';

  function applyMode(mode: ModalMode): void {
    currentMode = mode;
    registerTab.classList.toggle('is-active', mode === 'register');
    loginTab.classList.toggle('is-active', mode === 'login');
    errorMsg.hidden = true;

    if (mode === 'register') {
      title.textContent = t('usernameModal.title.register');
      subtitle.textContent = t('usernameModal.subtitle.register');
      hint.textContent = t('usernameModal.hint.register');
      passwordInput.placeholder = t('usernameModal.input.password.optional.placeholder');
      passwordInput.required = false;
      submitBtn.textContent = t('usernameModal.submit.enterZone');
      skipBtn.hidden = false;
    } else {
      title.textContent = t('usernameModal.title.login');
      subtitle.textContent = t('usernameModal.subtitle.login');
      hint.textContent = t('usernameModal.hint.login');
      passwordInput.placeholder = t('usernameModal.input.password.placeholder');
      passwordInput.required = true;
      submitBtn.textContent = t('usernameModal.submit.signIn');
      skipBtn.hidden = true;
    }
  }

  registerTab.onclick = () => applyMode('register');
  loginTab.onclick = () => applyMode('login');
  applyMode('register');

  // ── Submit handler ────────────────────────────────────────────────
  form.onsubmit = async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (username.length < 3 || username.length > 20) {
      errorMsg.textContent = t('usernameModal.error.usernameRange');
      errorMsg.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = currentMode === 'register' ? t('usernameModal.status.registering') : t('usernameModal.status.signingIn');
    errorMsg.hidden = true;

    try {
      let profile: UserProfile;
      if (currentMode === 'login') {
        if (!password || password.length < 6) {
          errorMsg.textContent = t('usernameModal.error.passwordMin');
          errorMsg.hidden = false;
          submitBtn.disabled = false;
          submitBtn.textContent = t('usernameModal.submit.signIn');
          return;
        }
        profile = await loginWithPassword(username, password);
        // Sync publisher_id from the retrieved profile into localStorage
        if (profile.publisher_id) {
          window.localStorage.setItem('panda-community-publisher-id', profile.publisher_id);
          setStoredUsername(profile.username ?? username);
        }
      } else {
        profile = await registerUsername(options.publisherId, username, password || undefined);
      }
      closeUsernameModal();
      options.onRegistered(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('usernameModal.error.failed');
      if (currentMode === 'register') {
        if (message.toLowerCase().includes('unique') || message.toLowerCase().includes('duplicate')) {
          errorMsg.textContent = t('usernameModal.error.callsignTaken');
        } else {
          errorMsg.textContent = message;
        }
      } else {
        errorMsg.textContent = t('usernameModal.error.invalidLogin');
      }
      errorMsg.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = currentMode === 'register' ? t('usernameModal.submit.enterZone') : t('usernameModal.submit.signIn');
    }
  };
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
