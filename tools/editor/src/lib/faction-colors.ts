import type { FactionId } from './types';

export const FACTION_COLORS: Record<FactionId, string> = {
  stalker: '#ffd700',
  dolg: '#ff4040',
  freedom: '#40c840',
  csky: '#87ceeb',
  ecolog: '#ffff40',
  killer: '#8080c8',
  army: '#406440',
  bandit: '#a0a0a0',
  monolith: '#ffffff',
  zombied: '#808080',
  isg: '#6496c8',
  renegade: '#c89664',
  greh: '#c8a478',
};

export type FactionThemeVariables = {
  accent: string;
  accentHover: string;
  accentDim: string;
  accentGlow: string;
  accentGlowStrong: string;
  bgSelected: string;
  bgSelectedBorder: string;
  edgeColor: string;
  focusRing: string;
};

export function getFactionThemeVariables(faction: FactionId): FactionThemeVariables {
  const accent = FACTION_COLORS[faction];
  const accentHover = mixHex(accent, '#ffffff', 0.14);
  const accentDim = mixHex(accent, '#10141a', 0.52);
  const bgSelected = mixHex(accent, '#10141a', 0.2);
  const bgSelectedBorder = mixHex(accent, '#10141a', 0.42);
  const edgeColor = mixHex(accent, '#10141a', 0.38);

  return {
    accent,
    accentHover,
    accentDim,
    accentGlow: toRgba(accent, 0.16),
    accentGlowStrong: toRgba(accent, 0.34),
    bgSelected,
    bgSelectedBorder,
    edgeColor,
    focusRing: `0 0 0 2px rgba(8, 10, 12, 0.95), 0 0 0 4px ${toRgba(accent, 0.72)}, 0 0 18px ${toRgba(accent, 0.3)}`,
  };
}

function mixHex(color: string, target: string, amount: number): string {
  const fromRgb = parseHex(color);
  const toRgb = parseHex(target);
  const mix = (from: number, to: number) => Math.round(from + (to - from) * amount);
  return toHex({
    r: mix(fromRgb.r, toRgb.r),
    g: mix(fromRgb.g, toRgb.g),
    b: mix(fromRgb.b, toRgb.b),
  });
}

function toRgba(color: string, alpha: number): string {
  const { r, g, b } = parseHex(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseHex(color: string): { r: number; g: number; b: number } {
  const normalized = color.trim().replace(/^#/, '');
  const hex = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized;

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Unsupported color value: ${color}`);
  }

  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b]
    .map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0'))
    .join('')}`;
}
