import { RANKS, LEVEL_DISPLAY_NAMES } from './constants';
import type { Conversation, FactionId, NpcTemplate, Outcome, PreconditionEntry, Project, Turn, Choice } from './types';
import { FACTION_DISPLAY_NAMES, getConversationFaction } from './types';
import { createChoice, createConversation, createTurn } from './xml-export';

export type StoryStartPattern = 'pda' | 'f2f' | 'pda_to_f2f' | 'f2f_to_pda';
export type StorySpeakerTarget = 'any_friendly' | 'friendly_faction' | 'named_npc' | 'custom_npc';
export type StoryStructureId = 'one_shot' | 'two_step' | 'three_act' | 'branching' | 'task';
export type StoryBranchStyle = 'simple' | 'ask_more' | 'negotiation' | 'betrayal' | 'intimidate' | 'bribe' | 'lie' | 'mercy' | 'double_cross';
export type StoryToneId = 'gritty' | 'mystery' | 'military' | 'scientific' | 'black_market' | 'horror' | 'political' | 'personal_debt' | 'treasure_hunt' | 'mutant_threat' | 'anomaly_weirdness';
export type StoryConsequenceId = 'none' | 'goodwill_gain' | 'goodwill_loss' | 'rep_gain' | 'rep_loss' | 'weather_shift' | 'news_broadcast';
export type StoryAccessRuleId =
  | 'none'
  | 'player_faction'
  | 'not_player_faction'
  | 'rank_min'
  | 'goodwill_min'
  | 'level'
  | 'not_level'
  | 'day'
  | 'night'
  | 'has_item'
  | 'lacks_item';
export type StoryRecipeId =
  | 'rumor'
  | 'job_offer'
  | 'faction_warning'
  | 'item_request'
  | 'go_to_location'
  | 'spawn_ambush'
  | 'meet_in_person'
  | 'multi_npc_handoff'
  | 'supply_gift'
  | 'paid_info'
  | 'fetch_task'
  | 'delivery_task'
  | 'dead_drop'
  | 'bounty_hunt'
  | 'eliminate_squad'
  | 'artifact_hunt'
  | 'escort_npc'
  | 'rescue'
  | 'betrayal'
  | 'paid_stash_lead'
  | 'marked_threat'
  | 'ambush_warning'
  | 'custom_npc_encounter'
  | 'artifact_lead';

export type StoryRecipe = {
  id: StoryRecipeId;
  title: string;
  description: string;
  group: 'Simple' | 'Exchange' | 'Task' | 'Handoff' | 'Setpiece';
};

export type StoryStartOption = {
  id: StoryStartPattern;
  title: string;
  description: string;
};

export type StoryTargetOption = {
  id: StorySpeakerTarget;
  title: string;
  description: string;
};

export type StoryWizardOption = {
  id: string;
  title: string;
  description: string;
};

export type StoryDetailOptions = {
  itemId: string;
  itemCount: string;
  rewardMoney: string;
  rewardItemId: string;
  locationId: string;
  enemyId: string;
  handoffNpcId: string;
  targetFaction: FactionId;
  targetRank: string;
  timeoutSeconds: string;
  infoId: string;
};

export type StoryRecipeBuildOptions = {
  recipeId: StoryRecipeId;
  startPattern: StoryStartPattern;
  speakerTarget: StorySpeakerTarget;
  details?: Partial<StoryDetailOptions>;
};

export type StoryRecipeBuildResult = {
  conversation: Conversation;
  npcTemplates?: NpcTemplate[];
};

export type StoryWizardDraft = {
  faction: FactionId;
  title: string;
  premise: string;
  tone: StoryToneId;
  stakes: string;
  startPattern: StoryStartPattern;
  speakerTarget: StorySpeakerTarget;
  structureId: StoryStructureId;
  branchStyle: StoryBranchStyle;
  recipeId: StoryRecipeId;
  storyNpcId: string;
  handoffNpcId: string;
  customNpcTemplateId: string;
  customNpcName: string;
  customNpcSmartTerrain: string;
  itemId: string;
  itemCount: string;
  rewardMoney: string;
  rewardItemId: string;
  stashItems: string;
  locationId: string;
  secondaryLocationId: string;
  enemySquadId: string;
  targetFaction: FactionId;
  targetRank: string;
  timeoutSeconds: string;
  priceMoney: string;
  infoId: string;
  goodwillAmount: string;
  reputationAmount: string;
  consequenceId: StoryConsequenceId;
  weatherId: string;
  accessRuleId: StoryAccessRuleId;
  accessFaction: FactionId;
  accessRank: string;
  accessGoodwill: string;
  accessLevel: string;
  accessItemId: string;
};

export type StoryBeatSpec = {
  turnNumber: number;
  title: string;
  channel: 'pda' | 'f2f';
  choices: string[];
};

export type StoryGenerationResult = {
  conversation: Conversation;
  npcTemplates?: NpcTemplate[];
  beats: StoryBeatSpec[];
};

export const STORY_START_OPTIONS: StoryStartOption[] = [
  { id: 'pda', title: 'PDA message', description: 'Remote opener. Good for rumors, jobs, warnings, and map markers.' },
  { id: 'f2f', title: 'Face-to-face talk', description: 'Player sees dialogue option when talking to NPC.' },
  { id: 'pda_to_f2f', title: 'PDA, then meet', description: 'Message first, then in-person scene for handoff or payment.' },
  { id: 'f2f_to_pda', title: 'Meet, then PDA', description: 'Starts in person, then follow-up continues by message.' },
];

export const STORY_TARGET_OPTIONS: StoryTargetOption[] = [
  { id: 'any_friendly', title: 'Any friendly NPC', description: 'Safest default. Any non-hostile NPC can start story.' },
  { id: 'friendly_faction', title: 'Friendly story faction', description: 'Only friendly NPCs from current story faction can start.' },
  { id: 'named_npc', title: 'Named story NPC', description: 'Barkeep starts story. Author can swap NPC later.' },
  { id: 'custom_npc', title: 'Custom NPC', description: 'Creates default Informant template at Cordon location.' },
];

export const STORY_STRUCTURE_OPTIONS: StoryWizardOption[] = [
  { id: 'one_shot', title: 'One-shot', description: 'Fast scene with accept, ask, and refuse choices.' },
  { id: 'two_step', title: 'Two-step handoff', description: 'Starts one channel, continues through second channel.' },
  { id: 'three_act', title: 'Three-act quest', description: 'Setup, job, aftermath turns with success and failure.' },
  { id: 'branching', title: 'Branching choice', description: 'Adds negotiation or distrust path for richer roleplay.' },
  { id: 'task', title: 'Task-ready', description: 'Builds success/fail task scaffolding and map objective.' },
];

export const STORY_BRANCH_OPTIONS: StoryWizardOption[] = [
  { id: 'simple', title: 'Simple', description: 'Accept, ask more, refuse.' },
  { id: 'ask_more', title: 'Ask more', description: 'Extra explanation turn before accepting.' },
  { id: 'negotiation', title: 'Negotiation', description: 'Adds better-pay branch gated by goodwill.' },
  { id: 'betrayal', title: 'Betrayal', description: 'Adds suspicious path with ambush consequence.' },
  { id: 'intimidate', title: 'Intimidate', description: 'Adds hard-pressure reply with small reputation gate.' },
  { id: 'bribe', title: 'Bribe', description: 'Player can pay to unlock cleaner details or shortcut.' },
  { id: 'lie', title: 'Lie', description: 'Adds deceptive path and info flag for later fallout.' },
  { id: 'mercy', title: 'Mercy', description: 'Adds spare/help path with small goodwill gain.' },
  { id: 'double_cross', title: 'Double-cross', description: 'Adds hostile twist using ambush consequence.' },
];

export const STORY_TONE_OPTIONS: StoryWizardOption[] = [
  { id: 'gritty', title: 'Gritty survival', description: 'Sparse, tense, grounded Zone dialogue.' },
  { id: 'mystery', title: 'Mystery', description: 'Unknown signal, hidden stash, strange witness.' },
  { id: 'military', title: 'Military op', description: 'Orders, patrols, chain-of-command pressure.' },
  { id: 'scientific', title: 'Scientific', description: 'Anomalies, samples, field observation.' },
  { id: 'black_market', title: 'Black market', description: 'Deals, debts, paid information.' },
  { id: 'horror', title: 'Horror', description: 'Body-horror clues, silence, and bad places.' },
  { id: 'political', title: 'Faction politics', description: 'Rival claims, leverage, deniable favors.' },
  { id: 'personal_debt', title: 'Personal debt', description: 'Old favor, saved life, or unpaid promise.' },
  { id: 'treasure_hunt', title: 'Treasure hunt', description: 'Stash rumor, coded lead, hidden payout.' },
  { id: 'mutant_threat', title: 'Mutant threat', description: 'Fresh tracks, missing squads, animal panic.' },
  { id: 'anomaly_weirdness', title: 'Anomaly weirdness', description: 'Wrong physics, readings, and impossible signs.' },
];

export const STORY_ACCESS_RULE_OPTIONS: StoryWizardOption[] = [
  { id: 'none', title: 'No extra gate', description: 'Starter rules only.' },
  { id: 'player_faction', title: 'Player faction only', description: 'Requires player faction match.' },
  { id: 'not_player_faction', title: 'Block faction', description: 'Hides story from selected player faction.' },
  { id: 'rank_min', title: 'Rank minimum', description: 'Requires selected player rank or better.' },
  { id: 'goodwill_min', title: 'Goodwill minimum', description: 'Requires goodwill with story faction.' },
  { id: 'level', title: 'Current level', description: 'Only appears on selected map.' },
  { id: 'not_level', title: 'Not on level', description: 'Hidden while player is on selected map.' },
  { id: 'day', title: 'Daytime only', description: 'Requires day.' },
  { id: 'night', title: 'Night only', description: 'Requires night.' },
  { id: 'has_item', title: 'Has item', description: 'Requires item in player inventory.' },
  { id: 'lacks_item', title: 'Lacks item', description: 'Requires item to be absent.' },
];

export const STORY_RANK_OPTIONS: StoryWizardOption[] = RANKS.map((rank) => ({
  id: rank,
  title: rank,
  description: `Player rank ${rank} or better.`,
}));

export const STORY_LEVEL_OPTIONS: StoryWizardOption[] = Object.entries(LEVEL_DISPLAY_NAMES).map(([id, title]) => ({
  id,
  title,
  description: `Gate story on ${title}.`,
}));

export const STORY_CONSEQUENCE_OPTIONS: StoryWizardOption[] = [
  { id: 'none', title: 'No extra consequence', description: 'Recipe effects only.' },
  { id: 'goodwill_gain', title: 'Faction approves', description: 'Adds goodwill with story faction.' },
  { id: 'goodwill_loss', title: 'Faction angered', description: 'Removes goodwill with story faction.' },
  { id: 'rep_gain', title: 'Reputation gain', description: 'Player reputation increases.' },
  { id: 'rep_loss', title: 'Reputation loss', description: 'Player reputation decreases.' },
  { id: 'weather_shift', title: 'Weather hook', description: 'Gives a weather info flag for follow-up logic.' },
  { id: 'news_broadcast', title: 'News hook', description: 'Gives a news info flag for follow-up logic.' },
];

export const STORY_RECIPES: StoryRecipe[] = [
  { id: 'rumor', title: 'Rumor', description: 'Small flavor exchange with no gameplay effect.', group: 'Simple' },
  { id: 'faction_warning', title: 'Faction warning', description: 'Warning from faction contact, with optional goodwill.', group: 'Simple' },
  { id: 'marked_threat', title: 'Marked threat', description: 'Marks suspicious place without starting task.', group: 'Simple' },
  { id: 'ambush_warning', title: 'Ambush warning', description: 'Marks place, then spawns threat when player arrives.', group: 'Simple' },
  { id: 'artifact_lead', title: 'Artifact lead', description: 'Points author toward level-based artifact hunt.', group: 'Simple' },
  { id: 'supply_gift', title: 'Give supplies', description: 'NPC gives item, money, or both after reply.', group: 'Exchange' },
  { id: 'paid_info', title: 'Sell information', description: 'Requires money, takes payment, gives info portion.', group: 'Exchange' },
  { id: 'paid_stash_lead', title: 'Paid stash lead', description: 'Requires money, then gives stash or item-stash lead.', group: 'Exchange' },
  { id: 'job_offer', title: 'Job offer', description: 'NPC offers work and pays money when accepted.', group: 'Exchange' },
  { id: 'item_request', title: 'NPC asks for item', description: 'Checks inventory, then takes item on in-person handoff.', group: 'Exchange' },
  { id: 'go_to_location', title: 'Go to location', description: 'NPC marks destination for player.', group: 'Task' },
  { id: 'spawn_ambush', title: 'Spawn ambush', description: 'Player reaches marker, then enemies spawn there.', group: 'Task' },
  { id: 'fetch_task', title: 'Fetch item task', description: 'Starts tracked task: find item before timeout.', group: 'Task' },
  { id: 'delivery_task', title: 'Delivery task', description: 'Courier delivery to a marked smart terrain.', group: 'Task' },
  { id: 'dead_drop', title: 'Dead drop task', description: 'Starts tracked task: bring item to location.', group: 'Task' },
  { id: 'bounty_hunt', title: 'Bounty hunt', description: 'Starts tracked task: spawn and kill target.', group: 'Task' },
  { id: 'eliminate_squad', title: 'Eliminate squad', description: 'Spawns selected squad and tracks elimination.', group: 'Task' },
  { id: 'artifact_hunt', title: 'Artifact hunt', description: 'Creates level-based anomaly artifact hunt.', group: 'Task' },
  { id: 'escort_npc', title: 'Escort NPC', description: 'Conversation NPC joins player, destination and fail state included.', group: 'Task' },
  { id: 'rescue', title: 'Rescue survivor', description: 'Clear enemy squad near a pinned custom NPC.', group: 'Setpiece' },
  { id: 'betrayal', title: 'Betrayal setup', description: 'Deal goes wrong and creates ambush consequence.', group: 'Setpiece' },
  { id: 'custom_npc_encounter', title: 'Custom NPC encounter', description: 'Spawns custom NPC at selected smart terrain.', group: 'Setpiece' },
  { id: 'meet_in_person', title: 'Meet in person', description: 'PDA opener turns into face-to-face scene.', group: 'Handoff' },
  { id: 'multi_npc_handoff', title: 'Multi-NPC handoff', description: 'First NPC points player toward another named NPC.', group: 'Handoff' },
];

export const STORY_ITEM_OPTIONS: StoryWizardOption[] = [
  { id: 'medkit', title: 'Medkit', description: 'Common medical item.' },
  { id: 'bandage', title: 'Bandage', description: 'Small medical item.' },
  { id: 'vodka', title: 'Vodka', description: 'Common trade item.' },
  { id: 'device_pda_3', title: 'PDA', description: 'Good for info or dead-drop stories.' },
  { id: 'itm_repairkit_tier_1', title: 'Repair kit', description: 'Good for mechanic requests.' },
  { id: 'af_medusa', title: 'Artifact', description: 'Useful for artifact/fetch stories.' },
];

export const STORY_LOCATION_OPTIONS: StoryWizardOption[] = [
  { id: '%cordon_panda_st_key%', title: 'Cordon', description: 'Safe starter location placeholder.' },
  { id: 'st_gar_smart_terrain_3_5_name', title: 'Garbage depot', description: 'Bandit-friendly task location.' },
  { id: 'st_yan_smart_terrain_6_2_name', title: 'Yantar camp', description: 'Scientist or mutant task location.' },
  { id: 'st_mil_smart_terrain_7_7_name', title: 'Army Warehouses', description: 'Escort or faction patrol location.' },
  { id: 'st_zat_b42_smart_terrain_name', title: 'Zaton station', description: 'Northern task location.' },
];

export const STORY_REWARD_OPTIONS: StoryWizardOption[] = [
  { id: '0', title: 'No money', description: 'Conversation or task only.' },
  { id: '500', title: 'Small - 500 RU', description: 'Small favor payment.' },
  { id: '750', title: 'Fair - 750 RU', description: 'Default handoff payment.' },
  { id: '1500', title: 'Risky - 1500 RU', description: 'Moderate job payment.' },
  { id: '3000', title: 'High - 3000 RU', description: 'High-risk payout.' },
];

export const STORY_REWARD_ITEM_OPTIONS: StoryWizardOption[] = [
  { id: '', title: 'No item', description: 'Money or story effect only.' },
  { id: 'medkit', title: 'Medkit', description: 'Useful starter reward.' },
  { id: 'bandage', title: 'Bandage', description: 'Small survival reward.' },
  { id: 'ammo_9x19_fmj', title: '9x19 ammo', description: 'Small ammo reward.' },
  { id: 'bread', title: 'Bread', description: 'Flavor/survival reward.' },
];

export const STORY_ENEMY_OPTIONS: StoryWizardOption[] = [
  { id: 'snork', title: 'Snork', description: 'Fast mutant ambush.' },
  { id: 'dog', title: 'Dogs', description: 'Low-risk mutant pack.' },
  { id: 'boar', title: 'Boars', description: 'Open-ground mutant threat.' },
  { id: 'bandit', title: 'Bandits', description: 'Human bounty target.' },
  { id: 'zombied', title: 'Zombified', description: 'Slow human target.' },
];

export const STORY_TIMEOUT_OPTIONS: StoryWizardOption[] = [
  { id: '300', title: '5 minutes', description: 'Short urgency.' },
  { id: '600', title: '10 minutes', description: 'Default task timer.' },
  { id: '900', title: '15 minutes', description: 'Long task timer.' },
  { id: '1800', title: '30 minutes', description: 'Slow travel.' },
];

export const STORY_HANDOFF_NPC_OPTIONS: StoryWizardOption[] = [
  { id: 'yan_stalker_sakharov', title: 'Sakharov', description: 'Scientist contact.' },
  { id: 'bar_visitors_barman_stalker_trader', title: 'Barkeep', description: 'Rostok contact.' },
  { id: 'esc_2_12_stalker_wolf', title: 'Wolf', description: 'Cordon contact.' },
  { id: 'zat_a2_stalker_barmen', title: 'Zaton barman', description: 'Northern contact.' },
];

export const DEFAULT_STORY_DETAILS: StoryDetailOptions = {
  itemId: 'medkit',
  itemCount: '1',
  rewardMoney: '750',
  rewardItemId: '',
  locationId: '%cordon_panda_st_key%',
  enemyId: 'jup_b209_squad_snork_1',
  handoffNpcId: 'yan_stalker_sakharov',
  targetFaction: 'bandit',
  targetRank: '',
  timeoutSeconds: '600',
  infoId: 'panda_story_info',
};

export const DEFAULT_STORY_DRAFT: StoryWizardDraft = {
  faction: 'stalker',
  title: '',
  premise: '',
  tone: 'gritty',
  stakes: 'Keep this quiet until you know who benefits.',
  startPattern: 'pda',
  speakerTarget: 'any_friendly',
  structureId: 'branching',
  branchStyle: 'ask_more',
  recipeId: 'fetch_task',
  storyNpcId: 'bar_visitors_barman_stalker_trader',
  handoffNpcId: 'yan_stalker_sakharov',
  customNpcTemplateId: 'informant',
  customNpcName: 'Informant',
  customNpcSmartTerrain: '%cordon_panda_st_key%',
  itemId: 'medkit',
  itemCount: '1',
  rewardMoney: '750',
  rewardItemId: '',
  stashItems: '',
  locationId: '%cordon_panda_st_key%',
  secondaryLocationId: 'st_gar_smart_terrain_3_5_name',
  enemySquadId: 'jup_b209_squad_snork_1',
  targetFaction: 'bandit',
  targetRank: '',
  timeoutSeconds: '600',
  priceMoney: '750',
  infoId: 'panda_story_info',
  goodwillAmount: '25',
  reputationAmount: '15',
  consequenceId: 'goodwill_gain',
  weatherId: 'w_storm1',
  accessRuleId: 'none',
  accessFaction: 'stalker',
  accessRank: 'experienced',
  accessGoodwill: '0',
  accessLevel: 'cordon',
  accessItemId: 'medkit',
};

export function createDefaultStoryDraft(project?: Project): StoryWizardDraft {
  return {
    ...DEFAULT_STORY_DRAFT,
    faction: project?.faction ?? DEFAULT_STORY_DRAFT.faction,
  };
}

export function buildStoryRecipe(project: Project, options: StoryRecipeBuildOptions): StoryRecipeBuildResult {
  const details = normalizeDetails(options.details);
  const draft = createDefaultStoryDraft(project);
  const result = buildStoryFromDraft(project, {
    ...draft,
    recipeId: options.recipeId,
    startPattern: options.startPattern,
    speakerTarget: options.speakerTarget,
    structureId: isDraftTaskRecipe(options.recipeId) ? 'task' : draft.structureId,
    itemId: details.itemId,
    itemCount: details.itemCount,
    rewardMoney: details.rewardMoney,
    priceMoney: options.recipeId === 'paid_info' ? details.rewardMoney : draft.priceMoney,
    rewardItemId: details.rewardItemId,
    locationId: details.locationId,
    enemySquadId: details.enemyId,
    handoffNpcId: details.handoffNpcId,
    targetFaction: details.targetFaction,
    targetRank: details.targetRank,
    timeoutSeconds: details.timeoutSeconds,
    infoId: details.infoId,
  });
  return { conversation: result.conversation, npcTemplates: result.npcTemplates };
}

export function buildStoryFromDraft(project: Project, input: StoryWizardDraft): StoryGenerationResult {
  const draft = normalizeStoryDraft(project, input);
  const startPattern = normalizeStartPatternForDraft(draft);
  const conversation = createConversation(project);
  conversation.label = draft.title || recipeTitle(draft.recipeId);
  conversation.faction = draft.faction;
  conversation.preconditions = createDraftTargetRules(draft);
  addDraftStartRules(conversation, draft);
  conversation.startMode = startPattern === 'f2f' || startPattern === 'f2f_to_pda' ? 'f2f' : 'pda';
  conversation.initialChannel = conversation.startMode;
  conversation.turns = createStartTurns(startPattern);

  applyDraftContent(conversation, draft);

  const npcTemplates = draft.speakerTarget === 'custom_npc' || draft.recipeId === 'rescue' || draft.recipeId === 'custom_npc_encounter'
    ? [createDraftNpcTemplate(draft)]
    : undefined;

  return {
    conversation,
    npcTemplates,
    beats: conversation.turns.map((turn) => ({
      turnNumber: turn.turnNumber,
      title: turn.customLabel ?? `Beat ${turn.turnNumber}`,
      channel: turn.channel ?? 'pda',
      choices: turn.choices.map((choice) => choice.text),
    })),
  };
}

function normalizeStoryDraft(project: Project, input: StoryWizardDraft): StoryWizardDraft {
  const base = createDefaultStoryDraft(project);
  const merged = { ...base, ...input };
  return {
    ...merged,
    title: merged.title.trim(),
    premise: merged.premise.trim(),
    stakes: merged.stakes.trim(),
    itemCount: positiveString(merged.itemCount, '1'),
    rewardMoney: nonNegativeString(merged.rewardMoney, '0'),
    priceMoney: nonNegativeString(merged.priceMoney, '0'),
    goodwillAmount: nonNegativeString(merged.goodwillAmount, '25'),
    reputationAmount: nonNegativeString(merged.reputationAmount, '15'),
    accessGoodwill: nonNegativeString(merged.accessGoodwill, '0'),
    timeoutSeconds: Math.max(30, parseInt(merged.timeoutSeconds, 10) || 600).toString(),
    customNpcTemplateId: slugifyDraftId(merged.customNpcTemplateId || merged.customNpcName || 'informant'),
    customNpcName: merged.customNpcName.trim() || 'Informant',
    accessRank: merged.accessRank.trim() || 'experienced',
    accessLevel: merged.accessLevel.trim() || 'cordon',
    accessItemId: merged.accessItemId.trim() || 'medkit',
  };
}

function positiveString(value: string, fallback: string): string {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : fallback;
}

function nonNegativeString(value: string, fallback: string): string {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : fallback;
}

function slugifyDraftId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'informant';
}

function normalizeStartPatternForDraft(draft: StoryWizardDraft): StoryStartPattern {
  if (draft.structureId === 'two_step' && draft.startPattern === 'pda') return 'pda_to_f2f';
  if (draft.recipeId === 'meet_in_person') return 'pda_to_f2f';
  if ((draft.recipeId === 'item_request' || draft.recipeId === 'escort_npc') && draft.startPattern === 'pda') return 'pda_to_f2f';
  return draft.startPattern;
}

function createDraftTargetRules(draft: StoryWizardDraft): PreconditionEntry[] {
  switch (draft.speakerTarget) {
    case 'friendly_faction':
      return [
        simpleRule('req_npc_friendly', draft.faction),
        simpleRule('req_npc_faction', draft.faction),
      ];
    case 'named_npc':
      return [simpleRule('req_story_npc', draft.storyNpcId || 'bar_visitors_barman_stalker_trader')];
    case 'custom_npc':
      return [simpleRule('req_custom_story_npc', draft.customNpcTemplateId, draft.customNpcSmartTerrain)];
    case 'any_friendly':
    default:
      return [simpleRule('req_npc_friendly')];
  }
}

function addDraftStartRules(conversation: Conversation, draft: StoryWizardDraft): void {
  if (draft.recipeId === 'item_request') conversation.preconditions.push(simpleRule('req_has_item', draft.itemId));
  if (draft.recipeId === 'paid_info' || draft.recipeId === 'paid_stash_lead') conversation.preconditions.push(simpleRule('req_money', draft.priceMoney));
  switch (draft.accessRuleId) {
    case 'player_faction':
      conversation.preconditions.push(simpleRule('req_faction', draft.accessFaction));
      break;
    case 'not_player_faction':
      conversation.preconditions.push(simpleRule('req_not_faction', draft.accessFaction));
      break;
    case 'rank_min':
      conversation.preconditions.push(simpleRule('req_rank', draft.accessRank));
      break;
    case 'goodwill_min':
      conversation.preconditions.push(simpleRule('req_goodwill', draft.accessGoodwill, draft.faction));
      break;
    case 'level':
      conversation.preconditions.push(simpleRule('req_level', draft.accessLevel));
      break;
    case 'not_level':
      conversation.preconditions.push(simpleRule('req_not_level', draft.accessLevel));
      break;
    case 'day':
      conversation.preconditions.push(simpleRule('req_time_day'));
      break;
    case 'night':
      conversation.preconditions.push(simpleRule('req_time_night'));
      break;
    case 'has_item':
      conversation.preconditions.push(simpleRule('req_has_item', draft.accessItemId));
      break;
    case 'lacks_item':
      conversation.preconditions.push(simpleRule('req_not_has_item', draft.accessItemId));
      break;
    case 'none':
    default:
      break;
  }
}

function applyDraftContent(conversation: Conversation, draft: StoryWizardDraft): void {
  const actionTurn = pickDraftActionTurn(conversation, draft);
  configureDraftTransition(conversation, actionTurn, draft);
  actionTurn.customLabel = recipeTitle(draft.recipeId);
  actionTurn.openingMessage = draftOpeningFor(draft);
  actionTurn.choices = [];

  let successTurn: Turn | undefined;
  let failTurn: Turn | undefined;
  if (isDraftTaskRecipe(draft.recipeId)) {
    successTurn = appendTerminalTurn(conversation, actionTurn.channel ?? 'pda', 'Task complete. Payment is ready.', 'Done.');
    successTurn.customLabel = 'Success';
    failTurn = appendTerminalTurn(conversation, actionTurn.channel ?? 'pda', 'Time ran out. Job is off.', 'Understood.');
    failTurn.customLabel = 'Failure';
  }

  const getOutcomes = (): Outcome[] => draftActionOutcomesFor(draft, successTurn, failTurn);

  const accept = ensureChoice(actionTurn, 1);
  accept.text = draftAcceptTextFor(draft);
  accept.reply = draftAcceptReplyFor(draft);
  accept.preconditions = draftActionPreconditionsFor(draft);
  accept.outcomes = getOutcomes();
  accept.terminal = true;
  if (draft.recipeId === 'multi_npc_handoff' && draft.handoffNpcId) {
    // The accept choice hands the player off to a second NPC. Attribute the
    // NPC on the reply and flow into a dedicated handoff turn so the second
    // speaker actually takes the floor rather than leaving the conversation
    // dangling at the original NPC.
    const handoff = appendTerminalTurn(
      conversation,
      actionTurn.channel ?? 'pda',
      `${npcLabel(draft.handoffNpcId)}: I take it from here. ${draft.stakes || 'Stay sharp.'}`,
      'Understood.',
    );
    handoff.customLabel = `Handoff: ${npcLabel(draft.handoffNpcId)}`;
    accept.cont_npc_id = draft.handoffNpcId;
    accept.terminal = false;
    accept.continueTo = handoff.turnNumber;
    accept.continueChannel = handoff.channel;
    accept.continue_channel = handoff.channel;
  }

  const details = appendDraftDetailTurn(conversation, draft, actionTurn.channel ?? 'pda', getOutcomes);
  const ask = ensureChoice(actionTurn, 2);
  ask.text = 'Tell me what this really is.';
  ask.reply = 'Fine. Details first, decision after.';
  ask.outcomes = [];
  ask.preconditions = [];
  ask.terminal = false;
  ask.continueTo = details.turnNumber;
  ask.continueChannel = details.channel;
  ask.continue_channel = details.channel;

  const refuse = ensureChoice(actionTurn, 3);
  refuse.text = 'Find someone else.';
  refuse.reply = draftRefusalReplyFor(draft);
  refuse.outcomes = draftRefusalOutcomesFor(draft);
  refuse.preconditions = [];
  refuse.terminal = true;

  if (draft.branchStyle === 'negotiation') {
    const negotiate = ensureChoice(actionTurn, 4);
    negotiate.text = 'Pay better and I listen.';
    negotiate.reply = 'You drive hard bargain. Extra pay if you finish.';
    // Require the NPC's faction to already like the player a little — a stranger
    // wouldn't get room to haggle. req_goodwill '0' was effectively no-op.
    negotiate.preconditions = [simpleRule('req_goodwill', '25', draft.faction)];
    negotiate.outcomes = [...getOutcomes(), ...draftMoneyReward(draft.rewardMoney)];
    negotiate.terminal = true;
  }

  if (draft.branchStyle === 'betrayal') {
    const suspicious = ensureChoice(actionTurn, 4);
    suspicious.text = 'This smells like a trap.';
    suspicious.reply = 'Then walk into it with eyes open.';
    suspicious.preconditions = [];
    suspicious.outcomes = draftBetrayalOutcomesFor(draft);
    suspicious.terminal = true;
  }

  appendDraftBranchStyleChoice(conversation, actionTurn, draft, getOutcomes);

  if (!isDraftTaskRecipe(draft.recipeId) && draft.structureId === 'three_act') {
    const aftermath = appendTerminalTurn(conversation, actionTurn.channel ?? 'pda', 'If this goes right, people will talk.', 'I will remember that.');
    aftermath.customLabel = 'Aftermath';
    // Route every choice that stays in this conversation (anything not already
    // re-targeted to a handoff turn) to the aftermath turn. Previously only
    // choices with non-empty outcomes were redirected, which broke the
    // three-act flow for refusals — they'd end the conversation instead of
    // closing out through the aftermath beat.
    for (const choice of actionTurn.choices) {
      if (choice.continueTo && choice.continueTo !== aftermath.turnNumber) continue;
      choice.terminal = false;
      choice.continueTo = aftermath.turnNumber;
      choice.continueChannel = aftermath.channel;
      choice.continue_channel = aftermath.channel;
    }
  }
}

function pickDraftActionTurn(conversation: Conversation, draft: StoryWizardDraft): Turn {
  if (draft.recipeId === 'item_request' || draft.recipeId === 'escort_npc' || draft.recipeId === 'meet_in_person') {
    return conversation.turns.find((turn) => turn.channel === 'f2f') ?? conversation.turns[conversation.turns.length - 1]!;
  }
  return conversation.turns[conversation.turns.length - 1]!;
}

function configureDraftTransition(conversation: Conversation, actionTurn: Turn, draft: StoryWizardDraft): void {
  const firstTurn = conversation.turns[0];
  if (!firstTurn || firstTurn === actionTurn) return;
  firstTurn.customLabel = 'Hook';
  firstTurn.openingMessage = draftTransitionOpeningFor(draft);
  const firstChoice = ensureChoice(firstTurn, 1);
  firstChoice.text = draftTransitionChoiceTextFor(draft);
  firstChoice.reply = draftTransitionReplyFor(draft);
  firstChoice.outcomes = [];
  firstChoice.preconditions = [];
  firstChoice.terminal = false;
  firstChoice.continueTo = actionTurn.turnNumber;
  firstChoice.continueChannel = actionTurn.channel;
  firstChoice.continue_channel = actionTurn.channel;

  // Two-step handoff structure: the first speaker routes the player to a
  // different NPC for the second step. The wizard exposes a "Handoff NPC"
  // picker in this case; wire it into the transition so the action turn is
  // attributed to the chosen NPC at runtime.
  if (draft.structureId === 'two_step' && draft.handoffNpcId) {
    firstChoice.cont_npc_id = draft.handoffNpcId;
    actionTurn.customLabel = `Handoff: ${npcLabel(draft.handoffNpcId)}`;
  }
}

function appendDraftDetailTurn(
  conversation: Conversation,
  draft: StoryWizardDraft,
  channel: 'pda' | 'f2f',
  getOutcomes: () => Outcome[],
): Turn {
  const turn = appendTerminalTurn(conversation, channel, draftDetailOpeningFor(draft), draftAcceptReplyFor(draft));
  turn.customLabel = 'Details';
  const accept = ensureChoice(turn, 1);
  accept.text = draftAcceptTextFor(draft);
  accept.reply = draftAcceptReplyFor(draft);
  accept.preconditions = draftActionPreconditionsFor(draft);
  accept.outcomes = getOutcomes();
  accept.terminal = true;

  const refuse = ensureChoice(turn, 2);
  refuse.text = 'No. Too many unknowns.';
  refuse.reply = draftRefusalReplyFor(draft);
  refuse.preconditions = [];
  refuse.outcomes = draftRefusalOutcomesFor(draft);
  refuse.terminal = true;
  return turn;
}

function isDraftTaskRecipe(recipeId: StoryRecipeId): boolean {
  return recipeId === 'fetch_task'
    || recipeId === 'delivery_task'
    || recipeId === 'dead_drop'
    || recipeId === 'bounty_hunt'
    || recipeId === 'eliminate_squad'
    || recipeId === 'artifact_hunt'
    || recipeId === 'escort_npc'
    || recipeId === 'rescue';
}

function appendDraftBranchStyleChoice(
  conversation: Conversation,
  actionTurn: Turn,
  draft: StoryWizardDraft,
  getOutcomes: () => Outcome[],
): void {
  if (draft.branchStyle === 'simple' || draft.branchStyle === 'negotiation' || draft.branchStyle === 'betrayal') return;

  if (draft.branchStyle === 'ask_more') {
    // Ask-more adds a dedicated "press for extra context" beat before the
    // accept/refuse — a non-terminal continuation to a small clarifier turn
    // that re-offers accept/refuse with the same outcomes.
    const clarifier = appendTerminalTurn(
      conversation,
      actionTurn.channel ?? 'pda',
      'Keep it simple: who, what, where, why. Then decide.',
      'Good — now I will say yes without flinching.',
    );
    clarifier.customLabel = 'Ask more';
    const more = ensureChoice(actionTurn, 4);
    more.text = 'Slower. Break it down for me.';
    more.reply = 'Right. From the top:';
    more.outcomes = [];
    more.preconditions = [];
    more.terminal = false;
    more.continueTo = clarifier.turnNumber;
    more.continueChannel = clarifier.channel;
    more.continue_channel = clarifier.channel;
    // Replace the auto-generated "Continue." choice on the clarifier with an
    // explicit accept / refuse pair so the extra turn actually exposes the
    // decision again (instead of dead-ending after the explanation).
    clarifier.choices = [];
    const clarifyAccept = ensureChoice(clarifier, 1);
    clarifyAccept.text = 'Clear enough. I am in.';
    clarifyAccept.reply = 'Then move.';
    clarifyAccept.preconditions = draftActionPreconditionsFor(draft);
    clarifyAccept.outcomes = getOutcomes();
    clarifyAccept.terminal = true;
    const clarifyDrop = ensureChoice(clarifier, 2);
    clarifyDrop.text = 'Still not my fight.';
    clarifyDrop.reply = draftRefusalReplyFor(draft);
    clarifyDrop.preconditions = [];
    clarifyDrop.outcomes = draftRefusalOutcomesFor(draft);
    clarifyDrop.terminal = true;
    return;
  }

  const choice = ensureChoice(actionTurn, 4);
  choice.preconditions = [];
  choice.terminal = true;

  switch (draft.branchStyle) {
    case 'intimidate':
      choice.text = 'Talk straight or I walk.';
      choice.reply = 'Fine. No riddles. You get facts.';
      choice.preconditions = [simpleRule('req_rep', '0')];
      choice.outcomes = getOutcomes();
      break;
    case 'bribe':
      choice.text = `I can pay ${draft.priceMoney} RU for cleaner details.`;
      choice.reply = 'Now you are speaking my language.';
      choice.preconditions = [simpleRule('req_money', draft.priceMoney)];
      choice.outcomes = [outcome('punish_money', draft.priceMoney), ...getOutcomes()];
      break;
    case 'lie':
      choice.text = 'I know more than you think.';
      choice.reply = 'Then you know this conversation never happened.';
      choice.outcomes = [outcome('give_info', `${draft.infoId}_lied`), ...getOutcomes()];
      break;
    case 'mercy':
      choice.text = 'Nobody else dies for this.';
      choice.reply = 'Mercy costs more than bullets. Prove it.';
      choice.outcomes = [outcome('reward_gw', '10', draft.faction), ...getOutcomes()];
      break;
    case 'double_cross':
      choice.text = 'I take payment, then I choose side.';
      choice.reply = 'Wrong answer. Now everyone chooses for you.';
      choice.outcomes = draftBetrayalOutcomesFor(draft);
      break;
    default:
      choice.text = 'I choose another way.';
      choice.reply = 'Then own it.';
      choice.outcomes = getOutcomes();
      break;
  }
}

function draftActionOutcomesFor(draft: StoryWizardDraft, successTurn?: Turn, failTurn?: Turn): Outcome[] {
  const success = String(successTurn?.turnNumber ?? '');
  const fail = String(failTurn?.turnNumber ?? '');
  const base = draftBaseOutcomesFor(draft, success, fail);
  return [...base, ...draftConsequenceOutcomesFor(draft)];
}

function draftBaseOutcomesFor(draft: StoryWizardDraft, successTurn: string, failTurn: string): Outcome[] {
  switch (draft.recipeId) {
    case 'job_offer':
      return draftMoneyReward(draft.rewardMoney);
    case 'faction_warning':
      return [outcome('reward_gw', draft.goodwillAmount, draft.faction)];
    case 'marked_threat':
      return [outcome('watch_location', draft.locationId, '85')];
    case 'ambush_warning':
      return [outcome('watch_location_trigger', draft.locationId, `spawn_mutant_at_smart:${draft.enemySquadId}:${draft.locationId}:0`, '85')];
    case 'artifact_lead':
      return [outcome('give_info', `${draft.infoId}_artifact_lead`)];
    case 'item_request':
      return [outcome('take_item', draft.itemId), ...draftMoneyReward(draft.rewardMoney)];
    case 'go_to_location':
      return [outcome('watch_location', draft.locationId, '85')];
    case 'spawn_ambush':
      return [outcome('watch_location_trigger', draft.locationId, `spawn_mutant_at_smart:${draft.enemySquadId}:${draft.locationId}:0`, '85')];
    case 'supply_gift':
      return [...draftMoneyReward(draft.rewardMoney), ...draftItemReward(draft.rewardItemId), ...draftStashReward(draft.stashItems)];
    case 'paid_info':
      return [outcome('punish_money', draft.priceMoney), outcome('give_info', draft.infoId)];
    case 'paid_stash_lead':
      return [
        outcome('punish_money', draft.priceMoney),
        ...(draft.stashItems.trim() ? draftStashReward(draft.stashItems) : [outcome('reward_stash')]),
      ];
    case 'fetch_task':
      return [outcome('panda_task_fetch', draft.itemId, draft.itemCount, draft.timeoutSeconds, successTurn, failTurn)];
    case 'delivery_task':
      return [outcome('panda_task_delivery', draft.itemId, draft.locationId, draft.timeoutSeconds, successTurn, failTurn)];
    case 'dead_drop':
      return [outcome('panda_task_dead_drop', draft.itemId, draft.locationId, draft.timeoutSeconds, successTurn, failTurn)];
    case 'bounty_hunt':
      return [outcome('panda_task_bounty', draft.targetFaction, draft.targetRank, draft.locationId, draft.timeoutSeconds, successTurn, failTurn)];
    case 'eliminate_squad':
      return [outcome('panda_task_eliminate', draft.enemySquadId, draft.locationId, '100', draft.timeoutSeconds, successTurn, failTurn)];
    case 'artifact_hunt':
      return [outcome('panda_task_artifact', draft.itemId || 'random', 'random_level', draftArtifactLevelToken(draft.locationId), 'basic', draft.timeoutSeconds, successTurn, failTurn)];
    case 'escort_npc':
      return [outcome('panda_task_escort', draft.locationId, draft.timeoutSeconds, successTurn, failTurn)];
    case 'rescue':
      return [
        outcome('spawn_custom_npc_at', draft.customNpcTemplateId, draft.locationId, '0'),
        outcome('panda_task_eliminate', draft.enemySquadId, draft.locationId, '100', draft.timeoutSeconds, successTurn, failTurn),
      ];
    case 'betrayal':
      return draftBetrayalOutcomesFor(draft);
    case 'custom_npc_encounter':
      return [outcome('spawn_custom_npc_at', draft.customNpcTemplateId, draft.locationId, '0')];
    case 'meet_in_person':
      // In-person meet keeps no gameplay reward but records a flag so authors
      // can gate follow-ups on "player met this NPC".
      return [outcome('give_info', `${draft.infoId}_met_in_person`)];
    case 'multi_npc_handoff':
      // Flag the handoff so the second NPC's follow-up can key off it, plus the
      // cont_npc_id on the accept choice routes the conversation to them.
      return [outcome('give_info', `${draft.infoId}_handoff_${draft.handoffNpcId || 'npc'}`)];
    case 'rumor':
      // Flavor exchange: no reward, just a flag so later stories can react.
      return [outcome('give_info', `${draft.infoId}_rumor`)];
    default:
      return [];
  }
}

function draftActionPreconditionsFor(draft: StoryWizardDraft): PreconditionEntry[] {
  if (draft.recipeId === 'item_request') return [simpleRule('req_has_item', draft.itemId)];
  if (draft.recipeId === 'paid_info' || draft.recipeId === 'paid_stash_lead') return [simpleRule('req_money', draft.priceMoney)];
  return [];
}

function draftMoneyReward(amount: string): Outcome[] {
  return amount === '0' || amount.trim() === '' ? [] : [outcome('reward_money', amount)];
}

function draftItemReward(itemId: string): Outcome[] {
  return itemId.trim() === '' ? [] : [outcome('give_item', itemId)];
}

function draftStashReward(items: string): Outcome[] {
  return items.trim() === '' ? [] : [outcome('reward_stash_items', items.trim())];
}

function draftConsequenceOutcomesFor(draft: StoryWizardDraft): Outcome[] {
  switch (draft.consequenceId) {
    case 'goodwill_gain':
      return [outcome('reward_gw', draft.goodwillAmount, draft.faction)];
    case 'goodwill_loss':
      return [outcome('punish_gw', draft.goodwillAmount, draft.faction)];
    case 'rep_gain':
      return [outcome('reward_rep', draft.reputationAmount)];
    case 'rep_loss':
      return [outcome('punish_rep', draft.reputationAmount)];
    case 'weather_shift':
      return [outcome('give_info', `${draft.infoId}_weather`)];
    case 'news_broadcast':
      return [outcome('give_info', `${draft.infoId}_news`)];
    case 'none':
    default:
      return [];
  }
}

function draftRefusalOutcomesFor(draft: StoryWizardDraft): Outcome[] {
  return draft.branchStyle === 'betrayal'
    ? [outcome('punish_gw', '10', draft.faction)]
    : [];
}

function draftBetrayalOutcomesFor(draft: StoryWizardDraft): Outcome[] {
  return [
    outcome('watch_location_trigger', draft.locationId, `spawn_mutant_at_smart:${draft.enemySquadId}:${draft.locationId}:0`, '85'),
    outcome('punish_gw', draft.goodwillAmount, draft.faction),
  ];
}

function draftArtifactLevelToken(locationId: string): string {
  const match = /^%([a-z_]+)_panda_st_key%$/.exec(locationId);
  if (match?.[1]) return `level:${draftLevelToken(match[1])}`;
  if (locationId.includes('gar_')) return 'level:gar';
  if (locationId.includes('yan_')) return 'level:yan';
  if (locationId.includes('zat_')) return 'level:zat';
  if (locationId.includes('mil_')) return 'level:mil';
  if (locationId.includes('val_')) return 'level:val';
  return 'level:esc';
}

function draftLevelToken(level: string): string {
  const map: Record<string, string> = {
    cordon: 'esc',
    garbage: 'gar',
    agroprom: 'agr',
    dark_valley: 'val',
    yantar: 'yan',
    rostok: 'bar',
    swamp: 'mar',
    jupiter: 'jup',
    zaton: 'zat',
    pripyat: 'pri',
  };
  return map[level] ?? level.slice(0, 3);
}

function draftTransitionOpeningFor(draft: StoryWizardDraft): string {
  if (draft.recipeId === 'item_request') return `I need ${itemLabel(draft.itemId)}. Bring it in person and I pay.`;
  if (draft.recipeId === 'escort_npc') return 'I need feet on the ground for this. Meet me and we move.';
  if (draft.recipeId === 'meet_in_person') return 'Not over PDA. Meet me and we talk properly.';
  if (draft.recipeId === 'multi_npc_handoff') return 'I am not right contact. I can put you through.';
  if (draft.recipeId === 'custom_npc_encounter') return `Someone waits near ${locationLabel(draft.locationId)}. Go in person.`;
  return `Meet me, then we talk about ${locationLabel(draft.locationId)}.`;
}

function draftTransitionChoiceTextFor(draft: StoryWizardDraft): string {
  if (draft.recipeId === 'item_request') return 'I can bring it.';
  if (draft.recipeId === 'meet_in_person') return 'Where do we meet?';
  if (draft.recipeId === 'multi_npc_handoff') return 'Put them through.';
  return 'Send meeting point.';
}

function draftTransitionReplyFor(draft: StoryWizardDraft): string {
  if (draft.recipeId === 'item_request') return 'Come by and we settle up.';
  if (draft.recipeId === 'meet_in_person') return 'Old bridge. Come alone.';
  if (draft.recipeId === 'multi_npc_handoff') return 'Stand by.';
  return 'We continue there.';
}

function draftOpeningFor(draft: StoryWizardDraft): string {
  const premise = draft.premise || draftFallbackPremise(draft);
  const factionName = FACTION_DISPLAY_NAMES[draft.faction];
  switch (draft.recipeId) {
    case 'job_offer':
      return `${premise} ${factionName} pays ${draft.rewardMoney} RU if you take it.`;
    case 'faction_warning':
      return `${factionName} patrols saw movement near ${locationLabel(draft.locationId)}. ${draft.stakes}`;
    case 'marked_threat':
      return `${premise} I marked ${locationLabel(draft.locationId)}. Go look, but do not announce yourself.`;
    case 'ambush_warning':
      return `${premise} Road near ${locationLabel(draft.locationId)} has bait written all over it.`;
    case 'artifact_lead':
      return `${premise} Artifact sign points toward ${locationLabel(draft.locationId)}.`;
    case 'item_request':
      return `You carrying ${itemLabel(draft.itemId)}? ${premise}`;
    case 'go_to_location':
      return `${premise} I marked ${locationLabel(draft.locationId)}.`;
    case 'spawn_ambush':
      return `${premise} Road near ${locationLabel(draft.locationId)} is wrong.`;
    case 'supply_gift':
      return `${premise} Take supplies and stay alive.`;
    case 'paid_info':
      return `${premise} Information costs ${draft.priceMoney} RU.`;
    case 'paid_stash_lead':
      return `${premise} Stash coordinates cost ${draft.priceMoney} RU.`;
    case 'fetch_task':
      return `${premise} Find ${draft.itemCount} ${itemLabel(draft.itemId)} before time runs out.`;
    case 'delivery_task':
      return `${premise} Bring ${itemLabel(draft.itemId)} to ${locationLabel(draft.locationId)}.`;
    case 'dead_drop':
      return `${premise} Leave ${itemLabel(draft.itemId)} at ${locationLabel(draft.locationId)}.`;
    case 'bounty_hunt':
      return `${premise} Target faction is ${FACTION_DISPLAY_NAMES[draft.targetFaction]}. Location: ${locationLabel(draft.locationId)}.`;
    case 'eliminate_squad':
      return `${premise} Eliminate squad at ${locationLabel(draft.locationId)}.`;
    case 'artifact_hunt':
      return `${premise} Anomaly field should have artifact signature.`;
    case 'escort_npc':
      return `${premise} Escort me to ${locationLabel(draft.locationId)}.`;
    case 'meet_in_person':
      return 'You came. Good. Keep voice low.';
    case 'multi_npc_handoff':
      return `This is ${npcLabel(draft.handoffNpcId)}. I hear you need work.`;
    case 'custom_npc_encounter':
      return `${premise} ${draft.customNpcName} waits near ${locationLabel(draft.locationId)}.`;
    case 'rumor':
      return `${premise} Just talk, no contract. Keep ears open.`;
    default:
      return premise;
  }
}

function draftDetailOpeningFor(draft: StoryWizardDraft): string {
  const factionName = FACTION_DISPLAY_NAMES[draft.faction];
  return `${factionName} angle: ${draft.stakes || 'someone benefits if player walks away blind.'} Setup already added: targets, branches, and effects.`;
}

function draftFallbackPremise(draft: StoryWizardDraft): string {
  switch (draft.tone) {
    case 'mystery':
      return 'Strange signal came through last night and someone wants it buried.';
    case 'military':
      return 'Patrol route went dark and command wants quiet response.';
    case 'scientific':
      return 'Field readings changed where no anomaly should exist.';
    case 'black_market':
      return 'Someone is selling truth before wrong buyer arrives.';
    case 'horror':
      return 'Nobody screams from that place anymore, and that is worse.';
    case 'political':
      return 'Two factions want same secret, and neither wants witness.';
    case 'personal_debt':
      return 'Old debt came due, and wrong person remembered your name.';
    case 'treasure_hunt':
      return 'Stash lead surfaced with enough truth to be dangerous.';
    case 'mutant_threat':
      return 'Fresh tracks circle camp, but no beast walks like that.';
    case 'anomaly_weirdness':
      return 'Bolts fall upward there and radios whisper back.';
    case 'gritty':
    default:
      return 'Zone handed us problem. You look alive enough to solve it.';
  }
}

function draftAcceptTextFor(draft: StoryWizardDraft): string {
  if (isDraftTaskRecipe(draft.recipeId)) return 'I will take the job.';
  if (draft.recipeId === 'paid_info') return 'Pay for information.';
  if (draft.recipeId === 'paid_stash_lead') return 'Buy stash lead.';
  if (draft.recipeId === 'item_request') return `Hand over ${itemLabel(draft.itemId)}.`;
  if (draft.recipeId === 'go_to_location' || draft.recipeId === 'spawn_ambush' || draft.recipeId === 'marked_threat' || draft.recipeId === 'ambush_warning') return 'Send marker.';
  if (draft.recipeId === 'custom_npc_encounter') return 'Send them out.';
  return 'I am in.';
}

function draftAcceptReplyFor(draft: StoryWizardDraft): string {
  if (isDraftTaskRecipe(draft.recipeId)) return 'Job started. Do not waste time.';
  if (draft.recipeId === 'paid_info') return 'Payment received. Info sent.';
  if (draft.recipeId === 'paid_stash_lead') return 'Payment received. Coordinates attached.';
  if (draft.recipeId === 'item_request') return 'Good. Payment is yours.';
  if (draft.recipeId === 'supply_gift') return 'Take it and stay alive.';
  if (draft.recipeId === 'custom_npc_encounter') return 'They are moving now.';
  return 'Then listen carefully.';
}

function draftRefusalReplyFor(draft: StoryWizardDraft): string {
  return draft.branchStyle === 'betrayal'
    ? 'Bad choice. People remember cowardice.'
    : 'Your funeral, your schedule.';
}

function recipeTitle(recipeId: StoryRecipeId): string {
  return STORY_RECIPES.find((recipe) => recipe.id === recipeId)?.title ?? 'New Story';
}

function npcLabel(npcId: string): string {
  return STORY_HANDOFF_NPC_OPTIONS.find((npc) => npc.id === npcId)?.title ?? npcId;
}

function createDraftNpcTemplate(draft: StoryWizardDraft): NpcTemplate {
  return {
    id: draft.customNpcTemplateId,
    name: draft.customNpcName,
    faction: draft.faction,
    rank: 'experienced',
    relation: 'neutral',
    primary: 'wpn_ak74',
    outfit: 'stalker_outfit',
    items: 'medkit:1,bandage:2',
    spawnDist: 8,
    count: 1,
    allowRoam: false,
  };
}

function normalizeDetails(input: Partial<StoryDetailOptions> | undefined): StoryDetailOptions {
  return {
    ...DEFAULT_STORY_DETAILS,
    ...(input ?? {}),
  };
}

function normalizeStartPatternForRecipe(recipeId: StoryRecipeId, startPattern: StoryStartPattern): StoryStartPattern {
  if ((recipeId === 'item_request' || recipeId === 'escort_npc') && startPattern === 'pda') return 'pda_to_f2f';
  if (recipeId === 'meet_in_person' && startPattern !== 'pda_to_f2f') return 'pda_to_f2f';
  return startPattern;
}

function createTargetRules(target: StorySpeakerTarget, faction: FactionId): PreconditionEntry[] {
  switch (target) {
    case 'friendly_faction':
      return [
        simpleRule('req_npc_friendly', faction),
        simpleRule('req_npc_faction', faction),
      ];
    case 'named_npc':
      return [simpleRule('req_story_npc', 'bar_visitors_barman_stalker_trader')];
    case 'custom_npc':
      return [simpleRule('req_custom_story_npc', 'informant', '%cordon_panda_st_key%')];
    case 'any_friendly':
    default:
      return [simpleRule('req_npc_friendly')];
  }
}

function addRecipeStartRules(conversation: Conversation, recipeId: StoryRecipeId, details: StoryDetailOptions): void {
  if (recipeId === 'item_request') {
    conversation.preconditions.push(simpleRule('req_has_item', details.itemId));
  }
  if (recipeId === 'paid_info') {
    conversation.preconditions.push(simpleRule('req_money', details.rewardMoney));
  }
}

function simpleRule(command: string, ...params: string[]): PreconditionEntry {
  return { type: 'simple', command, params };
}

function outcome(command: string, ...params: string[]): Outcome {
  return { command, params };
}

function createStartTurns(startPattern: StoryStartPattern): Turn[] {
  const turn1 = createTurn(1);
  setTurnChannel(turn1, startPattern === 'f2f' || startPattern === 'f2f_to_pda' ? 'f2f' : 'pda', true);

  if (startPattern === 'pda' || startPattern === 'f2f') {
    return [turn1];
  }

  const turn2 = createTurn(2);
  const nextChannel = startPattern === 'pda_to_f2f' ? 'f2f' : 'pda';
  setTurnChannel(turn2, nextChannel, true);
  turn1.choices[0].continueTo = 2;
  turn1.choices[0].terminal = false;
  turn1.choices[0].continueChannel = nextChannel;
  turn1.choices[0].continue_channel = nextChannel;
  return [turn1, turn2];
}

function setTurnChannel(turn: Turn, channel: 'pda' | 'f2f', entry: boolean): void {
  turn.channel = channel;
  turn.pda_entry = channel === 'pda' ? entry : false;
  turn.f2f_entry = channel === 'f2f' ? entry : false;
  turn.firstSpeaker = 'npc';
  turn.choices.forEach((choice) => {
    choice.channel = channel;
    choice.continueChannel = undefined;
    choice.continue_channel = undefined;
  });
}

function applyRecipeContent(conversation: Conversation, recipeId: StoryRecipeId, faction: FactionId, details: StoryDetailOptions): void {
  const actionTurn = pickActionTurn(conversation, recipeId);
  const actionChoice = ensureChoice(actionTurn, 1);
  configureTransitionIfNeeded(conversation, recipeId, actionTurn, details);

  actionTurn.openingMessage = actionOpeningFor(conversation, recipeId, faction, details);
  actionChoice.text = actionChoiceTextFor(recipeId, details);
  actionChoice.reply = actionReplyFor(recipeId, details);
  actionChoice.preconditions = actionPreconditionsFor(recipeId, details);
  actionChoice.outcomes = actionOutcomesFor(recipeId, faction, details);

  if (recipeId === 'multi_npc_handoff') {
    actionChoice.cont_npc_id = details.handoffNpcId;
  }

  if (isTaskRecipe(recipeId)) {
    configureTaskResultTurns(conversation, recipeId, actionTurn, actionChoice, details);
  }
}

function pickActionTurn(conversation: Conversation, recipeId: StoryRecipeId): Turn {
  if (recipeId === 'item_request' || recipeId === 'escort_npc') {
    return conversation.turns.find((turn) => turn.channel === 'f2f') ?? conversation.turns[conversation.turns.length - 1];
  }
  return conversation.turns[conversation.turns.length - 1];
}

function ensureChoice(turn: Turn, index: number): Choice {
  let choice = turn.choices.find((item) => item.index === index);
  if (!choice) {
    choice = createChoice(index);
    choice.channel = turn.channel;
    turn.choices.push(choice);
  }
  return choice;
}

function configureTransitionIfNeeded(conversation: Conversation, recipeId: StoryRecipeId, actionTurn: Turn, details: StoryDetailOptions): void {
  const firstTurn = conversation.turns[0];
  if (!firstTurn || firstTurn === actionTurn) return;

  const firstChoice = ensureChoice(firstTurn, 1);
  firstTurn.openingMessage = transitionOpeningFor(recipeId, details);
  firstChoice.text = transitionChoiceTextFor(recipeId);
  firstChoice.reply = transitionReplyFor(recipeId);
  firstChoice.outcomes = [];
  firstChoice.preconditions = [];
  firstChoice.terminal = false;
  firstChoice.continueTo = actionTurn.turnNumber;
  firstChoice.continueChannel = actionTurn.channel;
  firstChoice.continue_channel = actionTurn.channel;
}

function isTaskRecipe(recipeId: StoryRecipeId): boolean {
  return recipeId === 'fetch_task'
    || recipeId === 'delivery_task'
    || recipeId === 'dead_drop'
    || recipeId === 'bounty_hunt'
    || recipeId === 'eliminate_squad'
    || recipeId === 'artifact_hunt'
    || recipeId === 'escort_npc';
}

function configureTaskResultTurns(conversation: Conversation, recipeId: StoryRecipeId, actionTurn: Turn, actionChoice: Choice, details: StoryDetailOptions): void {
  const channel = actionTurn.channel ?? 'pda';
  const successTurn = appendTerminalTurn(conversation, channel, 'Task complete. Payment sent.', 'Done.');
  const failTurn = appendTerminalTurn(conversation, channel, 'Time ran out. Job is off.', 'Understood.');
  const success = String(successTurn.turnNumber);
  const fail = String(failTurn.turnNumber);

  switch (recipeId) {
    case 'fetch_task':
      actionChoice.outcomes = [outcome('panda_task_fetch', details.itemId, details.itemCount, details.timeoutSeconds, success, fail)];
      break;
    case 'dead_drop':
      actionChoice.outcomes = [outcome('panda_task_dead_drop', details.itemId, details.locationId, details.timeoutSeconds, success, fail)];
      break;
    case 'bounty_hunt':
      actionChoice.outcomes = [outcome('panda_task_bounty', details.targetFaction, details.targetRank, details.locationId, details.timeoutSeconds, success, fail)];
      break;
    case 'escort_npc':
      actionChoice.outcomes = [outcome('panda_task_escort', details.locationId, details.timeoutSeconds, success, fail)];
      break;
    default:
      break;
  }

  actionChoice.terminal = true;
  delete actionChoice.continueTo;
  delete actionChoice.continueChannel;
  delete actionChoice.continue_channel;
}

function appendTerminalTurn(conversation: Conversation, channel: 'pda' | 'f2f', openingMessage: string, reply: string): Turn {
  const turn = createTurn(nextTurnNumber(conversation));
  setTurnChannel(turn, channel, false);
  turn.openingMessage = openingMessage;
  const choice = ensureChoice(turn, 1);
  choice.text = 'Continue.';
  choice.reply = reply;
  choice.terminal = true;
  conversation.turns.push(turn);
  return turn;
}

function nextTurnNumber(conversation: Conversation): number {
  return conversation.turns.reduce((max, turn) => Math.max(max, turn.turnNumber), 0) + 1;
}

function transitionOpeningFor(recipeId: StoryRecipeId, details: StoryDetailOptions): string {
  switch (recipeId) {
    case 'item_request':
      return `I need ${articleFor(details.itemId)} ${itemLabel(details.itemId)}. Bring it in person and I will pay.`;
    case 'escort_npc':
      return 'I need feet on the ground for this. Meet me and we move.';
    case 'meet_in_person':
      return 'Not over PDA. Meet me and we talk properly.';
    case 'multi_npc_handoff':
      return 'I am not right person for this. I can put you through to someone who is.';
    default:
      return `Meet me, then we talk about ${locationLabel(details.locationId)}.`;
  }
}

function transitionChoiceTextFor(recipeId: StoryRecipeId): string {
  if (recipeId === 'item_request') return 'I can bring it.';
  if (recipeId === 'meet_in_person') return 'Where should I meet you?';
  if (recipeId === 'multi_npc_handoff') return 'Put them through.';
  return 'Tell me where.';
}

function transitionReplyFor(recipeId: StoryRecipeId): string {
  if (recipeId === 'item_request') return 'Come by and we settle up.';
  if (recipeId === 'meet_in_person') return 'Old bridge. Come alone.';
  if (recipeId === 'multi_npc_handoff') return 'Stand by.';
  return 'We continue in next scene.';
}

function actionOpeningFor(conversation: Conversation, recipeId: StoryRecipeId, faction: FactionId, details: StoryDetailOptions): string {
  if (conversation.turns.length > 1 && recipeId === 'item_request') return `You brought ${itemLabel(details.itemId)}?`;
  if (conversation.turns.length > 1 && recipeId === 'meet_in_person') return 'You came. Good. Keep your voice down.';
  if (conversation.turns.length > 1 && recipeId === 'multi_npc_handoff') return 'This is Sakharov. I hear you are looking for work.';
  return openingFor(recipeId, faction, details);
}

function openingFor(recipeId: StoryRecipeId, faction: FactionId, details: StoryDetailOptions): string {
  const factionName = FACTION_DISPLAY_NAMES[faction];
  switch (recipeId) {
    case 'job_offer':
      return `I have work if you want ${details.rewardMoney} RU.`;
    case 'faction_warning':
      return `${factionName} patrols saw movement near ${locationLabel(details.locationId)}. Keep your eyes open.`;
    case 'item_request':
      return `You carrying ${articleFor(details.itemId)} ${itemLabel(details.itemId)}? I can pay.`;
    case 'go_to_location':
      return `I marked something near ${locationLabel(details.locationId)}. Worth checking.`;
    case 'spawn_ambush':
      return `Road near ${locationLabel(details.locationId)} is wrong. Something is waiting there.`;
    case 'supply_gift':
      return 'Take this. You look like you need it.';
    case 'paid_info':
      return `I can sell you information for ${details.rewardMoney} RU.`;
    case 'fetch_task':
      return `Find ${details.itemCount} ${itemLabel(details.itemId)} before time runs out.`;
    case 'dead_drop':
      return `Bring ${itemLabel(details.itemId)} to ${locationLabel(details.locationId)}.`;
    case 'bounty_hunt':
      return `Target is at ${locationLabel(details.locationId)}. Remove them.`;
    case 'escort_npc':
      return `Escort me to ${locationLabel(details.locationId)}.`;
    case 'meet_in_person':
      return 'Not over PDA. Meet me and we talk properly.';
    case 'multi_npc_handoff':
      return 'I am not right person for this. I can put you through to someone who is.';
    case 'rumor':
    default:
      return 'Heard something strange over comms last night.';
  }
}

function actionChoiceTextFor(recipeId: StoryRecipeId, details: StoryDetailOptions): string {
  switch (recipeId) {
    case 'item_request':
      return `Hand over ${itemLabel(details.itemId)}.`;
    case 'meet_in_person':
      return 'I am here.';
    case 'multi_npc_handoff':
      return 'I am listening.';
    case 'go_to_location':
    case 'spawn_ambush':
      return 'Send me the marker.';
    case 'supply_gift':
      return 'I can use it.';
    case 'paid_info':
      return 'Pay for information.';
    case 'fetch_task':
    case 'dead_drop':
    case 'bounty_hunt':
    case 'escort_npc':
      return 'I will take the job.';
    default:
      return 'Tell me more.';
  }
}

function actionReplyFor(recipeId: StoryRecipeId, details: StoryDetailOptions): string {
  switch (recipeId) {
    case 'job_offer':
      return 'Done. Payment is yours.';
    case 'item_request':
      return `That ${itemLabel(details.itemId)} helps. Payment is yours.`;
    case 'go_to_location':
      return 'Marker sent. Watch your step.';
    case 'spawn_ambush':
      return 'Marker sent. Go ready.';
    case 'meet_in_person':
      return 'Good. This stays between us.';
    case 'multi_npc_handoff':
      return 'Then listen carefully.';
    case 'supply_gift':
      return 'Take it and stay alive.';
    case 'paid_info':
      return 'Payment received. Info sent.';
    case 'fetch_task':
    case 'dead_drop':
    case 'bounty_hunt':
    case 'escort_npc':
      return 'Job started. Do not waste time.';
    default:
      return 'Could be nothing. Could be Zone being Zone.';
  }
}

function actionPreconditionsFor(recipeId: StoryRecipeId, details: StoryDetailOptions): PreconditionEntry[] {
  if (recipeId === 'item_request') return [simpleRule('req_has_item', details.itemId)];
  if (recipeId === 'paid_info') return [simpleRule('req_money', details.rewardMoney)];
  return [];
}

function actionOutcomesFor(recipeId: StoryRecipeId, faction: FactionId, details: StoryDetailOptions): Outcome[] {
  switch (recipeId) {
    case 'job_offer':
      return moneyReward(details.rewardMoney);
    case 'faction_warning':
      return [outcome('reward_gw', '25', faction)];
    case 'item_request':
      return [
        outcome('take_item', details.itemId),
        ...moneyReward(details.rewardMoney),
      ];
    case 'go_to_location':
      return [outcome('watch_location', details.locationId, '85')];
    case 'spawn_ambush':
      return [outcome('watch_location_trigger', details.locationId, `spawn_mutant_at_smart:${details.enemyId}:${details.locationId}:0`, '85')];
    case 'supply_gift':
      return [
        ...moneyReward(details.rewardMoney),
        ...itemReward(details.rewardItemId),
      ];
    case 'paid_info':
      return [
        outcome('punish_money', details.rewardMoney),
        outcome('give_info', details.infoId),
      ];
    default:
      return [];
  }
}

function moneyReward(amount: string): Outcome[] {
  return amount === '0' || amount.trim() === '' ? [] : [outcome('reward_money', amount)];
}

function itemReward(itemId: string): Outcome[] {
  return itemId.trim() === '' ? [] : [outcome('give_item', itemId)];
}

function itemLabel(itemId: string): string {
  return STORY_ITEM_OPTIONS.find((item) => item.id === itemId)?.title.toLowerCase() ?? itemId;
}

function locationLabel(locationId: string): string {
  return STORY_LOCATION_OPTIONS.find((location) => location.id === locationId)?.title ?? locationId;
}

function articleFor(itemId: string): string {
  return /^[aeiou]/i.test(itemLabel(itemId)) ? 'an' : 'a';
}

function createDefaultNpcTemplate(): NpcTemplate {
  return {
    id: 'informant',
    name: 'Informant',
    faction: 'stalker',
    rank: 'experienced',
    relation: 'neutral',
    primary: 'wpn_ak74',
    outfit: 'stalker_outfit',
    items: 'medkit,bandage',
    spawnDist: 8,
    count: 1,
    allowRoam: false,
  };
}
