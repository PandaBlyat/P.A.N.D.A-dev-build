// P.A.N.D.A. — Avatar customization modal.
//
// Opens when the user clicks their own avatar inside the profile popover.
// Lets the user pick an icon glyph, tint color, frame, and banner preset,
// previews the result live, and persists it via updateUserCosmetics().

import {
  AVATAR_ICON_PRESETS,
  AVATAR_COLOR_PRESETS,
  AVATAR_FRAME_PRESETS,
  AVATAR_BANNER_PRESETS,
  type AvatarIconPreset,
  type AvatarColorPreset,
  type AvatarFramePreset,
  type AvatarBannerPreset,
} from '../lib/avatar-catalog';
import {
  updateUserCosmetics,
  type UserProfile,
  type UserCosmetics,
} from '../lib/api-client';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';

type OpenOptions = {
  profile: UserProfile;
  /** Called with the updated profile after a successful save. */
  onSaved: (profile: UserProfile) => void;
  /** Element to restore focus to when the modal closes. */
  returnFocus?: HTMLElement | null;
};

let activeOverlay: HTMLElement | null = null;
let activeTrap: FocusTrapController | null = null;
let activeReturnFocus: HTMLElement | null = null;

function closeModal() {
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
    closeModal();
  }
}

function getInitial(username: string): string {
  return (username ?? '').trim().charAt(0).toUpperCase() || '?';
}

/**
 * Build a preview swatch that mirrors how the avatar will render in the hero
 * card across the app. Keeps the visual language of the real avatar so the
 * user sees exactly what they'll get.
 */
function renderPreview(
  username: string,
  level: number,
  draft: UserCosmetics,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pa-avatar-preview';

  const banner = document.createElement('div');
  banner.className = 'pa-avatar-preview-banner';
  if (draft.avatar_banner) banner.dataset.banner = String(draft.avatar_banner);

  const avatar = document.createElement('div');
  const frameId = typeof draft.avatar_frame === 'string' ? draft.avatar_frame : 'none';
  avatar.className = `pa-avatar pa-avatar-preview-circle pa-avatar-frame-${frameId}`;
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
  avatar.appendChild(levelBadge);

  const copy = document.createElement('div');
  copy.className = 'pa-avatar-preview-copy';
  const title = document.createElement('div');
  title.className = 'pa-avatar-preview-name';
  title.textContent = username;
  const caption = document.createElement('div');
  caption.className = 'pa-avatar-preview-caption';
  caption.textContent = 'Preview — Stalker dossier header';
  copy.append(title, caption);

  wrap.append(banner, avatar, copy);
  return wrap;
}

function renderIconSection(draft: UserCosmetics, rerender: () => void): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pa-avatar-section';
  const head = document.createElement('div');
  head.className = 'pa-avatar-section-head';
  const heading = document.createElement('h4');
  heading.textContent = 'Icon';
  const hint = document.createElement('span');
  hint.textContent = 'Pick the glyph shown in your avatar circle.';
  hint.className = 'pa-avatar-section-hint';
  head.append(heading, hint);

  const grid = document.createElement('div');
  grid.className = 'pa-avatar-grid pa-avatar-grid-icons';

  const byCategory = new Map<string, AvatarIconPreset[]>();
  for (const preset of AVATAR_ICON_PRESETS) {
    const list = byCategory.get(preset.category) ?? [];
    list.push(preset);
    byCategory.set(preset.category, list);
  }

  byCategory.forEach((presets) => {
    for (const preset of presets) {
      const button = document.createElement('button');
      button.type = 'button';
      const isActive = (draft.avatar_icon ?? 'default') === preset.id;
      button.className = `pa-avatar-chip pa-avatar-chip-icon${isActive ? ' is-active' : ''}`;
      button.title = preset.label;
      button.setAttribute('aria-pressed', String(isActive));
      const glyph = document.createElement('span');
      glyph.className = 'pa-avatar-chip-glyph';
      glyph.textContent = preset.id === 'default' ? 'A' : preset.glyph;
      const label = document.createElement('span');
      label.className = 'pa-avatar-chip-label';
      label.textContent = preset.label;
      button.append(glyph, label);
      button.addEventListener('click', () => {
        draft.avatar_icon = preset.id;
        rerender();
      });
      grid.appendChild(button);
    }
  });

  section.append(head, grid);
  return section;
}

function renderColorSection(draft: UserCosmetics, rerender: () => void): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pa-avatar-section';
  const head = document.createElement('div');
  head.className = 'pa-avatar-section-head';
  const heading = document.createElement('h4');
  heading.textContent = 'Tint';
  const hint = document.createElement('span');
  hint.textContent = 'Color your ring and frame.';
  hint.className = 'pa-avatar-section-hint';
  head.append(heading, hint);

  const grid = document.createElement('div');
  grid.className = 'pa-avatar-grid pa-avatar-grid-colors';

  for (const preset of AVATAR_COLOR_PRESETS as AvatarColorPreset[]) {
    const button = document.createElement('button');
    button.type = 'button';
    const isActive = draft.avatar_color === preset.id;
    button.className = `pa-avatar-chip pa-avatar-chip-color${isActive ? ' is-active' : ''}`;
    button.title = preset.label;
    button.setAttribute('aria-pressed', String(isActive));
    button.style.setProperty('--pa-swatch', preset.color);
    const swatch = document.createElement('span');
    swatch.className = 'pa-avatar-chip-swatch';
    const label = document.createElement('span');
    label.className = 'pa-avatar-chip-label';
    label.textContent = preset.label;
    button.append(swatch, label);
    button.addEventListener('click', () => {
      draft.avatar_color = preset.id;
      rerender();
    });
    grid.appendChild(button);
  }

  section.append(head, grid);
  return section;
}

function renderFrameSection(draft: UserCosmetics, level: number, rerender: () => void): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pa-avatar-section';
  const head = document.createElement('div');
  head.className = 'pa-avatar-section-head';
  const heading = document.createElement('h4');
  heading.textContent = 'Frame';
  const hint = document.createElement('span');
  hint.textContent = 'Higher levels unlock ornate frames.';
  hint.className = 'pa-avatar-section-hint';
  head.append(heading, hint);

  const grid = document.createElement('div');
  grid.className = 'pa-avatar-grid pa-avatar-grid-frames';

  for (const preset of AVATAR_FRAME_PRESETS as AvatarFramePreset[]) {
    const locked = preset.minLevel !== undefined && level < preset.minLevel;
    const button = document.createElement('button');
    button.type = 'button';
    const isActive = (draft.avatar_frame ?? 'none') === preset.id;
    button.className = `pa-avatar-chip pa-avatar-chip-frame${isActive ? ' is-active' : ''}${locked ? ' is-locked' : ''}`;
    button.title = locked ? `Unlocks at Level ${preset.minLevel}` : preset.label;
    button.setAttribute('aria-pressed', String(isActive));
    button.disabled = locked;
    const sample = document.createElement('span');
    sample.className = `pa-avatar-chip-frame-sample pa-avatar-frame-${preset.variant}`;
    const label = document.createElement('span');
    label.className = 'pa-avatar-chip-label';
    label.textContent = locked ? `${preset.label} · Lv.${preset.minLevel}` : preset.label;
    button.append(sample, label);
    button.addEventListener('click', () => {
      if (locked) return;
      draft.avatar_frame = preset.id;
      rerender();
    });
    grid.appendChild(button);
  }

  section.append(head, grid);
  return section;
}

function renderBannerSection(draft: UserCosmetics, rerender: () => void): HTMLElement {
  const section = document.createElement('section');
  section.className = 'pa-avatar-section';
  const head = document.createElement('div');
  head.className = 'pa-avatar-section-head';
  const heading = document.createElement('h4');
  heading.textContent = 'Banner';
  const hint = document.createElement('span');
  hint.textContent = 'Background behind your dossier hero.';
  hint.className = 'pa-avatar-section-hint';
  head.append(heading, hint);

  const grid = document.createElement('div');
  grid.className = 'pa-avatar-grid pa-avatar-grid-banners';

  for (const preset of AVATAR_BANNER_PRESETS as AvatarBannerPreset[]) {
    const button = document.createElement('button');
    button.type = 'button';
    const isActive = (draft.avatar_banner ?? 'default') === preset.id;
    button.className = `pa-avatar-chip pa-avatar-chip-banner${isActive ? ' is-active' : ''}`;
    button.setAttribute('aria-pressed', String(isActive));
    button.title = preset.label;
    const swatch = document.createElement('span');
    swatch.className = 'pa-avatar-chip-banner-sample';
    swatch.style.background = preset.gradient;
    const label = document.createElement('span');
    label.className = 'pa-avatar-chip-label';
    label.textContent = preset.label;
    button.append(swatch, label);
    button.addEventListener('click', () => {
      draft.avatar_banner = preset.id;
      rerender();
    });
    grid.appendChild(button);
  }

  section.append(head, grid);
  return section;
}

export function openAvatarCustomizationModal(options: OpenOptions): void {
  closeModal();

  const { profile, onSaved, returnFocus } = options;

  const draft: UserCosmetics = {
    avatar_icon: profile.avatar_icon ?? 'default',
    avatar_color: profile.avatar_color ?? 'loner',
    avatar_frame: profile.avatar_frame ?? 'none',
    avatar_banner: profile.avatar_banner ?? 'default',
  };

  const backdrop = document.createElement('div');
  backdrop.className = 'pa-avatar-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Customize avatar');
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal();
  });

  const dialog = document.createElement('div');
  dialog.className = 'pa-avatar-modal';

  const header = document.createElement('header');
  header.className = 'pa-avatar-modal-header';
  const title = document.createElement('h3');
  title.textContent = 'Customize your dossier';
  const sub = document.createElement('p');
  sub.className = 'pa-avatar-modal-subtitle';
  sub.textContent = 'Dress the Zone — icon, tint, frame, and banner all update instantly.';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pa-avatar-modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u2715';
  closeBtn.addEventListener('click', closeModal);
  const titleWrap = document.createElement('div');
  titleWrap.append(title, sub);
  header.append(titleWrap, closeBtn);

  const body = document.createElement('div');
  body.className = 'pa-avatar-modal-body';

  const previewSlot = document.createElement('div');
  previewSlot.className = 'pa-avatar-modal-preview-slot';

  const sections = document.createElement('div');
  sections.className = 'pa-avatar-modal-sections';

  const rerender = () => {
    previewSlot.textContent = '';
    previewSlot.appendChild(renderPreview(profile.username, profile.level, draft));
    sections.textContent = '';
    sections.append(
      renderIconSection(draft, rerender),
      renderColorSection(draft, rerender),
      renderFrameSection(draft, profile.level, rerender),
      renderBannerSection(draft, rerender),
    );
  };

  rerender();

  body.append(previewSlot, sections);

  const footer = document.createElement('footer');
  footer.className = 'pa-avatar-modal-footer';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'pa-avatar-modal-action pa-avatar-modal-action-ghost';
  resetBtn.textContent = 'Reset to defaults';
  resetBtn.addEventListener('click', () => {
    draft.avatar_icon = 'default';
    draft.avatar_color = 'loner';
    draft.avatar_frame = 'none';
    draft.avatar_banner = 'default';
    rerender();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'pa-avatar-modal-action';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeModal);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'pa-avatar-modal-action pa-avatar-modal-action-primary';
  saveBtn.textContent = 'Save customization';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const updated = await updateUserCosmetics(profile.publisher_id, draft);
      if (updated) {
        onSaved({ ...profile, ...updated });
      } else {
        onSaved({ ...profile, ...draft });
      }
      closeModal();
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

export function closeAvatarCustomizationModal(): void {
  closeModal();
}
