import type { FactionId } from './types';

type FactionPalette = {
  accent: string;
  accentHover: string;
  accentDim: string;
  bgSelected: string;
  bgSelectedBorder: string;
  edgeColor: string;
};

const FACTION_PALETTES: Record<FactionId, FactionPalette> = {
  stalker: { accent: '#d6ad3f', accentHover: '#f0cf70', accentDim: '#76612b', bgSelected: '#2a2515', bgSelectedBorder: '#8a7430', edgeColor: '#b89135' },
  dolg: { accent: '#c65a4c', accentHover: '#e57968', accentDim: '#6b302c', bgSelected: '#2a1716', bgSelectedBorder: '#874038', edgeColor: '#b94f43' },
  freedom: { accent: '#69a85a', accentHover: '#86c774', accentDim: '#385f34', bgSelected: '#1b2718', bgSelectedBorder: '#527d45', edgeColor: '#5f984f' },
  csky: { accent: '#70b7d7', accentHover: '#9ad6ee', accentDim: '#345e73', bgSelected: '#14232d', bgSelectedBorder: '#4f88a4', edgeColor: '#67a9c8' },
  ecolog: { accent: '#d9c84a', accentHover: '#f0df72', accentDim: '#716a2d', bgSelected: '#282714', bgSelectedBorder: '#8d8134', edgeColor: '#c8b943' },
  killer: { accent: '#7e90d6', accentHover: '#a2b0f1', accentDim: '#404a76', bgSelected: '#191d2c', bgSelectedBorder: '#5b68a2', edgeColor: '#7484c6' },
  army: { accent: '#7f8c4d', accentHover: '#a0ad67', accentDim: '#464d2d', bgSelected: '#202315', bgSelectedBorder: '#66713d', edgeColor: '#758246' },
  bandit: { accent: '#b47a46', accentHover: '#d7995f', accentDim: '#654326', bgSelected: '#2a1d13', bgSelectedBorder: '#875b34', edgeColor: '#a76f3f' },
  monolith: { accent: '#e7e8ea', accentHover: '#ffffff', accentDim: '#83878c', bgSelected: '#242629', bgSelectedBorder: '#a7abb0', edgeColor: '#d5d8dc' },
  zombied: { accent: '#8d9588', accentHover: '#b0b8aa', accentDim: '#4d534b', bgSelected: '#1f221d', bgSelectedBorder: '#6b7366', edgeColor: '#818a7c' },
  isg: { accent: '#69a6d0', accentHover: '#8fc9ec', accentDim: '#385b72', bgSelected: '#13222d', bgSelectedBorder: '#4c7d9f', edgeColor: '#6098bf' },
  renegade: { accent: '#c2844f', accentHover: '#dda068', accentDim: '#6a4a2f', bgSelected: '#2b2015', bgSelectedBorder: '#91633c', edgeColor: '#b67a49' },
  greh: { accent: '#b8946d', accentHover: '#d3b083', accentDim: '#63513d', bgSelected: '#282119', bgSelectedBorder: '#876d51', edgeColor: '#aa8964' },
};

export const FACTION_COLORS: Record<FactionId, string> = Object.fromEntries(
  Object.entries(FACTION_PALETTES).map(([faction, palette]) => [faction, palette.accent]),
) as Record<FactionId, string>;

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
  accentText: string;
  borderColor: string;
  shadowColor: string;
};

function linearize(c: number): number {
  const normalized = c / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function delinearize(v: number): number {
  const clamped = Math.max(0, Math.min(1, v));
  const result = clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(result * 255);
}

function mixHex(color: string, target: string, amount: number): string {
  const from = parseHex(color);
  const to = parseHex(target);
  const linFrom = [linearize(from.r), linearize(from.g), linearize(from.b)];
  const linTo = [linearize(to.r), linearize(to.g), linearize(to.b)];
  const mixedLin = linFrom.map((ch, i) => ch + (linTo[i] - ch) * amount);
  const mixedRgb = mixedLin.map(delinearize);
  return toHex({ r: mixedRgb[0], g: mixedRgb[1], b: mixedRgb[2] });
}

function getLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const linear = (c: number) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function getContrastText(hex: string): string {
  return getLuminance(hex) > 0.5 ? '#000000' : '#ffffff';
}

function toRgba(color: string, alpha: number): string {
  const { r, g, b } = parseHex(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseHex(color: string): { r: number; g: number; b: number } {
  const normalized = color.trim().replace(/^#/, '');
  let hex = normalized;
  if (normalized.length === 3) {
    hex = normalized.split('').map(ch => ch + ch).join('');
  }
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`Invalid hex colour: "${color}". Expected #rgb or #rrggbb.`);
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

export function getFactionThemeVariables(faction: FactionId): FactionThemeVariables {
  const palette = FACTION_PALETTES[faction] ?? FACTION_PALETTES.stalker;
  const accent = palette.accent;
  const darkBg = '#10141a';

  return {
    accent,
    accentHover: palette.accentHover,
    accentDim: palette.accentDim,
    accentGlow: toRgba(accent, 0.16),
    accentGlowStrong: toRgba(accent, 0.34),
    bgSelected: palette.bgSelected,
    bgSelectedBorder: palette.bgSelectedBorder,
    edgeColor: palette.edgeColor,
    focusRing: `0 0 0 2px rgba(8, 10, 12, 0.95), 0 0 0 4px ${toRgba(accent, 0.72)}, 0 0 18px ${toRgba(accent, 0.3)}`,
    accentText: getContrastText(accent),
    borderColor: mixHex(accent, darkBg, 0.3),
    shadowColor: toRgba(accent, 0.2),
  };
}
