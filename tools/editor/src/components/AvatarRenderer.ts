// P.A.N.D.A. — Shared avatar rendering.
//
// Small helpers that turn a publisher's cosmetic fields (from UserProfile or
// LeaderboardEntry) into a consistent visual across the toolbar badge, profile
// popover, public profile hero, and leaderboard rows.

import type { UserCosmetics } from '../lib/api-client';
import {
  getAvatarColorPreset,
  getAvatarIconPreset,
  getAvatarFramePreset,
  getAvatarBannerPreset,
  getAvatarEffectPreset,
} from '../lib/avatar-catalog';

export type AvatarRenderInput = {
  username: string;
  level: number;
  /** Fallback hex color used when no cosmetic color is set. */
  fallbackColor: string;
} & UserCosmetics;

export type AvatarRenderOptions = {
  /** Extra CSS class on the avatar circle (e.g. 'panda-leaderboard-avatar'). */
  extraClass?: string;
  /** Render the little level chip in the corner. */
  showLevel?: boolean;
  /** Size variant (controls inner glyph sizing). */
  size?: 'sm' | 'md' | 'lg';
  /** Attach a click handler — the avatar becomes keyboard-focusable. */
  onClick?: (event: MouseEvent) => void;
  /** Tooltip text. */
  title?: string;
};

export function getUserInitial(username: string): string {
  return (username ?? '').trim().charAt(0).toUpperCase() || '?';
}

/**
 * Render the avatar as a self-contained element. Supports cosmetics: tint
 * color, frame variant, and optional glyph override. Falls back gracefully
 * when cosmetic fields are unset / unknown.
 */
export function renderAvatar(input: AvatarRenderInput, options: AvatarRenderOptions = {}): HTMLElement {
  const { size = 'md', showLevel = false } = options;
  const colorPreset = getAvatarColorPreset(input.avatar_color);
  const framePreset = getAvatarFramePreset(input.avatar_frame);
  const iconPreset = getAvatarIconPreset(input.avatar_icon);

  const color = colorPreset?.color ?? input.fallbackColor;
  const frameVariant = framePreset?.variant ?? 'none';

  const tag = options.onClick ? 'button' : 'span';
  const el = document.createElement(tag) as HTMLElement;
  el.className = [
    'pa-avatar',
    `pa-avatar-${size}`,
    `pa-avatar-frame-${frameVariant}`,
    framePreset?.isAnimated ? 'pa-anim-frame' : '',
    options.extraClass ?? '',
  ].filter(Boolean).join(' ');
  el.style.setProperty('--pa-avatar-color', color);
  if (input.avatar_frame_color) {
    el.style.setProperty('--pa-frame-color', input.avatar_frame_color);
  }
  if (framePreset?.isAnimated) {
    const intensity = (input.avatar_frame_intensity ?? framePreset.defaultIntensity ?? 85) / 100;
    el.style.setProperty('--pa-frame-intensity', String(intensity));
  }
  if (options.title) el.title = options.title;

  if (options.onClick) {
    (el as HTMLButtonElement).type = 'button';
    el.setAttribute('aria-label', options.title || `${input.username} avatar`);
    el.addEventListener('click', options.onClick);
  }

  const glyph = document.createElement('span');
  glyph.className = 'pa-avatar-glyph';
  if (iconPreset && iconPreset.id !== 'default') {
    glyph.textContent = iconPreset.glyph;
    glyph.classList.add('pa-avatar-glyph-emoji');
  } else {
    glyph.textContent = getUserInitial(input.username);
  }
  el.appendChild(glyph);

  if (showLevel) {
    const levelBadge = document.createElement('span');
    levelBadge.className = 'pa-avatar-level-chip';
    levelBadge.textContent = `Lv.${input.level}`;
    el.appendChild(levelBadge);
  }

  // Animated frame ornament slot — CSS hooks into these for certain frames.
  const ornament = document.createElement('span');
  ornament.className = 'pa-avatar-ornament';
  ornament.setAttribute('aria-hidden', 'true');
  el.appendChild(ornament);

  // VFX layer — gives the toolbar badge / profile popover the same look as
  // the modal preview, leaderboard row, and public profile hero.
  if (input.avatar_effect && input.avatar_effect !== 'none') {
    const effectPreset = getAvatarEffectPreset(input.avatar_effect);
    if (effectPreset) {
      const effect = document.createElement('span');
      effect.className = 'pa-avatar-chip-effect-sample pa-avatar-effect-layer';
      effect.setAttribute('aria-hidden', 'true');
      effect.dataset.effect = input.avatar_effect;
      effect.style.setProperty('--pa-effect-color', input.avatar_effect_color || effectPreset.defaultColor || 'var(--accent)');
      effect.style.setProperty('--pa-effect-intensity', String((input.avatar_effect_intensity ?? effectPreset.defaultIntensity ?? 75) / 100));
      effect.style.setProperty('--pa-effect-speed', String(input.avatar_effect_speed ?? effectPreset.defaultSpeed ?? 1.0));
      effect.style.setProperty('--pa-effect-saturation', String((input.avatar_effect_saturation ?? 100) / 100));
      effect.style.setProperty('--pa-effect-size', String((input.avatar_effect_size ?? 100) / 100));
      effect.style.setProperty('--pa-effect-alpha', String((input.avatar_effect_alpha ?? 100) / 100));
      el.appendChild(effect);
    }
  }

  return el;
}

/**
 * Produce a CSS `background` value for the hero banner based on the user's
 * chosen banner preset, or null to keep the original default.
 *
 * A neutral dark base is layered beneath the (usually semi-transparent) gradient
 * so the main theme accent colour doesn't bleed through custom banners.
 */
export function getBannerBackground(avatarBanner: string | null | undefined): string | null {
  const preset = getAvatarBannerPreset(avatarBanner);
  if (!preset || preset.id === 'default') return null;
  // Layer gradient over a near-opaque dark base to prevent theme-accent bleed.
  const base = 'color-mix(in srgb, var(--bg-card, #1a2030) 97%, transparent)';
  return `${preset.gradient}, ${base}`;
}
