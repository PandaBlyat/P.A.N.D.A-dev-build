import type { FactionId } from './types';

/**
 * Base faction colours (hex). Used as the primary accent for each faction.
 * All colours are chosen to work well on dark backgrounds (#10141a).
 */
export const FACTION_COLORS: Record<FactionId, string> = {
  stalker: '#ffd700',   // gold
  dolg: '#ff4040',      // bright red
  freedom: '#40c840',   // fresh green
  csky: '#87ceeb',      // sky blue (Clear Sky)
  ecolog: '#e6e600',    // amber‑yellow (softer than pure #ffff40)
  killer: '#8080c8',    // muted purple‑blue (Mercenaries)
  army: '#406440',      // military green
  bandit: '#b87c4f',    // dirty brown (was grey, now distinctive)
  monolith: '#ffffff',  // white
  zombied: '#808080',   // grey
  isg: '#6496c8',       // steel blue (UNISG)
  renegade: '#c89664',  // orange‑brown
  greh: '#c8a478',      // light tan (custom faction)
};

/**
 * Theme variables derived from a faction's base colour.
 * All fields are guaranteed to exist, even for unknown factions (fallback to 'stalker').
 */
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
  // Additional (non‑breaking) variables – safe to use in UI without affecting existing code
  accentText: string;       // black or white, whichever contrasts best with accent
  borderColor: string;      // accent mixed with 30% dark background
  shadowColor: string;      // accent with 20% opacity
};

/**
 * Converts a hex colour to linear RGB (gamma = 2.2) for perceptually uniform mixing.
 */
function linearize(c: number): number {
  const normalized = c / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Converts linear RGB back to gamma‑encoded sRGB.
 */
function delinearize(v: number): number {
  const clamped = Math.max(0, Math.min(1, v));
  const result = clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(result * 255);
}

/**
 * Mixes two hex colours in linear RGB space for visually smoother transitions.
 * @param color - starting colour (hex)
 * @param target - target colour (hex)
 * @param amount - blend factor (0 = color, 1 = target)
 */
function mixHex(color: string, target: string, amount: number): string {
  const from = parseHex(color);
  const to = parseHex(target);

  const linFrom = [linearize(from.r), linearize(from.g), linearize(from.b)];
  const linTo = [linearize(to.r), linearize(to.g), linearize(to.b)];

  const mixedLin = linFrom.map((ch, i) => ch + (linTo[i] - ch) * amount);
  const mixedRgb = mixedLin.map(delinearize);

  return toHex({ r: mixedRgb[0], g: mixedRgb[1], b: mixedRgb[2] });
}

/**
 * Computes the perceived luminance of a colour (WCAG relative luminance).
 * Used to pick black or white text for best contrast.
 */
function getLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const rsrgb = r / 255;
  const gsrgb = g / 255;
  const bsrgb = b / 255;
  const linear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linear(rsrgb) + 0.7152 * linear(gsrgb) + 0.0722 * linear(bsrgb);
}

/**
 * Returns black (#000000) or white (#ffffff) depending on which gives higher contrast.
 */
function getContrastText(hex: string): string {
  const luminance = getLuminance(hex);
  // Standard WCAG threshold: light text on dark if luminance < 0.5
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Converts a hex colour to rgba() string.
 */
function toRgba(color: string, alpha: number): string {
  const { r, g, b } = parseHex(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Parses a hex colour (#rgb, #rrggbb) into RGB components.
 * Throws a clear error for invalid formats.
 */
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

/**
 * Converts RGB components back to a hex string.
 */
function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Generates a complete set of theme variables for a given faction.
 * If the faction is not found in FACTION_COLORS, defaults to 'stalker'.
 */
export function getFactionThemeVariables(faction: FactionId): FactionThemeVariables {
  // Fallback for unknown factions (e.g. custom mod factions)
  const accent = FACTION_COLORS[faction] ?? FACTION_COLORS.stalker;

  const darkBg = '#10141a';
  const white = '#ffffff';

  const accentHover = mixHex(accent, white, 0.14);
  const accentDim = mixHex(accent, darkBg, 0.52);
  const bgSelected = mixHex(accent, darkBg, 0.2);
  const bgSelectedBorder = mixHex(accent, darkBg, 0.42);
  const edgeColor = mixHex(accent, darkBg, 0.38);
  const borderColor = mixHex(accent, darkBg, 0.3);
  const shadowColor = toRgba(accent, 0.2);
  const accentText = getContrastText(accent);

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
    // New fields (safe to add)
    accentText,
    borderColor,
    shadowColor,
  };
}
