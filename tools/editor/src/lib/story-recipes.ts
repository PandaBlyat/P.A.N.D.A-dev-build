import type { Conversation, FactionId, NpcTemplate, Outcome, PreconditionEntry, Project, Turn } from './types';
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
  | 'multi_npc_handoff';

export type StoryRecipe = {
  id: StoryRecipeId;
  title: string;
  description: string;
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

export type StoryRecipeBuildOptions = {
  recipeId: StoryRecipeId;
  startPattern: StoryStartPattern;
  speakerTarget: StorySpeakerTarget;
};

export type StoryRecipeBuildResult = {
  conversation: Conversation;
  npcTemplates?: NpcTemplate[];
};

export const STORY_START_OPTIONS: StoryStartOption[] = [
  { id: 'pda', title: 'PDA message', description: 'NPC starts story through remote message.' },
  { id: 'f2f', title: 'Face-to-face talk', description: 'Player sees dialogue option when talking to NPC.' },
  { id: 'pda_to_f2f', title: 'PDA, then meet', description: 'NPC messages first, then branch moves into in-person scene.' },
  { id: 'f2f_to_pda', title: 'Meet, then PDA', description: 'Story starts in person, then continues by message.' },
];

export const STORY_TARGET_OPTIONS: StoryTargetOption[] = [
  { id: 'any_friendly', title: 'Any friendly NPC', description: 'Safest default. Any non-hostile NPC can start story.' },
  { id: 'friendly_faction', title: 'Friendly story faction', description: 'Only friendly NPCs from current story faction can start.' },
  { id: 'named_npc', title: 'Named story NPC', description: 'Barkeep starts story. Author can swap NPC later.' },
  { id: 'custom_npc', title: 'Custom NPC', description: 'Creates default Informant template at Cordon location.' },
];

export const STORY_RECIPES: StoryRecipe[] = [
  { id: 'rumor', title: 'Rumor', description: 'Small flavor exchange with no gameplay effect.' },
  { id: 'job_offer', title: 'Job offer', description: 'NPC offers work and pays money when accepted.' },
  { id: 'faction_warning', title: 'Faction warning', description: 'Faction-flavored warning with goodwill change.' },
  { id: 'item_request', title: 'NPC asks for item', description: 'Player hands over medkit and gets paid.' },
  { id: 'go_to_location', title: 'Go to location', description: 'NPC marks Cordon location for player.' },
  { id: 'spawn_ambush', title: 'Spawn ambush', description: 'NPC sends player to location and spawns trouble.' },
  { id: 'meet_in_person', title: 'Meet in person', description: 'PDA opener turns into face-to-face scene.' },
  { id: 'multi_npc_handoff', title: 'Multi-NPC handoff', description: 'First NPC points player toward another named NPC.' },
];

export function buildStoryRecipe(project: Project, options: StoryRecipeBuildOptions): StoryRecipeBuildResult {
  const conversation = createConversation(project);
  const faction = getConversationFaction(conversation, project.faction);
  conversation.label = STORY_RECIPES.find((recipe) => recipe.id === options.recipeId)?.title ?? 'New Story';
  conversation.faction = faction;
  conversation.preconditions = createTargetRules(options.speakerTarget, faction);
  conversation.startMode = options.startPattern === 'f2f' || options.startPattern === 'f2f_to_pda' ? 'f2f' : 'pda';
  conversation.initialChannel = conversation.startMode;
  conversation.turns = createStartTurns(options.startPattern);

  applyRecipeContent(conversation, options.recipeId, faction);

  const npcTemplates = options.speakerTarget === 'custom_npc'
    ? [createDefaultNpcTemplate()]
    : undefined;

  return { conversation, npcTemplates };
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

function simpleRule(command: string, ...params: string[]): PreconditionEntry {
  return { type: 'simple', command, params };
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

function applyRecipeContent(conversation: Conversation, recipeId: StoryRecipeId, faction: FactionId): void {
  const [firstTurn] = conversation.turns;
  if (!firstTurn) return;
  const firstChoice = firstTurn.choices[0] ?? createChoice(1);
  firstTurn.choices[0] = firstChoice;

  firstTurn.openingMessage = openingFor(recipeId, faction);
  firstChoice.text = firstChoiceTextFor(recipeId);
  firstChoice.reply = replyFor(recipeId);
  firstChoice.outcomes = outcomesFor(recipeId, faction);

  if (recipeId === 'item_request') {
    firstChoice.preconditions = [simpleRule('req_has_item', 'medkit')];
    const noItemChoice = createChoice(2);
    noItemChoice.channel = firstTurn.channel;
    noItemChoice.preconditions = [simpleRule('req_not_has_item', 'medkit')];
    noItemChoice.text = 'I do not have one.';
    noItemChoice.reply = 'Then keep moving. I will ask someone else.';
    firstTurn.choices[1] = noItemChoice;
  }

  if (conversation.turns[1]) {
    conversation.turns[1].openingMessage = followUpOpeningFor(recipeId);
    conversation.turns[1].choices[0].text = 'I understand.';
    conversation.turns[1].choices[0].reply = 'Good. Stay alive out there.';
  }

  if (recipeId === 'meet_in_person' && !conversation.turns[1]) {
    addRecipeFollowUp(conversation, 'f2f', 'You came. Good, this is better said face to face.');
  }

  if (recipeId === 'multi_npc_handoff') {
    firstChoice.cont_npc_id = 'yan_stalker_sakharov';
    if (!conversation.turns[1]) {
      addRecipeFollowUp(conversation, 'pda', 'This is Sakharov. I was told you may be useful.');
    }
  }
}

function addRecipeFollowUp(conversation: Conversation, channel: 'pda' | 'f2f', openingMessage: string): void {
  const firstTurn = conversation.turns[0];
  const firstChoice = firstTurn.choices[0];
  const nextTurn = createTurn(2);
  setTurnChannel(nextTurn, channel, true);
  nextTurn.openingMessage = openingMessage;
  nextTurn.choices[0].text = 'Go on.';
  nextTurn.choices[0].reply = 'That is all for now.';
  firstChoice.continueTo = 2;
  firstChoice.terminal = false;
  firstChoice.continueChannel = channel;
  firstChoice.continue_channel = channel;
  conversation.turns.push(nextTurn);
}

function openingFor(recipeId: StoryRecipeId, faction: FactionId): string {
  const factionName = FACTION_DISPLAY_NAMES[faction];
  switch (recipeId) {
    case 'job_offer':
      return 'I have work if you want quick money.';
    case 'faction_warning':
      return `${factionName} patrols saw movement near Cordon. Keep your eyes open.`;
    case 'item_request':
      return 'You carrying a spare medkit? I can pay.';
    case 'go_to_location':
      return 'I marked something near Cordon. Worth checking.';
    case 'spawn_ambush':
      return 'Road ahead is wrong. Something is waiting there.';
    case 'meet_in_person':
      return 'Not over PDA. Meet me and we talk properly.';
    case 'multi_npc_handoff':
      return 'I am not right person for this. I can put you through to someone who is.';
    case 'rumor':
    default:
      return 'Heard something strange over comms last night.';
  }
}

function firstChoiceTextFor(recipeId: StoryRecipeId): string {
  switch (recipeId) {
    case 'item_request':
      return 'Take this medkit.';
    case 'meet_in_person':
      return 'Where should I meet you?';
    case 'multi_npc_handoff':
      return 'Put them through.';
    default:
      return 'Tell me more.';
  }
}

function replyFor(recipeId: StoryRecipeId): string {
  switch (recipeId) {
    case 'job_offer':
      return 'Done. Payment is yours.';
    case 'item_request':
      return 'That helps. Here, take payment.';
    case 'go_to_location':
      return 'Marker sent. Watch your step.';
    case 'spawn_ambush':
      return 'Marker sent. Go ready.';
    case 'meet_in_person':
      return 'Old bridge. Come alone.';
    case 'multi_npc_handoff':
      return 'Stand by.';
    default:
      return 'Could be nothing. Could be Zone being Zone.';
  }
}

function outcomesFor(recipeId: StoryRecipeId, faction: FactionId): Outcome[] {
  switch (recipeId) {
    case 'job_offer':
      return [{ command: 'reward_money', params: ['500'] }];
    case 'faction_warning':
      return [{ command: 'reward_gw', params: ['25', faction] }];
    case 'item_request':
      return [
        { command: 'take_item', params: ['medkit'] },
        { command: 'reward_money', params: ['750'] },
      ];
    case 'go_to_location':
      return [{ command: 'watch_location', params: ['%cordon_panda_st_key%', '85'] }];
    case 'spawn_ambush':
      return [
        { command: 'watch_location', params: ['%cordon_panda_st_key%', '85'] },
        { command: 'spawn_mutant_at_smart', params: ['snork', '%cordon_panda_st_key%', '0'] },
      ];
    default:
      return [];
  }
}

function followUpOpeningFor(recipeId: StoryRecipeId): string {
  if (recipeId === 'meet_in_person') return 'You came. Good. Keep your voice down.';
  if (recipeId === 'multi_npc_handoff') return 'This is Sakharov. I hear you are looking for work.';
  return 'Good. We continue from here.';
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
