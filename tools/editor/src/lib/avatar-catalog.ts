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
  category: 'default' | 'faction' | 'ranks' | 'gear' | 'zone' | 'mystic';
};

export type AvatarColorPreset = {
  id: string;
  label: string;
  /** Primary ring / tint color. */
  color: string;
};

export type AvatarFramePreset = {
  id: string;
  label: string;
  /** Optional lock: only unlocked for users at or above this level. */
  minLevel?: number;
  /** Triggers the rotating spin animation in CSS */
  isAnimated?: boolean;
  /** Visual variant id consumed by CSS (maps to .pa-avatar-frame-${variant}). */
  variant: 'none' | 'hex' | 'runic' | 'halo' | 'monolith' | 'radioactive';
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

export const AVATAR_ICON_PRESETS: AvatarIconPreset[] = [
  { id: 'default',   label: 'Initial',        glyph: '',   category: 'default' },
  { id: 'panda',     label: 'Panda',          glyph: '🐼', category: 'default' },
  { id: 'stalker',   label: 'Stalker',        glyph: '🕶', category: 'default' },
  { id: 'skull',     label: 'Zone Veteran',   glyph: '💀', category: 'ranks' },
  { id: 'crown',     label: 'Champion',       glyph: '👑', category: 'ranks' },
  { id: 'medal',     label: 'Medalist',       glyph: '🎖', category: 'ranks' },
  { id: 'trophy',    label: 'Trophy',         glyph: '🏆', category: 'ranks' },
  { id: 'star',      label: 'Star',           glyph: '⭐', category: 'ranks' },
  { id: 'flame',     label: 'Ember',          glyph: '🔥', category: 'zone' },
  { id: 'atom',      label: 'Radiant',        glyph: '☢', category: 'zone' },
  { id: 'bio',       label: 'Biohazard',      glyph: '☣', category: 'zone' },
  { id: 'helmet',    label: 'Exoskeleton',    glyph: '⛑', category: 'gear' },
  { id: 'shield',    label: 'Guardian',       glyph: '🛡', category: 'gear' },
  { id: 'compass',   label: 'Pathfinder',     glyph: '🧭', category: 'gear' },
  { id: 'map',       label: 'Cartographer',   glyph: '🗺', category: 'gear' },
  { id: 'lamp',      label: 'Nightwatch',     glyph: '🔦', category: 'gear' },
  { id: 'wolf',      label: 'Wolf',           glyph: '🐺', category: 'faction' },
  { id: 'bear',      label: 'Bear',           glyph: '🐻', category: 'faction' },
  { id: 'radio',     label: 'Operator',       glyph: '📡', category: 'faction' },
  { id: 'quill',     label: 'Scribe',         glyph: '✒', category: 'faction' },
  { id: 'crystal',   label: 'Artefact',       glyph: '🔮', category: 'mystic' },
  { id: 'eye',       label: 'All-seeing',     glyph: '👁', category: 'mystic' },
  { id: 'ghost',     label: 'Specter',        glyph: '👻', category: 'mystic' },
  { id: 'lightning', label: 'Anomaly',        glyph: '⚡', category: 'mystic' },
];

export const AVATAR_COLOR_PRESETS: AvatarColorPreset[] = [
  { id: 'loner',       label: 'Loner Green',     color: '#5eaa3a' },
  { id: 'clearsky',    label: 'Clear Sky',       color: '#3aaa8a' },
  { id: 'freedom',     label: 'Freedom',         color: '#8fd46a' },
  { id: 'duty',        label: 'Duty',            color: '#d87861' },
  { id: 'bandit',      label: 'Bandit',          color: '#7d6a52' },
  { id: 'mercenary',   label: 'Mercenary',       color: '#6fa1d4' },
  { id: 'ecologist',   label: 'Ecologist',       color: '#7fb2e8' },
  { id: 'military',    label: 'Military',        color: '#a0a03a' },
  { id: 'monolith',    label: 'Monolith',        color: '#c4a040' },
  { id: 'renegade',    label: 'Renegade',        color: '#b85a8c' },
  { id: 'neon-violet', label: 'Anomaly Violet',  color: '#a855f7' },
  { id: 'crimson',     label: 'Crimson Ember',   color: '#e05555' },
  { id: 'steel',       label: 'Zone Steel',      color: '#a0a8b8' },
  { id: 'bronze',      label: 'Dusk Bronze',     color: '#b87333' },
  { id: 'cyan',        label: 'Clear Signal',    color: '#22d3ee' },
  { id: 'rose',        label: 'Ashen Rose',      color: '#fb7185' },
];

export const AVATAR_FRAME_PRESETS: AvatarFramePreset[] = [
  { id: 'none',        label: 'No frame',         variant: 'none' },
  { id: 'hex',         label: 'Hex plating',      variant: 'hex' },
  { id: 'runic',       label: 'Runic ring',       variant: 'runic', minLevel: 3 },
  { id: 'halo',        label: 'Halo',             variant: 'halo',  minLevel: 5 },
  { id: 'radioactive', label: 'Radioactive ring', variant: 'radioactive', minLevel: 7, isAnimated: true },
  { id: 'monolith',    label: 'Monolith crown',   variant: 'monolith', minLevel: 9, isAnimated: true },
];

export const AVATAR_BANNER_PRESETS: AvatarBannerPreset[] = [
  {
    id: 'default',
    label: 'Default',
    gradient: 'linear-gradient(115deg, color-mix(in srgb, var(--accent) 16%, transparent), transparent 48%), color-mix(in srgb, var(--bg-card) 88%, transparent)',
  },
  {
    id: 'zone-dawn',
    label: 'Zone dawn',
    gradient: 'linear-gradient(120deg, rgba(94,170,58,0.22), rgba(212,163,75,0.12) 55%, rgba(0,0,0,0) 82%)',
  },
  {
    id: 'radiation',
    label: 'Radiation',
    gradient: 'linear-gradient(125deg, rgba(196,160,64,0.28), rgba(94,170,58,0.12) 52%, rgba(0,0,0,0) 82%)',
    isAnimated: true,
  },
  {
    id: 'monolith',
    label: 'Monolith',
    gradient: 'linear-gradient(120deg, rgba(168,85,247,0.22), rgba(94,170,58,0.10) 55%, rgba(0,0,0,0) 82%)',
    isAnimated: true,
  },
  {
    id: 'duty',
    label: 'Duty iron',
    gradient: 'linear-gradient(118deg, rgba(216,120,97,0.22), rgba(55,62,78,0.22) 55%, rgba(0,0,0,0) 84%)',
  },
  {
    id: 'freedom',
    label: 'Freedom sun',
    gradient: 'linear-gradient(120deg, rgba(143,212,106,0.28), rgba(212,163,75,0.14) 52%, rgba(0,0,0,0) 82%)',
  },
  {
    id: 'nightshift',
    label: 'Night shift',
    gradient: 'linear-gradient(120deg, rgba(34,211,238,0.22), rgba(94,170,58,0.10) 52%, rgba(0,0,0,0) 86%)',
    isAnimated: true,
  },
  {
    id: 'crimson',
    label: 'Crimson storm',
    gradient: 'linear-gradient(120deg, rgba(224,85,85,0.28), rgba(94,170,58,0.10) 60%, rgba(0,0,0,0) 84%)',
  },
];

export const AVATAR_EFFECT_PRESETS: AvatarEffectPreset[] = [
  { id: 'none', label: 'Clear' },
  { id: 'scanlines', label: 'Term/Link', minLevel: 5 },
  { id: 'spores', label: 'Irradiated', minLevel: 10 },
  { id: 'glitch', label: 'Psy-Storm', minLevel: 20 },
];

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
