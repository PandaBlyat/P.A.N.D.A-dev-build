// P.A.N.D.A. — Avatar customization catalog.
//
// Defines the presets a user can choose from when customizing their dossier
// avatar. Presets are stored as short string IDs on the user_profiles row
// (avatar_icon, avatar_color, avatar_frame, avatar_banner, avatar_effect).

export type AvatarIconPreset = {
  id: string;
  label: string;
  /** Unicode glyph rendered inside the avatar circle. */
  glyph: string;
  /** Rough category label, shown as a small heading in the picker. */
  category: 'default' | 'faction' | 'ranks' | 'gear' | 'zone' | 'mystic' | 'legend';
  /** Optional lock: only unlocked for users at or above this level. */
  minLevel?: number;
};

export type AvatarColorPreset = {
  id: string;
  label: string;
  /** Primary ring / tint color. */
  color: string;
  /** Optional lock: only unlocked for users at or above this level. */
  minLevel?: number;
};

export type AvatarFramePreset = {
  id: string;
  label: string;
  /** Optional lock: only unlocked for users at or above this level. */
  minLevel?: number;
  /** Triggers the rotating spin animation in CSS */
  isAnimated?: boolean;
  /** Visual variant id consumed by CSS (maps to .pa-avatar-frame-${variant}). */
  variant: 'none' | 'hex' | 'runic' | 'halo' | 'monolith' | 'radioactive' | 'cyber' | 'plasma' | 'blood' | 'void' | 'legend';
};

export type AvatarBannerPreset = {
  id: string;
  label: string;
  /** Gradient or color used behind the hero header. */
  gradient: string;
  /** Optional lock: only unlocked for users at or above this level. */
  minLevel?: number;
  /** Triggers the slow background panning animation in CSS */
  isAnimated?: boolean;
};

export type AvatarEffectPreset = {
  id: string;
  label: string;
  /** Optional lock: only unlocked for users at or above this level. */
  minLevel?: number;
};

// ---------------------------------------------------------------------------
// 1. ICONS (Massively Expanded)
// ---------------------------------------------------------------------------
export const AVATAR_ICON_PRESETS: AvatarIconPreset[] = [
  // Default / Starter
  { id: 'default',   label: 'Initial',        glyph: '',   category: 'default' },
  { id: 'panda',     label: 'Panda',          glyph: '🐼', category: 'default' },
  { id: 'stalker',   label: 'Stalker',        glyph: '🕶', category: 'default' },
  
  // Gear
  { id: 'helmet',    label: 'Exoskeleton',    glyph: '⛑', category: 'gear' },
  { id: 'shield',    label: 'Guardian',       glyph: '🛡', category: 'gear' },
  { id: 'compass',   label: 'Pathfinder',     glyph: '🧭', category: 'gear' },
  { id: 'map',       label: 'Cartographer',   glyph: '🗺', category: 'gear' },
  { id: 'lamp',      label: 'Nightwatch',     glyph: '🔦', category: 'gear', minLevel: 5 },
  { id: 'gasmask',   label: 'Respirator',     glyph: '🤿', category: 'gear', minLevel: 10 },
  { id: 'crosshair', label: 'Sniper',         glyph: '⌖', category: 'gear', minLevel: 15 },
  
  // Faction / Flora & Fauna
  { id: 'wolf',      label: 'Wolf',           glyph: '🐺', category: 'faction' },
  { id: 'bear',      label: 'Bear',           glyph: '🐻', category: 'faction' },
  { id: 'radio',     label: 'Operator',       glyph: '📡', category: 'faction' },
  { id: 'quill',     label: 'Scribe',         glyph: '✒', category: 'faction' },
  { id: 'spider',    label: 'Arachnid',       glyph: '🕷', category: 'faction', minLevel: 10 },
  { id: 'scorpion',  label: 'Stinger',        glyph: '🦂', category: 'faction', minLevel: 15 },
  { id: 'bat',       label: 'Nocturnal',      glyph: '🦇', category: 'faction', minLevel: 20 },
  { id: 'dragon',    label: 'Chimera',        glyph: '🐉', category: 'faction', minLevel: 35 },
  
  // Ranks
  { id: 'star',      label: 'Star',           glyph: '⭐', category: 'ranks' },
  { id: 'medal',     label: 'Medalist',       glyph: '🎖', category: 'ranks', minLevel: 5 },
  { id: 'trophy',    label: 'Trophy',         glyph: '🏆', category: 'ranks', minLevel: 10 },
  { id: 'skull',     label: 'Veteran',        glyph: '💀', category: 'ranks', minLevel: 20 },
  { id: 'swords',    label: 'Gladiator',      glyph: '⚔', category: 'ranks', minLevel: 30 },
  { id: 'crown',     label: 'Champion',       glyph: '👑', category: 'ranks', minLevel: 40 },
  
  // The Zone / Elements
  { id: 'flame',     label: 'Ember',          glyph: '🔥', category: 'zone' },
  { id: 'atom',      label: 'Radiant',        glyph: '☢', category: 'zone', minLevel: 5 },
  { id: 'bio',       label: 'Biohazard',      glyph: '☣', category: 'zone', minLevel: 10 },
  { id: 'blood',     label: 'Lifeblood',      glyph: '🩸', category: 'zone', minLevel: 25 },
  { id: 'tornado',   label: 'Vortex',         glyph: '🌪', category: 'zone', minLevel: 30 },
  { id: 'meteor',    label: 'Impact',         glyph: '☄', category: 'zone', minLevel: 45 },
  
  // Mystic / Anomalous
  { id: 'crystal',   label: 'Artefact',       glyph: '🔮', category: 'mystic' },
  { id: 'eye',       label: 'All-seeing',     glyph: '👁', category: 'mystic', minLevel: 8 },
  { id: 'ghost',     label: 'Specter',        glyph: '👻', category: 'mystic', minLevel: 12 },
  { id: 'lightning', label: 'Anomaly',        glyph: '⚡', category: 'mystic', minLevel: 18 },
  { id: 'alien',     label: 'Controller',     glyph: '👽', category: 'mystic', minLevel: 25 },
  { id: 'demon',     label: 'Burer',          glyph: '👹', category: 'mystic', minLevel: 35 },
  
  // Legends (High Tier)
  { id: 'galaxy',    label: 'The Void',       glyph: '🌌', category: 'legend', minLevel: 40 },
  { id: 'hamsa',     label: 'Oasis',          glyph: '🪬', category: 'legend', minLevel: 45 },
  { id: 'trident',   label: 'Warlord',        glyph: '🔱', category: 'legend', minLevel: 50 },
];

// ---------------------------------------------------------------------------
// 2. COLORS / TINTS
// ---------------------------------------------------------------------------
export const AVATAR_COLOR_PRESETS: AvatarColorPreset[] = [
  // Basic
  { id: 'loner',       label: 'Loner Green',     color: '#5eaa3a' },
  { id: 'clearsky',    label: 'Clear Sky',       color: '#3aaa8a' },
  { id: 'freedom',     label: 'Freedom',         color: '#8fd46a' },
  { id: 'duty',        label: 'Duty',            color: '#d87861' },
  { id: 'bandit',      label: 'Bandit',          color: '#7d6a52' },
  { id: 'mercenary',   label: 'Mercenary',       color: '#6fa1d4' },
  { id: 'ecologist',   label: 'Ecologist',       color: '#7fb2e8' },
  { id: 'military',    label: 'Military',        color: '#a0a03a' },
  
  // Level 10+
  { id: 'steel',       label: 'Zone Steel',      color: '#a0a8b8', minLevel: 10 },
  { id: 'bronze',      label: 'Dusk Bronze',     color: '#b87333', minLevel: 10 },
  { id: 'ocean',       label: 'Deep Ocean',      color: '#0ea5e9', minLevel: 15 },
  
  // Level 20+
  { id: 'renegade',    label: 'Renegade',        color: '#b85a8c', minLevel: 20 },
  { id: 'crimson',     label: 'Crimson Ember',   color: '#e05555', minLevel: 20 },
  { id: 'toxic',       label: 'Toxic Yellow',    color: '#eab308', minLevel: 25 },
  
  // Level 30+
  { id: 'neon-violet', label: 'Anomaly Violet',  color: '#a855f7', minLevel: 30 },
  { id: 'cyan',        label: 'Clear Signal',    color: '#22d3ee', minLevel: 30 },
  { id: 'blood',       label: 'Fresh Blood',     color: '#991b1b', minLevel: 35 },
  
  // Level 40+
  { id: 'monolith',    label: 'Monolith Gold',   color: '#c4a040', minLevel: 40 },
  { id: 'abyss',       label: 'Abyssal Blue',    color: '#1e3a8a', minLevel: 45 },
  
  // Level 50+
  { id: 'radioactive', label: 'Reactor Green',   color: '#39ff14', minLevel: 50 },
  { id: 'platinum',    label: 'True Platinum',   color: '#f3f4f6', minLevel: 50 },
];

// ---------------------------------------------------------------------------
// 3. FRAMES
// ---------------------------------------------------------------------------
export const AVATAR_FRAME_PRESETS: AvatarFramePreset[] = [
  { id: 'none',        label: 'No frame',         variant: 'none' },
  { id: 'hex',         label: 'Hex plating',      variant: 'hex' },
  { id: 'runic',       label: 'Runic ring',       variant: 'runic', minLevel: 5 },
  { id: 'halo',        label: 'Halo',             variant: 'halo',  minLevel: 10 },
  { id: 'radioactive', label: 'Radioactive',      variant: 'radioactive', minLevel: 15, isAnimated: true },
  
  // High-Tier Frames
  { id: 'cyber',       label: 'Cyber-Link',       variant: 'cyber',  minLevel: 20 },
  { id: 'plasma',      label: 'Plasma Coil',      variant: 'plasma', minLevel: 25, isAnimated: true },
  { id: 'blood',       label: 'Blood Pact',       variant: 'blood',  minLevel: 30 },
  { id: 'monolith',    label: 'Monolith Crown',   variant: 'monolith', minLevel: 35, isAnimated: true },
  { id: 'void',        label: 'Void Singularity', variant: 'void',   minLevel: 45, isAnimated: true },
  { id: 'legend',      label: 'Living Legend',    variant: 'legend', minLevel: 50, isAnimated: true },
];

// ---------------------------------------------------------------------------
// 4. BANNERS
// ---------------------------------------------------------------------------
export const AVATAR_BANNER_PRESETS: AvatarBannerPreset[] = [
  {
    id: 'default', label: 'Standard',
    gradient: 'linear-gradient(115deg, color-mix(in srgb, var(--accent) 16%, transparent), transparent 48%), color-mix(in srgb, var(--bg-card) 88%, transparent)',
  },
  {
    id: 'zone-dawn', label: 'Zone Dawn',
    gradient: 'linear-gradient(120deg, rgba(94,170,58,0.22), rgba(212,163,75,0.12) 55%, rgba(0,0,0,0) 82%)',
  },
  {
    id: 'duty', label: 'Duty Iron',
    gradient: 'linear-gradient(118deg, rgba(216,120,97,0.22), rgba(55,62,78,0.22) 55%, rgba(0,0,0,0) 84%)',
  },
  {
    id: 'freedom', label: 'Freedom Sun',
    gradient: 'linear-gradient(120deg, rgba(143,212,106,0.28), rgba(212,163,75,0.14) 52%, rgba(0,0,0,0) 82%)',
  },
  
  // Level Gated
  {
    id: 'deep-water', label: 'Deep Water', minLevel: 10,
    gradient: 'linear-gradient(120deg, rgba(14,165,233,0.25), rgba(30,58,138,0.2) 60%, transparent 85%)',
  },
  {
    id: 'radiation', label: 'Radiation', minLevel: 15, isAnimated: true,
    gradient: 'linear-gradient(125deg, rgba(196,160,64,0.28), rgba(94,170,58,0.12) 52%, rgba(0,0,0,0) 82%)',
  },
  {
    id: 'nightshift', label: 'Night Shift', minLevel: 20, isAnimated: true,
    gradient: 'linear-gradient(120deg, rgba(34,211,238,0.22), rgba(94,170,58,0.10) 52%, rgba(0,0,0,0) 86%)',
  },
  {
    id: 'crimson', label: 'Crimson Storm', minLevel: 25,
    gradient: 'linear-gradient(120deg, rgba(224,85,85,0.28), rgba(153,27,27,0.2) 60%, rgba(0,0,0,0) 84%)',
  },
  {
    id: 'inferno', label: 'Inferno', minLevel: 30, isAnimated: true,
    gradient: 'linear-gradient(110deg, rgba(234,179,8,0.25), rgba(224,85,85,0.25) 45%, rgba(0,0,0,0) 80%)',
  },
  {
    id: 'cyberpunk', label: 'Neon City', minLevel: 35, isAnimated: true,
    gradient: 'linear-gradient(130deg, rgba(244,114,182,0.25), rgba(34,211,238,0.2) 50%, rgba(0,0,0,0) 85%)',
  },
  {
    id: 'monolith', label: 'Monolith', minLevel: 40, isAnimated: true,
    gradient: 'linear-gradient(120deg, rgba(168,85,247,0.25), rgba(94,170,58,0.15) 55%, rgba(0,0,0,0) 82%)',
  },
  {
    id: 'abyss', label: 'The Abyss', minLevel: 45, isAnimated: true,
    gradient: 'radial-gradient(circle at 0% 50%, rgba(30,58,138,0.4), rgba(76,29,149,0.2) 60%, transparent 100%)',
  },
  {
    id: 'golden-era', label: 'Golden Era', minLevel: 50, isAnimated: true,
    gradient: 'linear-gradient(115deg, rgba(251,191,36,0.3), rgba(243,244,246,0.15) 50%, transparent 80%)',
  },
];

// ---------------------------------------------------------------------------
// 5. VFX OVERLAYS
// ---------------------------------------------------------------------------
export const AVATAR_EFFECT_PRESETS: AvatarEffectPreset[] = [
  { id: 'none',       label: 'Clear' },
  { id: 'scanlines',  label: 'Term/Link',   minLevel: 5 },
  { id: 'spores',     label: 'Irradiated',  minLevel: 10 },
  { id: 'rain',       label: 'Acid Rain',   minLevel: 15 },
  { id: 'embers',     label: 'Ash & Ember', minLevel: 25 },
  { id: 'glitch',     label: 'Psy-Storm',   minLevel: 30 },
  { id: 'matrix',     label: 'Data-Stream', minLevel: 40 },
  { id: 'wisps',      label: 'Void Wisps',  minLevel: 45 },
  { id: 'overcharge', label: 'Overcharge',  minLevel: 50 },
];

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------
export function getAvatarIconPreset(id: string | null | undefined): AvatarIconPreset | null {
  if (!id) return null;
  return AVATAR_ICON_PRESETS.find(preset => preset.id === id) ?? null;
}
export function getAvatarColorPreset(id: string | null | undefined): AvatarColorPreset | null {
  if (!id) return null;
  return AVATAR_COLOR_PRESETS.find(preset => preset.id === id) ?? null;
}
export function getAvatarFramePreset(id: string | null | undefined): AvatarFramePreset | null {
  if (!id) return null;
  return AVATAR_FRAME_PRESETS.find(preset => preset.id === id) ?? null;
}
export function getAvatarBannerPreset(id: string | null | undefined): AvatarBannerPreset | null {
  if (!id) return null;
  return AVATAR_BANNER_PRESETS.find(preset => preset.id === id) ?? null;
}

export function resolveAvatarColor(avatarColor: string | null | undefined, levelFallbackColor: string): string {
  const preset = getAvatarColorPreset(avatarColor);
  return preset ? preset.color : levelFallbackColor;
}
export function resolveAvatarGlyph(avatarIcon: string | null | undefined): string {
  const preset = getAvatarIconPreset(avatarIcon);
  if (!preset || preset.id === 'default') return '';
  return preset.glyph;
}
