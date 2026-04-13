import type { Conversation, FactionId, NpcTemplate, Outcome, PreconditionEntry, Project, Turn, Choice } from './types';
import { FACTION_DISPLAY_NAMES, getConversationFaction } from './types';
import { createChoice, createConversation, createTurn } from './xml-export';

export type StoryStartPattern = 'pda' | 'f2f' | 'pda_to_f2f' | 'f2f_to_pda';
export type StorySpeakerTarget = 'any_friendly' | 'friendly_faction' | 'named_npc' | 'custom_npc';
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
  | 'dead_drop'
  | 'bounty_hunt'
  | 'escort_npc';

export type StoryRecipe = {
  id: StoryRecipeId;
  title: string;
  description: string;
  group: 'Simple' | 'Exchange' | 'Task' | 'Handoff';
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

export const STORY_RECIPES: StoryRecipe[] = [
  { id: 'rumor', title: 'Rumor', description: 'Small flavor exchange with no gameplay effect.', group: 'Simple' },
  { id: 'faction_warning', title: 'Faction warning', description: 'Warning from faction contact, with optional goodwill.', group: 'Simple' },
  { id: 'supply_gift', title: 'Give supplies', description: 'NPC gives item, money, or both after reply.', group: 'Exchange' },
  { id: 'paid_info', title: 'Sell information', description: 'Requires money, takes payment, gives info portion.', group: 'Exchange' },
  { id: 'job_offer', title: 'Job offer', description: 'NPC offers work and pays money when accepted.', group: 'Exchange' },
  { id: 'item_request', title: 'NPC asks for item', description: 'Checks inventory, then takes item on in-person handoff.', group: 'Exchange' },
  { id: 'go_to_location', title: 'Go to location', description: 'NPC marks destination for player.', group: 'Task' },
  { id: 'spawn_ambush', title: 'Spawn ambush', description: 'Player reaches marker, then enemies spawn there.', group: 'Task' },
  { id: 'fetch_task', title: 'Fetch item task', description: 'Starts tracked task: find item before timeout.', group: 'Task' },
  { id: 'dead_drop', title: 'Dead drop task', description: 'Starts tracked task: bring item to location.', group: 'Task' },
  { id: 'bounty_hunt', title: 'Bounty hunt', description: 'Starts tracked task: spawn and kill target.', group: 'Task' },
  { id: 'escort_npc', title: 'Escort NPC', description: 'Conversation NPC joins player, destination and fail state included.', group: 'Task' },
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
  { id: '500', title: '500 RU', description: 'Small payment.' },
  { id: '750', title: '750 RU', description: 'Item handoff default.' },
  { id: '1500', title: '1500 RU', description: 'Moderate job payment.' },
  { id: '3000', title: '3000 RU', description: 'High-risk job payment.' },
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
  enemyId: 'snork',
  handoffNpcId: 'yan_stalker_sakharov',
  targetFaction: 'bandit',
  targetRank: '',
  timeoutSeconds: '600',
  infoId: 'panda_story_info',
};

export function buildStoryRecipe(project: Project, options: StoryRecipeBuildOptions): StoryRecipeBuildResult {
  const details = normalizeDetails(options.details);
  const startPattern = normalizeStartPatternForRecipe(options.recipeId, options.startPattern);
  const conversation = createConversation(project);
  const faction = getConversationFaction(conversation, project.faction);
  conversation.label = STORY_RECIPES.find((recipe) => recipe.id === options.recipeId)?.title ?? 'New Story';
  conversation.faction = faction;
  conversation.preconditions = createTargetRules(options.speakerTarget, faction);
  addRecipeStartRules(conversation, options.recipeId, details);
  conversation.startMode = startPattern === 'f2f' || startPattern === 'f2f_to_pda' ? 'f2f' : 'pda';
  conversation.initialChannel = conversation.startMode;
  conversation.turns = createStartTurns(startPattern);

  applyRecipeContent(conversation, options.recipeId, faction, details);

  const npcTemplates = options.speakerTarget === 'custom_npc'
    ? [createDefaultNpcTemplate()]
    : undefined;

  return { conversation, npcTemplates };
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
    || recipeId === 'dead_drop'
    || recipeId === 'bounty_hunt'
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
