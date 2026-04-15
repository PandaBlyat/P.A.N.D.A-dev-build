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
  { id: 'stalker',   label: 'Stalker',        glyph: '🕶️', category: 'default' },
  { id: 'smiley',    label: 'Happy',          glyph: '😊', category: 'default' },
  { id: 'robot',     label: 'Bot',            glyph: '🤖', category: 'default' },
  { id: 'cat',       label: 'Cat',            glyph: '🐱', category: 'default' },
  { id: 'dog',       label: 'Dog',            glyph: '🐶', category: 'default' },
  { id: 'bird',      label: 'Bird',           glyph: '🐦', category: 'default' },
  { id: 'fish',      label: 'Fish',           glyph: '🐟', category: 'default' },
  { id: 'bug',       label: 'Bug',            glyph: '🐛', category: 'default' },
  { id: 'flower',    label: 'Bloom',          glyph: '🌸', category: 'default' },
  { id: 'tree',      label: 'Oak',            glyph: '🌳', category: 'default' },
  { id: 'moon',      label: 'Lunar',          glyph: '🌙', category: 'default' },
  { id: 'sun',       label: 'Solar',          glyph: '☀️', category: 'default' },
  { id: 'cloud',     label: 'Cloud',          glyph: '☁️', category: 'default' },

  // Gear
  { id: 'helmet',    label: 'Exoskeleton',    glyph: '⛑️', category: 'gear' },
  { id: 'shield',    label: 'Guardian',       glyph: '🛡️', category: 'gear' },
  { id: 'compass',   label: 'Pathfinder',     glyph: '🧭', category: 'gear' },
  { id: 'map',       label: 'Cartographer',   glyph: '🗺️', category: 'gear' },
  { id: 'lamp',      label: 'Nightwatch',     glyph: '🔦', category: 'gear', minLevel: 5 },
  { id: 'gasmask',   label: 'Respirator',     glyph: '🤿', category: 'gear', minLevel: 10 },
  { id: 'crosshair', label: 'Sniper',         glyph: '⌖',  category: 'gear', minLevel: 15 },
  { id: 'knife',     label: 'Blade',          glyph: '🔪', category: 'gear', minLevel: 1 },
  { id: 'axe',       label: 'Chopper',        glyph: '🪓', category: 'gear', minLevel: 3 },
  { id: 'hammer',    label: 'Smith',          glyph: '🔨', category: 'gear', minLevel: 3 },
  { id: 'wrench',    label: 'Mechanic',       glyph: '🔧', category: 'gear', minLevel: 2 },
  { id: 'gears',     label: 'Engineer',       glyph: '⚙️', category: 'gear', minLevel: 4 },
  { id: 'binoculars',label: 'Scout',          glyph: '🔭', category: 'gear', minLevel: 5 },
  { id: 'microscope',label: 'Scientist',      glyph: '🔬', category: 'gear', minLevel: 10 },
  { id: 'syringe',   label: 'Medic',          glyph: '💉', category: 'gear', minLevel: 8 },
  { id: 'pill',      label: 'Chemist',        glyph: '💊', category: 'gear', minLevel: 8 },
  { id: 'goggles',   label: 'Scavenger',      glyph: '🥽', category: 'gear', minLevel: 3 },
  { id: 'backpack',  label: 'Pack',           glyph: '🎒', category: 'gear', minLevel: 2 },
  { id: 'battery',   label: 'Charged',        glyph: '🔋', category: 'gear', minLevel: 6 },
  { id: 'flare',     label: 'Signal',         glyph: '📡', category: 'gear', minLevel: 7 },
  { id: 'antenna',   label: 'Receiver',       glyph: '📶', category: 'gear', minLevel: 9 },
  { id: 'cable',     label: 'Link',           glyph: '🔌', category: 'gear', minLevel: 4 },
  { id: 'boots',     label: 'Trekker',        glyph: '👢', category: 'gear', minLevel: 1 },
  { id: 'vest',      label: 'Plated',         glyph: '🦺', category: 'gear', minLevel: 12 },
  
  // Combat -> Gear
  { id: 'sword',     label: 'Blade',          glyph: '🗡️', category: 'gear', minLevel: 2 },
  { id: 'spear',     label: 'Lancer',         glyph: '🔱', category: 'gear', minLevel: 8 },
  { id: 'bow',       label: 'Archer',         glyph: '🏹', category: 'gear', minLevel: 6 },
  { id: 'gun',       label: 'Gunslinger',     glyph: '🔫', category: 'gear', minLevel: 12 },
  { id: 'grenade',   label: 'Demolisher',     glyph: '💣', category: 'gear', minLevel: 15 },
  { id: 'shield_cross',label: 'Crusader',     glyph: '⚔️🛡️', category: 'gear', minLevel: 20 },
  { id: 'mace',      label: 'Bonecrusher',    glyph: '🔨', category: 'gear', minLevel: 10 },
  { id: 'dagger',    label: 'Assassin',       glyph: '🗡️', category: 'gear', minLevel: 14 },
  
  // Tech -> Gear
  { id: 'cpu',       label: 'Processor',      glyph: '🖥️', category: 'gear', minLevel: 5 },
  { id: 'microchip', label: 'Microchip',      glyph: '💠', category: 'gear', minLevel: 8 },
  { id: 'drone',     label: 'Drone',          glyph: '🚁', category: 'gear', minLevel: 12 },
  { id: 'hacker',    label: 'Hacker',         glyph: '💻', category: 'gear', minLevel: 10 },
  { id: 'gamepad',   label: 'Gamer',          glyph: '🎮', category: 'gear', minLevel: 3 },
  { id: 'vr',        label: 'Virtual',        glyph: '🥽', category: 'gear', minLevel: 15 },
  { id: 'headset',   label: 'Commander',      glyph: '🎧', category: 'gear', minLevel: 7 },
  { id: 'radar_dish',label: 'Radar',          glyph: '📡', category: 'gear', minLevel: 9 },
  
  // Survival -> Gear
  { id: 'tent',      label: 'Camper',         glyph: '⛺', category: 'gear', minLevel: 3 },
  { id: 'firewood',  label: 'Pyre',           glyph: '🪵', category: 'gear', minLevel: 4 },
  { id: 'canteen',   label: 'Hydrator',       glyph: '🧴', category: 'gear', minLevel: 5 },
  { id: 'rope',      label: 'Rigger',         glyph: '🪢', category: 'gear', minLevel: 6 },
  { id: 'first_aid', label: 'Medic',          glyph: '🩹', category: 'gear', minLevel: 8 },
  { id: 'radar',     label: 'Tracker',        glyph: '📡', category: 'gear', minLevel: 10 },

  // Faction / Flora & Fauna
  { id: 'wolf',      label: 'Wolf',           glyph: '🐺', category: 'faction' },
  { id: 'bear',      label: 'Bear',           glyph: '🐻', category: 'faction' },
  { id: 'radio',     label: 'Operator',       glyph: '📡', category: 'faction' },
  { id: 'quill',     label: 'Scribe',         glyph: '✒️', category: 'faction' },
  { id: 'spider',    label: 'Arachnid',       glyph: '🕷️', category: 'faction', minLevel: 10 },
  { id: 'scorpion',  label: 'Stinger',        glyph: '🦂', category: 'faction', minLevel: 15 },
  { id: 'bat',       label: 'Nocturnal',      glyph: '🦇', category: 'faction', minLevel: 20 },
  { id: 'dragon',    label: 'Chimera',        glyph: '🐉', category: 'faction', minLevel: 35 },
  { id: 'eagle',     label: 'Soarer',         glyph: '🦅', category: 'faction', minLevel: 5 },
  { id: 'owl',       label: 'Wise',           glyph: '🦉', category: 'faction', minLevel: 8 },
  { id: 'raven',     label: 'Omen',           glyph: '🐦‍⬛', category: 'faction', minLevel: 12 },
  { id: 'snake',     label: 'Serpent',        glyph: '🐍', category: 'faction', minLevel: 10 },
  { id: 'fox',       label: 'Trickster',      glyph: '🦊', category: 'faction', minLevel: 6 },
  { id: 'lion',      label: 'Pride',          glyph: '🦁', category: 'faction', minLevel: 18 },
  { id: 'tiger',     label: 'Stripes',        glyph: '🐯', category: 'faction', minLevel: 20 },
  { id: 'shark',     label: 'Predator',       glyph: '🦈', category: 'faction', minLevel: 25 },
  { id: 'whale',     label: 'Leviathan',      glyph: '🐋', category: 'faction', minLevel: 30 },
  { id: 'octopus',   label: 'Kraken',         glyph: '🐙', category: 'faction', minLevel: 28 },
  { id: 'phoenix',   label: 'Phoenix',        glyph: '🐦‍🔥', category: 'faction', minLevel: 45 },
  { id: 'griffin',   label: 'Griffin',        glyph: '🦅🏛️', category: 'faction', minLevel: 40 },
  { id: 'pegasus',   label: 'Pegasus',        glyph: '🐴✨', category: 'faction', minLevel: 42 },

  // Ranks
  { id: 'star',      label: 'Star',           glyph: '⭐', category: 'ranks' },
  { id: 'medal',     label: 'Medalist',       glyph: '🎖️', category: 'ranks', minLevel: 5 },
  { id: 'trophy',    label: 'Trophy',         glyph: '🏆', category: 'ranks', minLevel: 10 },
  { id: 'skull',     label: 'Veteran',        glyph: '💀', category: 'ranks', minLevel: 20 },
  { id: 'swords',    label: 'Gladiator',      glyph: '⚔️', category: 'ranks', minLevel: 30 },
  { id: 'crown',     label: 'Champion',       glyph: '👑', category: 'ranks', minLevel: 40 },
  { id: 'gem',       label: 'Jewel',          glyph: '💎', category: 'ranks', minLevel: 15 },
  { id: 'ring',      label: 'Champion Ring',  glyph: '💍', category: 'ranks', minLevel: 20 },
  { id: 'rocket',    label: 'Vanguard',       glyph: '🚀', category: 'ranks', minLevel: 25 },
  { id: 'satellite', label: 'Orbital',        glyph: '🛰️', category: 'ranks', minLevel: 30 },
  { id: 'target',    label: 'Marksman',       glyph: '🎯', category: 'ranks', minLevel: 12 },
  { id: 'flag',      label: 'Standard',       glyph: '🏁', category: 'ranks', minLevel: 8 },
  { id: 'podium',    label: 'Victor',         glyph: '🥇', category: 'ranks', minLevel: 18 },
  { id: 'ribbon',    label: 'Commendation',   glyph: '🎗️', category: 'ranks', minLevel: 6 },
  { id: 'key',       label: 'Gatekeeper',     glyph: '🔑', category: 'ranks', minLevel: 14 },

  // The Zone / Elements (nature moved here)
  { id: 'flame',     label: 'Ember',          glyph: '🔥', category: 'zone' },
  { id: 'atom',      label: 'Radiant',        glyph: '☢️', category: 'zone', minLevel: 5 },
  { id: 'bio',       label: 'Biohazard',      glyph: '☣️', category: 'zone', minLevel: 10 },
  { id: 'blood',     label: 'Lifeblood',      glyph: '🩸', category: 'zone', minLevel: 25 },
  { id: 'tornado',   label: 'Vortex',         glyph: '🌪️', category: 'zone', minLevel: 30 },
  { id: 'meteor',    label: 'Impact',         glyph: '☄️', category: 'zone', minLevel: 45 },
  { id: 'ice',       label: 'Frost',          glyph: '❄️', category: 'zone', minLevel: 8 },
  { id: 'wave',      label: 'Tsunami',        glyph: '🌊', category: 'zone', minLevel: 15 },
  { id: 'volcano',   label: 'Eruption',       glyph: '🌋', category: 'zone', minLevel: 20 },
  { id: 'earthquake',label: 'Quake',          glyph: '⛰️', category: 'zone', minLevel: 18 },
  { id: 'sandstorm', label: 'Dust',           glyph: '🏜️', category: 'zone', minLevel: 12 },
  { id: 'toxin',     label: 'Toxin',          glyph: '☠️', category: 'zone', minLevel: 22 },
  { id: 'fungal',    label: 'Fungal',         glyph: '🍄', category: 'zone', minLevel: 16 },
  { id: 'hurricane', label: 'Cyclone',        glyph: '🌀', category: 'zone', minLevel: 28 },
  { id: 'abyss',     label: 'Abyss',          glyph: '🕳️', category: 'zone', minLevel: 35 },
  
  // Nature -> Zone
  { id: 'leaf',      label: 'Verdant',        glyph: '🍃', category: 'zone', minLevel: 2 },
  { id: 'seedling',  label: 'Bloom',          glyph: '🌱', category: 'zone', minLevel: 1 },
  { id: 'mushroom',  label: 'Mycelial',       glyph: '🍄', category: 'zone', minLevel: 8 },
  { id: 'mountain',  label: 'Peak',           glyph: '🏔️', category: 'zone', minLevel: 10 },
  { id: 'river',     label: 'Current',        glyph: '🌊', category: 'zone', minLevel: 6 },
  { id: 'desert',    label: 'Dune',           glyph: '🏜️', category: 'zone', minLevel: 12 },
  { id: 'forest',    label: 'Wildwood',       glyph: '🌲', category: 'zone', minLevel: 5 },
  { id: 'cave',      label: 'Deep Cavern',    glyph: '🪨', category: 'zone', minLevel: 14 },

  // Mystic / Anomalous (occult moved here)
  { id: 'crystal',   label: 'Artefact',       glyph: '🔮', category: 'mystic' },
  { id: 'eye',       label: 'All-seeing',     glyph: '👁️', category: 'mystic', minLevel: 8 },
  { id: 'ghost',     label: 'Specter',        glyph: '👻', category: 'mystic', minLevel: 12 },
  { id: 'lightning', label: 'Anomaly',        glyph: '⚡', category: 'mystic', minLevel: 18 },
  { id: 'alien',     label: 'Controller',     glyph: '👽', category: 'mystic', minLevel: 25 },
  { id: 'demon',     label: 'Burer',          glyph: '👹', category: 'mystic', minLevel: 35 },
  { id: 'crescent',  label: 'Lunar',          glyph: '🌙', category: 'mystic', minLevel: 5 },
  { id: 'sparkles',  label: 'Stargazer',      glyph: '✨', category: 'mystic', minLevel: 10 },
  { id: 'magic',     label: 'Sorcerer',       glyph: '🪄', category: 'mystic', minLevel: 15 },
  { id: 'potion',    label: 'Alchemist',      glyph: '🧪', category: 'mystic', minLevel: 14 },
  { id: 'tarot',     label: 'Oracle',         glyph: '🃏', category: 'mystic', minLevel: 20 },
  { id: 'hourglass', label: 'Chronomancer',   glyph: '⏳', category: 'mystic', minLevel: 22 },
  { id: 'infinity',  label: 'Eternal',        glyph: '♾️', category: 'mystic', minLevel: 30 },
  { id: 'nazar',     label: 'Evil Eye',       glyph: '🧿', category: 'mystic', minLevel: 15 },
  { id: 'vampire',   label: 'Bloodletter',    glyph: '🧛', category: 'mystic', minLevel: 28 },
  { id: 'witch',     label: 'Hex',            glyph: '🧙', category: 'mystic', minLevel: 18 },
  { id: 'rune',      label: 'Runic',          glyph: '🔣', category: 'mystic', minLevel: 25 },
  
  // Occult -> Mystic
  { id: 'pentacle',  label: 'Pentacle',       glyph: '⭐', category: 'mystic', minLevel: 20 },
  { id: 'ouija',     label: 'Planchette',     glyph: '🔮', category: 'mystic', minLevel: 18 },
  { id: 'candle',    label: 'Candlelight',    glyph: '🕯️', category: 'mystic', minLevel: 12 },
  { id: 'mirror',    label: 'Reflection',     glyph: '🪞', category: 'mystic', minLevel: 16 },
  { id: 'skull_candle',label: 'Necromancer',  glyph: '💀🕯️', category: 'mystic', minLevel: 30 },
  { id: 'tome',      label: 'Grimoire',       glyph: '📖', category: 'mystic', minLevel: 22 },

  // Legends (High Tier)
  { id: 'galaxy',    label: 'The Void',       glyph: '🌌', category: 'legend', minLevel: 40 },
  { id: 'hamsa',     label: 'Oasis',          glyph: '🪬', category: 'legend', minLevel: 45 },
  { id: 'trident',   label: 'Warlord',        glyph: '🔱', category: 'legend', minLevel: 50 },
  { id: 'blackhole', label: 'Singularity',    glyph: '⚫', category: 'legend', minLevel: 55 },
  { id: 'quasar',    label: 'Pulsar',         glyph: '🌟', category: 'legend', minLevel: 50 },
  { id: 'supernova', label: 'Nova',           glyph: '💥', category: 'legend', minLevel: 60 },
  { id: 'titan',     label: 'Titan',          glyph: '🗿', category: 'legend', minLevel: 42 },
  { id: 'angel',     label: 'Seraph',         glyph: '👼', category: 'legend', minLevel: 38 },
  { id: 'reaper',    label: 'Mortis',         glyph: '⚰️', category: 'legend', minLevel: 48 },
  { id: 'phoenix_leg',label: 'Rebirth',       glyph: '🐦‍🔥', category: 'legend', minLevel: 52 },
  { id: 'voidwalker',label: 'Voidwalker',     glyph: '🌑', category: 'legend', minLevel: 58 },
];

// ---------------------------------------------------------------------------
// 2. COLORS / TINTS
// ---------------------------------------------------------------------------
export const AVATAR_COLOR_PRESETS: AvatarColorPreset[] = [
  // ==================== BASIC / FACTIONS (original + extras) ====================
  { id: 'loner',       label: 'Loner Green',     color: '#5eaa3a' },
  { id: 'clearsky',    label: 'Clear Sky',       color: '#3aaa8a' },
  { id: 'freedom',     label: 'Freedom',         color: '#8fd46a' },
  { id: 'duty',        label: 'Duty',            color: '#d87861' },
  { id: 'bandit',      label: 'Bandit',          color: '#7d6a52' },
  { id: 'mercenary',   label: 'Mercenary',       color: '#6fa1d4' },
  { id: 'ecologist',   label: 'Ecologist',       color: '#7fb2e8' },
  { id: 'military',    label: 'Military',        color: '#a0a03a' },
  
  // Additional basic / starter colors (no level requirement)
  { id: 'charcoal',    label: 'Charcoal',        color: '#36454f' },
  { id: 'rust',        label: 'Rust',            color: '#b7410e' },
  { id: 'mud',         label: 'Muddy',           color: '#6b4c3a' },
  { id: 'ash',         label: 'Ash Gray',        color: '#9ca3af' },
  { id: 'sand',        label: 'Desert Sand',     color: '#d2b48c' },
  { id: 'olive',       label: 'Olive Drab',      color: '#6b8e23' },
  { id: 'slate',       label: 'Slate',           color: '#708090' },
  { id: 'cream',       label: 'Cream',           color: '#f5f5dc' },
  { id: 'crimson_basic', label: 'Blood Rust',    color: '#a52a2a' }, // simple red-brown

  // ==================== METALS & ALLOYS ====================
  { id: 'steel',       label: 'Zone Steel',      color: '#a0a8b8', minLevel: 10 },
  { id: 'bronze',      label: 'Dusk Bronze',     color: '#b87333', minLevel: 10 },
  { id: 'iron',        label: 'Forged Iron',     color: '#5c5c5c', minLevel: 8 },
  { id: 'copper',      label: 'Rusted Copper',   color: '#b87333', minLevel: 12 }, // distinct from bronze
  { id: 'silver',      label: 'Tarnished Silver',color: '#c0c0c0', minLevel: 15 },
  { id: 'gold',        label: 'Rough Gold',      color: '#d4af37', minLevel: 20 },
  { id: 'titanium',    label: 'Titanium',        color: '#878f99', minLevel: 25 },
  { id: 'platinum',    label: 'True Platinum',   color: '#f3f4f6', minLevel: 50 },
  { id: 'obsidian',    label: 'Obsidian Edge',   color: '#1f1f2b', minLevel: 30 },
  { id: 'chromium',    label: 'Chrome Mirror',   color: '#dce4f0', minLevel: 35 },

  // ==================== OCEAN / SKY ====================
  { id: 'ocean',       label: 'Deep Ocean',      color: '#0ea5e9', minLevel: 15 },
  { id: 'sky',         label: 'Sky Blue',        color: '#87ceeb', minLevel: 5 },
  { id: 'teal',        label: 'Toxic Teal',      color: '#14b8a6', minLevel: 12 },
  { id: 'navy',        label: 'Night Navy',      color: '#1e3a8a', minLevel: 18 },
  { id: 'cyan_signal', label: 'Clear Signal',    color: '#22d3ee', minLevel: 30 },
  { id: 'ice',         label: 'Permafrost',      color: '#b0e0e6', minLevel: 22 },
  { id: 'cobalt',      label: 'Cobalt',          color: '#0047ab', minLevel: 28 },
  { id: 'abyss',       label: 'Abyssal Blue',    color: '#1e3a8a', minLevel: 45 },

  // ==================== FIRE / BLOOD / WARM ====================
  { id: 'crimson',     label: 'Crimson Ember',   color: '#e05555', minLevel: 20 },
  { id: 'blood',       label: 'Fresh Blood',     color: '#991b1b', minLevel: 35 },
  { id: 'fire',        label: 'Wildfire',        color: '#ff4500', minLevel: 15 },
  { id: 'sunset',      label: 'Sunset',          color: '#ff7f50', minLevel: 12 },
  { id: 'magma',       label: 'Magma',           color: '#ff4d00', minLevel: 25 },
  { id: 'rust_burned', label: 'Burned Rust',     color: '#8b3a3a', minLevel: 18 },
  { id: 'scarlet',     label: 'Scarlet',         color: '#ff2400', minLevel: 30 },
  { id: 'vampire',     label: 'Vampire Red',     color: '#880000', minLevel: 40 },
  { id: 'cherry',      label: 'Cherry',          color: '#de3163', minLevel: 22 },

  // ==================== TOXIC / RADIOACTIVE / ANOMALOUS ====================
  { id: 'toxic',       label: 'Toxic Yellow',    color: '#eab308', minLevel: 25 },
  { id: 'radioactive', label: 'Reactor Green',   color: '#39ff14', minLevel: 50 },
  { id: 'biohazard',   label: 'Biohazard Lime',  color: '#a3ff00', minLevel: 28 },
  { id: 'neon_green',  label: 'Neon Anomaly',    color: '#0eff00', minLevel: 35 },
  { id: 'irradiated',  label: 'Irradiated',      color: '#c6ff00', minLevel: 42 },
  { id: 'waste',       label: 'Toxic Waste',     color: '#8fce00', minLevel: 20 },
  { id: 'glow',        label: 'Glowstick',       color: '#ccff00', minLevel: 30 },

  // ==================== MYSTIC / PSYCHIC / ANOMALOUS VIOLET ====================
  { id: 'neon-violet', label: 'Anomaly Violet',  color: '#a855f7', minLevel: 30 },
  { id: 'purple_psi',  label: 'Psi Purple',      color: '#8b00ff', minLevel: 25 },
  { id: 'magenta',     label: 'Magenta Field',   color: '#ff00ff', minLevel: 38 },
  { id: 'orchid',      label: 'Orchid',          color: '#da70d6', minLevel: 20 },
  { id: 'dark_purple', label: 'Void Purple',     color: '#301934', minLevel: 48 },
  { id: 'amethyst',    label: 'Amethyst',        color: '#9966cc', minLevel: 32 },
  { id: 'lilac',       label: 'Lilac',           color: '#c8a2c8', minLevel: 15 },

  // ==================== NATURE / ZONE ====================
  { id: 'moss',        label: 'Moss',            color: '#8a9a5b', minLevel: 8 },
  { id: 'pine',        label: 'Pine Green',      color: '#014421', minLevel: 12 },
  { id: 'swamp',       label: 'Swamp',           color: '#5c5c3b', minLevel: 10 },
  { id: 'mushroom',    label: 'Fungal',          color: '#c47e5a', minLevel: 18 },
  { id: 'bark',        label: 'Bark',            color: '#5c4033', minLevel: 6 },
  { id: 'lichen',      label: 'Lichen',          color: '#bdc48e', minLevel: 5 },
  { id: 'spore',       label: 'Spore Orange',    color: '#e67e22', minLevel: 22 },
  { id: 'grave',       label: 'Grave Earth',     color: '#4d3e2e', minLevel: 15 },

  // ==================== RENEGADE / MONOLITH / LEGENDARY ====================
  { id: 'renegade',    label: 'Renegade',        color: '#b85a8c', minLevel: 20 },
  { id: 'monolith',    label: 'Monolith Gold',   color: '#c4a040', minLevel: 40 },
  { id: 'blackhole',   label: 'Black Hole',      color: '#111111', minLevel: 55 },
  { id: 'white_dwarf', label: 'White Dwarf',     color: '#f0f0f0', minLevel: 55 },
  { id: 'singularity', label: 'Singularity',     color: '#2b2b2b', minLevel: 60 },
  { id: 'cosmic',      label: 'Cosmic Violet',   color: '#4b0082', minLevel: 58 },
  { id: 'nebula',      label: 'Nebula',          color: '#dda0dd', minLevel: 50 },
  { id: 'quasar',      label: 'Quasar',          color: '#ffdf00', minLevel: 65 },
  { id: 'aurora',      label: 'Aurora',          color: '#00ffaa', minLevel: 52 },
  { id: 'void',        label: 'The Void',        color: '#0a0a0a', minLevel: 70 },

  // ==================== EXTRA COOL COLORS (mid-high level) ====================
  { id: 'electric',    label: 'Electric Blue',   color: '#00bfff', minLevel: 28 },
  { id: 'plasma',      label: 'Plasma',          color: '#e65c00', minLevel: 32 },
  { id: 'phoenix',     label: 'Phoenix Fire',    color: '#ff8c00', minLevel: 45 },
  { id: 'frostbite',   label: 'Frostbite',      color: '#00ffff', minLevel: 33 },
  { id: 'poison',      label: 'Poison Dart',    color: '#88ff11', minLevel: 27 },
  { id: 'emp',         label: 'EMP',            color: '#b0e0e6', minLevel: 24 },
  { id: 'hologram',    label: 'Hologram',       color: '#e0b0ff', minLevel: 36 },
  { id: 'inferno',     label: 'Inferno',        color: '#ff3300', minLevel: 38 },
  { id: 'blizzard',    label: 'Blizzard',       color: '#e0ffff', minLevel: 26 },
  { id: 'nightshade',  label: 'Nightshade',     color: '#3c1e4a', minLevel: 34 },
  { id: 'warlord',     label: 'Warlord Bronze', color: '#cd7f32', minLevel: 30 },
  { id: 'beast',       label: 'Beast Brown',    color: '#8b5a2b', minLevel: 12 },
  { id: 'mirage',      label: 'Mirage Gold',    color: '#e6c200', minLevel: 24 },
  { id: 'radar',       label: 'Radar Green',    color: '#00cc66', minLevel: 16 },
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
  // ==================== DEFAULT / STANDARD ====================
  {
    id: 'default', label: 'Standard',
    gradient: 'linear-gradient(115deg, color-mix(in srgb, var(--accent) 16%, transparent), transparent 48%), color-mix(in srgb, var(--bg-card) 88%, transparent)',
  },
  {
    id: 'faint-mist', label: 'Faint Mist',
    gradient: 'linear-gradient(120deg, rgba(128,128,128,0.1), transparent 70%)',
  },
  {
    id: 'soft-ember', label: 'Soft Ember',
    gradient: 'linear-gradient(135deg, rgba(255,99,71,0.08), transparent 60%)',
  },

  // ==================== FACTIONS (original + new) ====================
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
  {
    id: 'loner-camouflage', label: 'Loner Camo',
    gradient: 'linear-gradient(125deg, rgba(94,170,58,0.18), rgba(80,80,60,0.12) 60%, transparent 85%)',
  },
  {
    id: 'bandit-hideout', label: 'Bandit Hideout',
    gradient: 'linear-gradient(115deg, rgba(125,106,82,0.22), rgba(50,40,30,0.18) 50%, transparent 80%)',
  },
  {
    id: 'mercenary-steel', label: 'Mercenary Steel',
    gradient: 'linear-gradient(120deg, rgba(111,161,212,0.22), rgba(70,90,110,0.2) 55%, transparent 82%)',
  },
  {
    id: 'ecologist-bloom', label: 'Ecologist Bloom',
    gradient: 'linear-gradient(125deg, rgba(127,178,232,0.2), rgba(80,160,120,0.15) 60%, transparent 85%)',
  },
  {
    id: 'military-ash', label: 'Military Ash',
    gradient: 'linear-gradient(118deg, rgba(160,160,58,0.22), rgba(90,90,40,0.18) 55%, transparent 84%)',
  },

  // ==================== NATURE / ZONE ELEMENTS ====================
  {
    id: 'forest-canopy', label: 'Forest Canopy', minLevel: 5,
    gradient: 'linear-gradient(135deg, rgba(34,139,34,0.2), rgba(0,64,0,0.15) 65%, transparent 90%)',
  },
  {
    id: 'swamp-fog', label: 'Swamp Fog', minLevel: 8,
    gradient: 'linear-gradient(110deg, rgba(92,64,51,0.25), rgba(70,50,40,0.15) 50%, transparent 80%)',
  },
  {
    id: 'mushroom-circle', label: 'Mycelial Glow', minLevel: 12, isAnimated: true,
    gradient: 'radial-gradient(circle at 20% 80%, rgba(196,126,90,0.28), rgba(80,50,30,0.1) 70%, transparent 100%)',
  },
  {
    id: 'geothermal', label: 'Geothermal', minLevel: 15,
    gradient: 'linear-gradient(145deg, rgba(255,69,0,0.2), rgba(210,105,30,0.12) 55%, transparent 85%)',
  },

  // ==================== WATER / ICE ====================
  {
    id: 'deep-water', label: 'Deep Water', minLevel: 10,
    gradient: 'linear-gradient(120deg, rgba(14,165,233,0.25), rgba(30,58,138,0.2) 60%, transparent 85%)',
  },
  {
    id: 'glacial', label: 'Glacial', minLevel: 18, isAnimated: true,
    gradient: 'linear-gradient(125deg, rgba(176,224,230,0.25), rgba(100,149,237,0.15) 50%, transparent 80%)',
  },
  {
    id: 'abyssal-trench', label: 'Abyssal Trench', minLevel: 30,
    gradient: 'linear-gradient(115deg, rgba(25,25,112,0.3), rgba(0,0,0,0.25) 70%, transparent 90%)',
  },
  {
    id: 'frostbite', label: 'Frostbite', minLevel: 22, isAnimated: true,
    gradient: 'linear-gradient(135deg, rgba(224,255,255,0.25), rgba(70,130,180,0.15) 55%, transparent 85%)',
  },

  // ==================== FIRE / INFERNO ====================
  {
    id: 'crimson', label: 'Crimson Storm', minLevel: 25,
    gradient: 'linear-gradient(120deg, rgba(224,85,85,0.28), rgba(153,27,27,0.2) 60%, rgba(0,0,0,0) 84%)',
  },
  {
    id: 'inferno', label: 'Inferno', minLevel: 30, isAnimated: true,
    gradient: 'linear-gradient(110deg, rgba(234,179,8,0.25), rgba(224,85,85,0.25) 45%, rgba(0,0,0,0) 80%)',
  },
  {
    id: 'wildfire', label: 'Wildfire', minLevel: 20, isAnimated: true,
    gradient: 'radial-gradient(ellipse at 10% 40%, rgba(255,69,0,0.3), rgba(255,140,0,0.15) 50%, transparent 85%)',
  },
  {
    id: 'magma-core', label: 'Magma Core', minLevel: 35,
    gradient: 'linear-gradient(125deg, rgba(255,69,0,0.35), rgba(139,0,0,0.25) 60%, transparent 90%)',
  },

  // ==================== TOXIC / RADIATION ====================
  {
    id: 'radiation', label: 'Radiation', minLevel: 15, isAnimated: true,
    gradient: 'linear-gradient(125deg, rgba(196,160,64,0.28), rgba(94,170,58,0.12) 52%, rgba(0,0,0,0) 82%)',
  },
  {
    id: 'toxic-spill', label: 'Toxic Spill', minLevel: 18,
    gradient: 'linear-gradient(115deg, rgba(162,217,28,0.25), rgba(85,107,47,0.2) 55%, transparent 85%)',
  },
  {
    id: 'biohazard', label: 'Biohazard Zone', minLevel: 25, isAnimated: true,
    gradient: 'radial-gradient(circle at 80% 20%, rgba(163,255,0,0.3), rgba(0,100,0,0.15) 70%, transparent 100%)',
  },
  {
    id: 'reactor-core', label: 'Reactor Core', minLevel: 40, isAnimated: true,
    gradient: 'linear-gradient(130deg, rgba(57,255,20,0.3), rgba(0,200,0,0.2) 50%, transparent 80%)',
  },

  // ==================== MYSTIC / ANOMALOUS ====================
  {
    id: 'nightshift', label: 'Night Shift', minLevel: 20, isAnimated: true,
    gradient: 'linear-gradient(120deg, rgba(34,211,238,0.22), rgba(94,170,58,0.10) 52%, rgba(0,0,0,0) 86%)',
  },
  {
    id: 'cyberpunk', label: 'Neon City', minLevel: 35, isAnimated: true,
    gradient: 'linear-gradient(130deg, rgba(244,114,182,0.25), rgba(34,211,238,0.2) 50%, rgba(0,0,0,0) 85%)',
  },
  {
    id: 'psi-storm', label: 'Psi Storm', minLevel: 28, isAnimated: true,
    gradient: 'radial-gradient(ellipse at 30% 70%, rgba(168,85,247,0.3), rgba(75,0,130,0.2) 60%, transparent 90%)',
  },
  {
    id: 'warp-field', label: 'Warp Field', minLevel: 32, isAnimated: true,
    gradient: 'conic-gradient(from 90deg at 20% 50%, rgba(255,0,255,0.2), rgba(0,255,255,0.2), rgba(255,0,255,0.2))',
  },
  {
    id: 'anomaly-void', label: 'Anomaly Void', minLevel: 38,
    gradient: 'linear-gradient(115deg, rgba(0,0,0,0.4), rgba(40,0,60,0.3) 55%, transparent 85%)',
  },

  // ==================== LEGENDARY / HIGH TIER ====================
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
  {
    id: 'singularity', label: 'Singularity', minLevel: 55, isAnimated: true,
    gradient: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.5), rgba(128,0,128,0.2) 40%, transparent 85%)',
  },
  {
    id: 'cosmic-void', label: 'Cosmic Void', minLevel: 60,
    gradient: 'conic-gradient(from 0deg at 50% 50%, rgba(0,0,0,0.5), rgba(25,25,112,0.3), rgba(0,0,0,0.5))',
  },
  {
    id: 'quasar-flare', label: 'Quasar Flare', minLevel: 65, isAnimated: true,
    gradient: 'linear-gradient(125deg, rgba(255,223,0,0.4), rgba(255,69,0,0.25) 45%, rgba(255,255,255,0.1) 80%)',
  },
  {
    id: 'true-legend', label: 'True Legend', minLevel: 70, isAnimated: true,
    gradient: 'radial-gradient(circle at 20% 30%, rgba(255,215,0,0.45), rgba(255,105,180,0.25) 55%, transparent 90%)',
  },

  // ==================== EXTRA COOL / THEMATIC ====================
  {
    id: 'dust-storm', label: 'Dust Storm', minLevel: 12,
    gradient: 'linear-gradient(115deg, rgba(210,180,140,0.22), rgba(160,120,70,0.15) 60%, transparent 85%)',
  },
  {
    id: 'thunderhead', label: 'Thunderhead', minLevel: 14, isAnimated: true,
    gradient: 'linear-gradient(120deg, rgba(128,128,128,0.3), rgba(70,130,200,0.2) 50%, transparent 80%)',
  },
  {
    id: 'blood-moon', label: 'Blood Moon', minLevel: 22, isAnimated: true,
    gradient: 'radial-gradient(circle at 80% 20%, rgba(139,0,0,0.35), rgba(255,69,0,0.15) 70%, transparent 100%)',
  },
  {
    id: 'neon-grid', label: 'Neon Grid', minLevel: 34, isAnimated: true,
    gradient: 'repeating-linear-gradient(45deg, rgba(0,255,255,0.1) 0px, rgba(0,255,255,0.1) 2px, transparent 2px, transparent 8px)',
  },
  {
    id: 'aurora-borealis', label: 'Aurora', minLevel: 42, isAnimated: true,
    gradient: 'linear-gradient(135deg, rgba(0,255,127,0.25), rgba(0,191,255,0.2) 40%, rgba(138,43,226,0.15) 70%, transparent 95%)',
  },
  {
    id: 'solar-flare', label: 'Solar Flare', minLevel: 48, isAnimated: true,
    gradient: 'linear-gradient(115deg, rgba(255,215,0,0.35), rgba(255,69,0,0.25) 55%, rgba(255,140,0,0.1) 80%)',
  },
  {
    id: 'dark-matter', label: 'Dark Matter', minLevel: 52,
    gradient: 'radial-gradient(circle at 10% 90%, rgba(20,20,30,0.6), rgba(0,0,0,0.4) 60%, transparent 95%)',
  },
  {
    id: 'starburst', label: 'Starburst', minLevel: 38, isAnimated: true,
    gradient: 'conic-gradient(from 45deg at 30% 40%, rgba(255,255,0,0.2), rgba(255,0,255,0.2), rgba(0,255,255,0.2), rgba(255,255,0,0.2))',
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
