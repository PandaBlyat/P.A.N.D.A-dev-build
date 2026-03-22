// P.A.N.D.A. Conversation Editor — Command Schema Registry
// Defines all precondition and outcome commands with their parameter types,
// so the UI can auto-generate appropriate input fields.

import { FACTION_IDS, LEVEL_DISPLAY_NAMES, MUTANT_TYPES, RANKS } from './constants';
import { FACTION_DISPLAY_NAMES } from './types';

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
    kind: 'command_builder';
    suggestions: ParamOption[];
    chainSeparator?: string;
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
    value: 'spawn_hostile:bandit:90',
    label: 'Spawn a hostile squad near the player',
    keywords: ['spawn', 'hostile', 'bandit'],
  },
  {
    value: 'spawn_friendly:stalker:60',
    label: 'Spawn a friendly squad near the player',
    keywords: ['spawn', 'friendly', 'stalker'],
  },
  {
    value: 'spawn_npc:dolg:45',
    label: 'Spawn a faction squad near the player',
    keywords: ['spawn', 'npc', 'duty', 'dolg'],
  },
  {
    value: 'spawn_hostile_at_smart:bandit:%cordon_panda_st_key%',
    label: 'Spawn hostiles at the watched smart terrain',
    keywords: ['spawn', 'hostile', 'smart', 'bandit'],
  },
  {
    value: 'spawn_mutant:snork:90',
    label: 'Spawn mutants near the player',
    keywords: ['spawn', 'mutant', 'snork'],
  },
  {
    value: 'spawn_mutant_at_smart:snork:%cordon_panda_st_key%',
    label: 'Spawn mutants at the watched smart terrain',
    keywords: ['spawn', 'mutant', 'smart', 'snork'],
  },
  {
    value: 'recruit_companion',
    label: 'Recruit the current NPC as a companion',
    keywords: ['recruit', 'companion'],
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
    | 'item_section' | 'mutant_type' | 'achievement' | 'string' | 'slot';
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
      { name: 'achievement', type: 'achievement', required: true, label: 'Achievement Name' },
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
  {
    name: 'courier_item',
    label: 'Send Courier',
    description: 'Spawn NPC courier to deliver item',
    category: 'Items',
    params: [
      { name: 'item', type: 'item_section', required: false, label: 'Item Section', placeholder: 'medkit_army', editor: ITEM_PICKER_PANEL_EDITOR },
    ],
  },

  // Spawning
  {
    name: 'spawn_hostile',
    label: 'Spawn Hostiles',
    description: 'Spawn hostile squad near player',
    category: 'Spawning',
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'Faction' },
      { name: 'distance', type: 'number', required: true, label: 'Distance (m)', min: 10 },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '90', min: 0 },
    ],
  },
  {
    name: 'spawn_friendly',
    label: 'Spawn Friendlies',
    description: 'Spawn friendly squad near player',
    category: 'Spawning',
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'Faction' },
      { name: 'distance', type: 'number', required: true, label: 'Distance (m)', min: 10 },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '30', min: 0 },
    ],
  },
  {
    name: 'spawn_npc',
    label: 'Spawn Faction Squad',
    description: 'Spawn faction-default squad near player',
    category: 'Spawning',
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'Faction' },
      { name: 'distance', type: 'number', required: true, label: 'Distance (m)', min: 10 },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '30', min: 0 },
    ],
  },
  {
    name: 'spawn_mutant',
    label: 'Spawn Mutants',
    description: 'Spawn mutant squad near player',
    category: 'Spawning',
    params: [
      { name: 'type', type: 'mutant_type', required: true, label: 'Mutant Type', editor: { kind: 'searchable_select', options: MUTANT_OPTIONS } },
      { name: 'distance', type: 'number', required: true, label: 'Distance (m)', min: 10 },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '90', min: 0 },
    ],
  },
  {
    name: 'spawn_hostile_at_smart',
    label: 'Spawn Hostiles at Location',
    description: 'Spawn hostile squad at smart terrain',
    category: 'Spawning',
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'Faction' },
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '0', min: 0 },
    ],
  },
  {
    name: 'spawn_mutant_at_smart',
    label: 'Spawn Mutants at Location',
    description: 'Spawn mutant squad at smart terrain',
    category: 'Spawning',
    params: [
      { name: 'type', type: 'mutant_type', required: true, label: 'Mutant Type', editor: { kind: 'searchable_select', options: MUTANT_OPTIONS } },
      { name: 'smart_terrain', type: 'smart_terrain', required: true, label: 'Smart Terrain', editor: SMART_TERRAIN_EDITOR },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '0', min: 0 },
    ],
  },
  {
    name: 'spawn_companion',
    label: 'Spawn Companion',
    description: 'Spawn companion squad near player',
    category: 'Spawning',
    params: [
      { name: 'faction', type: 'faction', required: true, label: 'Faction' },
      { name: 'distance', type: 'number', required: true, label: 'Distance (m)', min: 10 },
      { name: 'delay', type: 'number', required: false, label: 'Delay (s)', placeholder: '30', min: 0 },
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
      'spawn_hostile:bandit:90',
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
          'spawn_hostile_at_smart:bandit:%cordon_panda_st_key%',
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
