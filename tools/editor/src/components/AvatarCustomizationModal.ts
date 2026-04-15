// P.A.N.D.A. — Avatar customization modal.
import {
  AVATAR_ICON_PRESETS,
  AVATAR_COLOR_PRESETS,
  AVATAR_FRAME_PRESETS,
  AVATAR_BANNER_PRESETS,
  AVATAR_EFFECT_PRESETS, 
  type AvatarIconPreset,
  type AvatarColorPreset,
  type AvatarFramePreset,
  type AvatarBannerPreset,
  type AvatarEffectPreset,
} from '../lib/avatar-catalog';
import {
  updateUserCosmetics as apiUpdateUserCosmetics,
  type UserProfile as BaseUserProfile,
  type UserCosmetics as BaseUserCosmetics,
} from '../lib/api-client';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';

// --- LOCAL TYPE EXTENSIONS ---
// This prevents build errors until you update api-client.ts to include avatar_effect
export type UserProfile = BaseUserProfile & { avatar_effect?: string };
export type UserCosmetics = BaseUserCosmetics & { avatar_effect?: string };

type OpenOptions = {
  profile: UserProfile;
  onSaved: (profile: UserProfile) => void;
  returnFocus?: HTMLElement | null;
};

let activeOverlay: HTMLElement | null = null;
let activeTrap: FocusTrapController | null = null;
let activeReturnFocus: HTMLElement | null = null;

const LOCK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

export function closeAvatarCustomizationModal(): void {
  if (!activeOverlay) return;
  activeTrap?.release();
  activeTrap = null;
  activeOverlay.remove();
  activeOverlay = null;
  document.removeEventListener('keydown', handleKeydown);
  const returnTarget = activeReturnFocus;
  activeReturnFocus = null;
  if (returnTarget && document.body.contains(returnTarget)) {
    try { returnTarget.focus(); } catch { /* noop */ }
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeAvatarCustomizationModal();
  }
}

function getInitial(username: string): string {
  return (username ?? '').trim().charAt(0).toUpperCase() || '?';
}

function renderPreview(username: string, level: number, draft: UserCosmetics): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pa-avatar-preview';

  const bannerPreset = AVATAR_BANNER_PRESETS.find(p => p.id === draft.avatar_banner);
  const banner = document.createElement('div');
  banner.className = `pa-avatar-preview-banner${bannerPreset?.isAnimated ? ' pa-anim-bg' : ''}`;
  if (draft.avatar_banner) banner.dataset.banner = String(draft.avatar_banner);

  const effectLayer = document.createElement('div');
  effectLayer.className = 'pa-avatar-preview-effect';
  if (draft.avatar_effect && draft.avatar_effect !== 'none') {
    effectLayer.dataset.effect = String(draft.avatar_effect);
  }

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'pa-avatar-preview-circle-wrap';

  const framePreset = AVATAR_FRAME_PRESETS.find(p => p.id === draft.avatar_frame);
  const frameId = typeof draft.avatar_frame === 'string' ? draft.avatar_frame : 'none';
  const avatar = document.createElement('div');
  avatar.className = `pa-avatar pa-avatar-preview-circle pa-avatar-frame-${frameId}${framePreset?.isAnimated ? ' pa-anim-frame' : ''}`;
  
  if (draft.avatar_color) avatar.style.setProperty('--pa-avatar-color', String(draft.avatar_color));
  
  const preset = AVATAR_ICON_PRESETS.find(item => item.id === draft.avatar_icon);
  const glyph = preset && preset.id !== 'default' ? preset.glyph : '';
  const inner = document.createElement('span');
  inner.className = 'pa-avatar-glyph';
  inner.textContent = glyph || getInitial(username);
  avatar.appendChild(inner);

  const levelBadge = document.createElement('span');
  levelBadge.className = 'pa-avatar-level-chip';
  levelBadge.textContent = `Lv.${level}`;
  
  avatarWrap.append(avatar, levelBadge);

  const copy = document.createElement('div');
  copy.className = 'pa-avatar-preview-copy';
  const title = document.createElement('div');
  title.className = 'pa-avatar-preview-name';
  title.textContent = username;
  const caption = document.createElement('div');
  caption.className = 'pa-avatar-preview-caption';
  caption.textContent = 'Preview — Stalker dossier header';
  copy.append(title, caption);

  wrap.append(banner, effectLayer, avatarWrap, copy);
  return wrap;
}

function buildCosmeticButton(
  item: { id: string; label: string; minLevel?: number },
  isActive: boolean,
  userLevel: number,
  baseClass: string,
  onClick: () => void
): HTMLButtonElement {
  const locked = item.minLevel !== undefined && userLevel < item.minLevel;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pa-avatar-chip ${baseClass}${isActive ? ' is-active' : ''}${locked ? ' is-locked' : ''}`;
  button.setAttribute('aria-pressed', String(isActive));
  button.disabled = locked;

  if (locked) {
    const lockBadge = document.createElement('div');
    lockBadge.className = 'pa-avatar-chip-lock';
    lockBadge.innerHTML = LOCK_ICON;
    button.appendChild(lockBadge);
    button.title = `Unlocks at Level ${item.minLevel}`;
  } else {
    button.title = item.label;
    button.addEventListener('click', onClick);
  }

  return button;
}

export function openAvatarCustomizationModal(options: OpenOptions): void {
  closeAvatarCustomizationModal();

  const { profile, onSaved, returnFocus } = options;
  // Fallback level to 1 if missing so we can evaluate locks
  const userLevel = (profile as any).level ?? 1;

  const draft: UserCosmetics = {
    avatar_icon: profile.avatar_icon ?? 'default',
    avatar_color: profile.avatar_color ?? 'loner',
    avatar_frame: profile.avatar_frame ?? 'none',
    avatar_banner: profile.avatar_banner ?? 'default',
    avatar_effect: profile.avatar_effect ?? 'none',
  };

  type TabId = 'icon' | 'color' | 'frame' | 'banner' | 'effect';
  let activeTab: TabId = 'icon';

  const backdrop = document.createElement('div');
  backdrop.className = 'pa-avatar-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Customize avatar');
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeAvatarCustomizationModal();
  });

  const dialog = document.createElement('div');
  dialog.className = 'pa-avatar-modal';

  const header = document.createElement('header');
  header.className = 'pa-avatar-modal-header';
  const titleWrap = document.createElement('div');
  titleWrap.innerHTML = `<h3>Customize your dossier</h3><p class="pa-avatar-modal-subtitle">Dress the Zone — Icon, tint, frame, banner, and VFX.</p>`;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pa-avatar-modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u2715';
  closeBtn.addEventListener('click', closeAvatarCustomizationModal);
  header.append(titleWrap, closeBtn);

  const body = document.createElement('div');
  body.className = 'pa-avatar-modal-body';

  const previewSlot = document.createElement('div');
  previewSlot.className = 'pa-avatar-modal-preview-slot';

  const workspace = document.createElement('div');
  workspace.className = 'pa-avatar-modal-workspace';

  const tabBar = document.createElement('nav');
  tabBar.className = 'pa-avatar-tabs';
  const tabs: { id: TabId; label: string }[] = [
    { id: 'icon', label: 'Icons' },
    { id: 'color', label: 'Tints' },
    { id: 'frame', label: 'Frames' },
    { id: 'banner', label: 'Banners' },
    { id: 'effect', label: 'VFX' },
  ];

  const tabButtons = new Map<TabId, HTMLButtonElement>();
  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'pa-avatar-tab-btn';
    btn.textContent = tab.label;
    btn.addEventListener('click', () => {
      activeTab = tab.id;
      renderWorkspace();
    });
    tabBar.appendChild(btn);
    tabButtons.set(tab.id, btn);
  });

  const tabContent = document.createElement('div');
  tabContent.className = 'pa-avatar-tab-content';
  workspace.append(tabBar, tabContent);

  const renderWorkspace = () => {
    tabButtons.forEach((btn, id) => {
      btn.classList.toggle('is-active', id === activeTab);
    });

    previewSlot.textContent = '';
    previewSlot.appendChild(renderPreview(profile.username ?? '', userLevel, draft));

    tabContent.textContent = '';
    const grid = document.createElement('div');
    grid.className = `pa-avatar-grid pa-avatar-grid-${activeTab}s`;

    if (activeTab === 'icon') {
      for (const preset of AVATAR_ICON_PRESETS as AvatarIconPreset[]) {
        const isActive = (draft.avatar_icon ?? 'default') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-icon', () => {
          draft.avatar_icon = preset.id; renderWorkspace();
        });
        const glyphTxt = preset.id === 'default' ? 'A' : preset.glyph;
        btn.innerHTML += `<span class="pa-avatar-chip-glyph">${glyphTxt}</span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        grid.appendChild(btn);
      }
    } 
    else if (activeTab === 'color') {
      for (const preset of AVATAR_COLOR_PRESETS as AvatarColorPreset[]) {
        const isActive = draft.avatar_color === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-color', () => {
          draft.avatar_color = preset.id; renderWorkspace();
        });
        btn.style.setProperty('--pa-swatch', preset.color);
        btn.innerHTML += `<span class="pa-avatar-chip-swatch"></span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        grid.appendChild(btn);
      }
    }
    else if (activeTab === 'frame') {
      for (const preset of AVATAR_FRAME_PRESETS as AvatarFramePreset[]) {
        const isActive = (draft.avatar_frame ?? 'none') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-frame', () => {
          draft.avatar_frame = preset.id; renderWorkspace();
        });
        const isAnim = preset.isAnimated ? ' pa-anim-frame' : '';
        btn.innerHTML += `<span class="pa-avatar-chip-frame-sample pa-avatar-frame-${preset.variant}${isAnim}"></span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        grid.appendChild(btn);
      }
    }
    else if (activeTab === 'banner') {
      for (const preset of AVATAR_BANNER_PRESETS as AvatarBannerPreset[]) {
        const isActive = (draft.avatar_banner ?? 'default') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-banner', () => {
          draft.avatar_banner = preset.id; renderWorkspace();
        });
        const isAnim = preset.isAnimated ? ' pa-anim-bg' : '';
        btn.innerHTML += `<span class="pa-avatar-chip-banner-sample${isAnim}" style="background: ${preset.gradient || ''}" data-banner="${preset.id}"></span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        grid.appendChild(btn);
      }
    }
    else if (activeTab === 'effect') {
      for (const preset of AVATAR_EFFECT_PRESETS as AvatarEffectPreset[]) {
        const isActive = (draft.avatar_effect ?? 'none') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-effect', () => {
          draft.avatar_effect = preset.id; renderWorkspace();
        });
        btn.innerHTML += `<span class="pa-avatar-chip-effect-sample" data-effect="${preset.id}"></span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        grid.appendChild(btn);
      }
    }

    tabContent.appendChild(grid);
  };

  renderWorkspace(); 
  body.append(previewSlot, workspace);

  const footer = document.createElement('footer');
  footer.className = 'pa-avatar-modal-footer';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'pa-avatar-modal-action pa-avatar-modal-action-ghost';
  resetBtn.textContent = 'Reset defaults';
  resetBtn.addEventListener('click', () => {
    draft.avatar_icon = 'default';
    draft.avatar_color = 'loner';
    draft.avatar_frame = 'none';
    draft.avatar_banner = 'default';
    draft.avatar_effect = 'none';
    renderWorkspace();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'pa-avatar-modal-action';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeAvatarCustomizationModal);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'pa-avatar-modal-action pa-avatar-modal-action-primary';
  saveBtn.textContent = 'Save customization';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      // Cast the draft back to BaseUserCosmetics so the API client accepts it 
      // even if it drops the `avatar_effect` property on save.
      const updated = await apiUpdateUserCosmetics(profile.publisher_id, draft as BaseUserCosmetics);
      onSaved({ ...profile, ...(updated || draft) } as UserProfile);
      closeAvatarCustomizationModal();
    } catch (err) {
      console.error('[avatar] save failed', err);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Retry save';
    }
  });

  footer.append(resetBtn, cancelBtn, saveBtn);

  dialog.append(header, body, footer);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  activeOverlay = backdrop;
  activeReturnFocus = returnFocus ?? null;
  document.addEventListener('keydown', handleKeydown);
  try {
    activeTrap = trapFocus(dialog);
  } catch {
    activeTrap = null;
  }
  queueMicrotask(() => {
    try { saveBtn.focus(); } catch { /* noop */ }
  });
}
