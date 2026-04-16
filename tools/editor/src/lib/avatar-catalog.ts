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
    | 'neon' | 'crystal' | 'inferno' | 'frost' | 'corrupted' | 'celestial' | 'omega'
    | 'sanctum' | 'nexus' | 'eclipse' | 'aurora' | 'venom' | 'torment' | 'seraph' | 'abyssal' | 'singularity'
    // --- New Frames ---
    | 'scrapwork' | 'barbed_wire' | 'circuitry' | 'bio_organic' | 'arcane' | 'glacial'
    | 'holographic' | 'solar_flare' | 'geode' | 'starlight' | 'quantum'
    | 'noosphere' | 'supernova' | 'event_horizon' | 'zone_heart';
  /** Default intensity for animated frames (0-100) */
  defaultIntensity?: number;
};

export type AvatarFrameCustomization = {
  intensity?: number;
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
  /** Default opacity (0-100) for the banner, applies when no user override is set. */
  defaultOpacity?: number;
  /** Default animation speed (0.5-2.0) for animated banners. */
  defaultSpeed?: number;
};

export type AvatarEffectPreset = {
  id: string;
  label: string;
  /** Optional lock: only unlocked for users at or above this level. */
  minLevel?: number;
  /** Default color for the effect */
  defaultColor?: string;
  /** Default intensity (0-100) */
  defaultIntensity?: number;
  /** Default speed (0.5-2.0) */
  defaultSpeed?: number;
};

export type AvatarEffectCustomization = {
  color?: string;
  intensity?: number;
  speed?: number;
};

// ---------------------------------------------------------------------------
// 1. ICONS (STALKER‑THEMED) – all glyphs unique
// ---------------------------------------------------------------------------
export const AVATAR_ICON_PRESETS: AvatarIconPreset[] = [
  // DEFAULT / STARTER
  { id: 'default',   label: 'Anonymous',      glyph: '◉',   category: 'default' },
  { id: 'panda',     label: 'Panda',          glyph: '🐼',  category: 'default', pandaOnly: true },
  { id: 'stalker',   label: 'Stalker',        glyph: '🎭',  category: 'default' },
  { id: 'rookie',    label: 'Rookie',         glyph: '🌱',  category: 'default', minLevel: 1 },

  // EQUIPMENT / GEAR
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

  // ARTIFACTS
  { id: 'stone_flower',  label: 'Stone Flower',   glyph: '🌸', category: 'artifact', minLevel: 5 },
  { id: 'jellyfish',     label: 'Jellyfish',      glyph: '🪼', category: 'artifact', minLevel: 7 },
  { id: 'sparkler',      label: 'Sparkler',       glyph: '✨', category: 'artifact', minLevel: 10 },
  { id: 'night_star',    label: 'Night Star',     glyph: '🌟', category: 'artifact', minLevel: 15 },
  { id: 'fireball',      label: 'Fireball',       glyph: '🔥', category: 'artifact', minLevel: 18 },
  { id: 'crystal',       label: 'Crystal Thorn',  glyph: '💎', category: 'artifact', minLevel: 22 },
  { id: 'gravi',         label: 'Graviton',       glyph: '⚫', category: 'artifact', minLevel: 28 },
  { id: 'goldfish',      label: 'Goldfish',       glyph: '🐟', category: 'artifact', minLevel: 35 },

  // ANOMALIES
  { id: 'vortex',        label: 'Vortex',         glyph: '🌀', category: 'anomaly', minLevel: 8 },
  { id: 'springboard',   label: 'Springboard',    glyph: '🦘', category: 'anomaly', minLevel: 10 },
  { id: 'burner',        label: 'Burner',         glyph: '🌋', category: 'anomaly', minLevel: 12 },
  { id: 'electro',       label: 'Electro',        glyph: '⚡', category: 'anomaly', minLevel: 15 },
  { id: 'fruit_punch',   label: 'Fruit Punch',    glyph: '🍎', category: 'anomaly', minLevel: 18 },
  { id: 'gas_cloud',     label: 'Gas Cloud',      glyph: '☠️', category: 'anomaly', minLevel: 20 },
  { id: 'space_bubble',  label: 'Space Bubble',   glyph: '🫧', category: 'anomaly', minLevel: 25 },
  { id: 'psi_field',     label: 'Psi‑Field',      glyph: '🧠', category: 'anomaly', minLevel: 30 },
  { id: 'tremor',        label: 'Tremor',         glyph: '🌍', category: 'anomaly', minLevel: 35 },
  { id: 'black_hole',    label: 'Black Hole',     glyph: '🌑', category: 'anomaly', minLevel: 40 },

  // MUTANTS
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

  // FACTIONS
  { id: 'loner',         label: 'Loner',          glyph: '🕊️', category: 'faction', minLevel: 1 },
  { id: 'duty',          label: 'Duty',           glyph: '🛡️', category: 'faction', minLevel: 1 },
  { id: 'freedom',       label: 'Freedom',        glyph: '🌿', category: 'faction', minLevel: 1 },
  { id: 'bandit',        label: 'Bandit',         glyph: '💰', category: 'faction', minLevel: 1 },
  { id: 'mercenary',     label: 'Mercenary',      glyph: '💵', category: 'faction', minLevel: 3 },
  { id: 'ecologist',     label: 'Ecologist',      glyph: '🔬', category: 'faction', minLevel: 5 },
  { id: 'military',      label: 'Military',       glyph: '🎖️', category: 'faction', minLevel: 5 },
  { id: 'clear_sky',     label: 'Clear Sky',      glyph: '🌤️', category: 'faction', minLevel: 8 },
  { id: 'monolith',      label: 'Monolith',       glyph: '⛲', category: 'faction', minLevel: 20 },
  { id: 'renegade',      label: 'Renegade',       glyph: '🗡️', category: 'faction', minLevel: 12 },
  { id: 'sin',           label: 'Sin',            glyph: '🐍', category: 'faction', minLevel: 25 },
  { id: 'isg',           label: 'ISG',            glyph: '🌏', category: 'faction', minLevel: 30 },

  // ZONE PHENOMENA
  { id: 'emission',      label: 'Emission',       glyph: '🌅', category: 'zone', minLevel: 15 },
  { id: 'psi_storm',     label: 'Psi‑Storm',      glyph: '🌪️', category: 'zone', minLevel: 20 },
  { id: 'blowout',       label: 'Blowout',        glyph: '💥', category: 'zone', minLevel: 25 },
  { id: 'scorched_earth',label: 'Scorched Earth', glyph: '🏜️', category: 'zone', minLevel: 30 },
  { id: 'dead_city',     label: 'Dead City',      glyph: '🏚️', category: 'zone', minLevel: 18 },
  { id: 'radar',         label: 'Radar',          glyph: '🛸', category: 'zone', minLevel: 12 },
  { id: 'brain_scorcher',label: 'Brain Scorcher', glyph: '🔮', category: 'zone', minLevel: 40 },

  // RANKS
  { id: 'novice',        label: 'Novice',         glyph: '🍃', category: 'rank', minLevel: 5 },
  { id: 'experienced',   label: 'Experienced',    glyph: '🍀', category: 'rank', minLevel: 10 },
  { id: 'veteran',       label: 'Veteran',        glyph: '⚙️', category: 'rank', minLevel: 20 },
  { id: 'expert',        label: 'Expert',         glyph: '🏅', category: 'rank', minLevel: 30 },
  { id: 'master',        label: 'Master',         glyph: '👑', category: 'rank', minLevel: 40 },
  { id: 'legend',        label: 'Legend',         glyph: '⭐', category: 'rank', minLevel: 50 },
  { id: 'stalker_hero',  label: 'Hero of the Zone', glyph: '🦸', category: 'rank', minLevel: 60 },
  { id: 'monolith_saint',label: 'Monolith Saint', glyph: '🙏', category: 'rank', minLevel: 70 },

  // LEGENDARY
  { id: 'chernobyl',     label: 'Chernobyl',      glyph: '☢️', category: 'legend', minLevel: 45 },
  { id: 'wish_granter',  label: 'Wish Granter',   glyph: '💫', category: 'legend', minLevel: 50 },
  { id: 'oasis',         label: 'Oasis',          glyph: '🏝️', category: 'legend', minLevel: 55 },
  { id: 'golden_sphere', label: 'Golden Sphere',  glyph: '🥚', category: 'legend', minLevel: 60 },
  { id: 'noosphere',     label: 'Noosphere',      glyph: '🌌', category: 'legend', minLevel: 65 },
  { id: 'c_consciousness',label: 'C‑Consciousness', glyph: '🧿', category: 'legend', minLevel: 70 },
];

// ---------------------------------------------------------------------------
// 2. COLORS / TINTS
// ---------------------------------------------------------------------------
export const AVATAR_COLOR_PRESETS: AvatarColorPreset[] = [
  // ==================== BASIC / FACTION (level 1–5) – muted, low saturation ====================
  { id: 'loner',       label: 'Loner Green',     color: '#7c8a5e', minLevel: 1 },  // muted olive
  { id: 'clearsky',    label: 'Clear Sky',       color: '#5a8a7a', minLevel: 1 },  // muted teal
  { id: 'freedom',     label: 'Freedom',         color: '#9aaa7a', minLevel: 1 },  // muted light green
  { id: 'duty',        label: 'Duty',            color: '#b88a7a', minLevel: 1 },  // muted brick
  { id: 'bandit',      label: 'Bandit',          color: '#7a6a5a', minLevel: 1 },  // muted brown
  { id: 'mercenary',   label: 'Mercenary',       color: '#7a9ab8', minLevel: 1 },  // muted blue
  { id: 'ecologist',   label: 'Ecologist',       color: '#8aa8c8', minLevel: 1 },  // muted periwinkle
  { id: 'military',    label: 'Military',        color: '#8a8a5a', minLevel: 1 },  // muted olive drab
  { id: 'charcoal',    label: 'Charcoal',        color: '#3a4a55', minLevel: 1 },  // dark grey-blue
  { id: 'rust',        label: 'Rust',            color: '#a87a5a', minLevel: 1 },  // muted burnt orange
  { id: 'mud',         label: 'Muddy',           color: '#6a5a4a', minLevel: 1 },  // desaturated brown
  { id: 'ash',         label: 'Ash Gray',        color: '#a0a5aa', minLevel: 1 },  // neutral grey
  { id: 'sand',        label: 'Desert Sand',     color: '#c8b89a', minLevel: 1 },  // pale sand
  { id: 'olive',       label: 'Olive Drab',      color: '#7a8a5a', minLevel: 1 },  // muted olive
  { id: 'slate',       label: 'Slate',           color: '#708090', minLevel: 1 },  // standard slate
  { id: 'cream',       label: 'Cream',           color: '#f5f5dc', minLevel: 1 },  // unchanged

  // ==================== OCEAN / SKY (level 5–22) – low‑medium saturation ====================
  { id: 'sky',         label: 'Sky Blue',        color: '#9ac0d0', minLevel: 5 },  // desaturated sky
  { id: 'lichen',      label: 'Lichen',          color: '#bdc48e', minLevel: 5 },  // unchanged
  { id: 'bark',        label: 'Bark',            color: '#7a4a3a', minLevel: 6 },  // slightly richer brown
  { id: 'moss',        label: 'Moss',            color: '#7a9a4a', minLevel: 8 },  // medium green
  { id: 'swamp',       label: 'Swamp',           color: '#6a6a3a', minLevel: 10 }, // muted swamp green
  { id: 'teal',        label: 'Toxic Teal',      color: '#2a8a7a', minLevel: 12 }, // deeper teal
  { id: 'pine',        label: 'Pine Green',      color: '#2a5a3a', minLevel: 12 }, // dark forest
  { id: 'ocean',       label: 'Deep Ocean',      color: '#2a6a9a', minLevel: 15 }, // medium blue
  { id: 'grave',       label: 'Grave Earth',     color: '#5a4a3a', minLevel: 15 }, // dark earth
  { id: 'radar',       label: 'Radar Green',     color: '#2a9a6a', minLevel: 16 }, // emerald‑ish
  { id: 'mushroom',    label: 'Fungal',          color: '#b87a5a', minLevel: 18 }, // warm orange‑brown
  { id: 'navy',        label: 'Night Navy',      color: '#2a3a6a', minLevel: 18 }, // dark blue
  { id: 'spore',       label: 'Spore Orange',    color: '#d87a2a', minLevel: 22 }, // medium orange
  { id: 'ice',         label: 'Permafrost',      color: '#b0e0e6', minLevel: 22 }, // unchanged (pale cyan)

  // ==================== METALS & ALLOYS (level 8–50) – low saturation but increasing shine ====================
  { id: 'iron',        label: 'Forged Iron',     color: '#6a6a6a', minLevel: 8 },  // neutral dark grey
  { id: 'steel',       label: 'Zone Steel',      color: '#8a92a0', minLevel: 10 }, // slightly blue‑grey
  { id: 'bronze',      label: 'Dusk Bronze',     color: '#b87a3a', minLevel: 12 }, // distinct bronze
  { id: 'copper',      label: 'Rusted Copper',   color: '#b85a2a', minLevel: 12 }, // reddish copper
  { id: 'silver',      label: 'Tarnished Silver',color: '#b0b8c0', minLevel: 15 }, // light grey
  { id: 'gold',        label: 'Rough Gold',      color: '#c8a030', minLevel: 20 }, // muted gold
  { id: 'titanium',    label: 'Titanium',        color: '#9aa2b0', minLevel: 25 }, // cool grey
  { id: 'obsidian',    label: 'Obsidian Edge',   color: '#2a2a3a', minLevel: 30 }, // very dark purple‑black
  { id: 'chromium',    label: 'Chrome Mirror',   color: '#d0d8e8', minLevel: 35 }, // bright silver
  { id: 'platinum',    label: 'True Platinum',   color: '#e8eef4', minLevel: 50 }, // near‑white metallic

  // ==================== FIRE / BLOOD / WARM (level 12–45) – saturation increases with level ====================
  { id: 'sunset',      label: 'Sunset',          color: '#e87a5a', minLevel: 12 }, // muted coral
  { id: 'fire',        label: 'Wildfire',        color: '#e85a2a', minLevel: 15 }, // medium orange
  { id: 'rust_burned', label: 'Burned Rust',     color: '#9a4a3a', minLevel: 18 }, // dark red‑brown
  { id: 'crimson',     label: 'Crimson Ember',   color: '#d84a4a', minLevel: 20 }, // medium red
  { id: 'cherry',      label: 'Cherry',          color: '#e84a6a', minLevel: 22 }, // pinkish red
  { id: 'magma',       label: 'Magma',           color: '#f85a1a', minLevel: 25 }, // bright orange
  { id: 'scarlet',     label: 'Scarlet',         color: '#f8301a', minLevel: 30 }, // vivid red
  { id: 'blood',       label: 'Fresh Blood',     color: '#c82020', minLevel: 35 }, // intense dark red
  { id: 'vampire',     label: 'Vampire Red',     color: '#a01020', minLevel: 40 }, // deep blood red
  { id: 'phoenix',     label: 'Phoenix Fire',    color: '#ff6a1a', minLevel: 45 }, // bright fiery orange

  // ==================== TOXIC / RADIOACTIVE (level 20–55) – high saturation, neon ====================
  { id: 'waste',       label: 'Toxic Waste',     color: '#9aba1a', minLevel: 20 }, // olive‑yellow
  { id: 'toxic',       label: 'Toxic Yellow',    color: '#e8c81a', minLevel: 25 }, // golden yellow
  { id: 'poison',      label: 'Poison Dart',     color: '#88ff11', minLevel: 27 }, // bright lime
  { id: 'biohazard',   label: 'Biohazard Lime',  color: '#b0ff00', minLevel: 28 }, // chartreuse
  { id: 'glow',        label: 'Glowstick',       color: '#daff00', minLevel: 30 }, // neon yellow
  { id: 'neon_green',  label: 'Neon Anomaly',    color: '#1aff1a', minLevel: 35 }, // pure neon green
  { id: 'irradiated',  label: 'Irradiated',      color: '#eaff00', minLevel: 42 }, // yellow‑green
  { id: 'radioactive', label: 'Reactor Green',   color: '#39ff14', minLevel: 50 }, // intense green
  { id: 'neon_cyan',   label: 'Toxic Cyan',      color: '#1affdd', minLevel: 55 }, // new – bright cyan

  // ==================== MYSTIC / PSYCHIC (level 15–60) – increasingly saturated ====================
  { id: 'lilac',       label: 'Lilac',           color: '#c8a8d0', minLevel: 15 }, // soft lavender
  { id: 'orchid',      label: 'Orchid',          color: '#d87ad8', minLevel: 20 }, // medium pink‑purple
  { id: 'purple_psi',  label: 'Psi Purple',      color: '#aa44ff', minLevel: 25 }, // vivid purple
  { id: 'neon_violet', label: 'Anomaly Violet',  color: '#c060ff', minLevel: 30 }, // bright violet
  { id: 'amethyst',    label: 'Amethyst',        color: '#b070e0', minLevel: 32 }, // rich purple
  { id: 'magenta',     label: 'Magenta Field',   color: '#ff44ff', minLevel: 38 }, // pure magenta
  { id: 'dark_purple', label: 'Void Purple',     color: '#4a1a6a', minLevel: 48 }, // deep dark purple
  { id: 'cosmic',      label: 'Cosmic Violet',   color: '#6a1ac0', minLevel: 58 }, // intense indigo
  { id: 'void_purple', label: 'Void Singularity',color: '#cc33ff', minLevel: 60 }, // new – very bright violet

  // ==================== NATURE / ZONE (level 5–22) – already okay, minor tweaks ====================
  { id: 'lichen',      label: 'Lichen',          color: '#bdc48e', minLevel: 5 },   // unchanged
  { id: 'bark',        label: 'Bark',            color: '#7a4a3a', minLevel: 6 },   // tweaked above
  { id: 'moss',        label: 'Moss',            color: '#7a9a4a', minLevel: 8 },   // tweaked above
  { id: 'swamp',       label: 'Swamp',           color: '#6a6a3a', minLevel: 10 },  // tweaked above
  { id: 'pine',        label: 'Pine Green',      color: '#2a5a3a', minLevel: 12 },  // tweaked above
  { id: 'grave',       label: 'Grave Earth',     color: '#5a4a3a', minLevel: 15 },  // tweaked above
  { id: 'mushroom',    label: 'Fungal',          color: '#b87a5a', minLevel: 18 },  // tweaked above
  { id: 'spore',       label: 'Spore Orange',    color: '#d87a2a', minLevel: 22 },  // tweaked above

  // ==================== RENEGADE / MONOLITH / LEGENDARY (level 20–70) – high saturation ====================
  { id: 'renegade',    label: 'Renegade',        color: '#d86a9a', minLevel: 20 }, // dusty rose
  { id: 'warlord',     label: 'Warlord Bronze',  color: '#d89a3a', minLevel: 30 }, // warm bronze
  { id: 'monolith',    label: 'Monolith Gold',   color: '#e8b830', minLevel: 40 }, // bright gold
  { id: 'nebula',      label: 'Nebula',          color: '#e0aaff', minLevel: 50 }, // light violet
  { id: 'aurora',      label: 'Aurora',          color: '#1affaa', minLevel: 52 }, // vivid mint
  { id: 'blackhole',   label: 'Black Hole',      color: '#1a1a1a', minLevel: 55 }, // near black
  { id: 'white_dwarf', label: 'White Dwarf',     color: '#f5f5ff', minLevel: 55 }, // pure white with hint
  { id: 'singularity', label: 'Singularity',     color: '#4a4a5a', minLevel: 60 }, // dark grey
  { id: 'quasar',      label: 'Quasar',          color: '#ffe66a', minLevel: 65 }, // intense yellow
  { id: 'void',        label: 'The Void',        color: '#0a0a0a', minLevel: 70 }, // pure black

  // ==================== EXTRA COOL / ANOMALOUS (level 24–50) – vibrant, distinct ====================
  { id: 'emp',         label: 'EMP',             color: '#7df9ff', minLevel: 24 }, // electric cyan (was duplicate)
  { id: 'mirage',      label: 'Mirage Gold',     color: '#f0c040', minLevel: 24 }, // warmer gold
  { id: 'blizzard',    label: 'Blizzard',        color: '#d0f0ff', minLevel: 26 }, // icy blue
  { id: 'electric',    label: 'Electric Blue',   color: '#1aafff', minLevel: 28 }, // deep sky blue
  { id: 'frostbite',   label: 'Frostbite',       color: '#1affff', minLevel: 33 }, // bright cyan
  { id: 'nightshade',  label: 'Nightshade',      color: '#5a2a7a', minLevel: 34 }, // dark purple
  { id: 'hologram',    label: 'Hologram',        color: '#e8ccff', minLevel: 36 }, // pale lavender
  { id: 'inferno',     label: 'Inferno',         color: '#ff4a1a', minLevel: 38 }, // bright orange‑red
  { id: 'plasma',      label: 'Plasma',          color: '#ff8c33', minLevel: 32 }, // vibrant orange
  { id: 'sunflare',    label: 'Sunflare',        color: '#ffaa33', minLevel: 45 }, // new – golden orange
  { id: 'plasma_blue', label: 'Plasma Blue',     color: '#3399ff', minLevel: 48 }, // new – intense blue
  { id: 'crimson_dusk',label: 'Crimson Dusk',    color: '#ff3366', minLevel: 52 }, // new – hot pink/red
];

// ---------------------------------------------------------------------------
// 3. FRAMES
// ---------------------------------------------------------------------------
export const AVATAR_FRAME_PRESETS: AvatarFramePreset[] = [
  // Starter Frames
  { id: 'none',        label: 'No frame',         variant: 'none' },
  { id: 'hex',         label: 'Hex plating',      variant: 'hex' },

  // Basic Frames (Lv 5-15)
  { id: 'runic',       label: 'Runic Ring',       variant: 'runic', minLevel: 5 },
  { id: 'halo',        label: 'Halo',             variant: 'halo',  minLevel: 10 },
  { id: 'radioactive', label: 'Radioactive',      variant: 'radioactive', minLevel: 15, isAnimated: true, defaultIntensity: 75 },

  // Mid-Tier Frames (Lv 18-48)
  { id: 'scrapwork',   label: 'Junker\'s Guard',  variant: 'scrapwork',   minLevel: 18 },
  { id: 'cyber',       label: 'Cyber-Link',       variant: 'cyber',       minLevel: 20, defaultIntensity: 70 },
  { id: 'barbed_wire', label: 'Barbed Wire',      variant: 'barbed_wire', minLevel: 22 },
  { id: 'plasma',      label: 'Plasma Coil',      variant: 'plasma',      minLevel: 25, isAnimated: true, defaultIntensity: 80 },
  { id: 'circuitry',   label: 'Circuit Board',    variant: 'circuitry',   minLevel: 28, isAnimated: true, defaultIntensity: 75 },
  { id: 'blood',       label: 'Blood Pact',       variant: 'blood',       minLevel: 30 },
  { id: 'bio_organic', label: 'Biomass',          variant: 'bio_organic', minLevel: 32, isAnimated: true, defaultIntensity: 80 },
  { id: 'monolith',    label: 'Monolith Guard',   variant: 'monolith',    minLevel: 35, isAnimated: true, defaultIntensity: 85 },
  { id: 'arcane',      label: 'Arcane Sigil',     variant: 'arcane',      minLevel: 38, isAnimated: true, defaultIntensity: 82 },
  { id: 'glacial',     label: 'Glacial Shard',    variant: 'glacial',     minLevel: 42, isAnimated: true, defaultIntensity: 85 },
  { id: 'void',        label: 'Void Drift',       variant: 'void',        minLevel: 45, isAnimated: true, defaultIntensity: 90 },
  { id: 'holographic', label: 'Hologram',         variant: 'holographic', minLevel: 48, isAnimated: true, defaultIntensity: 88 },

  // High-Tier Frames (Lv 50-70)
  { id: 'legend',      label: 'Living Legend',    variant: 'legend',      minLevel: 50, isAnimated: true, defaultIntensity: 88 },
  { id: 'solar_flare', label: 'Solar Flare',      variant: 'solar_flare', minLevel: 52, isAnimated: true, defaultIntensity: 90 },
  { id: 'neon',        label: 'Neon Synapse',     variant: 'neon',        minLevel: 55, isAnimated: true, defaultIntensity: 85 },
  { id: 'geode',       label: 'Geode Cluster',    variant: 'geode',       minLevel: 58, isAnimated: true, defaultIntensity: 85 },
  { id: 'crystal',     label: 'Prismatic',        variant: 'crystal',     minLevel: 60, isAnimated: true, defaultIntensity: 80 },
  { id: 'starlight',   label: 'Starlight Ring',   variant: 'starlight',   minLevel: 62, isAnimated: true, defaultIntensity: 88 },
  { id: 'sanctum',     label: 'Sanctum Ring',     variant: 'sanctum',     minLevel: 65, isAnimated: true, defaultIntensity: 84 },
  { id: 'venom',       label: 'Venom Ring',       variant: 'venom',       minLevel: 68, isAnimated: true, defaultIntensity: 86 },
  { id: 'inferno',     label: 'Infernal Core',    variant: 'inferno',     minLevel: 70, isAnimated: true, defaultIntensity: 92 },
  
  // Exotic Frames (Lv 72-98)
  { id: 'nexus',       label: 'Nexus Core',       variant: 'nexus',       minLevel: 72, isAnimated: true, defaultIntensity: 91 },
  { id: 'frost',       label: 'Absolute Zero',    variant: 'frost',       minLevel: 75, isAnimated: true, defaultIntensity: 88 },
  { id: 'quantum',     label: 'Quantum Foam',     variant: 'quantum',     minLevel: 76, isAnimated: true, defaultIntensity: 94 },
  { id: 'eclipse',     label: 'Eclipse',          variant: 'eclipse',     minLevel: 78, isAnimated: true, defaultIntensity: 87 },
  { id: 'corrupted',   label: 'Corrupted Data',   variant: 'corrupted',   minLevel: 80, isAnimated: true, defaultIntensity: 95 },
  { id: 'aurora',      label: 'Aurora Crown',     variant: 'aurora',      minLevel: 82, isAnimated: true, defaultIntensity: 89 },
  { id: 'torment',     label: 'Torment',          variant: 'torment',     minLevel: 85, isAnimated: true, defaultIntensity: 94 },
  { id: 'noosphere',   label: 'Noosphere',        variant: 'noosphere',   minLevel: 86, isAnimated: true, defaultIntensity: 95 },
  { id: 'abyssal',     label: 'Abyssal Deep',     variant: 'abyssal',     minLevel: 88, isAnimated: true, defaultIntensity: 96 },
  { id: 'celestial',   label: 'Celestial',        variant: 'celestial',   minLevel: 90, isAnimated: true, defaultIntensity: 92 },
  { id: 'seraph',      label: 'Seraph Halo',      variant: 'seraph',      minLevel: 92, isAnimated: true, defaultIntensity: 93 },
  { id: 'supernova',   label: 'Supernova',        variant: 'supernova',   minLevel: 94, isAnimated: true, defaultIntensity: 98 },
  { id: 'event_horizon', label: 'Event Horizon',  variant: 'event_horizon', minLevel: 98, isAnimated: true, defaultIntensity: 100 },
  
  // Ultimate Frames (Lv 99+)
  { id: 'singularity', label: 'Singularity',      variant: 'singularity', minLevel: 99, isAnimated: true, defaultIntensity: 100 },
  { id: 'omega',       label: 'Omega Directive',  variant: 'omega',     minLevel: 100, isAnimated: true, defaultIntensity: 100 },
  { id: 'zone_heart',  label: 'Heart of the Zone',variant: 'zone_heart',  minLevel: 101, isAnimated: true, defaultIntensity: 100 },
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

  // ==================== NEW BRIGHTER/DARKER & UNIQUE (level 15–90) ====================
  {
    id: 'neon-pulse',
    label: 'Neon Pulse',
    minLevel: 15,
    isAnimated: true,
    gradient: 'linear-gradient(115deg, rgba(255,0,255,0.4), rgba(0,255,255,0.3) 50%, rgba(255,255,0,0.1) 80%)',
  },
  {
    id: 'electric-violet',
    label: 'Electric Violet',
    minLevel: 25,
    isAnimated: true,
    gradient: 'radial-gradient(circle at 70% 20%, rgba(180,0,255,0.45), rgba(30,0,60,0.35) 65%, transparent 90%)',
  },
  {
    id: 'sunset-inferno',
    label: 'Sunset Inferno',
    minLevel: 32,
    isAnimated: true,
    gradient: 'linear-gradient(125deg, rgba(255,100,0,0.5), rgba(220,20,60,0.35) 45%, rgba(30,0,0,0.4) 80%)',
  },
  {
    id: 'arctic-blast',
    label: 'Arctic Blast',
    minLevel: 20,
    isAnimated: true,
    gradient: 'linear-gradient(120deg, rgba(180,230,255,0.45), rgba(0,160,255,0.25) 55%, transparent 85%)',
  },
  {
    id: 'toxic-waste',
    label: 'Toxic Waste',
    minLevel: 28,
    isAnimated: true,
    gradient: 'repeating-linear-gradient(135deg, rgba(57,255,20,0.3) 0px, rgba(57,255,20,0.3) 5px, rgba(0,80,0,0.4) 5px, rgba(0,80,0,0.4) 15px)',
  },
  {
    id: 'voidwalker',
    label: 'Voidwalker',
    minLevel: 45,
    gradient: 'linear-gradient(110deg, rgba(10,10,20,0.7), rgba(80,0,120,0.4) 60%, transparent 90%)',
  },
  {
    id: 'prism-shard',
    label: 'Prism Shard',
    minLevel: 55,
    isAnimated: true,
    gradient: 'conic-gradient(from 120deg at 30% 40%, rgba(255,0,0,0.3), rgba(255,255,0,0.3), rgba(0,255,0,0.3), rgba(0,255,255,0.3), rgba(255,0,255,0.3), rgba(255,0,0,0.3))',
  },
  {
    id: 'radiant-dawn',
    label: 'Radiant Dawn',
    minLevel: 60,
    isAnimated: true,
    gradient: 'radial-gradient(ellipse at 50% 100%, rgba(255,220,100,0.5), rgba(255,100,0,0.25) 50%, rgba(255,200,50,0.1) 80%, transparent 100%)',
  },
  {
    id: 'shadowfell',
    label: 'Shadowfell',
    minLevel: 48,
    isAnimated: true,
    gradient: 'linear-gradient(130deg, rgba(0,0,0,0.6), rgba(50,0,50,0.4) 45%, rgba(100,0,0,0.2) 70%, transparent 90%)',
  },
  {
    id: 'plasma-bolt',
    label: 'Plasma Bolt',
    minLevel: 38,
    isAnimated: true,
    gradient: 'radial-gradient(circle at 15% 85%, rgba(0,200,255,0.5), rgba(255,255,255,0.2) 40%, rgba(0,50,150,0.3) 70%, transparent 95%)',
  },
  {
    id: 'candy-burst',
    label: 'Candy Burst',
    minLevel: 42,
    isAnimated: true,
    gradient: 'linear-gradient(115deg, rgba(255,20,147,0.4), rgba(255,255,0,0.35) 35%, rgba(0,255,200,0.2) 65%, transparent 85%)',
  },
  {
    id: 'obsidian-edge',
    label: 'Obsidian Edge',
    minLevel: 62,
    gradient: 'linear-gradient(155deg, rgba(15,15,20,0.7), rgba(30,30,40,0.5) 30%, rgba(0,0,0,0.8) 70%, transparent 90%)',
  },
  {
    id: 'celestial-halo',
    label: 'Celestial Halo',
    minLevel: 66,
    isAnimated: true,
    gradient: 'radial-gradient(circle at 50% 50%, rgba(255,255,200,0.5), rgba(200,200,255,0.2) 35%, rgba(100,100,150,0.1) 60%, transparent 85%)',
  },
  {
    id: 'glitch',
    label: 'Glitch',
    minLevel: 50,
    isAnimated: true,
    gradient: 'repeating-linear-gradient(45deg, rgba(255,0,255,0.2) 0px, rgba(255,0,255,0.2) 4px, rgba(0,255,255,0.1) 4px, rgba(0,255,255,0.1) 12px, rgba(255,255,0,0.05) 12px, rgba(255,255,0,0.05) 16px)',
  },
  {
    id: 'hypernova',
    label: 'Hypernova',
    minLevel: 75,
    isAnimated: true,
    gradient: 'radial-gradient(circle at 25% 50%, rgba(255,255,180,0.6), rgba(255,80,0,0.4) 40%, rgba(100,0,200,0.3) 70%, transparent 100%)',
  },
  {
    id: 'midnight-chrome',
    label: 'Midnight Chrome',
    minLevel: 68,
    gradient: 'linear-gradient(135deg, rgba(60,60,80,0.6), rgba(100,100,140,0.3) 25%, rgba(20,20,30,0.7) 60%, transparent 90%)',
  },
  {
    id: 'voltage-arc',
    label: 'Voltage Arc',
    minLevel: 44,
    isAnimated: true,
    gradient: 'conic-gradient(from 60deg at 80% 20%, rgba(0,255,255,0.4), rgba(255,0,255,0.3), rgba(0,255,255,0.4))',
  },
  {
    id: 'deep-abyss',
    label: 'Deep Abyss',
    minLevel: 80,
    gradient: 'radial-gradient(circle at 10% 90%, rgba(0,0,20,0.8), rgba(0,0,0,0.6) 50%, rgba(0,40,80,0.3) 80%, transparent 100%)',
  },
  {
    id: 'solar-corona',
    label: 'Solar Corona',
    minLevel: 85,
    isAnimated: true,
    gradient: 'radial-gradient(circle at 60% 40%, rgba(255,200,0,0.5), rgba(255,50,0,0.3) 45%, rgba(255,255,150,0.2) 70%, transparent 95%)',
  },
  {
    id: 'starlight-veil',
    label: 'Starlight Veil',
    minLevel: 78,
    isAnimated: true,
    gradient: 'repeating-radial-gradient(circle at 30% 60%, rgba(255,255,200,0.2) 0px, rgba(255,255,200,0.2) 2px, transparent 2px, transparent 12px)',
  },
  {
    id: 'quantum-foam',
    label: 'Quantum Foam',
    minLevel: 90,
    isAnimated: true,
    gradient: 'repeating-conic-gradient(from 0deg, rgba(0,255,128,0.2) 0deg, rgba(255,0,128,0.2) 45deg, rgba(0,128,255,0.2) 90deg, rgba(255,128,0,0.2) 135deg, rgba(0,255,128,0.2) 180deg)',
  },
];

// ---------------------------------------------------------------------------
// 5. VFX OVERLAYS
// ---------------------------------------------------------------------------
export const AVATAR_EFFECT_PRESETS: AvatarEffectPreset[] = [
  { id: 'none',         label: 'Clear' },

  // Tier 1: Subtle & Clean (Lv. 5-15)
  { id: 'scanlines',    label: 'Term/Link',        minLevel: 5,  defaultColor: '#22d3ee', defaultIntensity: 60, defaultSpeed: 1.0 },
  { id: 'ash',          label: 'Volcanic Ash',     minLevel: 8,  defaultColor: '#9ca3af', defaultIntensity: 55, defaultSpeed: 0.8 },
  { id: 'spores',       label: 'Irradiated',       minLevel: 10, defaultColor: '#84cc16', defaultIntensity: 65, defaultSpeed: 0.9 },
  { id: 'rain',         label: 'Acid Rain',        minLevel: 15, defaultColor: '#22c55e', defaultIntensity: 70, defaultSpeed: 1.2 },

  // Tier 2: Elemental (Lv. 18-35)
  { id: 'blizzard',     label: 'Blizzard',         minLevel: 18, defaultColor: '#e0f2fe', defaultIntensity: 75, defaultSpeed: 1.1 },
  { id: 'embers',       label: 'Ash & Ember',      minLevel: 25, defaultColor: '#f97316', defaultIntensity: 80, defaultSpeed: 0.7 },
  { id: 'fireflies',    label: 'Fireflies',        minLevel: 28, defaultColor: '#facc15', defaultIntensity: 70, defaultSpeed: 1.4 },
  { id: 'wind-shear',   label: 'Wind Shear',       minLevel: 22, defaultColor: '#0ea5e9', defaultIntensity: 65, defaultSpeed: 1.5 },

  // Tier 3: Anomalous (Lv. 30-50)
  { id: 'glitch',       label: 'Psy-Storm',        minLevel: 30, defaultColor: '#34e2ff', defaultIntensity: 85, defaultSpeed: 1.3 },
  { id: 'toxic-gas',    label: 'Toxic Fumes',      minLevel: 38, defaultColor: '#84e215', defaultIntensity: 80, defaultSpeed: 0.9 },
  { id: 'matrix',       label: 'Data-Stream',      minLevel: 40, defaultColor: '#10b981', defaultIntensity: 75, defaultSpeed: 1.6 },
  { id: 'wisps',        label: 'Void Wisps',       minLevel: 45, defaultColor: '#a78bfa', defaultIntensity: 82, defaultSpeed: 1.1 },
  { id: 'plasma-flow',  label: 'Plasma Flow',      minLevel: 35, defaultColor: '#ec4899', defaultIntensity: 88, defaultSpeed: 1.2 },

  // Tier 4: Hazardous (Lv. 50-75)
  { id: 'overcharge',   label: 'Overcharge',       minLevel: 50, defaultColor: '#39ff14', defaultIntensity: 90, defaultSpeed: 0.8 },
  { id: 'lightning',    label: 'Arc Flash',        minLevel: 55, defaultColor: '#7dd3fc', defaultIntensity: 92, defaultSpeed: 2.0 },
  { id: 'cosmos',       label: 'Deep Space',       minLevel: 65, defaultColor: '#f5d4ff', defaultIntensity: 78, defaultSpeed: 0.6 },
  { id: 'blood-rain',   label: 'Blood Rain',       minLevel: 75, defaultColor: '#dc2626', defaultIntensity: 85, defaultSpeed: 1.0 },
  { id: 'radiation',    label: 'Radiation Pulse',  minLevel: 58, defaultColor: '#facc15', defaultIntensity: 86, defaultSpeed: 0.5 },
  { id: 'storm-core',   label: 'Storm Core',       minLevel: 62, defaultColor: '#60a5fa', defaultIntensity: 88, defaultSpeed: 1.4 },

  // Tier 5: Legendary (Lv. 80+)
  { id: 'blackhole',    label: 'Event Horizon',    minLevel: 85, defaultColor: '#0c0a0a', defaultIntensity: 95, defaultSpeed: 0.7 },
  { id: 'ascension',    label: 'Ascension',        minLevel: 95, defaultColor: '#fbbf24', defaultIntensity: 93, defaultSpeed: 0.8 },
  { id: 'omega-burst',  label: 'Omega Shock',      minLevel: 100, defaultColor: '#f5d4ff', defaultIntensity: 100, defaultSpeed: 1.8 },

  // New Exotic Effects
  { id: 'void-fracture',label: 'Void Fracture',    minLevel: 70, defaultColor: '#3730a3', defaultIntensity: 89, defaultSpeed: 0.9 },
  { id: 'temporal-flux', label: 'Temporal Flux',   minLevel: 76, defaultColor: '#1e40af', defaultIntensity: 84, defaultSpeed: 1.3 },
  { id: 'eclipse-aura',  label: 'Eclipse Aura',    minLevel: 82, defaultColor: '#1f2937', defaultIntensity: 87, defaultSpeed: 0.6 },
  { id: 'infernal-haze', label: 'Infernal Haze',   minLevel: 68, defaultColor: '#ff0000', defaultIntensity: 91, defaultSpeed: 1.1 },
  { id: 'quantum-shimmer', label: 'Quantum Shimmer', minLevel: 72, defaultColor: '#00ffff', defaultIntensity: 80, defaultSpeed: 1.7 },
  { id: 'stellar-bloom',  label: 'Stellar Bloom',   minLevel: 78, defaultColor: '#fde047', defaultIntensity: 86, defaultSpeed: 0.7 },
  { id: 'vortex-spin',    label: 'Vortex Spin',     minLevel: 48, defaultColor: '#8b5cf6', defaultIntensity: 83, defaultSpeed: 1.9 },
  { id: 'frost-aura',     label: 'Frost Aura',      minLevel: 52, defaultColor: '#0ea5e9', defaultIntensity: 81, defaultSpeed: 0.9 },
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
export function getAvatarEffectPreset(id: string | null | undefined): AvatarEffectPreset | null {
  if (!id) return null;
  return AVATAR_EFFECT_PRESETS.find(preset => preset.id === id) ?? null;
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
