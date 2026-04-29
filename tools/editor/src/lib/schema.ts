// P.A.N.D.A. Conversation Editor — Command Schema Registry
// Defines all precondition and outcome commands with their parameter types,
// so the UI can auto-generate appropriate input fields.

import {
  FACTION_IDS, LEVEL_DISPLAY_NAMES, MUTANT_TYPES, RANKS,
  WEATHER_TYPES, WEATHER_DISPLAY_NAMES,
  COMPANION_STATES, COMPANION_STATE_DISPLAY_NAMES,
  MONTH_NAMES,
} from './constants';
import { FACTION_DISPLAY_NAMES } from './types';
import { ALL_SQUAD_OPTIONS, MUTANT_SQUAD_OPTIONS, NPC_SQUAD_OPTIONS } from './generated/squad-catalog';
import { ANOMALY_ZONE_ID_OPTIONS } from './generated/anomaly-zone-catalog';
import { DETECTOR_TIER_OPTIONS } from './generated/detector-tier-catalog';
import { VANILLA_INFO_PORTION_OPTIONS } from './generated/info-portion-catalog';
import { STORY_NPC_OPTIONS } from './generated/story-npc-catalog';
import { VANILLA_TASK_ID_OPTIONS } from './generated/task-catalog';

export interface CommandSchema {
  name: string;
  label: string;
  description: string;
  category: string;
  params: ParamDef[];
  helpText?: string;
  examples?: string[];
  pickerHidden?: boolean;
}

export interface ParamOption {
  value: string;
  label: string;
  keywords?: string[];
}

export type ParamEditor =
  | {
    kind: 'searchable_select';
    options: ParamOption[];
    emptyLabel?: string;
  }
  | {
    kind: 'static_select';
    options: ParamOption[];
    emptyLabel?: string;
  }
  | {
    kind: 'smart_terrain_picker';
    allowPlaceholder?: boolean;
  }
  | {
    kind: 'turn_reference';
    emptyLabel?: string;
  }
  | {
    kind: 'item_picker_panel';
  }
  | {
    kind: 'item_chain_picker_panel';
    chainSeparator?: string;
  }
  | {
    kind: 'story_npc_picker_panel';
    options: ParamOption[];
    emptyLabel?: string;
  }
  | {
    kind: 'level_option_picker_panel';
    options: ParamOption[];
    emptyLabel?: string;
  }
  | {
    kind: 'catalog_picker_panel';
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    emptyLabel?: string;
    browseLabel?: string;
    options: ParamOption[];
    facets?: Array<{
      label: string;
      allLabel: string;
      field?: string;
      keywordIndex?: number;
    }>;
    richRows?: boolean;
  }
  | {
    kind: 'command_builder';
    suggestions: ParamOption[];
    chainSeparator?: string;
  }
  | {
    kind: 'custom_npc_builder';
  };

const FACTION_OPTIONS: ParamOption[] = FACTION_IDS.map((factionId) => ({
  value: factionId,
  label: FACTION_DISPLAY_NAMES[factionId],
  keywords: [factionId, FACTION_DISPLAY_NAMES[factionId]],
}));

const LEVEL_OPTIONS: ParamOption[] = Object.entries(LEVEL_DISPLAY_NAMES).map(([levelKey, displayName]) => ({
  value: levelKey,
  label: displayName,
  keywords: [levelKey, displayName],
}));

const RANK_OPTIONS: ParamOption[] = RANKS.map((rank) => ({
  value: rank,
  label: rank,
  keywords: [rank],
}));

const MUTANT_OPTIONS: ParamOption[] = MUTANT_TYPES.map((mutantType) => ({
  value: mutantType,
  label: mutantType,
  keywords: [mutantType],
}));

const ACHIEVEMENT_OPTIONS: ParamOption[] = [
  { value: 'completionist', label: 'Completionist — All available achievements have been unlocked.', keywords: ['completionist'] },
  { value: 'down_to_earth', label: 'Down to Earth — Mi-2 helicopters will appear in place of Mi-24s.', keywords: ['down_to_earth'] },
  { value: 'duga_free', label: 'Duga Free — Stalkers are more likely to move through Yantar and Radar.', keywords: ['duga_free', 'yantar', 'radar'] },
  { value: 'geologist', label: 'Geologist — Increased chance of finding artefacts after an emission.', keywords: ['geologist', 'artefact'] },
  { value: 'heavy_pockets', label: 'Heavy Pockets — Traders sell higher tier gear regardless of goodwill.', keywords: ['heavy_pockets', 'trader', 'gear'] },
  { value: 'infopreneur', label: 'Infopreneur — Brokers pay a small bonus for PDAs you deliver.', keywords: ['infopreneur', 'pda', 'broker'] },
  { value: 'mechanized_warfare', label: 'Mechanized Warfare — Bonus items used in repairs are more effective.', keywords: ['mechanized_warfare', 'repair'] },
  { value: 'patriarch', label: 'Folk Hero — Recruit larger groups of followers as companions.', keywords: ['patriarch', 'folk hero', 'companion', 'recruit'] },
  { value: 'radiotherapy', label: 'Radiotherapy — Chance to survive emissions/psy-storms without cover.', keywords: ['radiotherapy', 'emission', 'psy-storm'] },
  { value: 'rag_and_bone', label: 'Rag and Bone — Occasionally find more loot in stashes.', keywords: ['rag_and_bone', 'stash', 'loot'] },
  { value: 'silver_or_lead', label: 'Silver or Lead — Surrendering stalkers may reveal a second stash.', keywords: ['silver_or_lead', 'surrender', 'stash'] },
  { value: 'tourist', label: 'Tourist — Deduce the whereabouts of the Zone\'s best stashes.', keywords: ['tourist', 'explore', 'stash'] },
  { value: 'well_dressed', label: 'Well Dressed — Skin mutants much faster than normal.', keywords: ['well_dressed', 'mutant', 'skin'] },
  { value: 'wishful_thinking', label: 'Wishful Thinking — Unlocks "Renegades" as a playable faction.', keywords: ['wishful_thinking', 'renegade', 'faction'] },
  { value: 'infantile_pleasure', label: 'Infantile Pleasure — Recover more loot from destroyed boxes.', keywords: ['infantile_pleasure', 'box', 'loot'] },
  { value: 'recycler', label: 'Vigilant Recycler — Chance to recover additional material during disassembly.', keywords: ['recycler', 'disassembly', 'material'] },
  { value: 'artificer_eagerness', label: 'Artificer Eagerness — Crafting requires fewer components.', keywords: ['artificer_eagerness', 'craft', 'component'] },
  { value: 'unforeseen_guest', label: 'Unforeseen Guest — Less likely to be discovered while disguised.', keywords: ['unforeseen_guest', 'disguise'] },
  { value: 'absolver', label: 'Absolver — Unlocks "Sin" as a playable faction.', keywords: ['absolver', 'sin', 'faction'] },
  { value: 'collaborator', label: 'Collaborator — Unlocks "UNISG" as a playable faction.', keywords: ['collaborator', 'unisg', 'faction'] },
  { value: 'iron_curtain', label: 'Iron Curtain — Awarded 50,000 RU bonus for the faction war effort.', keywords: ['iron_curtain', 'warfare', 'money'] },
  { value: 'murky_spirit', label: 'Murky Spirit — Your rank has been greatly increased.', keywords: ['murky_spirit', 'rank', 'ironman'] },
  { value: 'invictus', label: 'Invictus — The ultimate achievement for surviving ironman mode.', keywords: ['invictus', 'ironman', 'screenshot'] },
];

const ITEM_TYPE_OPTIONS: ParamOption[] = [
  { value: 'weapon', label: 'Weapon', keywords: ['weapon', 'gun'] },
  { value: 'outfit', label: 'Outfit/Armor', keywords: ['outfit', 'armor'] },
  { value: 'artefact', label: 'Artefact', keywords: ['artefact', 'artifact'] },
  { value: 'headgear', label: 'Headgear/Helmet', keywords: ['headgear', 'helmet'] },
  { value: 'pistol', label: 'Pistol', keywords: ['pistol', 'handgun'] },
  { value: 'rifle', label: 'Rifle', keywords: ['rifle'] },
  { value: 'shotgun', label: 'Shotgun', keywords: ['shotgun'] },
  { value: 'sniper', label: 'Sniper Rifle', keywords: ['sniper'] },
  { value: 'melee', label: 'Melee Weapon', keywords: ['melee', 'knife'] },
  { value: 'explosive', label: 'Explosive', keywords: ['explosive', 'grenade'] },
];

const WEATHER_OPTIONS: ParamOption[] = WEATHER_TYPES.map((w) => ({
  value: w,
  label: WEATHER_DISPLAY_NAMES[w] ?? w,
  keywords: [w, WEATHER_DISPLAY_NAMES[w] ?? ''],
}));

const COMPANION_STATE_OPTIONS: ParamOption[] = COMPANION_STATES.map((s) => ({
  value: s,
  label: COMPANION_STATE_DISPLAY_NAMES[s] ?? s,
  keywords: [s, COMPANION_STATE_DISPLAY_NAMES[s] ?? ''],
}));

// Spawned-squad relation modes used by spawn_npc_squad*, panda_task_eliminate,
// and panda_task_rescue. "default" leaves the squad's faction relations alone.
const SQUAD_STATE_OPTIONS: ParamOption[] = [
  { value: 'hostile', label: 'Aggressive (hostile to player)', keywords: ['enemy', 'hostile', 'aggressive', 'attack'] },
  { value: 'neutral', label: 'Neutral', keywords: ['neutral', 'passive', 'ignore'] },
  { value: 'friendly', label: 'Friendly to player', keywords: ['friend', 'friendly', 'ally'] },
  { value: 'default', label: 'Default (faction relation)', keywords: ['default', 'faction'] },
];

// Conversation-NPC relation toward the player for set_npc_state.
const NPC_RELATION_STATE_OPTIONS: ParamOption[] = [
  { value: 'hostile', label: 'Aggressive (enemy)', keywords: ['enemy', 'hostile', 'aggressive'] },
  { value: 'neutral', label: 'Neutral', keywords: ['neutral'] },
  { value: 'friendly', label: 'Friendly', keywords: ['friend', 'friendly'] },
];

const ESCORT_TARGET_OPTIONS: ParamOption[] = [
  { value: 'sender', label: 'Conversation NPC', keywords: ['sender', 'talker', 'current npc'] },
  { value: 'story_npc', label: 'Story NPC', keywords: ['story npc', 'named npc'] },
  { value: 'custom_npc', label: 'Custom NPC Template', keywords: ['custom npc', 'template'] },
  { value: 'spawn_faction', label: 'Spawn New NPC', keywords: ['spawn', 'new npc', 'faction'] },
];

export const NPC_ANIMATION_PRESET_OPTIONS: ParamOption[] = [
  { value: 'smoke_stand', label: 'Smoke Standing', keywords: ['smoke', 'standing', 'cigarette', 'smoking_stand'] },
  { value: 'smoke_sit', label: 'Smoke Sitting', keywords: ['smoke', 'sitting', 'cigarette', 'smoking_sit'] },
  { value: 'use_pda', label: 'Use PDA', keywords: ['pda', 'use', 'device', 'use_pda'] },
  { value: 'guard_attention', label: 'Guard Attention', keywords: ['guard', 'attention', 'stay_smirno', 'salute'] },
  { value: 'sit_ground', label: 'Sit on Ground (terrain-sensitive)', keywords: ['sit', 'ground', 'terrain', 'sit_korta'] },
  { value: 'sit_chair', label: 'Sit on Chair', keywords: ['sit', 'chair', 'seat', 'sit_ass'] },
  { value: 'sit_knee', label: 'Sit on Knee', keywords: ['sit', 'knee', 'sit_knee'] },
  { value: 'sleep_ground', label: 'Sleep on Ground (terrain-sensitive)', keywords: ['sleep', 'ground', 'terrain', 'sleep'] },
  { value: 'sleep_sit', label: 'Sleep Sitting (terrain-sensitive)', keywords: ['sleep', 'sit', 'terrain', 'sleep_sit'] },
  { value: 'wounded_heavy_1', label: 'Wounded Heavy 1 (terrain-sensitive)', keywords: ['wounded', 'injured', 'terrain', 'wounded_heavy'] },
  { value: 'wounded_heavy_2', label: 'Wounded Heavy 2 (terrain-sensitive)', keywords: ['wounded', 'injured', 'terrain', 'wounded_heavy_2'] },
  { value: 'wounded_heavy_3', label: 'Wounded Heavy 3 (terrain-sensitive)', keywords: ['wounded', 'injured', 'terrain', 'wounded_heavy_3'] },
  { value: 'drink_vodka_stand', label: 'Drink Vodka Standing', keywords: ['drink', 'vodka', 'standing', 'drink_vodka_stand'] },
  { value: 'drunk_stand', label: 'Drunk Standing', keywords: ['drunk', 'standing', 'drunk_stand'] },
  { value: 'laugh', label: 'Laugh', keywords: ['laugh', 'smeh'] },
];

const MONTH_OPTIONS: ParamOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: MONTH_NAMES[i + 1],
  keywords: [String(i + 1), MONTH_NAMES[i + 1]],
}));

const ANOMALY_TASK_ID_OPTIONS: ParamOption[] = ANOMALY_ZONE_ID_OPTIONS
  .filter((option) => option.value.includes('anomal_zone'))
  .map((option) => ({
    value: option.value,
    label: `${option.value} — Suggested runtime task id`,
    keywords: [...(option.keywords ?? []), 'task_id', 'runtime'],
  }));

const SMART_TERRAIN_EDITOR: ParamEditor = {
  kind: 'smart_terrain_picker',
  allowPlaceholder: true,
};

const TURN_REFERENCE_EDITOR: ParamEditor = {
  kind: 'turn_reference',
};

const ITEM_PICKER_PANEL_EDITOR: ParamEditor = {
  kind: 'item_picker_panel',
};

const ITEM_CHAIN_PICKER_PANEL_EDITOR: ParamEditor = {
  kind: 'item_chain_picker_panel',
  chainSeparator: '+',
};

const ANOMALY_ZONE_PICKER_PANEL_EDITOR: ParamEditor = {
  kind: 'level_option_picker_panel',
  options: ANOMALY_ZONE_ID_OPTIONS,
  emptyLabel: '-- Select anomaly zone id --',
};

const TASK_ID_PICKER_PANEL_EDITOR: ParamEditor = {
  kind: 'catalog_picker_panel',
  title: 'Browse vanilla task ids',
  subtitle: 'Pick bundled vanilla task ids fast. Open custom override only for modded tasks.',
  searchPlaceholder: 'Search task id, title, or source map...',
  emptyLabel: 'No task id selected',
  browseLabel: 'Browse task ids',
  options: VANILLA_TASK_ID_OPTIONS,
  facets: [
    { label: 'Source', allLabel: 'All sources', field: 'source' },
  ],
};

const INFO_PORTION_PICKER_PANEL_EDITOR: ParamEditor = {
  kind: 'catalog_picker_panel',
  title: 'Browse info portions',
  subtitle: 'Search bundled vanilla info portion ids. Use custom override only for modded flags.',
  searchPlaceholder: 'Search info id or keywords...',
  emptyLabel: 'No info portion selected',
  browseLabel: 'Browse info ids',
  options: VANILLA_INFO_PORTION_OPTIONS,
};

const SQUAD_PICKER_PANEL_EDITOR: ParamEditor = {
  kind: 'catalog_picker_panel',
  title: 'Browse vanilla squads',
  subtitle: 'Pick bundled NPC or mutant squad sections with compact filters.',
  searchPlaceholder: 'Search squad id, faction, source, or size...',
  emptyLabel: 'No squad selected',
  browseLabel: 'Browse squads',
  options: ALL_SQUAD_OPTIONS,
  facets: [
    { label: 'Kind', allLabel: 'All kinds', field: 'kind' },
    { label: 'Faction', allLabel: 'All factions', field: 'faction' },
    { label: 'Source', allLabel: 'All sources', field: 'source' },
  ],
};

const NPC_SQUAD_PICKER_PANEL_EDITOR: ParamEditor = {
  kind: 'catalog_picker_panel',
  title: 'Browse vanilla faction squads',
  subtitle: 'Pick bundled vanilla NPC squad sections. Use custom override only for modded squads.',
  searchPlaceholder: 'Search squad id, faction, source, or size...',
  emptyLabel: 'No faction squad selected',
  browseLabel: 'Browse faction squads',
  options: NPC_SQUAD_OPTIONS,
  facets: [
    { label: 'Faction', allLabel: 'All factions', field: 'faction' },
    { label: 'Source', allLabel: 'All sources', field: 'source' },
  ],
};

const PANDA_ARTIFACT_LEVEL_TOKEN_OPTIONS: ParamOption[] = [
  { value: 'level:esc', label: 'Cordon (level:esc)', keywords: ['cordon', 'esc'] },
  { value: 'level:gar', label: 'Garbage (level:gar)', keywords: ['garbage', 'gar'] },
  { value: 'level:agr', label: 'Agroprom (level:agr)', keywords: ['agroprom', 'agr'] },
  { value: 'level:val', label: 'Dark Valley (level:val)', keywords: ['dark valley', 'val'] },
  { value: 'level:yan', label: 'Yantar (level:yan)', keywords: ['yantar', 'yan'] },
  { value: 'level:ros', label: 'Wild Territory (level:ros)', keywords: ['wild territory', 'ros'] },
  { value: 'level:bar', label: 'Rostok (level:bar)', keywords: ['rostok', 'bar'] },
  { value: 'level:mar', label: 'Great Swamp (level:mar)', keywords: ['swamp', 'mar'] },
  { value: 'level:ds', label: 'Darkscape (level:ds)', keywords: ['darkscape', 'ds'] },
  { value: 'level:trc', label: 'Truck Cemetery (level:trc)', keywords: ['truck cemetery', 'trc'] },
  { value: 'level:red', label: 'Red Forest (level:red)', keywords: ['red forest', 'red'] },
  { value: 'level:lim', label: 'Limansk (level:lim)', keywords: ['limansk', 'lim'] },
  { value: 'level:jup', label: 'Jupiter (level:jup)', keywords: ['jupiter', 'jup'] },
  { value: 'level:zat', label: 'Zaton (level:zat)', keywords: ['zaton', 'zat'] },
  { value: 'level:pri', label: 'Pripyat (level:pri)', keywords: ['pripyat', 'pri'] },
];

const WATCH_TRIGGER_SUGGESTIONS: ParamOption[] = [
  {
    value: 'teleport_npc_to_smart:%cordon_panda_st_key%',
    label: 'Teleport NPC to the watched smart terrain',
    keywords: ['teleport', 'npc', 'smart', 'location'],
  },
  {
    value: 'teleport_npc_to_player',
    label: 'Teleport NPC near the player',
    keywords: ['teleport', 'npc', 'player'],
  },
  {
    value: 'spawn_custom_npc:hired_guns',
    label: 'Spawn a custom NPC near the player',
    keywords: ['spawn', 'custom', 'npc', 'hired', 'guns'],
  },
  {
    value: 'spawn_custom_npc_at:hired_guns:%cordon_panda_st_key%',
    label: 'Spawn a custom NPC at the watched smart terrain',
    keywords: ['spawn', 'custom', 'npc', 'smart', 'location'],
  },
  {
    value: 'spawn_mutant:snork:90',
    label: 'Spawn mutants near the player',
    keywords: ['spawn', 'mutant', 'snork'],
  },
  {
    value: 'spawn_npc_squad:army_sim_squad_novice:50:10',
    label: 'Spawn vanilla faction squad near the player',
    keywords: ['spawn', 'npc', 'squad', 'faction', 'player', 'distance', 'army'],
  },
  {
    value: 'spawn_mutant_at_smart:snork:%cordon_panda_st_key%',
    label: 'Spawn mutants at the watched smart terrain',
    keywords: ['spawn', 'mutant', 'smart', 'snork'],
  },
  {
    value: 'spawn_npc_squad_at_smart:army_sim_squad_novice:%cordon_panda_st_key%',
    label: 'Spawn vanilla faction squad at the watched smart terrain',
    keywords: ['spawn', 'npc', 'squad', 'faction', 'smart', 'army'],
  },
  {
    value: 'recruit_companion',
    label: 'Recruit the current NPC as a companion',
    keywords: ['recruit', 'companion'],
  },
  {
    value: 'set_npc_hostile',
    label: 'Make the NPC hostile to the player',
    keywords: ['hostile', 'npc', 'enemy'],
  },
  {
    value: 'set_npc_friendly',
    label: 'Make the NPC friendly to the player',
    keywords: ['friendly', 'npc'],
  },
  {
    value: 'kill_npc',
    label: 'Kill the conversation NPC',
    keywords: ['kill', 'npc', 'death'],
  },
  {
    value: 'set_npc_neutral',
    label: 'Make the NPC neutral to the player',
    keywords: ['neutral', 'npc'],
  },
  {
    value: 'ceasefire:100',
    label: 'Ceasefire — make nearby NPCs non-hostile',
    keywords: ['ceasefire', 'peace', 'neutral'],
  },
  {
    value: 'set_weather:w_storm1',
    label: 'Change weather to storm',
    keywords: ['weather', 'storm'],
  },
  {
    value: 'boost_speed:1.5:60',
    label: 'Boost player speed for 60 seconds',
    keywords: ['speed', 'boost', 'fast'],
  },
  {
    value: 'equip_npc_item:medkit',
    label: 'Give NPC an item',
    keywords: ['equip', 'npc', 'item', 'give'],
  },
];

const WATCH_TRIGGER_EDITOR: ParamEditor = {
  kind: 'command_builder',
  suggestions: WATCH_TRIGGER_SUGGESTIONS,
  chainSeparator: '+',
};

export interface ParamDef {
  name: string;
  type: 'faction' | 'rank' | 'number' | 'level' | 'smart_terrain'
    | 'item_section' | 'mutant_type' | 'achievement' | 'story_npc' | 'string' | 'slot';
  required: boolean;
  label: string;
  placeholder?: string;
  min?: number;
  max?: number;
  editor?: ParamEditor;
  helpText?: string;
  examples?: string[];
}

// ─── Precondition Schemas ───────────────────────────────────────────────────

export const PRECONDITION_SCHEMAS: CommandSchema[] = [
  // NPC Relation
  {
    name: 'req_npc_friendly',
    label: 'NPC Friendly',
    description: 'NPC must be friendly/neutral toward the player (goodwill >= 0)',
    category: 'NPC Relation',
    params: [
      { name: 'faction', type: 'faction', required: false, label: 'Faction', placeholder: 'Any faction' },
    ],
  },
  {
    name: 'req_npc_hostile',
    label: 'NPC Hostile',
    description: 'NPC must be hostile toward the player (goodwill < 0)',
    category: 'NPC Relation',
    params: [
      { name: 'faction', type: 'faction', required: false, label: 'Faction', placeholder: 'Any faction' },
    ],
  },

  // Faction
  {
    name: 'req_faction',
    label: 'Player Faction',
    description: 'Player must belong to this faction',
    category: 'Faction',
    pickerHidden: true,
    helpText: "New conversations are already scoped by the project\'s player faction, so you usually do not need to add this manually.",
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'Faction', editor: { kind: 'searchable_select', options: FACTION_OPTIONS, emptyLabel: '-- Select faction --' } },
    ],
  },
  {
    name: 'req_not_faction',
    label: 'Player Not Faction',
    description: 'Player must NOT belong to this faction',
    category: 'Faction',
    pickerHidden: true,
    helpText: "New conversations are already scoped by the project\'s player faction, so you usually do not need to add this manually.",
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'Faction' },
    ],
  },
  {
    name: 'req_npc_faction',
    label: 'NPC Faction',
    description: 'NPC must belong to this faction',
    category: 'Faction',
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'Faction' },
    ],
  },
  {
    name: 'req_npc_not_faction',
    label: 'NPC Not Faction',
    description: 'NPC must NOT belong to this faction',
    category: 'Faction',
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'Faction' },
    ],
  },

  // Rank
  {
    name: 'req_rank',
    label: 'Player Rank Min',
    description: 'Player rank must be >= specified rank',
    category: 'Rank',
    params: [
      { name: 'rank', type: 'rank', required: true, label: 'Minimum Rank', editor: { kind: 'searchable_select', options: RANK_OPTIONS } },
    ],
  },
  {
    name: 'req_rank_max',
    label: 'Player Rank Max',
    description: 'Player rank must be <= specified rank',
    category: 'Rank',
    params: [
      { name: 'rank', type: 'rank', required: true, label: 'Maximum Rank' },
    ],
  },
  {
    name: 'req_npc_rank',
    label: 'NPC Rank Min',
    description: 'NPC rank must be >= specified rank',
    category: 'Rank',
    params: [
      { name: 'rank', type: 'rank', required: true, label: 'Minimum Rank' },
    ],
  },
  {
    name: 'req_npc_rank_max',
    label: 'NPC Rank Max',
    description: 'NPC rank must be <= specified rank',
    category: 'Rank',
    params: [
      { name: 'rank', type: 'rank', required: true, label: 'Maximum Rank' },
    ],
  },

  // Money
  {
    name: 'req_money',
    label: 'Player Money Min',
    description: 'Player must have at least this many RU',
    category: 'Money',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Minimum RU', min: 0 },
    ],
  },
  {
    name: 'req_money_max',
    label: 'Player Money Max',
    description: 'Player must have less than this many RU',
    category: 'Money',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Maximum RU', min: 0 },
    ],
  },

  // Reputation
  {
    name: 'req_rep',
    label: 'Reputation Min',
    description: 'Player reputation must be >= amount',
    category: 'Reputation',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Minimum Reputation' },
    ],
  },
  {
    name: 'req_rep_max',
    label: 'Reputation Max',
    description: 'Player reputation must be <= amount',
    category: 'Reputation',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Maximum Reputation' },
    ],
  },

  // Kills
  {
    name: 'req_kills',
    label: 'Stalker Kills',
    description: 'Player must have killed >= count stalkers',
    category: 'Statistics',
    params: [
      { name: 'count', type: 'number', required: true, label: 'Minimum Kills', min: 0 },
    ],
  },
  {
    name: 'req_mutant_kills',
    label: 'Mutant Kills',
    description: 'Player must have killed >= count mutants',
    category: 'Statistics',
    params: [
      { name: 'count', type: 'number', required: true, label: 'Minimum Kills', min: 0 },
    ],
  },

  // Goodwill
  {
    name: 'req_goodwill',
    label: 'Goodwill Min',
    description: 'Player goodwill with faction must be >= amount',
    category: 'Goodwill',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Minimum Goodwill' },
      { name: 'faction', type: 'faction', required: false, label: 'Faction', placeholder: 'stalker' },
    ],
  },
  {
    name: 'req_goodwill_max',
    label: 'Goodwill Max',
    description: 'Player goodwill with faction must be <= amount',
    category: 'Goodwill',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Maximum Goodwill' },
      { name: 'faction', type: 'faction', required: false, label: 'Faction', placeholder: 'stalker' },
    ],
  },

  // Location
  {
    name: 'req_level',
    label: 'Player On Level',
    description: 'Player must be on specified level',
    category: 'Location',
    params: [
      { name: 'level', type: 'level', required: true, label: 'Level', editor: { kind: 'searchable_select', options: LEVEL_OPTIONS, emptyLabel: '-- Select level --' } },
    ],
  },
  {
    name: 'req_not_level',
    label: 'Player Not On Level',
    description: 'Player must NOT be on specified level',
    category: 'Location',
    params: [
      { name: 'level', type: 'level', required: true, label: 'Level', editor: { kind: 'searchable_select', options: LEVEL_OPTIONS, emptyLabel: '-- Select level --' } },
    ],
  },
  {
    name: 'req_actor_near_smart',
    label: 'Player Near Smart Terrain',
    description: 'Player must be within distance of smart terrain',
    category: 'Location',
    params: [
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
      { name: 'distance', type: 'number', required: false, label: 'Distance (m)', placeholder: '50', min: 1 },
    ],
  },
  {
    name: 'req_npc_near_smart',
    label: 'NPC Near Smart Terrain',
    description: 'NPC must be within distance of smart terrain',
    category: 'Location',
    params: [
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
      { name: 'distance', type: 'number', required: false, label: 'Distance (m)', placeholder: '50', min: 1 },
    ],
  },
  {
    name: 'req_actor_in_zone',
    label: 'Player In Zone',
    description: 'Player must be inside named zone',
    category: 'Location',
    params: [
      { name: 'zone', type: 'string', required: true, label: 'Zone Name' },
    ],
  },
  {
    name: 'req_detector_tier',
    label: 'Detector Tier',
    description: 'Player must have at least the specified detector tier',
    category: 'Anomaly / Artifact',
    helpText: 'Use this precondition to gate dialogue or choices by detector progression.',
    examples: ['req_detector_tier:advanced', 'req_detector_tier:scientific'],
    params: [
      { name: 'detector_tier', type: 'string', required: true, label: 'Detector Tier', editor: { kind: 'static_select', options: DETECTOR_TIER_OPTIONS, emptyLabel: '-- Select detector tier --' } },
    ],
  },

  // Companions
  {
    name: 'req_companions',
    label: 'Companions Min',
    description: 'Player must have >= count active companions',
    category: 'Companions',
    params: [
      { name: 'count', type: 'number', required: true, label: 'Minimum Companions', min: 0 },
    ],
  },
  {
    name: 'req_companions_max',
    label: 'Companions Max',
    description: 'Player must have <= count active companions',
    category: 'Companions',
    params: [
      { name: 'count', type: 'number', required: true, label: 'Maximum Companions', min: 0 },
    ],
  },

  // Items
  {
    name: 'req_has_item',
    label: 'Has Item',
    description: 'Player must have item in inventory',
    category: 'Items',
    params: [
      { name: 'item', type: 'item_section', required: true, label: 'Item Section', editor: ITEM_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'req_equipped',
    label: 'Item Equipped',
    description: 'Player must have item equipped',
    category: 'Items',
    params: [
      { name: 'item', type: 'item_section', required: true, label: 'Item Section', editor: ITEM_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'req_equipped_slot',
    label: 'Slot Filled',
    description: 'Specified equipment slot must be filled',
    category: 'Items',
    params: [
      { name: 'slot', type: 'slot', required: true, label: 'Slot Number', min: 0, max: 12 },
    ],
  },

  // Time
  {
    name: 'req_time_day',
    label: 'Daytime',
    description: 'Must be daytime (6:00-19:59)',
    category: 'Time & Weather',
    params: [],
  },
  {
    name: 'req_time_night',
    label: 'Nighttime',
    description: 'Must be nighttime (20:00-5:59)',
    category: 'Time & Weather',
    params: [],
  },

  // Weather/Events
  {
    name: 'req_surge_soon',
    label: 'Surge Soon',
    description: 'Emission must occur within threshold seconds',
    category: 'Time & Weather',
    params: [
      { name: 'threshold', type: 'number', required: true, label: 'Threshold (seconds)', min: 0 },
    ],
  },
  {
    name: 'req_not_surge_soon',
    label: 'No Surge Soon',
    description: 'Emission must NOT occur within threshold seconds',
    category: 'Time & Weather',
    params: [
      { name: 'threshold', type: 'number', required: true, label: 'Threshold (seconds)', min: 0 },
    ],
  },
  {
    name: 'req_psi_storm_soon',
    label: 'Psi Storm Soon',
    description: 'Psi storm must occur within threshold seconds',
    category: 'Time & Weather',
    params: [
      { name: 'threshold', type: 'number', required: true, label: 'Threshold (seconds)', min: 0 },
    ],
  },
  {
    name: 'req_weather_fx_active',
    label: 'Weather FX Active',
    description: 'Special weather effects must be active',
    category: 'Time & Weather',
    params: [],
  },
  {
    name: 'req_weather_fx_not_active',
    label: 'Weather FX Inactive',
    description: 'Special weather effects must NOT be active',
    category: 'Time & Weather',
    params: [],
  },

  // Health
  {
    name: 'req_health_min',
    label: 'Health Min',
    description: 'Player health must be >= amount (0-100)',
    category: 'Health',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Minimum Health', min: 0, max: 100 },
    ],
  },
  {
    name: 'req_health_max',
    label: 'Health Max',
    description: 'Player health must be <= amount (0-100)',
    category: 'Health',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Maximum Health', min: 0, max: 100 },
    ],
  },

  // Achievement
  {
    name: 'req_achievement',
    label: 'Achievement',
    description: 'Player must have achievement',
    category: 'Achievement',
    params: [
      { name: 'achievement', type: 'achievement', required: true, label: 'Achievement Name', editor: { kind: 'searchable_select', options: ACHIEVEMENT_OPTIONS, emptyLabel: '-- Select achievement --' } },
    ],
  },

  // Player Condition
  {
    name: 'req_radiation_min',
    label: 'Radiation Min',
    description: 'Player radiation level must be >= amount (0-100)',
    category: 'Player Condition',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Minimum Radiation', min: 0, max: 100 },
    ],
  },
  {
    name: 'req_radiation_max',
    label: 'Radiation Max',
    description: 'Player radiation level must be <= amount (0-100)',
    category: 'Player Condition',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Maximum Radiation', min: 0, max: 100 },
    ],
  },
  {
    name: 'req_hunger',
    label: 'Player Hungry',
    description: 'Player must be hungry (satiety level 2+)',
    category: 'Player Condition',
    params: [],
  },
  {
    name: 'req_not_hungry',
    label: 'Player Not Hungry',
    description: 'Player must not be hungry',
    category: 'Player Condition',
    params: [],
  },
  {
    name: 'req_bleeding',
    label: 'Player Bleeding',
    description: 'Player must be bleeding',
    category: 'Player Condition',
    params: [],
  },
  {
    name: 'req_overweight',
    label: 'Player Overweight',
    description: 'Player must be overburdened (carrying more than max weight)',
    category: 'Player Condition',
    params: [],
  },

  // Items (expanded)
  {
    name: 'req_has_item_type',
    label: 'Has Item Type',
    description: 'Player must have any item of specified type in inventory',
    category: 'Items',
    params: [
      { name: 'type', type: 'string', required: true, label: 'Item Type',
        editor: { kind: 'searchable_select', options: ITEM_TYPE_OPTIONS, emptyLabel: '-- Select type --' } },
    ],
  },

  // Statistics (expanded)
  {
    name: 'req_artefacts_found',
    label: 'Artefacts Found',
    description: 'Player must have found >= count artefacts total',
    category: 'Statistics',
    params: [
      { name: 'count', type: 'number', required: true, label: 'Minimum Artefacts', min: 0 },
    ],
  },
  {
    name: 'req_faction_kills',
    label: 'Faction Kills',
    description: 'Player must have killed >= count members of a specific faction',
    category: 'Statistics',
    params: [
      { name: 'count', type: 'number', required: true, label: 'Minimum Kills', min: 0 },
      { name: 'faction', type: 'faction', required: true, label: 'Faction', editor: { kind: 'searchable_select', options: FACTION_OPTIONS, emptyLabel: '-- Select faction --' } },
    ],
  },
  {
    name: 'req_enemy_kills',
    label: 'Enemy Kills',
    description: 'Player must have killed >= count hostile stalkers',
    category: 'Statistics',
    params: [
      { name: 'count', type: 'number', required: true, label: 'Minimum Kills', min: 0 },
    ],
  },

  // Items (expanded)
  {
    name: 'req_not_has_item',
    label: 'Does Not Have Item',
    description: 'Player must NOT have item in inventory',
    category: 'Items',
    params: [
      { name: 'item', type: 'item_section', required: true, label: 'Item Section', editor: ITEM_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'req_has_item_count',
    label: 'Has Item Count',
    description: 'Player must have >= count of a specific item',
    category: 'Items',
    params: [
      { name: 'item', type: 'item_section', required: true, label: 'Item Section', editor: ITEM_PICKER_PANEL_EDITOR },
      { name: 'count', type: 'number', required: true, label: 'Minimum Count', min: 1 },
    ],
  },

  // Knowledge
  {
    name: 'req_has_info',
    label: 'Has Info Portion',
    description: 'Player must have a specific info portion (knowledge/lore gate)',
    category: 'Knowledge',
    helpText: 'Info portions are game knowledge flags. Check vanilla game files for available info IDs.',
    params: [
      { name: 'info_id', type: 'string', required: true, label: 'Info Portion ID', placeholder: 'e.g. bar_deactivate_radar_done', editor: INFO_PORTION_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'req_not_has_info',
    label: 'Missing Info Portion',
    description: 'Player must NOT have a specific info portion',
    category: 'Knowledge',
    params: [
      { name: 'info_id', type: 'string', required: true, label: 'Info Portion ID', placeholder: 'e.g. bar_deactivate_radar_done', editor: INFO_PORTION_PICKER_PANEL_EDITOR },
    ],
  },

  // Relationship
  {
    name: 'req_relationship_min',
    label: 'Relationship Min',
    description: 'NPC relationship score with player must be >= value (-1000 to 1000)',
    category: 'Relationship',
    helpText: 'Uses P.A.N.D.A.\'s built-in per-NPC relationship score system.',
    params: [
      { name: 'score', type: 'number', required: true, label: 'Minimum Score', min: -1000, max: 1000 },
    ],
  },
  {
    name: 'req_relationship_max',
    label: 'Relationship Max',
    description: 'NPC relationship score with player must be <= value (-1000 to 1000)',
    category: 'Relationship',
    params: [
      { name: 'score', type: 'number', required: true, label: 'Maximum Score', min: -1000, max: 1000 },
    ],
  },

  // Time (expanded)
  {
    name: 'req_time_hour_min',
    label: 'Hour Min',
    description: 'Current game hour must be >= value (0-23)',
    category: 'Time & Weather',
    params: [
      { name: 'hour', type: 'number', required: true, label: 'Minimum Hour', min: 0, max: 23 },
    ],
  },
  {
    name: 'req_time_hour_max',
    label: 'Hour Max',
    description: 'Current game hour must be <= value (0-23)',
    category: 'Time & Weather',
    params: [
      { name: 'hour', type: 'number', required: true, label: 'Maximum Hour', min: 0, max: 23 },
    ],
  },

  // NPC State
  {
    name: 'req_npc_alive',
    label: 'NPC Alive',
    description: 'The conversation NPC must still be alive in the simulation',
    category: 'NPC State',
    params: [],
  },
  {
    name: 'req_npc_on_level',
    label: 'NPC On Level',
    description: 'NPC must be on specified level',
    category: 'NPC State',
    params: [
      { name: 'level', type: 'level', required: true, label: 'Level', editor: { kind: 'searchable_select', options: LEVEL_OPTIONS, emptyLabel: '-- Select level --' } },
    ],
  },
  {
    name: 'req_story_npc',
    label: 'Story NPC',
    description: 'Conversation must be triggered by a specific story NPC (e.g. Sidorovich, Barkeep, Sakharov). Overrides normal random NPC selection.',
    category: 'NPC State',
    helpText: 'When set, the system will look up this named NPC by their story ID at trigger time. The NPC must be alive in the game world. Other preconditions (faction, rank, friendly/hostile, etc.) still apply alongside this one.',
    examples: ['req_story_npc:bar_visitors_barman_stalker_trader', 'req_story_npc:yan_stalker_sakharov'],
    params: [
      {
        name: 'story_id',
        type: 'story_npc',
        required: true,
        label: 'Story NPC',
        editor: {
          kind: 'story_npc_picker_panel',
          options: STORY_NPC_OPTIONS,
          emptyLabel: '-- Search for a story NPC --',
        },
      },
    ],
  },
  {
    name: 'req_custom_story_npc',
    label: 'Custom NPC Target',
    description: 'Conversation must be triggered by a specific author-defined custom NPC template, spawned once at the chosen smart terrain.',
    category: 'NPC State',
    helpText:
      'Use this when a storyline belongs to a custom character instead of a vanilla story NPC. ' +
      'The template comes from your project NPC library, and the runtime will spawn that NPC once at the chosen smart terrain so the same character can own the conversation chain.',
    examples: ['req_custom_story_npc:informant:bar_visitors', 'req_custom_story_npc:weapons_dealer:esc_smart_terrain_5_7'],
    params: [
      {
        name: 'template_id',
        type: 'string',
        required: true,
        label: 'NPC Template',
        placeholder: 'e.g. informant',
        editor: { kind: 'custom_npc_builder' },
        helpText: 'Choose an existing custom NPC template or create one inline.',
      },
      {
        name: 'smart_terrain',
        type: 'smart_terrain',
        required: true,
        label: 'Spawn Smart Terrain',
        editor: { kind: 'smart_terrain_picker', allowPlaceholder: false },
        helpText: 'Pick the exact smart terrain where this storyline character should appear at the start of the game.',
      },
    ],
  },

  // Game Progress
  {
    name: 'req_game_days_min',
    label: 'Days Survived Min',
    description: 'Player must have survived >= N in-game days',
    category: 'Game Progress',
    params: [
      { name: 'days', type: 'number', required: true, label: 'Minimum Days', min: 0 },
    ],
  },
  {
    name: 'req_game_days_max',
    label: 'Days Survived Max',
    description: 'Player must have survived < N in-game days',
    category: 'Game Progress',
    params: [
      { name: 'days', type: 'number', required: true, label: 'Maximum Days', min: 0 },
    ],
  },
  {
    name: 'req_visited_level',
    label: 'Visited Level',
    description: 'Player must have visited this level before',
    category: 'Game Progress',
    params: [
      { name: 'level', type: 'level', required: true, label: 'Level', editor: { kind: 'searchable_select', options: LEVEL_OPTIONS, emptyLabel: '-- Select level --' } },
    ],
  },
  {
    name: 'req_not_visited_level',
    label: 'Not Visited Level',
    description: 'Player must NOT have visited this level',
    category: 'Game Progress',
    params: [
      { name: 'level', type: 'level', required: true, label: 'Level', editor: { kind: 'searchable_select', options: LEVEL_OPTIONS, emptyLabel: '-- Select level --' } },
    ],
  },

  // ─── NEW: Player Condition (expanded) ─────────────────────────────────────
  {
    name: 'req_satiety_min',
    label: 'Satiety Min',
    description: 'Player satiety (fullness) must be >= amount (0-100)',
    category: 'Player Condition',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Minimum Satiety (%)', min: 0, max: 100 },
    ],
  },
  {
    name: 'req_satiety_max',
    label: 'Satiety Max',
    description: 'Player satiety (fullness) must be <= amount (0-100)',
    category: 'Player Condition',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Maximum Satiety (%)', min: 0, max: 100 },
    ],
  },
  {
    name: 'req_thirsty',
    label: 'Player Thirsty',
    description: 'Player must be thirsty (low hydration)',
    category: 'Player Condition',
    params: [],
  },
  {
    name: 'req_not_thirsty',
    label: 'Player Not Thirsty',
    description: 'Player must NOT be thirsty',
    category: 'Player Condition',
    params: [],
  },

  // ─── NEW: Equipment ───────────────────────────────────────────────────────
  {
    name: 'req_weapon_equipped',
    label: 'Weapon Equipped',
    description: 'Player must have a weapon in an active slot (pistol or rifle)',
    category: 'Items',
    params: [],
  },
  {
    name: 'req_no_weapon_equipped',
    label: 'No Weapon Equipped',
    description: 'Player must NOT have a weapon in any active slot',
    category: 'Items',
    params: [],
  },
  {
    name: 'req_outfit_equipped',
    label: 'Outfit Equipped',
    description: 'Player must have an outfit/armor equipped (slot 6)',
    category: 'Items',
    params: [],
  },

  // ─── NEW: World State ─────────────────────────────────────────────────────
  {
    name: 'req_surge_active',
    label: 'Emission Active',
    description: 'An emission/blowout must currently be in progress',
    category: 'Time & Weather',
    params: [],
  },
  {
    name: 'req_not_surge_active',
    label: 'No Emission Active',
    description: 'No emission/blowout must be in progress',
    category: 'Time & Weather',
    params: [],
  },
  {
    name: 'req_weather',
    label: 'Weather Type',
    description: 'Current weather must match specified type',
    category: 'Time & Weather',
    params: [
      { name: 'weather', type: 'string', required: true, label: 'Weather Type',
        editor: { kind: 'searchable_select', options: WEATHER_OPTIONS, emptyLabel: '-- Select weather --' } },
    ],
  },
  {
    name: 'req_game_hour_between',
    label: 'Hour Between',
    description: 'Current game hour must be between min and max (inclusive, wraps at midnight)',
    category: 'Time & Weather',
    helpText: 'Supports midnight wrapping: e.g. min=22, max=4 matches 22:00-04:59.',
    params: [
      { name: 'hour_min', type: 'number', required: true, label: 'Start Hour', min: 0, max: 23 },
      { name: 'hour_max', type: 'number', required: true, label: 'End Hour', min: 0, max: 23 },
    ],
  },
  {
    name: 'req_game_month',
    label: 'Game Month',
    description: 'Current in-game month must match',
    category: 'Time & Weather',
    params: [
      { name: 'month', type: 'number', required: true, label: 'Month',
        editor: { kind: 'searchable_select', options: MONTH_OPTIONS, emptyLabel: '-- Select month --' } },
    ],
  },

  // ─── NEW: Faction Relations ───────────────────────────────────────────────
  {
    name: 'req_factions_enemies',
    label: 'Factions Are Enemies',
    description: 'Two factions must currently be hostile to each other',
    category: 'Faction',
    params: [
      { name: 'faction1', type: 'faction', required: true, label: 'Faction 1', editor: { kind: 'searchable_select', options: FACTION_OPTIONS, emptyLabel: '-- Select faction --' } },
      { name: 'faction2', type: 'faction', required: true, label: 'Faction 2', editor: { kind: 'searchable_select', options: FACTION_OPTIONS, emptyLabel: '-- Select faction --' } },
    ],
  },
  {
    name: 'req_factions_friends',
    label: 'Factions Are Friends',
    description: 'Two factions must currently be allied',
    category: 'Faction',
    params: [
      { name: 'faction1', type: 'faction', required: true, label: 'Faction 1', editor: { kind: 'searchable_select', options: FACTION_OPTIONS, emptyLabel: '-- Select faction --' } },
      { name: 'faction2', type: 'faction', required: true, label: 'Faction 2', editor: { kind: 'searchable_select', options: FACTION_OPTIONS, emptyLabel: '-- Select faction --' } },
    ],
  },
  {
    name: 'req_npc_rank_name',
    label: 'NPC Rank Name',
    description: 'NPC rank name must match exactly (e.g. veteran, master)',
    category: 'Rank',
    params: [
      { name: 'rank', type: 'rank', required: true, label: 'Rank Name', editor: { kind: 'searchable_select', options: RANK_OPTIONS } },
    ],
  },

  // ─── NEW: Statistics / Weight ─────────────────────────────────────────────
  {
    name: 'req_total_weight_min',
    label: 'Carry Weight Min',
    description: 'Player must be carrying >= specified weight (kg)',
    category: 'Statistics',
    params: [
      { name: 'weight', type: 'number', required: true, label: 'Minimum Weight (kg)', min: 0 },
    ],
  },
  {
    name: 'req_total_weight_max',
    label: 'Carry Weight Max',
    description: 'Player must be carrying <= specified weight (kg)',
    category: 'Statistics',
    params: [
      { name: 'weight', type: 'number', required: true, label: 'Maximum Weight (kg)', min: 0 },
    ],
  },
  {
    name: 'req_visited_smart',
    label: 'Visited Smart Terrain',
    description: 'Player must have visited a specific smart terrain before',
    category: 'Game Progress',
    params: [
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
    ],
  },
  {
    name: 'req_distance_min',
    label: 'Distance From NPC Min',
    description: 'Player must be at least this far from the conversation NPC (meters)',
    category: 'Location',
    params: [
      { name: 'distance', type: 'number', required: true, label: 'Minimum Distance (m)', min: 1 },
    ],
  },
  {
    name: 'req_distance_max',
    label: 'Distance From NPC Max',
    description: 'Player must be within this distance of the conversation NPC (meters)',
    category: 'Location',
    params: [
      { name: 'distance', type: 'number', required: true, label: 'Maximum Distance (m)', min: 1 },
    ],
  },

  // ─── Custom NPCs ──────────────────────────────────────────────────────────
  {
    name: 'req_custom_npc_alive',
    label: 'Custom NPC is Alive',
    description: 'At least one spawned instance of the custom NPC template is alive',
    category: 'Custom NPCs',
    helpText:
      'Checks whether a custom NPC spawned via spawn_custom_npc / spawn_custom_npc_at with this template ID currently exists and is alive in the world. ' +
      'Use together with req_custom_npc_dead to build gated follow-up conversations.',
    examples: ['req_custom_npc_alive:informant', 'req_custom_npc_alive:hired_guns'],
    params: [
      {
        name: 'template_id',
        type: 'string',
        required: true,
        label: 'Template ID',
        placeholder: 'e.g. informant',
        editor: { kind: 'custom_npc_builder' },
        helpText: 'Must match the template_id used in the spawn_custom_npc outcome.',
      },
    ],
  },
  {
    name: 'req_custom_npc_dead',
    label: 'Custom NPC is Dead',
    description: 'All spawned instances of the custom NPC template are dead or gone',
    category: 'Custom NPCs',
    helpText:
      'Passes when every NPC spawned from this template has been killed or despawned. ' +
      'Useful for follow-up conversations after the player eliminates a custom target.',
    examples: ['req_custom_npc_dead:hired_guns', 'req_custom_npc_dead:escort'],
    params: [
      {
        name: 'template_id',
        type: 'string',
        required: true,
        label: 'Template ID',
        placeholder: 'e.g. hired_guns',
        editor: { kind: 'custom_npc_builder' },
        helpText: 'Must match the template_id used in the spawn_custom_npc outcome.',
      },
    ],
  },
  {
    name: 'req_custom_npc_near',
    label: 'Custom NPC is Nearby',
    description: 'At least one alive custom NPC of this template is within the specified distance of the player',
    category: 'Custom NPCs',
    helpText:
      'Passes when a living custom NPC from the template is within the given radius of the player. ' +
      'Use this to gate F2F conversations on whether the spawned NPC has actually been reached.',
    examples: ['req_custom_npc_near:informant:15', 'req_custom_npc_near:weapons_dealer:20'],
    params: [
      {
        name: 'template_id',
        type: 'string',
        required: true,
        label: 'Template ID',
        placeholder: 'e.g. informant',
        editor: { kind: 'custom_npc_builder' },
        helpText: 'Must match the template_id used in the spawn_custom_npc outcome.',
      },
      {
        name: 'distance',
        type: 'number',
        required: true,
        label: 'Distance (m)',
        min: 1,
        placeholder: '15',
      },
    ],
  },
];

// ─── Outcome Schemas ────────────────────────────────────────────────────────

export const OUTCOME_SCHEMAS: CommandSchema[] = [
  // Money
  {
    name: 'reward_money',
    label: 'Give Money',
    description: 'Give player money',
    category: 'Money',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount (RU)', min: 1 },
    ],
  },
  {
    name: 'punish_money',
    label: 'Take Money',
    description: 'Remove money from player',
    category: 'Money',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount (RU)', min: 1 },
    ],
  },

  // Reputation
  {
    name: 'reward_rep',
    label: 'Give Reputation',
    description: 'Increase player reputation',
    category: 'Reputation',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount', min: 1 },
    ],
  },
  {
    name: 'punish_rep',
    label: 'Take Reputation',
    description: 'Decrease player reputation',
    category: 'Reputation',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount', min: 1 },
    ],
  },

  // Goodwill
  {
    name: 'reward_gw',
    label: 'Give Goodwill',
    description: 'Increase goodwill with faction',
    category: 'Goodwill',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount', min: 1 },
      { name: 'faction', type: 'faction', required: false, label: 'Faction', placeholder: 'stalker' },
    ],
  },
  {
    name: 'punish_gw',
    label: 'Take Goodwill',
    description: 'Decrease goodwill with faction',
    category: 'Goodwill',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount', min: 1 },
      { name: 'faction', type: 'faction', required: false, label: 'Faction', placeholder: 'stalker' },
    ],
  },

  // Items
  {
    name: 'give_item',
    label: 'Give Item',
    description: 'Spawn item in player inventory',
    category: 'Items',
    params: [
      { name: 'item', type: 'item_section', required: true, label: 'Item Section', editor: ITEM_PICKER_PANEL_EDITOR },
    ],
  },
  // Items (expanded)
  {
    name: 'take_item',
    label: 'Take Item',
    description: 'Remove specific item from player inventory',
    category: 'Items',
    params: [
      { name: 'item', type: 'item_section', required: true, label: 'Item Section', editor: ITEM_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'give_item_count',
    label: 'Give Item (Multiple)',
    description: 'Give multiple copies of an item to the player',
    category: 'Items',
    params: [
      { name: 'item', type: 'item_section', required: true, label: 'Item Section', editor: ITEM_PICKER_PANEL_EDITOR },
      { name: 'count', type: 'number', required: true, label: 'Count', min: 1 },
    ],
  },

  // Stash (expanded)
  {
    name: 'reward_stash_items',
    label: 'Give Stash (Specific Items)',
    description: 'Create stash containing specific bonus items',
    category: 'Rewards',
    helpText: 'Items are added as bonus items to the stash. Separate items with +.',
    params: [
      { name: 'items', type: 'string', required: true, label: 'Items (+-separated)', editor: ITEM_CHAIN_PICKER_PANEL_EDITOR,
        helpText: 'Item sections separated by +. Example: medkit+bandage+vodka' },
    ],
  },

  // Knowledge
  {
    name: 'give_info',
    label: 'Give Info Portion',
    description: 'Give player an info portion (knowledge unlock)',
    category: 'Knowledge',
    params: [
      { name: 'info_id', type: 'string', required: true, label: 'Info Portion ID', editor: INFO_PORTION_PICKER_PANEL_EDITOR,
        helpText: 'The info portion ID from configs/gameplay/info_portions.xml' },
    ],
  },
  {
    name: 'disable_info',
    label: 'Remove Info Portion',
    description: 'Remove info portion from player',
    category: 'Knowledge',
    params: [
      { name: 'info_id', type: 'string', required: true, label: 'Info Portion ID', editor: INFO_PORTION_PICKER_PANEL_EDITOR },
    ],
  },

  // Player Effects
  {
    name: 'heal_player',
    label: 'Heal Player',
    description: 'Restore player health by percentage',
    category: 'Player Effects',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount (%)', min: 1, max: 100 },
    ],
  },
  {
    name: 'damage_player',
    label: 'Damage Player',
    description: 'Reduce player health by percentage (will not kill)',
    category: 'Player Effects',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount (%)', min: 1, max: 99 },
    ],
  },
  {
    name: 'give_radiation',
    label: 'Give Radiation',
    description: 'Apply radiation to player',
    category: 'Player Effects',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount (%)', min: 1, max: 100 },
    ],
  },
  {
    name: 'cure_radiation',
    label: 'Cure Radiation',
    description: 'Remove all radiation from player',
    category: 'Player Effects',
    params: [],
  },

  // Spawning
  {
    name: 'spawn_custom_npc',
    label: 'Spawn Custom NPC (near player)',
    description: 'Spawn a fully author-defined NPC near the player using a named template',
    category: 'Spawning',
    helpText:
      'Configure the NPC template directly in the editor — name, faction, rank, weapons, outfit, items, relation, and optional near-player spawn distance. ' +
      'Near-player spawns always roam after spawning; if you need a fixed custom NPC, use "Spawn Custom NPC at Location" with a smart terrain instead. ' +
      'The template is stored in your conversations XML as st_panda_npc_template_<id>. ' +
      'Use req_custom_npc_alive / req_custom_npc_dead as preconditions to gate conversations on whether this NPC is still alive.',
    examples: ['spawn_custom_npc:informant', 'spawn_custom_npc:hired_guns:10'],
    params: [
      {
        name: 'template_id',
        type: 'string',
        required: true,
        label: 'NPC Template',
        placeholder: 'e.g. informant',
        editor: { kind: 'custom_npc_builder' },
      },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '0', min: 0 },
    ],
  },
  {
    name: 'spawn_custom_npc_at',
    label: 'Spawn Custom NPC at Location',
    description: 'Spawn a fully author-defined NPC at a smart terrain position using a named template',
    category: 'Spawning',
    helpText:
      'Same as "Spawn Custom NPC" but places the NPC at the chosen smart terrain position instead of near the player. ' +
      'Use this path when you want a custom NPC to stay locked to a location: turn roaming off in the template builder, choose a fixed-job behavior, and the runtime will bind that NPC to a compatible vanilla smart job on the chosen smart terrain. ' +
      'Not every smart terrain has every job type, so choose a smart terrain that has paths or animpoints matching the behavior you want. ' +
      'The smart terrain is chosen on this command, so the template builder hides near-player spawn distance and keeps the movement lock option here.',
    examples: ['spawn_custom_npc_at:hired_guns:esc_smart_terrain_5_7', 'spawn_custom_npc_at:weapons_dealer:bar_visitors:5'],
    params: [
      {
        name: 'template_id',
        type: 'string',
        required: true,
        label: 'NPC Template',
        placeholder: 'e.g. hired_guns',
        editor: { kind: 'custom_npc_builder' },
      },
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '0', min: 0 },
    ],
  },
  {
    name: 'spawn_mutant',
    label: 'Spawn Mutants',
    description: 'Spawn a specific mutant squad near player',
    category: 'Spawning',
    params: [
      {
        name: 'squad_section',
        type: 'string',
        required: true,
        label: 'Mutant Squad',
        editor: { kind: 'searchable_select', options: MUTANT_SQUAD_OPTIONS, emptyLabel: '-- Select mutant squad --' },
        helpText: 'Pick the exact mutant squad section to spawn.',
      },
      { name: 'distance', type: 'number', required: true, label: 'Distance (m)', min: 10 },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '90', min: 0 },
      { name: 'count', type: 'number', required: false, label: 'Squad Count', placeholder: '1', min: 1, max: 10, helpText: 'Number of copies to spawn.' },
    ],
  },
  {
    name: 'spawn_mutant_at_smart',
    label: 'Spawn Mutants at Location',
    description: 'Spawn a specific mutant squad at smart terrain',
    category: 'Spawning',
    params: [
      {
        name: 'squad_section',
        type: 'string',
        required: true,
        label: 'Mutant Squad',
        editor: { kind: 'searchable_select', options: MUTANT_SQUAD_OPTIONS, emptyLabel: '-- Select mutant squad --' },
        helpText: 'Pick the exact mutant squad section to spawn at the selected smart terrain.',
      },
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '0', min: 0 },
      { name: 'count', type: 'number', required: false, label: 'Squad Count', placeholder: '1', min: 1, max: 10, helpText: 'Number of copies to spawn.' },
    ],
  },
  {
    name: 'spawn_npc_squad',
    label: 'Spawn Vanilla Faction Squad (near player)',
    description: 'Spawn a vanilla NPC faction squad near player',
    category: 'Spawning',
    helpText:
      'Use bundled vanilla NPC squad sections when you want normal faction squads to appear near player instead of at a smart terrain. ' +
      'Set spawn distance in meters and optional delay timer before squad appears.',
    examples: ['spawn_npc_squad:army_sim_squad_novice:50', 'spawn_npc_squad:bandit_sim_squad_advanced:80:15:2:hostile'],
    params: [
      {
        name: 'squad_section',
        type: 'string',
        required: true,
        label: 'Faction Squad',
        editor: NPC_SQUAD_PICKER_PANEL_EDITOR,
        helpText: 'Pick exact vanilla NPC squad section to spawn near player.',
      },
      { name: 'distance', type: 'number', required: true, label: 'Distance (m)', min: 10 },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '0', min: 0 },
      { name: 'count', type: 'number', required: false, label: 'Squad Count', placeholder: '1', min: 1, max: 10, helpText: 'Number of copies to spawn.' },
      {
        name: 'state',
        type: 'string',
        required: false,
        label: 'Spawn State',
        placeholder: 'default',
        editor: { kind: 'static_select', options: SQUAD_STATE_OPTIONS, emptyLabel: '-- Faction default --' },
        helpText: 'Sets relation each spawned squad has toward the player.',
      },
    ],
  },
  {
    name: 'spawn_npc_squad_at_smart',
    label: 'Spawn Vanilla Faction Squad at Location',
    description: 'Spawn a vanilla NPC faction squad at smart terrain',
    category: 'Spawning',
    helpText:
      'Use bundled vanilla NPC squad sections instead of custom NPC templates when you want to drop regular faction squads onto a smart terrain. ' +
      'Picker is limited to vanilla NPC squads only, so mutants and custom template ids stay out of list.',
    examples: ['spawn_npc_squad_at_smart:army_sim_squad_novice:esc_smart_terrain_5_7', 'spawn_npc_squad_at_smart:bandit_sim_squad_advanced:gar_smart_terrain_1_7:10:3:hostile'],
    params: [
      {
        name: 'squad_section',
        type: 'string',
        required: true,
        label: 'Faction Squad',
        editor: NPC_SQUAD_PICKER_PANEL_EDITOR,
        helpText: 'Pick exact vanilla NPC squad section to spawn at selected smart terrain.',
      },
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '0', min: 0 },
      { name: 'count', type: 'number', required: false, label: 'Squad Count', placeholder: '1', min: 1, max: 10, helpText: 'Number of copies to spawn.' },
      {
        name: 'state',
        type: 'string',
        required: false,
        label: 'Spawn State',
        placeholder: 'default',
        editor: { kind: 'static_select', options: SQUAD_STATE_OPTIONS, emptyLabel: '-- Faction default --' },
        helpText: 'Sets relation each spawned squad has toward the player.',
      },
    ],
  },

  // Location
  {
    name: 'watch_location',
    label: 'Watch Location',
    description: 'Mark location on map for tracking',
    category: 'Location',
    params: [
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
      { name: 'radius', type: 'number', required: false, label: 'Radius (m)', placeholder: '85', min: 1 },
    ],
  },
  {
    name: 'watch_location_trigger',
    label: 'Watch Location + Trigger',
    description: 'Mark location and execute command when player arrives',
    category: 'Location',
    helpText: 'Build one or more outcome commands that should fire when the player reaches the watched smart terrain. Chain multiple commands with + so they execute as one deferred batch.',
    examples: [
      'teleport_npc_to_smart:%cordon_panda_st_key%+spawn_mutant_at_smart:snork:%cordon_panda_st_key%',
      'spawn_custom_npc:hired_guns',
    ],
    params: [
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
      {
        name: 'trigger_command',
        type: 'string',
        required: true,
        label: 'Trigger Command (use + to chain)',
        editor: WATCH_TRIGGER_EDITOR,
        helpText: 'Use normal outcome syntax here. The watched smart terrain can be referenced with a real key or a %<level>_panda_st_key% placeholder.',
        examples: [
          'teleport_npc_to_smart:%cordon_panda_st_key%+spawn_mutant_at_smart:snork:%cordon_panda_st_key%',
          'spawn_custom_npc_at:hired_guns:%cordon_panda_st_key%',
        ],
      },
      { name: 'radius', type: 'number', required: false, label: 'Radius (m)', placeholder: '85', min: 1 },
    ],
  },

  // NPC Movement
  {
    name: 'teleport_npc_to_smart',
    label: 'Teleport NPC to Location',
    description: 'Move NPC to smart terrain',
    category: 'NPC',
    params: [
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '0', min: 0 },
    ],
  },
  {
    name: 'teleport_npc_to_player',
    label: 'Teleport NPC to Player',
    description: 'Move NPC near player position',
    category: 'NPC',
    params: [
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '0', min: 0 },
    ],
  },
  {
    name: 'recruit_companion',
    label: 'Recruit Companion',
    description: 'Convert NPC to player companion',
    category: 'NPC',
    params: [
      { name: 'no_dismiss', type: 'string', required: false, label: 'Prevent Dismissal', placeholder: 'no_dismiss' },
    ],
  },
  {
    name: 'dismiss_companion',
    label: 'Dismiss Companion',
    description: 'Dismiss the conversation NPC from companion squad',
    category: 'NPC',
    params: [],
  },
  {
    name: 'kill_npc',
    label: 'Kill NPC',
    description: 'Kill or release the conversation NPC from the simulation',
    category: 'NPC',
    params: [],
  },
  {
    name: 'set_npc_hostile',
    label: 'Set NPC Hostile',
    description: 'Make the conversation NPC hostile to the player',
    category: 'NPC',
    params: [],
  },
  {
    name: 'set_npc_friendly',
    label: 'Set NPC Friendly',
    description: 'Make the conversation NPC friendly to the player',
    category: 'NPC',
    params: [],
  },
  {
    name: 'change_npc_faction',
    label: 'Change NPC Faction',
    description: 'Change the conversation NPC to a different faction',
    category: 'NPC',
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'New Faction', editor: { kind: 'searchable_select', options: FACTION_OPTIONS, emptyLabel: '-- Select faction --' } },
    ],
  },

  // Job System
  {
    name: 'start_anomaly_scan_task',
    label: 'Start Anomaly Scan Task (Legacy)',
    description: 'Legacy outcome kept for backward compatibility only.',
    category: 'Anomaly / Artifact',
    pickerHidden: true,
    examples: ['start_anomaly_scan_task:scan_yan_01:labx18_2c_04_bioh_anomaly_spot:advanced:1800'],
    params: [
      { name: 'task_id', type: 'string', required: true, label: 'Runtime Task ID', editor: TASK_ID_PICKER_PANEL_EDITOR, helpText: 'Task IDs can be custom. Browse vanilla task ids or type a modded/custom id.' },
      { name: 'zone_name', type: 'string', required: true, label: 'Anomaly Zone Name', editor: ANOMALY_ZONE_PICKER_PANEL_EDITOR },
      { name: 'detector_tier', type: 'string', required: false, label: 'Detector Tier', placeholder: 'basic', editor: { kind: 'static_select', options: DETECTOR_TIER_OPTIONS, emptyLabel: '-- Select detector tier --' } },
      { name: 'expire_seconds', type: 'number', required: false, label: 'Expire After (s)', placeholder: '0', min: 0 },
    ],
  },
  {
    name: 'start_artifact_retrieval_task',
    label: 'Start Artifact Retrieval Task (Legacy)',
    description: 'Legacy outcome kept for backward compatibility only.',
    category: 'Anomaly / Artifact',
    pickerHidden: true,
    examples: ['start_artifact_retrieval_task:af_fetch_01:af_compass:red_smart_terrain_3_2_anomal_zone:elite:3600'],
    params: [
      { name: 'task_id', type: 'string', required: true, label: 'Runtime Task ID', editor: TASK_ID_PICKER_PANEL_EDITOR, helpText: 'Task IDs can be custom. Browse vanilla task ids or type a modded/custom id.' },
      { name: 'artifact_section', type: 'item_section', required: true, label: 'Artifact Section', editor: ITEM_PICKER_PANEL_EDITOR },
      { name: 'zone_name', type: 'string', required: true, label: 'Anomaly Zone Name', editor: ANOMALY_ZONE_PICKER_PANEL_EDITOR },
      { name: 'detector_tier', type: 'string', required: false, label: 'Detector Tier', placeholder: 'basic', editor: { kind: 'static_select', options: DETECTOR_TIER_OPTIONS, emptyLabel: '-- Select detector tier --' } },
      { name: 'expire_seconds', type: 'number', required: false, label: 'Expire After (s)', placeholder: '0', min: 0 },
    ],
  },
  {
    name: 'spawn_artifact_on_npc',
    label: 'Spawn Artifact on NPC (Legacy)',
    description: 'Legacy outcome kept for backward compatibility only.',
    category: 'Anomaly / Artifact',
    pickerHidden: true,
    params: [
      { name: 'task_id', type: 'string', required: true, label: 'Runtime Task ID', editor: TASK_ID_PICKER_PANEL_EDITOR, helpText: 'Task IDs can be custom. Browse vanilla task ids or type a modded/custom id.' },
      { name: 'target_npc_id', type: 'number', required: false, label: 'Target NPC ID', placeholder: 'conversation npc' },
      { name: 'artifact_section', type: 'item_section', required: true, label: 'Artifact Section', editor: ITEM_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'spawn_artifact_in_zone',
    label: 'Spawn Artifact in Zone (Legacy)',
    description: 'Legacy outcome kept for backward compatibility only.',
    category: 'Anomaly / Artifact',
    pickerHidden: true,
    params: [
      { name: 'task_id', type: 'string', required: true, label: 'Runtime Task ID', editor: TASK_ID_PICKER_PANEL_EDITOR, helpText: 'Task IDs can be custom. Browse vanilla task ids or type a modded/custom id.' },
      { name: 'artifact_section', type: 'item_section', required: true, label: 'Artifact Section', editor: ITEM_PICKER_PANEL_EDITOR },
      { name: 'zone_name', type: 'string', required: true, label: 'Anomaly Zone Name', editor: ANOMALY_ZONE_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'require_detector_tier',
    label: 'Require Detector Tier',
    description: 'Legacy detector-tier check outcome (prefer req_detector_tier precondition).',
    category: 'Anomaly / Artifact',
    pickerHidden: true,
    helpText: 'Deprecated for new content: use req_detector_tier preconditions for gating. Keep this only for legacy conversation compatibility.',
    params: [
      { name: 'detector_tier', type: 'string', required: true, label: 'Detector Tier', editor: { kind: 'static_select', options: DETECTOR_TIER_OPTIONS, emptyLabel: '-- Select detector tier --' } },
    ],
  },
  {
    name: 'turn_in_artifact',
    label: 'Turn In Artifact (Legacy)',
    description: 'Legacy outcome kept for backward compatibility only.',
    category: 'Anomaly / Artifact',
    pickerHidden: true,
    params: [
      { name: 'task_id', type: 'string', required: true, label: 'Runtime Task ID', editor: TASK_ID_PICKER_PANEL_EDITOR, helpText: 'Task IDs can be custom. Browse vanilla task ids or type a modded/custom id.' },
      { name: 'artifact_section', type: 'item_section', required: false, label: 'Artifact Section (override)', editor: ITEM_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'set_anomaly_target',
    label: 'Set Anomaly Target (Legacy)',
    description: 'Legacy outcome kept for backward compatibility only.',
    category: 'Anomaly / Artifact',
    pickerHidden: true,
    params: [
      { name: 'task_id', type: 'string', required: true, label: 'Runtime Task ID', editor: TASK_ID_PICKER_PANEL_EDITOR, helpText: 'Task IDs can be custom. Browse vanilla task ids or type a modded/custom id.' },
      { name: 'zone_name', type: 'string', required: true, label: 'Anomaly Zone Name', editor: ANOMALY_ZONE_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'fail_if_artifact_lost',
    label: 'Fail if Artifact Lost (Legacy)',
    description: 'Legacy outcome kept for backward compatibility only.',
    category: 'Anomaly / Artifact',
    pickerHidden: true,
    params: [
      { name: 'task_id', type: 'string', required: true, label: 'Runtime Task ID', editor: TASK_ID_PICKER_PANEL_EDITOR, helpText: 'Task IDs can be custom. Browse vanilla task ids or type a modded/custom id.' },
      { name: 'enabled', type: 'string', required: false, label: 'Enabled', placeholder: 'true' },
    ],
  },

  // Job System
  {
    name: 'pause_job',
    label: 'Job Timer',
    description: 'Wait for spawned squads to die, then branch to success/fail turn',
    category: 'Job System',
    helpText: 'pause_job should usually live on the same choice as the spawn or watch_location_trigger command it is tracking.',
    examples: [
      'pause_job:600:3:4',
    ],
    params: [
      { name: 'timeout', type: 'number', required: true, label: 'Timeout (s)', min: 1 },
      { name: 'success_turn', type: 'number', required: true, label: 'Success Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      { name: 'fail_turn', type: 'number', required: true, label: 'Fail Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
    ],
  },

  // Stash
  {
    name: 'reward_stash',
    label: 'Give Stash',
    description: 'Queue random stash for discovery',
    category: 'Rewards',
    params: [],
  },

  // ─── NEW: Player Effects (expanded) ──────────────────────────────────────
  {
    name: 'give_hunger',
    label: 'Give Hunger',
    description: 'Reduce player satiety (make them hungry)',
    category: 'Player Effects',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount (%)', min: 1, max: 100 },
    ],
  },
  {
    name: 'cure_hunger',
    label: 'Cure Hunger',
    description: 'Restore player satiety (feed them)',
    category: 'Player Effects',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount (%)', min: 1, max: 100 },
    ],
  },
  {
    name: 'boost_speed',
    label: 'Boost Speed',
    description: 'Temporarily increase player movement speed',
    category: 'Player Effects',
    params: [
      { name: 'multiplier', type: 'number', required: true, label: 'Multiplier (1.1-3.0)', min: 1.1, max: 3 },
      { name: 'duration', type: 'number', required: true, label: 'Duration (s)', min: 1 },
    ],
  },
  {
    name: 'slow_speed',
    label: 'Slow Speed',
    description: 'Temporarily decrease player movement speed',
    category: 'Player Effects',
    params: [
      { name: 'multiplier', type: 'number', required: true, label: 'Multiplier (0.1-0.9)', min: 0.1, max: 0.9 },
      { name: 'duration', type: 'number', required: true, label: 'Duration (s)', min: 1 },
    ],
  },
  {
    name: 'change_rank',
    label: 'Change Rank',
    description: 'Modify player rank points (positive or negative)',
    category: 'Player Effects',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount (can be negative)' },
    ],
  },
  {
    name: 'teleport_player_to_smart',
    label: 'Teleport Player to Location',
    description: 'Teleport the player to a smart terrain location',
    category: 'Player Effects',
    helpText: 'Warning: This is a dramatic action that relocates the player. Use with care in conversation context.',
    params: [
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '0', min: 0 },
    ],
  },

  // ─── NEW: NPC Manipulation (expanded) ──────────────────────────────────
  {
    name: 'change_npc_rank',
    label: 'Change NPC Rank',
    description: 'Modify the conversation NPC rank points (positive or negative)',
    category: 'NPC',
    params: [
      { name: 'amount', type: 'number', required: true, label: 'Amount (can be negative)' },
    ],
  },
  {
    name: 'equip_npc_item',
    label: 'Give NPC Item',
    description: 'Spawn an item into the conversation NPC inventory',
    category: 'NPC',
    params: [
      { name: 'item', type: 'item_section', required: true, label: 'Item Section', editor: ITEM_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'set_companion_state',
    label: 'Set Companion Behavior',
    description: 'Set the conversation NPC companion behavior (must be a companion)',
    category: 'NPC',
    params: [
      { name: 'state', type: 'string', required: true, label: 'Behavior State',
        editor: { kind: 'searchable_select', options: COMPANION_STATE_OPTIONS, emptyLabel: '-- Select state --' } },
    ],
  },
  {
    name: 'set_npc_neutral',
    label: 'Set NPC Neutral',
    description: 'Make the conversation NPC neutral toward the player',
    category: 'NPC',
    params: [],
  },
  {
    name: 'set_npc_state',
    label: 'Set NPC State',
    description: 'Set the conversation NPC relation toward the player',
    category: 'NPC',
    helpText: 'Unified replacement for Set NPC Hostile/Friendly/Neutral. Use to make the story NPC the player is talking to aggressive, neutral, or friendly.',
    examples: ['set_npc_state:hostile', 'set_npc_state:neutral', 'set_npc_state:friendly'],
    params: [
      {
        name: 'state',
        type: 'string',
        required: true,
        label: 'NPC State',
        editor: { kind: 'static_select', options: NPC_RELATION_STATE_OPTIONS, emptyLabel: '-- Select state --' },
      },
    ],
  },
  {
    name: 'make_npc_invulnerable',
    label: 'Make NPC Invulnerable',
    description: 'Make the conversation NPC immune to damage for a duration',
    category: 'NPC',
    params: [
      { name: 'duration', type: 'number', required: true, label: 'Duration (s)', min: 1 },
    ],
  },
  {
    name: 'set_npc_animation',
    label: 'Set NPC Animation',
    description: 'Play a curated vanilla animation preset on the conversation NPC',
    category: 'NPC',
    helpText: 'Targets the active conversation NPC only. In F2F, the preset is queued and starts after the vanilla dialogue panel closes. Terrain-sensitive presets like sleep, wounded, and sit_ground need enough flat space to look right.',
    params: [
      {
        name: 'preset_id',
        type: 'string',
        required: true,
        label: 'Animation Preset',
        editor: { kind: 'searchable_select', options: NPC_ANIMATION_PRESET_OPTIONS, emptyLabel: '-- Select animation preset --' },
        helpText: 'Curated safe presets only. sleep_*, wounded_*, and sit_ground are terrain-sensitive and may clip or fail on uneven ground.',
      },
      {
        name: 'duration',
        type: 'number',
        required: false,
        label: 'Duration Override (s)',
        placeholder: 'Use preset default',
        min: 0.1,
        helpText: 'Optional. Leave empty to use the preset default duration.',
      },
    ],
  },
  {
    name: 'clear_npc_animation',
    label: 'Clear NPC Animation',
    description: 'Stop the current dialogue-driven animation on the conversation NPC',
    category: 'NPC',
    helpText: 'Clears the active dialogue-driven pose for the conversation NPC. In F2F, the clear is applied after the dialogue panel closes.',
    params: [],
  },
  // ─── NEW: Faction & Relations ─────────────────────────────────────────
  {
    name: 'change_faction_relations',
    label: 'Change Faction Relations',
    description: 'Change how two factions feel about each other',
    category: 'Goodwill',
    helpText: 'Positive values improve relations, negative values worsen them. This affects the global faction diplomacy.',
    params: [
      { name: 'faction1', type: 'faction', required: true, label: 'Faction 1', editor: { kind: 'searchable_select', options: FACTION_OPTIONS, emptyLabel: '-- Select faction --' } },
      { name: 'faction2', type: 'faction', required: true, label: 'Faction 2', editor: { kind: 'searchable_select', options: FACTION_OPTIONS, emptyLabel: '-- Select faction --' } },
      { name: 'amount', type: 'number', required: true, label: 'Amount (-1000 to 1000)', min: -1000, max: 1000 },
    ],
  },
  {
    name: 'change_player_faction',
    label: 'Change Player Faction',
    description: 'Change the player character faction allegiance',
    category: 'Player Effects',
    helpText: 'Warning: This is a major game state change. The player will immediately switch factions, affecting all relations.',
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'New Faction', editor: { kind: 'searchable_select', options: FACTION_OPTIONS, emptyLabel: '-- Select faction --' } },
    ],
  },
  {
    name: 'ceasefire',
    label: 'Ceasefire',
    description: 'Make all nearby NPCs temporarily non-hostile to the player',
    category: 'NPC',
    params: [
      { name: 'radius', type: 'number', required: false, label: 'Radius (m)', placeholder: '100', min: 10 },
    ],
  },

  // ─── NEW: World Effects ───────────────────────────────────────────────
  {
    name: 'set_weather',
    label: 'Change Weather',
    description: 'Force change the current weather',
    category: 'World',
    params: [
      { name: 'weather', type: 'string', required: true, label: 'Weather Type',
        editor: { kind: 'searchable_select', options: WEATHER_OPTIONS, emptyLabel: '-- Select weather --' } },
    ],
  },
  {
    name: 'give_game_news',
    label: 'Show Game News',
    description: 'Display an in-game news popup notification to the player',
    category: 'World',
    params: [
      { name: 'title', type: 'string', required: true, label: 'Title', placeholder: 'Breaking News' },
      { name: 'message', type: 'string', required: true, label: 'Message Text' },
      { name: 'duration', type: 'number', required: false, label: 'Duration (s)', placeholder: '5', min: 1, max: 30 },
    ],
  },

  // ─── NEW: Knowledge & Tasks ───────────────────────────────────────────
  {
    name: 'give_task',
    label: 'Give Task',
    description: 'Assign a game task/quest to the player',
    category: 'Knowledge',
    helpText: 'Task ID must match a valid task defined in the game task configs.',
    params: [
      { name: 'task_id', type: 'string', required: true, label: 'Task ID', placeholder: 'e.g. jup_b6_task', editor: TASK_ID_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'complete_task',
    label: 'Complete Task',
    description: 'Mark a game task as completed',
    category: 'Knowledge',
    params: [
      { name: 'task_id', type: 'string', required: true, label: 'Task ID', editor: TASK_ID_PICKER_PANEL_EDITOR },
    ],
  },
  {
    name: 'fail_task',
    label: 'Fail Task',
    description: 'Mark a game task as failed',
    category: 'Knowledge',
    params: [
      { name: 'task_id', type: 'string', required: true, label: 'Task ID', editor: TASK_ID_PICKER_PANEL_EDITOR },
    ],
  },

  // ─── Tasks ────────────────────────────────────────────────────────────

  {
    name: 'panda_task_delivery',
    label: 'Task: Delivery',
    description: 'Player delivers an auto package to a randomly chosen NPC',
    category: 'Tasks',
    helpText: 'Framework picks the package and the recipient automatically. Leave Destination empty for the engine to pick any eligible NPC anywhere; set a smart terrain to bias the recipient pick toward NPCs in that area.',
    examples: [
      'panda_task_delivery:600:3:4',
      'panda_task_delivery:st_esc_smart_terrain_5_4_name:600:3:4',
    ],
    params: [
      { name: 'destination', type: 'smart_terrain', required: false, label: 'Destination (optional)', editor: SMART_TERRAIN_EDITOR, helpText: 'Optional. Leave blank to let the engine pick any random recipient.' },
      { name: 'timeout', type: 'number', required: true, label: 'Timeout (s)', min: 30 },
      { name: 'success_turn', type: 'number', required: true, label: 'Success Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      { name: 'fail_turn', type: 'number', required: true, label: 'Fail Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
    ],
  },
  {
    name: 'panda_task_fetch',
    label: 'Task: Fetch Item',
    description: 'Player must find and collect specified item(s)',
    category: 'Tasks',
    helpText: 'Periodically checks the player\'s inventory. When the required items are found they are removed and the conversation resumes at the success turn. If the timeout expires first, the fail turn is used.',
    examples: ['panda_task_fetch:medkit_army:3:600:3:4'],
    params: [
      { name: 'item', type: 'item_section', required: true, label: 'Required Item', editor: ITEM_PICKER_PANEL_EDITOR },
      { name: 'count', type: 'number', required: true, label: 'Count', min: 1 },
      { name: 'timeout', type: 'number', required: true, label: 'Timeout (s)', min: 30 },
      { name: 'success_turn', type: 'number', required: true, label: 'Success Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      { name: 'fail_turn', type: 'number', required: true, label: 'Fail Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
    ],
  },
  {
    name: 'panda_task_bounty',
    label: 'Task: Bounty Hunt',
    description: 'Spawn target NPC at location; player must eliminate them',
    category: 'Tasks',
    helpText: 'Spawns a target NPC of the specified faction at the smart terrain and marks it on the PDA map. The player must find and kill the target. Rank is optional — omit or leave empty for any rank.',
    examples: ['panda_task_bounty:bandit:veteran:st_gar_smart_terrain_3_5_name:900:3:4'],
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'Target Faction', editor: { kind: 'searchable_select', options: FACTION_OPTIONS, emptyLabel: '-- Select faction --' } },
      { name: 'rank', type: 'string', required: false, label: 'Target Rank', editor: { kind: 'searchable_select', options: RANK_OPTIONS, emptyLabel: '-- Any rank --' } },
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Target Location', editor: SMART_TERRAIN_EDITOR },
      { name: 'timeout', type: 'number', required: true, label: 'Timeout (s)', min: 30 },
      { name: 'success_turn', type: 'number', required: true, label: 'Success Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      { name: 'fail_turn', type: 'number', required: true, label: 'Fail Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
    ],
  },
  {
    name: 'panda_task_dead_drop',
    label: 'Task: Dead Drop',
    description: 'Player must deposit item at a marked stash location',
    category: 'Tasks',
    helpText: 'The player must bring the specified item to the destination smart terrain. The item is taken from inventory on arrival. Location is marked on the PDA map.',
    examples: ['panda_task_dead_drop:device_pda_3:st_val_smart_terrain_8_6_name:600:3:4'],
    params: [
      { name: 'item', type: 'item_section', required: true, label: 'Item to Deposit', editor: ITEM_PICKER_PANEL_EDITOR },
      { name: 'destination', type: 'smart_terrain', required: true, label: 'Drop Location', editor: SMART_TERRAIN_EDITOR },
      { name: 'timeout', type: 'number', required: true, label: 'Timeout (s)', min: 30 },
      { name: 'success_turn', type: 'number', required: true, label: 'Success Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      { name: 'fail_turn', type: 'number', required: true, label: 'Fail Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
    ],
  },
  {
    name: 'panda_task_artifact',
    label: 'Task: Artifact Hunt',
    description: 'Player must find the specified artifact',
    category: 'Tasks',
    helpText: 'Vanilla-style artifact hunt: no destination required. Player succeeds once the specified artifact is in inventory.',
    examples: [
      'panda_task_artifact:af_compass:basic:900:3:4',
      'panda_task_artifact:af_medusa:advanced:900:3:4',
    ],
    params: [
      { name: 'artifact_section', type: 'item_section', required: true, label: 'Artifact Section', placeholder: 'af_medusa', editor: ITEM_PICKER_PANEL_EDITOR, helpText: 'Artifact player must find. Location stays unrestricted.' },
      { name: 'detector_tier', type: 'string', required: false, label: 'Detector Tier', placeholder: 'basic', editor: { kind: 'static_select', options: DETECTOR_TIER_OPTIONS, emptyLabel: '-- Select detector tier --' } },
      { name: 'timeout', type: 'number', required: true, label: 'Timeout (s)', min: 30 },
      { name: 'success_turn', type: 'number', required: true, label: 'Success Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      { name: 'fail_turn', type: 'number', required: true, label: 'Fail Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
    ],
  },
  {
    name: 'panda_task_escort',
    label: 'Task: Escort NPC',
    description: 'NPC becomes companion; escort to destination',
    category: 'Tasks',
    helpText:
      'By default the conversation NPC joins as a companion (cannot be dismissed). Optional target fields let authors use a story NPC (teleported next to the player), spawn or reuse a custom NPC template, or spawn a new faction NPC near the player. The NPC leaves the group on arrival. Fails if the NPC dies or the timeout expires.',
    examples: [
      'panda_task_escort:st_mil_smart_terrain_7_7_name:900:3:4',
      'panda_task_escort:st_mil_smart_terrain_7_7_name:900:3:4:story_npc:bar_visitors_barman_stalker_trader',
      'panda_task_escort:st_mil_smart_terrain_7_7_name:900:3:4:custom_npc:hired_guns:30',
      'panda_task_escort:st_mil_smart_terrain_7_7_name:900:3:4:spawn_faction:stalker:30',
    ],
    params: [
      { name: 'destination', type: 'smart_terrain', required: true, label: 'Destination', editor: SMART_TERRAIN_EDITOR },
      { name: 'timeout', type: 'number', required: true, label: 'Timeout (s)', min: 30 },
      { name: 'success_turn', type: 'number', required: true, label: 'Success Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      { name: 'fail_turn', type: 'number', required: true, label: 'Fail Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      { name: 'target_kind', type: 'string', required: false, label: 'Escort Target', placeholder: 'sender', editor: { kind: 'static_select', options: ESCORT_TARGET_OPTIONS, emptyLabel: 'Conversation NPC' } },
      { name: 'target_id', type: 'string', required: false, label: 'Target ID / Template / Faction', placeholder: 'hired_guns', helpText: 'story_npc uses story ID, custom_npc uses template ID, spawn_faction uses faction key. Leave empty for conversation NPC.' },
      { name: 'spawn_distance', type: 'number', required: false, label: 'Spawn Distance (m)', placeholder: '30', min: 5, max: 200, helpText: 'Meters from the player. Used when spawning a custom_npc or spawn_faction target. Story NPCs are teleported in at this distance.' },
    ],
  },
  {
    name: 'panda_task_eliminate',
    label: 'Task: Elimination',
    description: 'Spawn enemies at location; player must eliminate all',
    category: 'Tasks',
    helpText: 'Spawns one or more copies of the chosen squad at the smart terrain when the player approaches. Squad relation is configurable. The PDA task system places its own destination marker, so authors no longer need a separate watch-location.',
    examples: [
      'panda_task_eliminate:bandit:st_gar_smart_terrain_3_5_name:100:900:3:4',
      'panda_task_eliminate:snork:st_yan_smart_terrain_6_4_name:80:600:3:4:2:hostile',
    ],
    params: [
      {
        name: 'target_type',
        type: 'string',
        required: true,
        label: 'Target Squad',
        editor: SQUAD_PICKER_PANEL_EDITOR,
        helpText: 'Pick the exact squad section that should be spawned for the elimination objective.',
      },
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Location', editor: SMART_TERRAIN_EDITOR },
      { name: 'radius', type: 'number', required: false, label: 'Map Marker Radius (m)', placeholder: '100', min: 10 },
      { name: 'timeout', type: 'number', required: true, label: 'Timeout (s)', min: 30 },
      { name: 'success_turn', type: 'number', required: true, label: 'Success Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      { name: 'fail_turn', type: 'number', required: true, label: 'Fail Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      { name: 'squad_count', type: 'number', required: false, label: 'Squad Count', placeholder: '1', min: 1, max: 10, helpText: 'How many copies of the squad to spawn at the location.' },
      {
        name: 'state',
        type: 'string',
        required: false,
        label: 'Spawn State',
        placeholder: 'hostile',
        editor: { kind: 'static_select', options: SQUAD_STATE_OPTIONS, emptyLabel: '-- Aggressive (default) --' },
        helpText: 'Relation each spawned squad has toward the player. Defaults to aggressive.',
      },
    ],
  },
  {
    name: 'panda_task_rescue',
    label: 'Task: Rescue Survivor',
    description: 'Spawn hostile squads and keep survivor alive',
    category: 'Tasks',
    helpText: 'Survivor spawns immediately as a stationary hostage (invulnerable, ignores combat) at the smart terrain. Enemy squads spawn only when the player enters the smart terrain watch radius. Leave Survivor Template empty or random for generated survivor, or pick a custom NPC template.',
    examples: ['panda_task_rescue:bandit_sim_squad_novice:st_gar_smart_terrain_3_5_name:2:random:900:3:4:hostile'],
    params: [
      { name: 'enemy_squad', type: 'string', required: true, label: 'Enemy Squad', editor: SQUAD_PICKER_PANEL_EDITOR },
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Rescue Location', editor: SMART_TERRAIN_EDITOR },
      { name: 'squad_count', type: 'number', required: false, label: 'Enemy Squad Count', placeholder: '1', min: 1, max: 10 },
      { name: 'survivor_template', type: 'string', required: false, label: 'Survivor Template', placeholder: 'random', editor: { kind: 'custom_npc_builder' } },
      { name: 'timeout', type: 'number', required: true, label: 'Timeout (s)', min: 30 },
      { name: 'success_turn', type: 'number', required: true, label: 'Success Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      { name: 'fail_turn', type: 'number', required: true, label: 'Fail Turn', min: 2, editor: TURN_REFERENCE_EDITOR },
      {
        name: 'state',
        type: 'string',
        required: false,
        label: 'Enemy State',
        placeholder: 'hostile',
        editor: { kind: 'static_select', options: SQUAD_STATE_OPTIONS, emptyLabel: '-- Aggressive (default) --' },
        helpText: 'Relation each spawned enemy squad has toward the player. Defaults to aggressive.',
      },
    ],
  },

  // No outcome
  {
    name: 'none',
    label: 'No Outcome',
    description: 'No outcome (conversation only)',
    category: 'Other',
    params: [],
  },
];

/** Group schemas by category for dropdown menus */
export function groupByCategory(schemas: CommandSchema[]): Map<string, CommandSchema[]> {
  const groups = new Map<string, CommandSchema[]>();
  for (const schema of schemas) {
    const list = groups.get(schema.category) || [];
    list.push(schema);
    groups.set(schema.category, list);
  }
  return groups;
}

/** Find schema by command name */
export function findSchema(schemas: CommandSchema[], name: string): CommandSchema | undefined {
  return schemas.find(s => s.name === name);
}
