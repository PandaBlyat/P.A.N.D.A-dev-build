// P.A.N.D.A. — Avatar customization catalog.
//
// Defines the presets a user can choose from when customizing their dossier
// avatar. Presets are stored as short string IDs on the user_profiles row
// (avatar_icon, avatar_color, avatar_frame, avatar_banner, avatar_effect).

export type AvatarIconPreset = {
  id: string;
  label: string;
  glyph: string;
  category: 'default' | 'faction' | 'rank' | 'equipment' | 'zone' | 'artifact' | 'mutant' | 'anomaly' | 'legend';
  minLevel?: number;
  pandaOnly?: boolean;
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
  minLevel?: number;
  isAnimated?: boolean;
  variant: 
    | 'none' | 'hex' | 'runic' | 'halo' | 'monolith' 
    | 'radioactive' | 'cyber' | 'plasma' | 'blood' | 'void' | 'legend'
    | 'neon' | 'crystal' | 'inferno' | 'frost' | 'corrupted' | 'celestial' | 'omega';
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
// 1. ICONS (STALKER‑THEMED)
// ---------------------------------------------------------------------------
export const AVATAR_ICON_PRESETS: AvatarIconPreset[] = [
  // ==================== DEFAULT / STARTER ====================
  { id: 'default',   label: 'Anonymous',      glyph: '◉',   category: 'default' },
  { id: 'panda',     label: 'Panda',          glyph: '🐼',  category: 'default', pandaOnly: true },
  { id: 'stalker',   label: 'Stalker',        glyph: '🎭',  category: 'default' },
  { id: 'rookie',    label: 'Rookie',         glyph: '🌱',  category: 'default', minLevel: 1 },

  // ==================== EQUIPMENT / GEAR (Level 1–15) ====================
  { id: 'bolt',          label: 'Bolt',           glyph: '🔩', category: 'equipment', minLevel: 1 },
  { id: 'detector',      label: 'Detector',       glyph: '📡', category: 'equipment', minLevel: 2 },
  { id: 'backpack',      label: 'Backpack',       glyph: '🎒', category: 'equipment', minLevel: 2 },
  { id: 'gasmask',       label: 'Gas Mask',       glyph: '😷', category: 'equipment', minLevel: 3 },
  { id: 'flashlight',    label: 'Flashlight',     glyph: '🔦', category: 'equipment', minLevel: 3 },
  { id: 'knife',         label: 'Combat Knife',   glyph: '🔪', category: 'equipment', minLevel: 4 },
  { id: 'medkit',        label: 'Medkit',         glyph: '🩹', category: 'equipment', minLevel: 5 },
  { id: 'anomaly_suit',  label: 'Anomaly Suit',   glyph: '👕', category: 'equipment', minLevel: 6 },
  { id: 'exo',           label: 'Exoskeleton',    glyph: '🦾', category: 'equipment', minLevel: 10 },
  { id: 'svd',           label: 'SVD',            glyph: '🔫', category: 'equipment', minLevel: 12 },
  { id: 'rpg',           label: 'RPG',            glyph: '🚀', category: 'equipment', minLevel: 15 },

  // ==================== ARTIFACTS (Level 5–35) ====================
  { id: 'stone_flower',  label: 'Stone Flower',   glyph: '🌸', category: 'artifact', minLevel: 5 },
  { id: 'jellyfish',     label: 'Jellyfish',      glyph: '🪼', category: 'artifact', minLevel: 7 },
  { id: 'sparkler',      label: 'Sparkler',       glyph: '✨', category: 'artifact', minLevel: 10 },
  { id: 'night_star',    label: 'Night Star',     glyph: '🌟', category: 'artifact', minLevel: 15 },
  { id: 'fireball',      label: 'Fireball',       glyph: '🔥', category: 'artifact', minLevel: 18 },
  { id: 'crystal',       label: 'Crystal Thorn',  glyph: '💎', category: 'artifact', minLevel: 22 },
  { id: 'gravi',         label: 'Graviton',       glyph: '🪨', category: 'artifact', minLevel: 28 },
  { id: 'goldfish',      label: 'Goldfish',       glyph: '🐟', category: 'artifact', minLevel: 35 },

  // ==================== ANOMALIES (Level 8–40) ====================
  { id: 'vortex',        label: 'Vortex',         glyph: '🌀', category: 'anomaly', minLevel: 8 },
  { id: 'springboard',   label: 'Springboard',    glyph: '🦘', category: 'anomaly', minLevel: 10 },
  { id: 'burner',        label: 'Burner',         glyph: '🔥', category: 'anomaly', minLevel: 12 },
  { id: 'electro',       label: 'Electro',        glyph: '⚡', category: 'anomaly', minLevel: 15 },
  { id: 'fruit_punch',   label: 'Fruit Punch',    glyph: '🍎', category: 'anomaly', minLevel: 18 },
  { id: 'gas_cloud',     label: 'Gas Cloud',      glyph: '☠️', category: 'anomaly', minLevel: 20 },
  { id: 'space_bubble',  label: 'Space Bubble',   glyph: '🫧', category: 'anomaly', minLevel: 25 },
  { id: 'psi_field',     label: 'Psi‑Field',      glyph: '🧠', category: 'anomaly', minLevel: 30 },
  { id: 'tremor',        label: 'Tremor',         glyph: '🌋', category: 'anomaly', minLevel: 35 },
  { id: 'black_hole',    label: 'Black Hole',     glyph: '⚫', category: 'anomaly', minLevel: 40 },

  // ==================== MUTANTS (Level 10–55) ====================
  { id: 'flesh',         label: 'Flesh',          glyph: '🐗', category: 'mutant', minLevel: 10 },
  { id: 'blind_dog',     label: 'Blind Dog',      glyph: '🐕', category: 'mutant', minLevel: 12 },
  { id: 'snork',         label: 'Snork',          glyph: '🏃', category: 'mutant', minLevel: 15 },
  { id: 'bloodsucker',   label: 'Bloodsucker',    glyph: '🩸', category: 'mutant', minLevel: 20 },
  { id: 'pseudodog',     label: 'Pseudodog',      glyph: '🐺', category: 'mutant', minLevel: 18 },
  { id: 'boar',          label: 'Boar',           glyph: '🐖', category: 'mutant', minLevel: 14 },
  { id: 'poltergeist',   label: 'Poltergeist',    glyph: '👻', category: 'mutant', minLevel: 25 },
  { id: 'burer',         label: 'Burer',          glyph: '👹', category: 'mutant', minLevel: 30 },
  { id: 'controller',    label: 'Controller',     glyph: '🧙', category: 'mutant', minLevel: 35 },
  { id: 'pseudogiant',   label: 'Pseudogiant',    glyph: '🦍', category: 'mutant', minLevel: 45 },
  { id: 'chimera',       label: 'Chimera',        glyph: '🐉', category: 'mutant', minLevel: 50 },
  { id: 'karlik',        label: 'Karlik',         glyph: '🪨', category: 'mutant', minLevel: 55 },

  // ==================== FACTIONS (Level 1–30) ====================
  { id: 'loner',         label: 'Loner',          glyph: '🕊️', category: 'faction', minLevel: 1 },
  { id: 'duty',          label: 'Duty',           glyph: '🛡️', category: 'faction', minLevel: 1 },
  { id: 'freedom',       label: 'Freedom',        glyph: '🌿', category: 'faction', minLevel: 1 },
  { id: 'bandit',        label: 'Bandit',         glyph: '💰', category: 'faction', minLevel: 1 },
  { id: 'mercenary',     label: 'Mercenary',      glyph: '💵', category: 'faction', minLevel: 3 },
  { id: 'ecologist',     label: 'Ecologist',      glyph: '🔬', category: 'faction', minLevel: 5 },
  { id: 'military',      label: 'Military',       glyph: '🎖️', category: 'faction', minLevel: 5 },
  { id: 'clear_sky',     label: 'Clear Sky',      glyph: '🌤️', category: 'faction', minLevel: 8 },
  { id: 'monolith',      label: 'Monolith',       glyph: '⛲', category: 'faction', minLevel: 20 },
  { id: 'renegade',      label: 'Renegade',       glyph: '🔪', category: 'faction', minLevel: 12 },
  { id: 'sin',           label: 'Sin',            glyph: '🐍', category: 'faction', minLevel: 25 },
  { id: 'isg',           label: 'ISG',            glyph: '🌍', category: 'faction', minLevel: 30 },

  // ==================== ZONE PHENOMENA / RANKS (Level 5–60) ====================
  { id: 'emission',      label: 'Emission',       glyph: '🌅', category: 'zone', minLevel: 15 },
  { id: 'psi_storm',     label: 'Psi‑Storm',      glyph: '🌪️', category: 'zone', minLevel: 20 },
  { id: 'blowout',       label: 'Blowout',        glyph: '💥', category: 'zone', minLevel: 25 },
  { id: 'scorched_earth',label: 'Scorched Earth', glyph: '🏜️', category: 'zone', minLevel: 30 },
  { id: 'dead_city',     label: 'Dead City',      glyph: '🏚️', category: 'zone', minLevel: 18 },
  { id: 'radar',         label: 'Radar',          glyph: '📡', category: 'zone', minLevel: 12 },
  { id: 'brain_scorcher',label: 'Brain Scorcher', glyph: '🧠', category: 'zone', minLevel: 40 },

  // ==================== RANKS / ACHIEVEMENTS (Level 5–70) ====================
  { id: 'novice',        label: 'Novice',         glyph: '🌱', category: 'rank', minLevel: 5 },
  { id: 'experienced',   label: 'Experienced',    glyph: '🌿', category: 'rank', minLevel: 10 },
  { id: 'veteran',       label: 'Veteran',        glyph: '⚙️', category: 'rank', minLevel: 20 },
  { id: 'expert',        label: 'Expert',         glyph: '🏅', category: 'rank', minLevel: 30 },
  { id: 'master',        label: 'Master',         glyph: '👑', category: 'rank', minLevel: 40 },
  { id: 'legend',        label: 'Legend',         glyph: '🌟', category: 'rank', minLevel: 50 },
  { id: 'stalker_hero',  label: 'Hero of the Zone', glyph: '🦸', category: 'rank', minLevel: 60 },
  { id: 'monolith_saint',label: 'Monolith Saint', glyph: '⛲', category: 'rank', minLevel: 70 },

  // ==================== LEGENDARY / MYTHIC (Level 45–70) ====================
  { id: 'chernobyl',     label: 'Chernobyl',      glyph: '☢️', category: 'legend', minLevel: 45 },
  { id: 'wish_granter',  label: 'Wish Granter',   glyph: '💎', category: 'legend', minLevel: 50 },
  { id: 'oasis',         label: 'Oasis',          glyph: '🏝️', category: 'legend', minLevel: 55 },
  { id: 'golden_sphere', label: 'Golden Sphere',  glyph: '🔮', category: 'legend', minLevel: 60 },
  { id: 'noosphere',     label: 'Noosphere',      glyph: '🌌', category: 'legend', minLevel: 65 },
  { id: 'c_consciousness',label: 'C‑Consciousness', glyph: '🧠', category: 'legend', minLevel: 70 },
];

// ---------------------------------------------------------------------------
// 2. COLORS / TINTS
// ---------------------------------------------------------------------------
export const AVATAR_COLOR_PRESETS: AvatarColorPreset[] = [
  // ==================== BASIC / FACTION (level 1–5) ====================
  { id: 'loner',       label: 'Loner Green',     color: '#5eaa3a', minLevel: 1 },
  { id: 'clearsky',    label: 'Clear Sky',       color: '#3aaa8a', minLevel: 1 },
  { id: 'freedom',     label: 'Freedom',         color: '#8fd46a', minLevel: 1 },
  { id: 'duty',        label: 'Duty',            color: '#d87861', minLevel: 1 },
  { id: 'bandit',      label: 'Bandit',          color: '#7d6a52', minLevel: 1 },
  { id: 'mercenary',   label: 'Mercenary',       color: '#6fa1d4', minLevel: 1 },
  { id: 'ecologist',   label: 'Ecologist',       color: '#7fb2e8', minLevel: 1 },
  { id: 'military',    label: 'Military',        color: '#a0a03a', minLevel: 1 },
  { id: 'charcoal',    label: 'Charcoal',        color: '#36454f', minLevel: 1 },
  { id: 'rust',        label: 'Rust',            color: '#b7410e', minLevel: 1 },
  { id: 'mud',         label: 'Muddy',           color: '#6b4c3a', minLevel: 1 },
  { id: 'ash',         label: 'Ash Gray',        color: '#9ca3af', minLevel: 1 },
  { id: 'sand',        label: 'Desert Sand',     color: '#d2b48c', minLevel: 1 },
  { id: 'olive',       label: 'Olive Drab',      color: '#6b8e23', minLevel: 1 },
  { id: 'slate',       label: 'Slate',           color: '#708090', minLevel: 1 },
  { id: 'cream',       label: 'Cream',           color: '#f5f5dc', minLevel: 1 },

  // ==================== METALS & ALLOYS (level 8–35) ====================
  { id: 'iron',        label: 'Forged Iron',     color: '#5c5c5c', minLevel: 8 },
  { id: 'steel',       label: 'Zone Steel',      color: '#a0a8b8', minLevel: 10 },
  { id: 'bronze',      label: 'Dusk Bronze',     color: '#cd7f32', minLevel: 12 },  // unique bronze
  { id: 'copper',      label: 'Rusted Copper',   color: '#b87333', minLevel: 12 },
  { id: 'silver',      label: 'Tarnished Silver',color: '#c0c0c0', minLevel: 15 },
  { id: 'gold',        label: 'Rough Gold',      color: '#d4af37', minLevel: 20 },
  { id: 'titanium',    label: 'Titanium',        color: '#878f99', minLevel: 25 },
  { id: 'obsidian',    label: 'Obsidian Edge',   color: '#1f1f2b', minLevel: 30 },
  { id: 'chromium',    label: 'Chrome Mirror',   color: '#dce4f0', minLevel: 35 },
  { id: 'platinum',    label: 'True Platinum',   color: '#f3f4f6', minLevel: 50 },

  // ==================== OCEAN / SKY (level 5–45) ====================
  { id: 'sky',         label: 'Sky Blue',        color: '#87ceeb', minLevel: 5 },
  { id: 'ocean',       label: 'Deep Ocean',      color: '#0ea5e9', minLevel: 15 },
  { id: 'teal',        label: 'Toxic Teal',      color: '#14b8a6', minLevel: 12 },
  { id: 'navy',        label: 'Night Navy',      color: '#1e3a8a', minLevel: 18 },
  { id: 'ice',         label: 'Permafrost',      color: '#b0e0e6', minLevel: 22 },
  { id: 'cobalt',      label: 'Cobalt',          color: '#0047ab', minLevel: 28 },
  { id: 'cyan_signal', label: 'Clear Signal',    color: '#22d3ee', minLevel: 30 },
  { id: 'abyss',       label: 'Abyssal Blue',    color: '#0f172a', minLevel: 45 }, // darker, unique

  // ==================== FIRE / BLOOD / WARM (level 12–40) ====================
  { id: 'sunset',      label: 'Sunset',          color: '#ff7f50', minLevel: 12 },
  { id: 'fire',        label: 'Wildfire',        color: '#ff4500', minLevel: 15 },
  { id: 'rust_burned', label: 'Burned Rust',     color: '#8b3a3a', minLevel: 18 },
  { id: 'crimson',     label: 'Crimson Ember',   color: '#e05555', minLevel: 20 },
  { id: 'cherry',      label: 'Cherry',          color: '#de3163', minLevel: 22 },
  { id: 'magma',       label: 'Magma',           color: '#ff4d00', minLevel: 25 },
  { id: 'scarlet',     label: 'Scarlet',         color: '#ff2400', minLevel: 30 },
  { id: 'blood',       label: 'Fresh Blood',     color: '#991b1b', minLevel: 35 },
  { id: 'vampire',     label: 'Vampire Red',     color: '#880000', minLevel: 40 },

  // ==================== TOXIC / RADIOACTIVE (level 20–50) ====================
  { id: 'waste',       label: 'Toxic Waste',     color: '#8fce00', minLevel: 20 },
  { id: 'toxic',       label: 'Toxic Yellow',    color: '#eab308', minLevel: 25 },
  { id: 'poison',      label: 'Poison Dart',     color: '#88ff11', minLevel: 27 },
  { id: 'biohazard',   label: 'Biohazard Lime',  color: '#a3ff00', minLevel: 28 },
  { id: 'glow',        label: 'Glowstick',       color: '#ccff00', minLevel: 30 },
  { id: 'neon_green',  label: 'Neon Anomaly',    color: '#0eff00', minLevel: 35 },
  { id: 'irradiated',  label: 'Irradiated',      color: '#c6ff00', minLevel: 42 },
  { id: 'radioactive', label: 'Reactor Green',   color: '#39ff14', minLevel: 50 },

  // ==================== MYSTIC / PSYCHIC (level 15–58) ====================
  { id: 'lilac',       label: 'Lilac',           color: '#c8a2c8', minLevel: 15 },
  { id: 'orchid',      label: 'Orchid',          color: '#da70d6', minLevel: 20 },
  { id: 'purple_psi',  label: 'Psi Purple',      color: '#8b00ff', minLevel: 25 },
  { id: 'neon_violet', label: 'Anomaly Violet',  color: '#a855f7', minLevel: 30 },
  { id: 'amethyst',    label: 'Amethyst',        color: '#9966cc', minLevel: 32 },
  { id: 'magenta',     label: 'Magenta Field',   color: '#ff00ff', minLevel: 38 },
  { id: 'dark_purple', label: 'Void Purple',     color: '#301934', minLevel: 48 },
  { id: 'cosmic',      label: 'Cosmic Violet',   color: '#4b0082', minLevel: 58 },

  // ==================== NATURE / ZONE (level 5–22) ====================
  { id: 'lichen',      label: 'Lichen',          color: '#bdc48e', minLevel: 5 },
  { id: 'bark',        label: 'Bark',            color: '#5c4033', minLevel: 6 },
  { id: 'moss',        label: 'Moss',            color: '#8a9a5b', minLevel: 8 },
  { id: 'swamp',       label: 'Swamp',           color: '#5c5c3b', minLevel: 10 },
  { id: 'pine',        label: 'Pine Green',      color: '#014421', minLevel: 12 },
  { id: 'grave',       label: 'Grave Earth',     color: '#4d3e2e', minLevel: 15 },
  { id: 'mushroom',    label: 'Fungal',          color: '#c47e5a', minLevel: 18 },
  { id: 'spore',       label: 'Spore Orange',    color: '#e67e22', minLevel: 22 },

  // ==================== RENEGADE / MONOLITH / LEGENDARY (level 20–70) ====================
  { id: 'renegade',    label: 'Renegade',        color: '#b85a8c', minLevel: 20 },
  { id: 'warlord',     label: 'Warlord Bronze',  color: '#cd7f32', minLevel: 30 },
  { id: 'monolith',    label: 'Monolith Gold',   color: '#c4a040', minLevel: 40 },
  { id: 'nebula',      label: 'Nebula',          color: '#dda0dd', minLevel: 50 },
  { id: 'aurora',      label: 'Aurora',          color: '#00ffaa', minLevel: 52 },
  { id: 'blackhole',   label: 'Black Hole',      color: '#111111', minLevel: 55 },
  { id: 'white_dwarf', label: 'White Dwarf',     color: '#f0f0f0', minLevel: 55 },
  { id: 'singularity', label: 'Singularity',     color: '#2b2b2b', minLevel: 60 },
  { id: 'quasar',      label: 'Quasar',          color: '#ffdf00', minLevel: 65 },
  { id: 'void',        label: 'The Void',        color: '#0a0a0a', minLevel: 70 },

  // ==================== EXTRA COOL / ANOMALOUS (level 24–45) ====================
  { id: 'radar',       label: 'Radar Green',     color: '#00cc66', minLevel: 16 },
  { id: 'emp',         label: 'EMP',             color: '#b0e0e6', minLevel: 24 },
  { id: 'mirage',      label: 'Mirage Gold',     color: '#e6c200', minLevel: 24 },
  { id: 'blizzard',    label: 'Blizzard',        color: '#e0ffff', minLevel: 26 },
  { id: 'electric',    label: 'Electric Blue',   color: '#00bfff', minLevel: 28 },
  { id: 'frostbite',   label: 'Frostbite',       color: '#00ffff', minLevel: 33 },
  { id: 'nightshade',  label: 'Nightshade',      color: '#3c1e4a', minLevel: 34 },
  { id: 'hologram',    label: 'Hologram',        color: '#e0b0ff', minLevel: 36 },
  { id: 'inferno',     label: 'Inferno',         color: '#ff3300', minLevel: 38 },
  { id: 'plasma',      label: 'Plasma',          color: '#e65c00', minLevel: 32 },
  { id: 'phoenix',     label: 'Phoenix Fire',    color: '#ff8c00', minLevel: 45 },
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
  { id: 'neon',       label: 'Neon Synapse',   variant: 'neon',      minLevel: 55, isAnimated: true },
  { id: 'crystal',    label: 'Prismatic',      variant: 'crystal',   minLevel: 60, isAnimated: true },
  { id: 'inferno',    label: 'Infernal Core',  variant: 'inferno',   minLevel: 70, isAnimated: true },
  { id: 'frost',      label: 'Absolute Zero',  variant: 'frost',     minLevel: 75, isAnimated: true },
  { id: 'corrupted',  label: 'Corrupted Data', variant: 'corrupted', minLevel: 80, isAnimated: true },
  { id: 'celestial',  label: 'Celestial',      variant: 'celestial', minLevel: 90, isAnimated: true },
  { id: 'omega',      label: 'Omega Directive',variant: 'omega',     minLevel: 100, isAnimated: true },
];

// ---------------------------------------------------------------------------
// 4. BANNERS
// ---------------------------------------------------------------------------
export const AVATAR_BANNER_PRESETS: AvatarBannerPreset[] = [
  // ==================== DEFAULT (always available) ====================
  {
    id: 'default',
    label: 'Standard',
    gradient: 'linear-gradient(115deg, color-mix(in srgb, var(--accent) 16%, transparent), transparent 48%), color-mix(in srgb, var(--bg-card) 88%, transparent)',
  },

  // ==================== BASIC / FACTION (level 1–5) ====================
  {
    id: 'loner-camouflage',
    label: 'Loner Camo',
    gradient: 'linear-gradient(125deg, rgba(94,170,58,0.18), rgba(80,80,60,0.12) 60%, transparent 85%)',
  },
  {
    id: 'duty-iron',
    label: 'Duty Iron',
    gradient: 'linear-gradient(118deg, rgba(216,120,97,0.22), rgba(55,62,78,0.22) 55%, transparent 84%)',
  },
  {
    id: 'freedom-sun',
    label: 'Freedom Sun',
    gradient: 'linear-gradient(120deg, rgba(143,212,106,0.28), rgba(212,163,75,0.14) 52%, transparent 82%)',
  },
  {
    id: 'clearsky',
    label: 'Clear Sky',
    gradient: 'linear-gradient(115deg, rgba(58,170,138,0.2), rgba(135,206,235,0.1) 60%, transparent 85%)',
  },
  {
    id: 'bandit-hideout',
    label: 'Bandit Hideout',
    gradient: 'linear-gradient(115deg, rgba(125,106,82,0.22), rgba(50,40,30,0.18) 50%, transparent 80%)',
  },
  {
    id: 'mercenary-steel',
    label: 'Mercenary Steel',
    gradient: 'linear-gradient(120deg, rgba(111,161,212,0.22), rgba(70,90,110,0.2) 55%, transparent 82%)',
  },
  {
    id: 'ecologist-bloom',
    label: 'Ecologist Bloom',
    gradient: 'linear-gradient(125deg, rgba(127,178,232,0.2), rgba(80,160,120,0.15) 60%, transparent 85%)',
  },
  {
    id: 'military-ash',
    label: 'Military Ash',
    gradient: 'linear-gradient(118deg, rgba(160,160,58,0.22), rgba(90,90,40,0.18) 55%, transparent 84%)',
  },
  {
    id: 'renegade-scar',
    label: 'Renegade Scar',
    gradient: 'linear-gradient(130deg, rgba(184,90,140,0.22), rgba(60,30,50,0.18) 50%, transparent 80%)',
  },

  // ==================== NATURE / ZONE (level 5–20) ====================
  {
    id: 'forest-canopy',
    label: 'Forest Canopy',
    minLevel: 5,
    gradient: 'linear-gradient(135deg, rgba(34,139,34,0.2), rgba(0,64,0,0.15) 65%, transparent 90%)',
  },
  {
    id: 'swamp-fog',
    label: 'Swamp Fog',
    minLevel: 8,
    gradient: 'linear-gradient(110deg, rgba(92,64,51,0.25), rgba(70,50,40,0.15) 50%, transparent 80%)',
  },
  {
    id: 'mushroom-circle',
    label: 'Mycelial Glow',
    minLevel: 12,
    isAnimated: true,
    gradient: 'radial-gradient(circle at 20% 80%, rgba(196,126,90,0.28), rgba(80,50,30,0.1) 70%, transparent 100%)',
  },
  {
    id: 'lichen-veil',
    label: 'Lichen Veil',
    minLevel: 5,
    gradient: 'linear-gradient(120deg, rgba(189,196,142,0.2), rgba(100,110,70,0.1) 55%, transparent 85%)',
  },
  {
    id: 'pine-shadow',
    label: 'Pine Shadow',
    minLevel: 10,
    gradient: 'linear-gradient(115deg, rgba(1,68,33,0.25), rgba(0,30,15,0.2) 60%, transparent 85%)',
  },

  // ==================== WATER / ICE (level 10–30) ====================
  {
    id: 'deep-water',
    label: 'Deep Water',
    minLevel: 10,
    gradient: 'linear-gradient(120deg, rgba(14,165,233,0.25), rgba(30,58,138,0.2) 60%, transparent 85%)',
  },
  {
    id: 'glacial',
    label: 'Glacial',
    minLevel: 18,
    isAnimated: true,
    gradient: 'linear-gradient(125deg, rgba(176,224,230,0.25), rgba(100,149,237,0.15) 50%, transparent 80%)',
  },
  {
    id: 'abyssal-trench',
    label: 'Abyssal Trench',
    minLevel: 30,
    gradient: 'linear-gradient(115deg, rgba(25,25,112,0.3), rgba(0,0,0,0.25) 70%, transparent 90%)',
  },
  {
    id: 'frostbite',
    label: 'Frostbite',
    minLevel: 22,
    isAnimated: true,
    gradient: 'linear-gradient(135deg, rgba(224,255,255,0.25), rgba(70,130,180,0.15) 55%, transparent 85%)',
  },

  // ==================== FIRE / INFERNO (level 15–40) ====================
  {
    id: 'wildfire',
    label: 'Wildfire',
    minLevel: 15,
    isAnimated: true,
    gradient: 'radial-gradient(ellipse at 10% 40%, rgba(255,69,0,0.3), rgba(255,140,0,0.15) 50%, transparent 85%)',
  },
  {
    id: 'crimson-storm',
    label: 'Crimson Storm',
    minLevel: 20,
    gradient: 'linear-gradient(120deg, rgba(224,85,85,0.28), rgba(153,27,27,0.2) 60%, transparent 84%)',
  },
  {
    id: 'inferno',
    label: 'Inferno',
    minLevel: 30,
    isAnimated: true,
    gradient: 'linear-gradient(110deg, rgba(234,179,8,0.25), rgba(224,85,85,0.25) 45%, transparent 80%)',
  },
  {
    id: 'magma-core',
    label: 'Magma Core',
    minLevel: 35,
    gradient: 'linear-gradient(125deg, rgba(255,69,0,0.35), rgba(139,0,0,0.25) 60%, transparent 90%)',
  },
  {
    id: 'phoenix-blaze',
    label: 'Phoenix Blaze',
    minLevel: 40,
    isAnimated: true,
    gradient: 'radial-gradient(circle at 70% 30%, rgba(255,140,0,0.4), rgba(255,0,0,0.2) 60%, transparent 90%)',
  },

  // ==================== TOXIC / RADIOACTIVE (level 18–50) ====================
  {
    id: 'radiation',
    label: 'Radiation',
    minLevel: 18,
    isAnimated: true,
    gradient: 'linear-gradient(125deg, rgba(196,160,64,0.28), rgba(94,170,58,0.12) 52%, transparent 82%)',
  },
  {
    id: 'toxic-spill',
    label: 'Toxic Spill',
    minLevel: 22,
    gradient: 'linear-gradient(115deg, rgba(162,217,28,0.25), rgba(85,107,47,0.2) 55%, transparent 85%)',
  },
  {
    id: 'biohazard',
    label: 'Biohazard Zone',
    minLevel: 28,
    isAnimated: true,
    gradient: 'radial-gradient(circle at 80% 20%, rgba(163,255,0,0.3), rgba(0,100,0,0.15) 70%, transparent 100%)',
  },
  {
    id: 'reactor-core',
    label: 'Reactor Core',
    minLevel: 45,
    isAnimated: true,
    gradient: 'linear-gradient(130deg, rgba(57,255,20,0.3), rgba(0,200,0,0.2) 50%, transparent 80%)',
  },
  {
    id: 'neon-toxin',
    label: 'Neon Toxin',
    minLevel: 50,
    isAnimated: true,
    gradient: 'repeating-linear-gradient(45deg, rgba(0,255,0,0.1) 0px, rgba(0,255,0,0.1) 3px, rgba(255,255,0,0.05) 3px, rgba(255,255,0,0.05) 8px)',
  },

  // ==================== MYSTIC / ANOMALOUS (level 25–60) ====================
  {
    id: 'nightshift',
    label: 'Night Shift',
    minLevel: 20,
    isAnimated: true,
    gradient: 'linear-gradient(120deg, rgba(34,211,238,0.22), rgba(94,170,58,0.10) 52%, transparent 86%)',
  },
  {
    id: 'psi-storm',
    label: 'Psi Storm',
    minLevel: 28,
    isAnimated: true,
    gradient: 'radial-gradient(ellipse at 30% 70%, rgba(168,85,247,0.3), rgba(75,0,130,0.2) 60%, transparent 90%)',
  },
  {
    id: 'warp-field',
    label: 'Warp Field',
    minLevel: 32,
    isAnimated: true,
    gradient: 'conic-gradient(from 90deg at 20% 50%, rgba(255,0,255,0.2), rgba(0,255,255,0.2), rgba(255,0,255,0.2))',
  },
  {
    id: 'anomaly-void',
    label: 'Anomaly Void',
    minLevel: 38,
    gradient: 'linear-gradient(115deg, rgba(0,0,0,0.4), rgba(40,0,60,0.3) 55%, transparent 85%)',
  },
  {
    id: 'neon-grid',
    label: 'Neon Grid',
    minLevel: 34,
    isAnimated: true,
    gradient: 'repeating-linear-gradient(45deg, rgba(0,255,255,0.1) 0px, rgba(0,255,255,0.1) 2px, transparent 2px, transparent 8px)',
  },
  {
    id: 'hologram-shift',
    label: 'Hologram Shift',
    minLevel: 42,
    isAnimated: true,
    gradient: 'conic-gradient(from 0deg at 50% 50%, rgba(0,255,255,0.2), rgba(255,0,255,0.2), rgba(0,255,255,0.2))',
  },
  {
    id: 'starburst',
    label: 'Starburst',
    minLevel: 38,
    isAnimated: true,
    gradient: 'conic-gradient(from 45deg at 30% 40%, rgba(255,255,0,0.2), rgba(255,0,255,0.2), rgba(0,255,255,0.2), rgba(255,255,0,0.2))',
  },

  // ==================== LEGENDARY / HIGH TIER (level 40–70) ====================
  {
    id: 'monolith',
    label: 'Monolith',
    minLevel: 40,
    isAnimated: true,
    gradient: 'linear-gradient(120deg, rgba(168,85,247,0.25), rgba(94,170,58,0.15) 55%, transparent 82%)',
  },
  {
    id: 'golden-era',
    label: 'Golden Era',
    minLevel: 50,
    isAnimated: true,
    gradient: 'linear-gradient(115deg, rgba(251,191,36,0.3), rgba(243,244,246,0.15) 50%, transparent 80%)',
  },
  {
    id: 'singularity',
    label: 'Singularity',
    minLevel: 55,
    isAnimated: true,
    gradient: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.5), rgba(128,0,128,0.2) 40%, transparent 85%)',
  },
  {
    id: 'cosmic-void',
    label: 'Cosmic Void',
    minLevel: 60,
    gradient: 'conic-gradient(from 0deg at 50% 50%, rgba(0,0,0,0.5), rgba(25,25,112,0.3), rgba(0,0,0,0.5))',
  },
  {
    id: 'quasar-flare',
    label: 'Quasar Flare',
    minLevel: 65,
    isAnimated: true,
    gradient: 'linear-gradient(125deg, rgba(255,223,0,0.4), rgba(255,69,0,0.25) 45%, rgba(255,255,255,0.1) 80%)',
  },
  {
    id: 'true-legend',
    label: 'True Legend',
    minLevel: 70,
    isAnimated: true,
    gradient: 'radial-gradient(circle at 20% 30%, rgba(255,215,0,0.45), rgba(255,105,180,0.25) 55%, transparent 90%)',
  },

  // ==================== EXTRA THEMATIC (mid–high level) ====================
  {
    id: 'dust-storm',
    label: 'Dust Storm',
    minLevel: 12,
    gradient: 'linear-gradient(115deg, rgba(210,180,140,0.22), rgba(160,120,70,0.15) 60%, transparent 85%)',
  },
  {
    id: 'thunderhead',
    label: 'Thunderhead',
    minLevel: 14,
    isAnimated: true,
    gradient: 'linear-gradient(120deg, rgba(128,128,128,0.3), rgba(70,130,200,0.2) 50%, transparent 80%)',
  },
  {
    id: 'blood-moon',
    label: 'Blood Moon',
    minLevel: 22,
    isAnimated: true,
    gradient: 'radial-gradient(circle at 80% 20%, rgba(139,0,0,0.35), rgba(255,69,0,0.15) 70%, transparent 100%)',
  },
  {
    id: 'aurora-borealis',
    label: 'Aurora',
    minLevel: 42,
    isAnimated: true,
    gradient: 'linear-gradient(135deg, rgba(0,255,127,0.25), rgba(0,191,255,0.2) 40%, rgba(138,43,226,0.15) 70%, transparent 95%)',
  },
  {
    id: 'solar-flare',
    label: 'Solar Flare',
    minLevel: 48,
    isAnimated: true,
    gradient: 'linear-gradient(115deg, rgba(255,215,0,0.35), rgba(255,69,0,0.25) 55%, rgba(255,140,0,0.1) 80%)',
  },
  {
    id: 'dark-matter',
    label: 'Dark Matter',
    minLevel: 52,
    gradient: 'radial-gradient(circle at 10% 90%, rgba(20,20,30,0.6), rgba(0,0,0,0.4) 60%, transparent 95%)',
  },
  {
    id: 'pulse-wave',
    label: 'Pulse Wave',
    minLevel: 58,
    isAnimated: true,
    gradient: 'repeating-radial-gradient(circle at 30% 70%, rgba(0,255,255,0.15) 0px, rgba(0,255,255,0.15) 4px, transparent 4px, transparent 16px)',
  },
];

// ---------------------------------------------------------------------------
// 5. VFX OVERLAYS
// ---------------------------------------------------------------------------
export const AVATAR_EFFECT_PRESETS: AvatarEffectPreset[] = [
  { id: 'none',       label: 'Clear' },
  { id: 'scanlines',  label: 'Term/Link',   minLevel: 5 },
  { id: 'ash',        label: 'Volcanic Ash',  minLevel: 8 },
  { id: 'spores',     label: 'Irradiated',  minLevel: 10 },
  { id: 'rain',       label: 'Acid Rain',   minLevel: 15 },
  { id: 'blizzard',   label: 'Blizzard',      minLevel: 18 },
  { id: 'embers',     label: 'Ash & Ember', minLevel: 25 },
  { id: 'fireflies',  label: 'Fireflies',     minLevel: 28 },
  { id: 'glitch',     label: 'Psy-Storm',   minLevel: 30 },
  { id: 'toxic-gas',  label: 'Toxic Fumes',   minLevel: 38 },
  { id: 'matrix',     label: 'Data-Stream', minLevel: 40 },
  { id: 'wisps',      label: 'Void Wisps',  minLevel: 45 },
  { id: 'overcharge', label: 'Overcharge',  minLevel: 50 },
  { id: 'lightning',  label: 'Arc Flash',     minLevel: 55 },
  { id: 'cosmos',     label: 'Deep Space',    minLevel: 65 },
  { id: 'blood-rain', label: 'Blood Rain',    minLevel: 75 },
  { id: 'blackhole',  label: 'Event Horizon', minLevel: 85 },
  { id: 'ascension',  label: 'Ascension',     minLevel: 95 },
  { id: 'omega-burst',label: 'Omega Shock',   minLevel: 100 },
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
