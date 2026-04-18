// P.A.N.D.A. — Avatar customization modal.
import {
  AVATAR_ICON_PRESETS,
  AVATAR_COLOR_PRESETS,
  AVATAR_FRAME_PRESETS,
  AVATAR_BANNER_PRESETS,
  AVATAR_EFFECT_PRESETS,
  getAvatarColorPreset,
  type AvatarIconPreset,
  type AvatarColorPreset,
  type AvatarFramePreset,
  type AvatarBannerPreset,
  type AvatarEffectPreset,
} from '../lib/avatar-catalog';
import {
  updateUserCosmetics as apiUpdateUserCosmetics,
  type UserProfile,
  type UserCosmetics,
} from '../lib/api-client';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';

// Re-export so callers that previously imported these from here still work.
export type { UserProfile, UserCosmetics };

// ---------------------------------------------------------------------------
// Admin check — "Panda" gets unlimited access for testing.
// ---------------------------------------------------------------------------
function isPandaAdmin(username: string): boolean {
  return username.trim().toLowerCase() === 'panda';
}

type OpenOptions = {
  profile: UserProfile;
  onSaved: (profile: UserProfile) => void;
  returnFocus?: HTMLElement | null;
};

let activeOverlay: HTMLElement | null = null;
let activeTrap: FocusTrapController | null = null;
let activeReturnFocus: HTMLElement | null = null;

const LOCK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
const ADMIN_ICON = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" title="Admin unlock"><path d="M12 1l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>`;

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

/** Sort a preset array so free (minLevel=0/undefined) items come first, then ascending level. */
function sortByLevel<T extends { minLevel?: number }>(presets: T[]): T[] {
  return [...presets].sort((a, b) => (a.minLevel ?? 0) - (b.minLevel ?? 0));
}

/** Apply every effect tweak as CSS custom properties so render paths match the modal preview. */
function applyEffectVars(el: HTMLElement, preset: AvatarEffectPreset | undefined, cosmetics: UserCosmetics): void {
  if (!preset || preset.id === 'none') return;
  el.style.setProperty('--pa-effect-color', cosmetics.avatar_effect_color || preset.defaultColor || 'var(--accent)');
  el.style.setProperty('--pa-effect-intensity', String((cosmetics.avatar_effect_intensity ?? preset.defaultIntensity ?? 75) / 100));
  el.style.setProperty('--pa-effect-speed', String(cosmetics.avatar_effect_speed ?? preset.defaultSpeed ?? 1.0));
  el.style.setProperty('--pa-effect-saturation', String((cosmetics.avatar_effect_saturation ?? 100) / 100));
  el.style.setProperty('--pa-effect-size', String((cosmetics.avatar_effect_size ?? 100) / 100));
  el.style.setProperty('--pa-effect-alpha', String((cosmetics.avatar_effect_alpha ?? 100) / 100));
}

/** Build a consistent mini-avatar element for use in both preview tiles. */
function buildPreviewAvatar(
  username: string,
  level: number,
  draft: UserCosmetics,
  sizeClass: 'pa-avatar-sm' | 'pa-avatar-md' | 'pa-avatar-lg',
  extraClass: string,
): HTMLElement {
  const framePreset = AVATAR_FRAME_PRESETS.find(p => p.id === draft.avatar_frame);
  const frameId = typeof draft.avatar_frame === 'string' ? draft.avatar_frame : 'none';
  const colorPreset = getAvatarColorPreset(draft.avatar_color);
  const colorValue = colorPreset?.color ?? 'var(--accent)';
  const iconPreset = AVATAR_ICON_PRESETS.find(item => item.id === draft.avatar_icon);
  const glyphText = iconPreset && iconPreset.id !== 'default' ? iconPreset.glyph : getInitial(username);

  const av = document.createElement('div');
  av.className = [
    'pa-avatar', sizeClass,
    `pa-avatar-frame-${frameId}`,
    framePreset?.isAnimated ? 'pa-anim-frame' : '',
    extraClass,
  ].filter(Boolean).join(' ');
  av.style.setProperty('--pa-avatar-color', colorValue);
  const frameColorValue = draft.avatar_frame_color && draft.avatar_frame_color !== ''
    ? draft.avatar_frame_color
    : colorValue;
  av.style.setProperty('--pa-frame-color', frameColorValue);
  if (framePreset?.isAnimated && framePreset.defaultIntensity !== undefined) {
    av.style.setProperty('--pa-frame-intensity', String((draft.avatar_frame_intensity ?? framePreset.defaultIntensity ?? 85) / 100));
  }

  const glyph = document.createElement('span');
  glyph.className = 'pa-avatar-glyph';
  glyph.textContent = glyphText;
  av.appendChild(glyph);

  const ornament = document.createElement('span');
  ornament.className = 'pa-avatar-ornament';
  ornament.setAttribute('aria-hidden', 'true');
  av.appendChild(ornament);

  const chip = document.createElement('span');
  chip.className = 'pa-avatar-level-chip';
  chip.textContent = `Lv.${level}`;
  av.appendChild(chip);

  return av;
}

/**
 * Render a dual-tile preview: a podium card on the left and a leaderboard
 * row strip on the right, both reflecting the current draft cosmetics.
 */
function renderPreview(username: string, level: number, draft: UserCosmetics): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pa-preview-dual';

  const bannerPreset = AVATAR_BANNER_PRESETS.find(p => p.id === draft.avatar_banner);
  const bannerBg = (bannerPreset && bannerPreset.id !== 'default' && bannerPreset.gradient)
    ? `${bannerPreset.gradient}, #141811`
    : undefined;
  const colorPreset = getAvatarColorPreset(draft.avatar_color);
  const colorValue = colorPreset?.color ?? 'var(--accent)';
  const hasEffect = !!(draft.avatar_effect && draft.avatar_effect !== 'none');

  // ── Podium card tile ─────────────────────────────────────────────────────
  const podiumTile = document.createElement('div');
  podiumTile.className = 'pa-preview-podium-tile';
  if (bannerBg) podiumTile.style.setProperty('--pa-preview-banner', bannerBg);
  podiumTile.style.setProperty('--pa-avatar-color', colorValue);

  const podiumBanner = document.createElement('span');
  podiumBanner.className = `pa-preview-tile-banner${bannerPreset?.isAnimated ? ' pa-anim-bg' : ''}`;
  if (bannerBg) podiumBanner.style.background = bannerBg;
  podiumBanner.style.opacity = String((draft.avatar_banner_opacity ?? 80) / 100);
  if (bannerPreset?.isAnimated) {
    // background shorthand resets background-size; re-assert it so the pan animation works.
    podiumBanner.style.backgroundSize = '200% 200%';
    podiumBanner.style.setProperty('--pa-banner-speed', String(draft.avatar_banner_speed ?? 1.0));
  }
  podiumTile.appendChild(podiumBanner);

  if (hasEffect) {
    const podiumEffect = document.createElement('span');
    podiumEffect.className = 'pa-preview-tile-effect pa-avatar-chip-effect-sample';
    podiumEffect.dataset.effect = String(draft.avatar_effect);
    const effectPreset = AVATAR_EFFECT_PRESETS.find(p => p.id === draft.avatar_effect);
    applyEffectVars(podiumEffect, effectPreset, draft);
    podiumTile.appendChild(podiumEffect);
  }

  const podiumRank = document.createElement('span');
  podiumRank.className = 'pa-preview-podium-rank';
  podiumRank.textContent = 'I';
  podiumTile.appendChild(podiumRank);

  podiumTile.appendChild(buildPreviewAvatar(username, level, draft, 'pa-avatar-lg', 'pa-preview-podium-avatar'));

  const podiumName = document.createElement('span');
  podiumName.className = 'pa-preview-podium-name';
  podiumName.textContent = username;
  podiumTile.appendChild(podiumName);

  const podiumXp = document.createElement('span');
  podiumXp.className = 'pa-preview-podium-xp';
  podiumXp.textContent = '— XP';
  podiumTile.appendChild(podiumXp);

  // Label below the tile
  const podiumLabel = document.createElement('p');
  podiumLabel.className = 'pa-preview-tile-label';
  podiumLabel.textContent = 'Podium card';
  podiumTile.appendChild(podiumLabel);

  // ── Row tile ─────────────────────────────────────────────────────────────
  const rowTile = document.createElement('div');
  rowTile.className = `pa-preview-row-tile${bannerPreset?.isAnimated ? ' pa-anim-bg' : ''}`;
  if (bannerBg) {
    rowTile.style.setProperty('--row-banner', bannerBg);
    const bannerOpacity = (draft.avatar_banner_opacity ?? 80) / 100;
    rowTile.style.setProperty('--pa-banner-row-opacity', String(bannerOpacity));
    if (bannerPreset?.isAnimated) {
      rowTile.style.setProperty('--pa-banner-speed', String(draft.avatar_banner_speed ?? 1.0));
    }
  }
  rowTile.style.setProperty('--pa-avatar-color', colorValue);

  if (hasEffect) {
    const rowEffect = document.createElement('span');
    rowEffect.className = 'pa-preview-tile-row-effect pa-avatar-chip-effect-sample';
    rowEffect.dataset.effect = String(draft.avatar_effect);
    const effectPreset = AVATAR_EFFECT_PRESETS.find(p => p.id === draft.avatar_effect);
    applyEffectVars(rowEffect, effectPreset, draft);
    rowTile.appendChild(rowEffect);
  }

  const rowRank = document.createElement('span');
  rowRank.className = 'pa-preview-row-rank';
  rowRank.textContent = '#1';
  rowTile.appendChild(rowRank);

  rowTile.appendChild(buildPreviewAvatar(username, level, draft, 'pa-avatar-sm', 'pa-preview-row-avatar'));

  const rowIdentity = document.createElement('span');
  rowIdentity.className = 'pa-preview-row-identity';
  const rowName = document.createElement('span');
  rowName.className = 'pa-preview-row-name';
  rowName.textContent = username;
  const rowTitle = document.createElement('span');
  rowTitle.className = 'pa-preview-row-title';
  rowTitle.textContent = 'Leaderboard row preview';
  rowIdentity.append(rowName, rowTitle);
  rowTile.appendChild(rowIdentity);

  const rowXp = document.createElement('span');
  rowXp.className = 'pa-preview-row-xp';
  rowXp.textContent = '— XP';
  rowTile.appendChild(rowXp);

  wrap.append(podiumTile, rowTile);
  return wrap;
}

function buildCosmeticButton(
  item: { id: string; label: string; minLevel?: number },
  isActive: boolean,
  userLevel: number,
  baseClass: string,
  isAdmin: boolean,
  onClick: () => void
): HTMLButtonElement {
  const locked = !isAdmin && item.minLevel !== undefined && userLevel < item.minLevel;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pa-avatar-chip ${baseClass}${isActive ? ' is-active' : ''}${locked ? ' is-locked' : ''}${isAdmin && item.minLevel ? ' is-admin-unlocked' : ''}`;
  button.setAttribute('aria-pressed', String(isActive));
  button.disabled = locked;

  if (locked) {
    const lockBadge = document.createElement('div');
    lockBadge.className = 'pa-avatar-chip-lock';
    lockBadge.innerHTML = LOCK_ICON;
    button.appendChild(lockBadge);
    button.title = `Unlocks at Level ${item.minLevel}`;
  } else {
    if (isAdmin && item.minLevel) {
      const adminBadge = document.createElement('div');
      adminBadge.className = 'pa-avatar-chip-admin';
      adminBadge.innerHTML = ADMIN_ICON;
      adminBadge.title = `Admin unlocked (Lv.${item.minLevel})`;
      button.appendChild(adminBadge);
    }
    button.title = item.label;
    button.addEventListener('click', onClick);
  }

  return button;
}

export function openAvatarCustomizationModal(options: OpenOptions): void {
  closeAvatarCustomizationModal();

  const { profile, onSaved, returnFocus } = options;
  const userLevel = (profile as unknown as Record<string, unknown>).level as number ?? 1;
  const isAdmin = isPandaAdmin(profile.username ?? '');

  const draft: UserCosmetics = {
    avatar_icon: profile.avatar_icon ?? 'default',
    avatar_color: profile.avatar_color ?? 'loner',
    avatar_frame: profile.avatar_frame ?? 'none',
    avatar_banner: profile.avatar_banner ?? 'default',
    avatar_effect: profile.avatar_effect ?? 'none',
    avatar_effect_color: profile.avatar_effect_color ?? undefined,
    avatar_effect_intensity: profile.avatar_effect_intensity ?? undefined,
    avatar_effect_speed: profile.avatar_effect_speed ?? undefined,
    avatar_effect_saturation: profile.avatar_effect_saturation ?? undefined,
    avatar_effect_size: profile.avatar_effect_size ?? undefined,
    avatar_effect_alpha: profile.avatar_effect_alpha ?? undefined,
    avatar_frame_intensity: profile.avatar_frame_intensity ?? undefined,
    avatar_frame_color: profile.avatar_frame_color ?? undefined,
    avatar_banner_opacity: profile.avatar_banner_opacity ?? undefined,
    avatar_banner_speed: profile.avatar_banner_speed ?? undefined,
  };


  type TabId = 'icon' | 'color' | 'frame' | 'banner' | 'effect';
  let activeTab: TabId = 'icon';
  let selectedEffectOrFrame: { type: 'effect' | 'frame'; id: string } | null = null;
  let selectedBannerId: string | null = null;

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
  const headerTitle = isAdmin
    ? 'Customize your dossier <span class="pa-avatar-modal-admin-badge">ADMIN</span>'
    : 'Customize your dossier';
  titleWrap.innerHTML = `<h3>${headerTitle}</h3><p class="pa-avatar-modal-subtitle">Dress the Zone — Icon, tint, frame, banner, and VFX.</p>`;
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
      selectedEffectOrFrame = null;
      selectedBannerId = null;
      renderWorkspace();
    });
    tabBar.appendChild(btn);
    tabButtons.set(tab.id, btn);
  });

  const tabContent = document.createElement('div');
  tabContent.className = 'pa-avatar-tab-content';

  const tweakPanel = document.createElement('div');
  tweakPanel.className = 'pa-avatar-tweak-panel';

  workspace.append(tabBar, tabContent);

  const renderWorkspace = () => {
    tabButtons.forEach((btn, id) => {
      btn.classList.toggle('is-active', id === activeTab);
    });

    // Re-render preview on every selection change.
    previewSlot.textContent = '';
    previewSlot.appendChild(renderPreview(profile.username ?? '', userLevel, draft));
    previewSlot.appendChild(tweakPanel);

    tabContent.textContent = '';
    const grid = document.createElement('div');
    grid.className = `pa-avatar-grid pa-avatar-grid-${activeTab}s`;

    if (activeTab === 'icon') {
      // Filter out pandaOnly icons for non-Panda users; sort by level.
      const icons = sortByLevel(
        (AVATAR_ICON_PRESETS as AvatarIconPreset[]).filter(p => !p.pandaOnly || isAdmin)
      );
      for (const preset of icons) {
        const isActive = (draft.avatar_icon ?? 'default') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-icon', isAdmin, () => {
          draft.avatar_icon = preset.id; renderWorkspace();
        });
        const glyphTxt = preset.id === 'default' ? 'A' : preset.glyph;
        btn.innerHTML += `<span class="pa-avatar-chip-glyph">${glyphTxt}</span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        if (preset.pandaOnly) {
          btn.classList.add('is-panda-only');
          btn.title = `🐼 ${preset.label} — Panda exclusive`;
        }
        grid.appendChild(btn);
      }
    }
    else if (activeTab === 'color') {
      const colors = sortByLevel(AVATAR_COLOR_PRESETS as AvatarColorPreset[]);
      for (const preset of colors) {
        const isActive = draft.avatar_color === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-color', isAdmin, () => {
          draft.avatar_color = preset.id; renderWorkspace();
        });
        btn.style.setProperty('--pa-swatch', preset.color);
        btn.innerHTML += `<span class="pa-avatar-chip-swatch"></span><span class="pa-avatar-chip-label">${preset.label}</span>`;
        grid.appendChild(btn);
      }
    }
    else if (activeTab === 'frame') {
      const frames = sortByLevel(AVATAR_FRAME_PRESETS as AvatarFramePreset[]);
      for (const preset of frames) {
        const isActive = (draft.avatar_frame ?? 'none') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-frame', isAdmin, () => {
          draft.avatar_frame = preset.id;
          selectedEffectOrFrame = { type: 'frame', id: preset.id };
          renderWorkspace();
        });
        // Build a real mini-avatar so variant-specific CSS (ornaments, ::after
        // crests, animated borders) actually renders in the picker.
        const sampleWrap = document.createElement('span');
        sampleWrap.className = 'pa-avatar-chip-frame-sample-wrap';
        const sampleAvatar = document.createElement('span');
        const isAnim = preset.isAnimated ? ' pa-anim-frame' : '';
        sampleAvatar.className = `pa-avatar pa-avatar-frame-${preset.variant} pa-avatar-chip-frame-sample${isAnim}`;
        // Apply the user's currently selected tint so color-dependent frames
        // (radioactive, plasma, neon, etc.) show the right colour in the picker.
        const chipColorPreset = getAvatarColorPreset(draft.avatar_color);
        sampleAvatar.style.setProperty('--pa-avatar-color', chipColorPreset?.color ?? 'var(--accent)');
        // Set per-preset default intensity so the chip matches the in-game default.
        if (preset.isAnimated && preset.defaultIntensity !== undefined) {
          sampleAvatar.style.setProperty('--pa-frame-intensity', String(preset.defaultIntensity / 100));
        }
        const glyph = document.createElement('span');
        glyph.className = 'pa-avatar-glyph';
        glyph.textContent = 'A';
        sampleAvatar.appendChild(glyph);
        const ornament = document.createElement('span');
        ornament.className = 'pa-avatar-ornament';
        ornament.setAttribute('aria-hidden', 'true');
        sampleAvatar.appendChild(ornament);
        sampleWrap.appendChild(sampleAvatar);
        btn.appendChild(sampleWrap);
        const label = document.createElement('span');
        label.className = 'pa-avatar-chip-label';
        label.textContent = preset.label;
        btn.appendChild(label);
        grid.appendChild(btn);
      }
    }
    else if (activeTab === 'banner') {
      const banners = sortByLevel(AVATAR_BANNER_PRESETS as AvatarBannerPreset[]);
      for (const preset of banners) {
        const isActive = (draft.avatar_banner ?? 'default') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-banner', isAdmin, () => {
          draft.avatar_banner = preset.id;
          selectedBannerId = preset.id;
          renderWorkspace();
        });
        const isAnim = preset.isAnimated ? ' pa-anim-bg' : '';
        // Layer the (often translucent) gradient over a solid dark base so
        // every banner reads distinctly in the picker, not just on preview.
        const sample = document.createElement('span');
        sample.className = `pa-avatar-chip-banner-sample${isAnim}`;
        sample.setAttribute('data-banner', preset.id);
        const background = preset.gradient
          ? `${preset.gradient}, linear-gradient(140deg, #1a1e18, #0c0f0a)`
          : 'linear-gradient(140deg, #1a1e18, #0c0f0a)';
        sample.style.background = background;
        if (preset.isAnimated) {
          // background shorthand resets background-size; re-assert so the pan animation works.
          sample.style.backgroundSize = '200% 200%';
          sample.style.setProperty('--pa-banner-speed', String(draft.avatar_banner_speed ?? preset.defaultSpeed ?? 1.0));
        }
        btn.appendChild(sample);
        const label = document.createElement('span');
        label.className = 'pa-avatar-chip-label';
        label.textContent = preset.label;
        btn.appendChild(label);
        grid.appendChild(btn);
      }
    }
    else if (activeTab === 'effect') {
      const effects = sortByLevel(AVATAR_EFFECT_PRESETS as AvatarEffectPreset[]);
      for (const preset of effects) {
        const isActive = (draft.avatar_effect ?? 'none') === preset.id;
        const btn = buildCosmeticButton(preset, isActive, userLevel, 'pa-avatar-chip-effect', isAdmin, () => {
          draft.avatar_effect = preset.id;
          selectedEffectOrFrame = { type: 'effect', id: preset.id };
          renderWorkspace();
        });
        // Wrap the effect layer inside a faux avatar tile so the overlay
        // has a background to paint onto (many effects use `mix-blend: screen`
        // and look invisible on transparent backgrounds).
        const wrap = document.createElement('span');
        wrap.className = 'pa-avatar-chip-effect-wrap';
        const inner = document.createElement('span');
        inner.className = 'pa-avatar-chip-effect-sample';
        inner.setAttribute('data-effect', preset.id);
        applyEffectVars(inner, preset, draft);
        wrap.appendChild(inner);
        btn.appendChild(wrap);
        const label = document.createElement('span');
        label.className = 'pa-avatar-chip-label';
        label.textContent = preset.label;
        btn.appendChild(label);
        grid.appendChild(btn);
      }
    }

    tabContent.appendChild(grid);

    // Render tweak panel
    tweakPanel.textContent = '';
    if (activeTab === 'effect' && selectedEffectOrFrame?.type === 'effect') {
      const effectPreset = AVATAR_EFFECT_PRESETS.find(p => p.id === selectedEffectOrFrame!.id);
      if (effectPreset && effectPreset.id !== 'none') {
        const panelTitle = document.createElement('div');
        panelTitle.className = 'pa-tweak-panel-title';
        panelTitle.textContent = `Customize: ${effectPreset.label}`;
        tweakPanel.appendChild(panelTitle);

        const controlsGrid = document.createElement('div');
        controlsGrid.className = 'pa-tweak-controls-grid';

        // Color control
        if (effectPreset.defaultColor) {
          const colorGroup = document.createElement('div');
          colorGroup.className = 'pa-tweak-control-group';
          const colorLabel = document.createElement('label');
          colorLabel.textContent = 'Color';
          const colorInput = document.createElement('input');
          colorInput.type = 'color';
          colorInput.className = 'pa-tweak-color-input';
          colorInput.value = draft.avatar_effect_color || effectPreset.defaultColor;
          colorInput.addEventListener('change', (e) => {
            draft.avatar_effect_color = (e.target as HTMLInputElement).value;
            renderWorkspace();
          });
          colorGroup.append(colorLabel, colorInput);
          controlsGrid.appendChild(colorGroup);
        }

        // Intensity control
        if (effectPreset.defaultIntensity !== undefined) {
          const intensityGroup = document.createElement('div');
          intensityGroup.className = 'pa-tweak-control-group';
          const intensityLabel = document.createElement('label');
          intensityLabel.textContent = `Intensity: ${draft.avatar_effect_intensity ?? effectPreset.defaultIntensity}%`;
          intensityLabel.className = 'pa-tweak-label-with-value';
          const intensitySlider = document.createElement('input');
          intensitySlider.type = 'range';
          intensitySlider.className = 'pa-tweak-slider';
          intensitySlider.min = '0';
          intensitySlider.max = '100';
          intensitySlider.value = String(draft.avatar_effect_intensity ?? effectPreset.defaultIntensity);
          intensitySlider.addEventListener('input', (e) => {
            draft.avatar_effect_intensity = parseInt((e.target as HTMLInputElement).value);
            intensityLabel.textContent = `Intensity: ${draft.avatar_effect_intensity}%`;
            renderWorkspace();
          });
          intensityGroup.append(intensityLabel, intensitySlider);
          controlsGrid.appendChild(intensityGroup);
        }

        // Speed control
        if (effectPreset.defaultSpeed !== undefined) {
          const speedGroup = document.createElement('div');
          speedGroup.className = 'pa-tweak-control-group';
          const speedLabel = document.createElement('label');
          speedLabel.textContent = `Speed: ${(draft.avatar_effect_speed ?? effectPreset.defaultSpeed).toFixed(1)}x`;
          speedLabel.className = 'pa-tweak-label-with-value';
          const speedSlider = document.createElement('input');
          speedSlider.type = 'range';
          speedSlider.className = 'pa-tweak-slider';
          speedSlider.min = '0.5';
          speedSlider.max = '2.0';
          speedSlider.step = '0.1';
          speedSlider.value = String(draft.avatar_effect_speed ?? effectPreset.defaultSpeed);
          speedSlider.addEventListener('input', (e) => {
            draft.avatar_effect_speed = parseFloat((e.target as HTMLInputElement).value);
            speedLabel.textContent = `Speed: ${draft.avatar_effect_speed.toFixed(1)}x`;
            renderWorkspace();
          });
          speedGroup.append(speedLabel, speedSlider);
          controlsGrid.appendChild(speedGroup);
        }

        // Saturation control
        {
          const saturationGroup = document.createElement('div');
          saturationGroup.className = 'pa-tweak-control-group';
          const saturationLabel = document.createElement('label');
          saturationLabel.textContent = `Saturation: ${draft.avatar_effect_saturation ?? 100}%`;
          saturationLabel.className = 'pa-tweak-label-with-value';
          const saturationSlider = document.createElement('input');
          saturationSlider.type = 'range';
          saturationSlider.className = 'pa-tweak-slider';
          saturationSlider.min = '0';
          saturationSlider.max = '200';
          saturationSlider.value = String(draft.avatar_effect_saturation ?? 100);
          saturationSlider.addEventListener('input', (e) => {
            draft.avatar_effect_saturation = parseInt((e.target as HTMLInputElement).value);
            saturationLabel.textContent = `Saturation: ${draft.avatar_effect_saturation}%`;
            renderWorkspace();
          });
          saturationGroup.append(saturationLabel, saturationSlider);
          controlsGrid.appendChild(saturationGroup);
        }

        // Size control
        {
          const sizeGroup = document.createElement('div');
          sizeGroup.className = 'pa-tweak-control-group';
          const sizeLabel = document.createElement('label');
          sizeLabel.textContent = `Size: ${draft.avatar_effect_size ?? 100}%`;
          sizeLabel.className = 'pa-tweak-label-with-value';
          const sizeSlider = document.createElement('input');
          sizeSlider.type = 'range';
          sizeSlider.className = 'pa-tweak-slider';
          sizeSlider.min = '50';
          sizeSlider.max = '200';
          sizeSlider.value = String(draft.avatar_effect_size ?? 100);
          sizeSlider.addEventListener('input', (e) => {
            draft.avatar_effect_size = parseInt((e.target as HTMLInputElement).value);
            sizeLabel.textContent = `Size: ${draft.avatar_effect_size}%`;
            renderWorkspace();
          });
          sizeGroup.append(sizeLabel, sizeSlider);
          controlsGrid.appendChild(sizeGroup);
        }

        // Alpha / opacity control — distinct from intensity (which scales the effect visual weight).
        {
          const alphaGroup = document.createElement('div');
          alphaGroup.className = 'pa-tweak-control-group';
          const alphaLabel = document.createElement('label');
          alphaLabel.textContent = `Alpha: ${draft.avatar_effect_alpha ?? 100}%`;
          alphaLabel.className = 'pa-tweak-label-with-value';
          const alphaSlider = document.createElement('input');
          alphaSlider.type = 'range';
          alphaSlider.className = 'pa-tweak-slider';
          alphaSlider.min = '0';
          alphaSlider.max = '100';
          alphaSlider.value = String(draft.avatar_effect_alpha ?? 100);
          alphaSlider.addEventListener('input', (e) => {
            draft.avatar_effect_alpha = parseInt((e.target as HTMLInputElement).value);
            alphaLabel.textContent = `Alpha: ${draft.avatar_effect_alpha}%`;
            renderWorkspace();
          });
          alphaGroup.append(alphaLabel, alphaSlider);
          controlsGrid.appendChild(alphaGroup);
        }

        tweakPanel.appendChild(controlsGrid);
      }
    } else if (activeTab === 'frame' && selectedEffectOrFrame?.type === 'frame') {
      const framePreset = AVATAR_FRAME_PRESETS.find(p => p.id === selectedEffectOrFrame!.id);
      if (framePreset && framePreset.id !== 'none') {
        const panelTitle = document.createElement('div');
        panelTitle.className = 'pa-tweak-panel-title';
        panelTitle.textContent = `Customize: ${framePreset.label}`;
        tweakPanel.appendChild(panelTitle);

        const controlsGrid = document.createElement('div');
        controlsGrid.className = 'pa-tweak-controls-grid';

        // Frame color override — applies to color-sensitive variants (plasma, neon, radioactive, etc.).
        const colorGroup = document.createElement('div');
        colorGroup.className = 'pa-tweak-control-group';
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Frame color';
        const colorRow = document.createElement('div');
        colorRow.className = 'pa-tweak-color-row';
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'pa-tweak-color-input';
        const currentColorPreset = getAvatarColorPreset(draft.avatar_color);
        const themeAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5eaa3a';
        colorInput.value = draft.avatar_frame_color || currentColorPreset?.color || themeAccent;
        colorInput.addEventListener('input', (e) => {
          draft.avatar_frame_color = (e.target as HTMLInputElement).value;
          renderWorkspace();
        });
        const resetColor = document.createElement('button');
        resetColor.type = 'button';
        resetColor.className = 'pa-tweak-reset';
        resetColor.textContent = 'Match tint';
        resetColor.addEventListener('click', () => {
          draft.avatar_frame_color = undefined;
          renderWorkspace();
        });
        colorRow.append(colorInput, resetColor);
        colorGroup.append(colorLabel, colorRow);
        controlsGrid.appendChild(colorGroup);

        if (framePreset.isAnimated && framePreset.defaultIntensity !== undefined) {
          const intensityGroup = document.createElement('div');
          intensityGroup.className = 'pa-tweak-control-group';
          const intensityLabel = document.createElement('label');
          intensityLabel.textContent = `Animation Intensity: ${draft.avatar_frame_intensity ?? framePreset.defaultIntensity}%`;
          intensityLabel.className = 'pa-tweak-label-with-value';
          const intensitySlider = document.createElement('input');
          intensitySlider.type = 'range';
          intensitySlider.className = 'pa-tweak-slider';
          intensitySlider.min = '0';
          intensitySlider.max = '100';
          intensitySlider.value = String(draft.avatar_frame_intensity ?? framePreset.defaultIntensity);
          intensitySlider.addEventListener('input', (e) => {
            draft.avatar_frame_intensity = parseInt((e.target as HTMLInputElement).value);
            intensityLabel.textContent = `Animation Intensity: ${draft.avatar_frame_intensity}%`;
            renderWorkspace();
          });
          intensityGroup.append(intensityLabel, intensitySlider);
          controlsGrid.appendChild(intensityGroup);
        }

        tweakPanel.appendChild(controlsGrid);
      }
    } else if (activeTab === 'banner' && selectedBannerId) {
      const bannerPreset = AVATAR_BANNER_PRESETS.find(p => p.id === selectedBannerId);
      if (bannerPreset && bannerPreset.id !== 'default') {
        const panelTitle = document.createElement('div');
        panelTitle.className = 'pa-tweak-panel-title';
        panelTitle.textContent = `Customize: ${bannerPreset.label}`;
        tweakPanel.appendChild(panelTitle);

        const controlsGrid = document.createElement('div');
        controlsGrid.className = 'pa-tweak-controls-grid';

        // Opacity control
        const opacityGroup = document.createElement('div');
        opacityGroup.className = 'pa-tweak-control-group';
        const opacityLabel = document.createElement('label');
        opacityLabel.textContent = `Opacity: ${draft.avatar_banner_opacity ?? 80}%`;
        opacityLabel.className = 'pa-tweak-label-with-value';
        const opacitySlider = document.createElement('input');
        opacitySlider.type = 'range';
        opacitySlider.className = 'pa-tweak-slider';
        opacitySlider.min = '10';
        opacitySlider.max = '100';
        opacitySlider.value = String(draft.avatar_banner_opacity ?? 80);
        opacitySlider.addEventListener('input', (e) => {
          draft.avatar_banner_opacity = parseInt((e.target as HTMLInputElement).value);
          opacityLabel.textContent = `Opacity: ${draft.avatar_banner_opacity}%`;
          renderWorkspace();
        });
        opacityGroup.append(opacityLabel, opacitySlider);
        controlsGrid.appendChild(opacityGroup);

        // Speed control — only for animated banners
        if (bannerPreset.isAnimated) {
          const speedGroup = document.createElement('div');
          speedGroup.className = 'pa-tweak-control-group';
          const speedLabel = document.createElement('label');
          speedLabel.textContent = `Speed: ${(draft.avatar_banner_speed ?? 1.0).toFixed(1)}x`;
          speedLabel.className = 'pa-tweak-label-with-value';
          const speedSlider = document.createElement('input');
          speedSlider.type = 'range';
          speedSlider.className = 'pa-tweak-slider';
          speedSlider.min = '0.3';
          speedSlider.max = '3.0';
          speedSlider.step = '0.1';
          speedSlider.value = String(draft.avatar_banner_speed ?? 1.0);
          speedSlider.addEventListener('input', (e) => {
            draft.avatar_banner_speed = parseFloat((e.target as HTMLInputElement).value);
            speedLabel.textContent = `Speed: ${draft.avatar_banner_speed.toFixed(1)}x`;
            renderWorkspace();
          });
          speedGroup.append(speedLabel, speedSlider);
          controlsGrid.appendChild(speedGroup);
        }

        tweakPanel.appendChild(controlsGrid);
      }
    }
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
      const updated = await apiUpdateUserCosmetics(profile.publisher_id, draft);
      if (!updated) {
        // API returned null — the server didn't persist the changes.
        // Surface the error so the user knows to retry.
        throw new Error('Server returned no data');
      }
      onSaved({ ...profile, ...updated } as UserProfile);
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
