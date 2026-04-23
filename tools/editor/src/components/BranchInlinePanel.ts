import { store, type BranchInlinePanelMode } from '../lib/state';
import type { Choice, Conversation, FactionId, Outcome, PreconditionEntry, SimplePrecondition, Turn } from '../lib/types';
import { FACTION_DISPLAY_NAMES, getConversationFaction } from '../lib/types';
import { OUTCOME_SCHEMAS, type CommandSchema } from '../lib/schema';
import { FACTION_IDS } from '../lib/constants';
import {
  getChoiceFieldKey,
  getChoicePreconditionItemFieldKey,
  getChoicePreconditionParamFieldKey,
  getOutcomeChanceFieldKey,
  getOutcomeItemFieldKey,
  getOutcomeParamFieldKey,
  getTurnFieldKey,
  getTurnPreconditionItemFieldKey,
  getTurnPreconditionParamFieldKey,
} from '../lib/validation';
import { requestFlowCenter } from '../lib/flow-navigation';
import { STORY_NPC_OPTIONS } from '../lib/generated/story-npc-catalog';
import {
  createCustomNpcBuilderEditor,
  createOptionPickerPanelEditor,
  getAddablePreconditionSchemas,
  renderParamEditors,
  renderPlaceholderPicker,
  showCommandPicker,
} from './CommandEditorFields';

type TurnLabels = {
  getLongLabel(turnNumber: number): string;
};

type CommandSelection =
  | { kind: 'precondition'; index: number }
  | { kind: 'outcome'; index: number };

type NpcContinuationSpeaker = 'same' | 'new';
type NewNpcContinuationMode = 'story' | 'custom' | 'sim' | null;

const npcContinuationSpeakerByChoice = new Map<string, NpcContinuationSpeaker>();
const newNpcContinuationModeByChoice = new Map<string, NewNpcContinuationMode>();

export function renderBranchInlinePanel(options: {
  conv: Conversation;
  turn: Turn;
  choice: Choice | null;
  mode: BranchInlinePanelMode;
  selectedOutcomeIndex: number | null;
  turnLabels: TurnLabels;
  onClose?: () => void;
}): HTMLElement {
  const { conv, turn, choice, mode, selectedOutcomeIndex, turnLabels, onClose } = options;
  const panel = document.createElement('section');
  panel.className = `branch-inline-panel branch-inline-panel-${mode}${choice ? ' is-choice-scope' : ' is-opener-scope'}`;
  panel.onclick = (event) => event.stopPropagation();
  panel.onpointerdown = (event) => event.stopPropagation();
  panel.onwheel = (event) => event.stopPropagation();

  panel.appendChild(renderHeader(conv, turn, choice, mode, turnLabels, onClose));
  const body = document.createElement('div');
  body.className = 'branch-inline-panel-body';
  panel.appendChild(body);

  if (mode === 'dialogue') {
    renderDialoguePanel(body, conv, turn, choice);
  } else if (mode === 'outcomes') {
    renderCommandPanel(body, conv, turn, choice, selectedOutcomeIndex);
  } else if (!choice) {
    body.appendChild(createEmpty('Pick player choice before continuation.'));
  } else {
    renderContinuationPanel(body, conv, turn, choice, turnLabels);
  }

  return panel;
}

function renderHeader(
  conv: Conversation,
  turn: Turn,
  choice: Choice | null,
  mode: BranchInlinePanelMode,
  turnLabels: TurnLabels,
  onClose?: () => void,
): HTMLElement {
  const header = document.createElement('div');
  header.className = 'branch-inline-panel-header';

  const title = document.createElement('div');
  title.className = 'branch-inline-panel-title';
  const scope = choice ? `${turnLabels.getLongLabel(turn.turnNumber)} / Choice ${choice.index}` : turnLabels.getLongLabel(turn.turnNumber);
  title.textContent = `${scope} - ${modeLabel(mode, choice)}`;

  const steps = document.createElement('div');
  steps.className = 'branch-inline-steps';
  const stepLabels = choice
    ? ['Dialogue Text', 'Preconditions / Outcomes', 'Continuation']
    : ['Dialogue Text', 'Preconditions'];
  for (const label of stepLabels) {
    const step = document.createElement('button');
    step.type = 'button';
    step.className = `branch-inline-step${stepMatchesMode(label, mode) ? ' is-active' : ''}`;
    step.textContent = label;
    step.disabled = stepMatchesMode(label, mode);
    step.onclick = () => {
      if (label === 'Continuation' && choice) {
        openPanel(conv.id, turn.turnNumber, choice.index, 'continuation');
      } else if (label === 'Preconditions / Outcomes' || label === 'Preconditions') {
        openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'outcomes', getInitialCommandSelection(turn, choice));
      } else {
        openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'dialogue');
      }
    };
    steps.appendChild(step);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-sm branch-inline-close';
  close.textContent = 'Close';
  const closePanel = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (onClose) {
      onClose();
      return;
    }
    store.closeBranchInlinePanel();
  };
  close.onpointerdown = closePanel;
  close.onclick = closePanel;

  header.append(title, steps, close);
  return header;
}

function renderDialoguePanel(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice | null): void {
  const grid = document.createElement('div');
  grid.className = 'branch-inline-grid branch-inline-grid-two';

  const textPane = createPane(choice ? 'Dialogue Text' : 'NPC Opener');
  if (!choice) {
    textPane.appendChild(createTextarea({
      label: 'NPC Opener Message',
      value: turn.openingMessage ?? '',
      placeholder: 'NPC opening line for this branch',
      fieldKey: getTurnFieldKey(conv.id, turn.turnNumber, 'opening-message'),
      onCommit: (value) => store.updateTurn(conv.id, turn.turnNumber, { openingMessage: value }),
    }));
    textPane.appendChild(createChannelControls(conv, turn));
  } else {
    textPane.appendChild(createTextarea({
      label: 'Player Dialogue Choice',
      value: choice.text,
      placeholder: 'Player choice text',
      fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'text'),
      onCommit: (value) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { text: value }),
    }));
    textPane.appendChild(createTextarea({
      label: 'NPC Reply',
      value: choice.reply,
      placeholder: 'NPC response after player picks this choice',
      fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply'),
      onCommit: (value) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { reply: value }),
    }));
  }

  const placeholderPane = createPane('Dynamic Placeholder List');
  renderPlaceholderPicker(placeholderPane, `branch-inline-${conv.id}-${turn.turnNumber}-${choice?.index ?? 'opener'}-placeholders`, { defaultCollapsed: false });

  const actionRow = document.createElement('div');
  actionRow.className = 'branch-inline-action-row branch-inline-stage-row';
  actionRow.append(createActionButton(choice ? `Outcomes (${choice.outcomes.length})` : `Preconditions (${turn.preconditions.length})`, () => {
    openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'outcomes', getInitialCommandSelection(turn, choice));
  }));
  placeholderPane.appendChild(actionRow);

  grid.append(textPane, placeholderPane);
  container.appendChild(grid);
}

function renderCommandPanel(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  choice: Choice | null,
  selectedOutcomeIndex: number | null,
): void {
  const selection = resolveCommandSelection(turn, choice, selectedOutcomeIndex);
  const grid = document.createElement('div');
  grid.className = 'branch-inline-grid branch-inline-grid-outcomes';

  const listPane = createPane(choice ? 'Preconditions / Outcomes' : 'Opener Preconditions');
  renderCommandAddControls(listPane, conv, turn, choice);
  renderCurrentCommandList(listPane, conv, turn, choice, selection);

  const detailPane = createPane('Details / Properties');
  renderCommandDetails(detailPane, conv, turn, choice, selection);
  if (choice) {
    const continueRow = document.createElement('div');
    continueRow.className = 'branch-inline-action-row branch-inline-next-row';
    continueRow.appendChild(createActionButton('Continuation', () => openPanel(conv.id, turn.turnNumber, choice.index, 'continuation')));
    detailPane.appendChild(continueRow);
  }

  grid.append(listPane, detailPane);
  container.appendChild(grid);
}

function renderContinuationPanel(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice, turnLabels: TurnLabels): void {
  const grid = document.createElement('div');
  grid.className = 'branch-inline-grid branch-inline-grid-continuation';

  const pathPane = createPane('How Does This Dialogue Continue?');
  const currentChannel = normalizeChannel(choice.continueChannel ?? choice.continue_channel, normalizeChannel(turn.channel, normalizeChannel(conv.initialChannel, 'pda')));
  const channelRow = document.createElement('div');
  channelRow.className = 'branch-inline-segmented branch-inline-large-segmented';
  channelRow.append(
    createSegmentButton('PDA', currentChannel === 'pda', () => ensureContinuation(conv, turn, choice, 'pda')),
    createSegmentButton('F2F', currentChannel === 'f2f', () => ensureContinuation(conv, turn, choice, 'f2f')),
  );
  pathPane.appendChild(channelRow);

  const linkRow = document.createElement('div');
  linkRow.className = 'branch-inline-action-row';
  linkRow.append(
    createActionButton('End Here', () => store.clearChoiceContinuation(conv.id, turn.turnNumber, choice.index), choice.continueTo == null),
  );
  pathPane.appendChild(linkRow);
  pathPane.appendChild(renderExistingBranchLinks(conv, turn, choice, turnLabels));

  const npcPane = createPane('Who Continues It?');
  renderNpcContinuationOptions(npcPane, conv, turn, choice);

  grid.append(npcPane, pathPane);
  container.appendChild(grid);
}

function getNpcContinuationKey(conv: Conversation, turn: Turn, choice: Choice): string {
  return `${conv.id}:${turn.turnNumber}:${choice.index}`;
}

function hasNewNpcContinuationData(choice: Choice): boolean {
  return Boolean(choice.cont_npc_id || choice.allow_generic_stalker || (choice.npc_faction_filters?.length ?? 0) > 0);
}

function inferNpcContinuationSpeaker(conv: Conversation, turn: Turn, choice: Choice): NpcContinuationSpeaker {
  const key = getNpcContinuationKey(conv, turn, choice);
  const remembered = npcContinuationSpeakerByChoice.get(key);
  if (remembered) return remembered;
  return hasNewNpcContinuationData(choice) || newNpcContinuationModeByChoice.has(key) ? 'new' : 'same';
}

function inferNewNpcContinuationMode(conv: Conversation, turn: Turn, choice: Choice): NewNpcContinuationMode {
  const remembered = newNpcContinuationModeByChoice.get(getNpcContinuationKey(conv, turn, choice));
  if (remembered) return remembered;
  if (choice.allow_generic_stalker || (choice.npc_faction_filters?.length ?? 0) > 0) return 'sim';
  if (choice.cont_npc_id?.startsWith('npc:')) return 'custom';
  if (choice.cont_npc_id) return 'story';
  return null;
}

function reopenContinuationPanel(conv: Conversation, turn: Turn, choice: Choice): void {
  store.closeBranchInlinePanel();
  store.openBranchInlinePanel({
    conversationId: conv.id,
    turnNumber: turn.turnNumber,
    choiceIndex: choice.index,
    mode: 'continuation',
  });
}

function setNpcContinuationSpeaker(conv: Conversation, turn: Turn, choice: Choice, speaker: NpcContinuationSpeaker): void {
  const key = getNpcContinuationKey(conv, turn, choice);
  npcContinuationSpeakerByChoice.set(key, speaker);
  if (speaker === 'same') {
    newNpcContinuationModeByChoice.delete(key);
    store.batch(() => {
      store.updateChoice(conv.id, turn.turnNumber, choice.index, {
        cont_npc_id: undefined,
        npc_faction_filters: undefined,
        npc_profile_filters: undefined,
        allow_generic_stalker: false,
      });
      reopenContinuationPanel(conv, turn, choice);
    });
    return;
  }
  store.batch(() => {
    reopenContinuationPanel(conv, turn, choice);
  });
}

function setNewNpcContinuationMode(conv: Conversation, turn: Turn, choice: Choice, mode: Exclude<NewNpcContinuationMode, null>): void {
  const key = getNpcContinuationKey(conv, turn, choice);
  npcContinuationSpeakerByChoice.set(key, 'new');
  newNpcContinuationModeByChoice.set(key, mode);
  if (mode === 'sim') {
    store.batch(() => {
      store.updateChoice(conv.id, turn.turnNumber, choice.index, {
        cont_npc_id: undefined,
        npc_faction_filters: choice.npc_faction_filters?.length ? choice.npc_faction_filters : [getConversationFaction(conv)],
        npc_profile_filters: undefined,
        allow_generic_stalker: true,
      });
      reopenContinuationPanel(conv, turn, choice);
    });
    return;
  }
  store.batch(() => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, {
      cont_npc_id: mode === 'custom' && choice.cont_npc_id?.startsWith('npc:') ? choice.cont_npc_id : undefined,
      npc_faction_filters: undefined,
      npc_profile_filters: undefined,
      allow_generic_stalker: false,
    });
    reopenContinuationPanel(conv, turn, choice);
  });
}

function renderCommandAddControls(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice | null): void {
  const controls = document.createElement('div');
  controls.className = 'branch-inline-picker-actions';

  const addPrecondition = createActionButton(choice ? 'Add Precondition' : 'Add Opener Precondition', () => undefined);
  addPrecondition.onclick = () => {
    showCommandPicker(addPrecondition, getAddablePreconditionSchemas(choice ? 'choice' : 'turn'), (schema) => {
      addPreconditionEntry(conv, turn, choice, schema);
    }, {
      title: choice ? 'Add choice precondition' : 'Add opener precondition',
      searchPlaceholder: 'Search preconditions...',
      emptyMessage: 'No matching preconditions',
    });
  };
  controls.appendChild(addPrecondition);

  if (choice) {
    const addOutcome = createActionButton('Add Outcome', () => undefined);
    addOutcome.onclick = () => {
      showCommandPicker(addOutcome, OUTCOME_SCHEMAS, (schema) => {
        addOutcomeEntry(conv, turn, choice, schema);
      }, {
        title: 'Add outcome',
        searchPlaceholder: 'Search outcomes...',
        emptyMessage: 'No matching outcomes',
      });
    };
    controls.appendChild(addOutcome);
  }

  container.appendChild(controls);
}

function renderCurrentCommandList(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  choice: Choice | null,
  selection: CommandSelection | null,
): void {
  const wrap = document.createElement('div');
  wrap.className = 'branch-inline-current-outcomes';
  const title = document.createElement('div');
  title.className = 'branch-inline-subtitle';
  title.textContent = 'Current';
  wrap.appendChild(title);

  const entries = choice ? (choice.preconditions ?? []) : (turn.preconditions ?? []);
  if (entries.length > 0) {
    const preTitle = document.createElement('div');
    preTitle.className = 'branch-inline-command-section-label';
    preTitle.textContent = 'Preconditions';
    wrap.appendChild(preTitle);
    entries.forEach((entry, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `branch-inline-current-outcome${selection?.kind === 'precondition' && selection.index === index ? ' is-active' : ''}`;
      row.setAttribute('data-field-key', choice
        ? getChoicePreconditionItemFieldKey(conv.id, turn.turnNumber, choice.index, index)
        : getTurnPreconditionItemFieldKey(conv.id, turn.turnNumber, index));
      row.textContent = `${index + 1}. ${formatPreconditionLabel(entry)}`;
      row.onclick = () => openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'outcomes', encodePreconditionIndex(index));
      wrap.appendChild(row);
    });
  }

  if (choice && choice.outcomes.length > 0) {
    const outTitle = document.createElement('div');
    outTitle.className = 'branch-inline-command-section-label';
    outTitle.textContent = 'Outcomes';
    wrap.appendChild(outTitle);
    choice.outcomes.forEach((outcome, index) => {
      const schema = OUTCOME_SCHEMAS.find((candidate) => candidate.name === outcome.command);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `branch-inline-current-outcome${selection?.kind === 'outcome' && selection.index === index ? ' is-active' : ''}`;
      row.setAttribute('data-field-key', getOutcomeItemFieldKey(conv.id, turn.turnNumber, choice.index, index));
      row.textContent = `${index + 1}. ${schema?.label ?? outcome.command}`;
      row.onclick = () => openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', index);
      wrap.appendChild(row);
    });
  }

  if (entries.length === 0 && (!choice || choice.outcomes.length === 0)) {
    wrap.appendChild(createEmpty(choice ? 'No preconditions or outcomes on this choice.' : 'No opener preconditions.'));
  }
  container.appendChild(wrap);
}

function renderCommandDetails(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  choice: Choice | null,
  selection: CommandSelection | null,
): void {
  if (!selection) {
    container.appendChild(createEmpty(choice ? 'Pick or add precondition/outcome to edit properties here.' : 'Pick or add opener precondition to edit properties here.'));
    return;
  }

  if (selection.kind === 'precondition') {
    renderPreconditionDetails(container, conv, turn, choice, selection.index);
    return;
  }

  if (!choice) {
    container.appendChild(createEmpty('Outcomes belong to player choices.'));
    return;
  }
  renderOutcomeDetails(container, conv, turn, choice, selection.index);
}

function renderPreconditionDetails(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice | null, preconditionIndex: number): void {
  const entries = choice ? (choice.preconditions ?? []) : (turn.preconditions ?? []);
  const entry = entries[preconditionIndex];
  if (!entry) {
    container.appendChild(createEmpty('Precondition no longer exists.'));
    return;
  }

  const schema = entry.type === 'simple'
    ? getAddablePreconditionSchemas(choice ? 'choice' : 'turn').find((candidate) => candidate.name === entry.command)
    : null;
  const title = document.createElement('div');
  title.className = 'branch-inline-detail-title';
  title.textContent = schema?.label ?? formatPreconditionLabel(entry);
  container.appendChild(title);
  if (schema?.description) {
    const desc = document.createElement('div');
    desc.className = 'branch-inline-detail-desc';
    desc.textContent = schema.description;
    container.appendChild(desc);
  }

  if (entry.type !== 'simple' || !schema) {
    container.appendChild(createEmpty('Nested or invalid precondition. Use advanced properties to edit full expression.'));
  } else if (schema.params.length > 0) {
    container.appendChild(renderParamEditors(schema, entry.params, (newParams) => {
      const next = [...entries];
      next[preconditionIndex] = { ...entry, params: newParams };
      updatePreconditions(conv, turn, choice, next);
    }, (paramIndex) => choice
      ? getChoicePreconditionParamFieldKey(conv.id, turn.turnNumber, choice.index, preconditionIndex, paramIndex)
      : getTurnPreconditionParamFieldKey(conv.id, turn.turnNumber, preconditionIndex, paramIndex), conv));
  } else {
    container.appendChild(createEmpty('No properties for this precondition.'));
  }

  const actions = document.createElement('div');
  actions.className = 'branch-inline-action-row';
  actions.append(
    createActionButton('Move Up', () => movePrecondition(conv, turn, choice, preconditionIndex, -1), preconditionIndex === 0),
    createActionButton('Move Down', () => movePrecondition(conv, turn, choice, preconditionIndex, 1), preconditionIndex >= entries.length - 1),
    createActionButton('Delete', () => {
      updatePreconditions(conv, turn, choice, entries.filter((_, index) => index !== preconditionIndex));
      openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'outcomes', getInitialCommandSelectionAfterDelete(entries.length, preconditionIndex));
    }),
  );
  container.appendChild(actions);
}

function renderOutcomeDetails(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice, outcomeIndex: number): void {
  const outcome = choice.outcomes[outcomeIndex];
  if (!outcome) {
    container.appendChild(createEmpty('Outcome no longer exists.'));
    return;
  }
  const schema = OUTCOME_SCHEMAS.find((candidate) => candidate.name === outcome.command);
  const title = document.createElement('div');
  title.className = 'branch-inline-detail-title';
  title.textContent = schema?.label ?? outcome.command;
  container.appendChild(title);
  if (schema?.description) {
    const desc = document.createElement('div');
    desc.className = 'branch-inline-detail-desc';
    desc.textContent = schema.description;
    container.appendChild(desc);
  }

  if (schema && schema.params.length > 0) {
    container.appendChild(renderParamEditors(schema, outcome.params, (newParams) => {
      const updated = [...choice.outcomes];
      updated[outcomeIndex] = { ...outcome, params: newParams };
      store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: updated });
    }, (paramIndex) => getOutcomeParamFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex, paramIndex), conv));
  } else {
    container.appendChild(createEmpty('No properties for this outcome.'));
  }

  const chance = document.createElement('label');
  chance.className = 'branch-inline-field';
  const chanceText = document.createElement('span');
  chanceText.textContent = 'Chance %';
  const chanceInput = document.createElement('input');
  chanceInput.type = 'number';
  chanceInput.min = '1';
  chanceInput.max = '100';
  chanceInput.placeholder = '100';
  chanceInput.value = String(outcome.chancePercent ?? '');
  chanceInput.setAttribute('data-field-key', getOutcomeChanceFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex));
  chanceInput.onchange = () => {
    const next = [...choice.outcomes];
    const value = Number.parseInt(chanceInput.value, 10);
    next[outcomeIndex] = { ...outcome, chancePercent: Number.isFinite(value) && value < 100 ? value : undefined };
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: next });
  };
  chance.append(chanceText, chanceInput);
  container.appendChild(chance);

  const actions = document.createElement('div');
  actions.className = 'branch-inline-action-row';
  actions.append(
    createActionButton('Move Up', () => moveOutcome(conv, turn, choice, outcomeIndex, -1), outcomeIndex === 0),
    createActionButton('Move Down', () => moveOutcome(conv, turn, choice, outcomeIndex, 1), outcomeIndex >= choice.outcomes.length - 1),
    createActionButton('Delete', () => {
      const next = choice.outcomes.filter((_, index) => index !== outcomeIndex);
      store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: next });
      openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', next.length > 0 ? Math.min(outcomeIndex, next.length - 1) : getInitialCommandSelection(turn, choice));
    }),
  );
  container.appendChild(actions);
}

function addPreconditionEntry(conv: Conversation, turn: Turn, choice: Choice | null, schema: CommandSchema): void {
  const entries = choice ? (choice.preconditions ?? []) : (turn.preconditions ?? []);
  const entry: SimplePrecondition = {
    type: 'simple',
    command: schema.name,
    params: schema.params.map((param) => param.placeholder || ''),
  };
  const nextIndex = entries.length;
  store.batch(() => {
    updatePreconditions(conv, turn, choice, [...entries, entry]);
    openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'outcomes', encodePreconditionIndex(nextIndex));
  });
}

function addOutcomeEntry(conv: Conversation, turn: Turn, choice: Choice, schema: CommandSchema): void {
  const outcome: Outcome = {
    command: schema.name,
    params: schema.params.map((param) => param.placeholder || ''),
  };
  const nextIndex = choice.outcomes.length;
  store.batch(() => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: [...choice.outcomes, outcome] });
    openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', nextIndex);
  });
}

function updatePreconditions(conv: Conversation, turn: Turn, choice: Choice | null, entries: PreconditionEntry[]): void {
  if (choice) {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { preconditions: entries });
    return;
  }
  store.updateTurn(conv.id, turn.turnNumber, { preconditions: entries });
}

function renderExistingBranchLinks(conv: Conversation, turn: Turn, choice: Choice, turnLabels: TurnLabels): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'branch-inline-link-list';
  const title = document.createElement('div');
  title.className = 'branch-inline-subtitle';
  title.textContent = 'Link Existing Branch';
  wrap.appendChild(title);

  for (const candidate of conv.turns) {
    if (candidate.turnNumber === turn.turnNumber) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `branch-inline-link${choice.continueTo === candidate.turnNumber ? ' is-active' : ''}`;
    button.textContent = turnLabels.getLongLabel(candidate.turnNumber);
    button.onclick = () => store.connectChoiceToTurn(conv.id, turn.turnNumber, choice.index, candidate.turnNumber);
    wrap.appendChild(button);
  }
  return wrap;
}

function renderNpcContinuationOptions(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice): void {
  const speaker = inferNpcContinuationSpeaker(conv, turn, choice);
  const speakerRow = document.createElement('div');
  speakerRow.className = 'branch-inline-segmented branch-inline-large-segmented branch-inline-npc-speaker-row';
  speakerRow.append(
    createSegmentButton('Same NPC', speaker === 'same', () => setNpcContinuationSpeaker(conv, turn, choice, 'same')),
    createSegmentButton('New NPC', speaker === 'new', () => setNpcContinuationSpeaker(conv, turn, choice, 'new')),
  );
  container.appendChild(speakerRow);

  if (speaker === 'same') {
    container.appendChild(createEmpty('Same NPC delivers next branch.'));
    return;
  }

  const mode = inferNewNpcContinuationMode(conv, turn, choice);
  const modeRow = document.createElement('div');
  modeRow.className = 'branch-inline-npc-mode-row';
  modeRow.append(
    createSegmentButton('Story NPC', mode === 'story', () => setNewNpcContinuationMode(conv, turn, choice, 'story')),
    createSegmentButton('Custom NPC', mode === 'custom', () => setNewNpcContinuationMode(conv, turn, choice, 'custom')),
    createSegmentButton('Any Sim x Faction NPC', mode === 'sim', () => setNewNpcContinuationMode(conv, turn, choice, 'sim')),
  );
  container.appendChild(modeRow);

  if (!mode) {
    container.appendChild(createEmpty('Pick new NPC source to tune handoff.'));
    return;
  }

  const options = document.createElement('div');
  options.className = 'branch-inline-npc-options';

  if (mode === 'story') {
    const storyField = document.createElement('div');
    storyField.className = 'branch-inline-field-block';
    const storyLabel = document.createElement('div');
    storyLabel.className = 'branch-inline-subtitle';
    storyLabel.textContent = 'Story NPC';
    const storyPicker = createOptionPickerPanelEditor(
      choice.cont_npc_id?.startsWith('npc:') ? '' : (choice.cont_npc_id ?? ''),
      (value) => {
        const key = getNpcContinuationKey(conv, turn, choice);
        npcContinuationSpeakerByChoice.set(key, 'new');
        newNpcContinuationModeByChoice.set(key, 'story');
        store.updateChoice(conv.id, turn.turnNumber, choice.index, {
          cont_npc_id: value.trim() || undefined,
          npc_faction_filters: undefined,
          npc_profile_filters: undefined,
          allow_generic_stalker: false,
        });
      },
      getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'cont-npc-id'),
      {
        title: 'NPC Handoff Catalog',
        subtitle: 'Pick story NPC who delivers next branch.',
        searchPlaceholder: 'Search story NPC id, faction, level, or role...',
        emptyLabel: 'Same NPC continues',
        options: STORY_NPC_OPTIONS,
      },
    );
    storyField.append(storyLabel, storyPicker);
    options.appendChild(storyField);
  }

  if (mode === 'custom') {
    const customField = document.createElement('div');
    customField.className = 'branch-inline-field-block';
    const customLabel = document.createElement('div');
    customLabel.className = 'branch-inline-subtitle';
    customLabel.textContent = 'Custom NPC';
    const currentTemplate = choice.cont_npc_id?.startsWith('npc:') ? choice.cont_npc_id.slice(4) : '';
    const customEditor = createCustomNpcBuilderEditor(
      currentTemplate,
      (templateId) => {
        const key = getNpcContinuationKey(conv, turn, choice);
        npcContinuationSpeakerByChoice.set(key, 'new');
        newNpcContinuationModeByChoice.set(key, 'custom');
        store.updateChoice(conv.id, turn.turnNumber, choice.index, {
          cont_npc_id: templateId ? `npc:${templateId}` : undefined,
          npc_faction_filters: undefined,
          npc_profile_filters: undefined,
          allow_generic_stalker: false,
        });
      },
      `${getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'cont-npc-id')}-custom`,
      { showSpawnDistance: true },
    );
    customField.append(customLabel, customEditor);
    options.appendChild(customField);
  }

  if (mode === 'sim') {
    const simField = document.createElement('div');
    simField.className = 'branch-inline-field-block';
    const simTitle = document.createElement('div');
    simTitle.className = 'branch-inline-subtitle';
    simTitle.textContent = 'Any Sim x Faction NPC';
    const factionSelect = document.createElement('select');
    factionSelect.multiple = true;
    factionSelect.size = Math.min(6, FACTION_IDS.length);
    const selected = new Set(choice.npc_faction_filters ?? [getConversationFaction(conv)]);
    for (const factionId of FACTION_IDS) {
      const option = document.createElement('option');
      option.value = factionId;
      option.textContent = FACTION_DISPLAY_NAMES[factionId];
      option.selected = selected.has(factionId);
      factionSelect.appendChild(option);
    }
    const applySimTarget = (): void => {
      const key = getNpcContinuationKey(conv, turn, choice);
      npcContinuationSpeakerByChoice.set(key, 'new');
      newNpcContinuationModeByChoice.set(key, 'sim');
      const values = Array.from(factionSelect.selectedOptions).map((option) => option.value as FactionId);
      store.updateChoice(conv.id, turn.turnNumber, choice.index, {
        cont_npc_id: undefined,
        npc_faction_filters: values.length > 0 ? values : [getConversationFaction(conv)],
        allow_generic_stalker: true,
      });
    };
    factionSelect.onchange = applySimTarget;
    const simButton = createActionButton('Use Sim NPC Targeting', applySimTarget);
    simField.append(simTitle, factionSelect, simButton);
    options.appendChild(simField);
  }

  container.appendChild(options);
}

function createChannelControls(conv: Conversation, turn: Turn): HTMLElement {
  const field = document.createElement('div');
  field.className = 'branch-inline-field-block';
  const label = document.createElement('div');
  label.className = 'branch-inline-subtitle';
  label.textContent = 'Branch Mode';
  const current = normalizeChannel(turn.channel, normalizeChannel(conv.initialChannel, 'pda'));
  const row = document.createElement('div');
  row.className = 'branch-inline-segmented';
  row.append(
    createSegmentButton('PDA', current === 'pda', () => setTurnChannel(conv, turn, 'pda')),
    createSegmentButton('F2F', current === 'f2f', () => setTurnChannel(conv, turn, 'f2f')),
  );
  field.append(label, row);
  return field;
}

function setTurnChannel(conv: Conversation, turn: Turn, channel: 'pda' | 'f2f'): void {
  if (turn.turnNumber === 1) {
    store.setConversationInitialChannel(conv.id, channel);
    return;
  }
  store.updateTurn(conv.id, turn.turnNumber, {
    channel,
    ...(channel === 'pda' ? { pda_entry: true, f2f_entry: false } : { f2f_entry: true, pda_entry: false }),
  });
}

function ensureContinuation(conv: Conversation, turn: Turn, choice: Choice, channel: 'pda' | 'f2f'): void {
  const created = store.ensureChoiceContinuationTurn(conv.id, turn.turnNumber, choice.index, channel);
  if (created != null) requestFlowCenter({ conversationId: conv.id, turnNumber: created });
}

function movePrecondition(conv: Conversation, turn: Turn, choice: Choice | null, preconditionIndex: number, delta: -1 | 1): void {
  const entries = choice ? (choice.preconditions ?? []) : (turn.preconditions ?? []);
  const nextIndex = preconditionIndex + delta;
  if (nextIndex < 0 || nextIndex >= entries.length) return;
  const next = [...entries];
  const [moved] = next.splice(preconditionIndex, 1);
  next.splice(nextIndex, 0, moved);
  store.batch(() => {
    updatePreconditions(conv, turn, choice, next);
    openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'outcomes', encodePreconditionIndex(nextIndex));
  });
}

function moveOutcome(conv: Conversation, turn: Turn, choice: Choice, outcomeIndex: number, delta: -1 | 1): void {
  const nextIndex = outcomeIndex + delta;
  if (nextIndex < 0 || nextIndex >= choice.outcomes.length) return;
  const next = [...choice.outcomes];
  const [moved] = next.splice(outcomeIndex, 1);
  next.splice(nextIndex, 0, moved);
  store.batch(() => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: next });
    openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', nextIndex);
  });
}

function createTextarea(options: {
  label: string;
  value: string;
  placeholder: string;
  fieldKey: string;
  onCommit: (value: string) => void;
}): HTMLElement {
  const field = document.createElement('label');
  field.className = 'branch-inline-field';
  const label = document.createElement('span');
  label.textContent = options.label;
  const textarea = document.createElement('textarea');
  textarea.value = options.value;
  textarea.placeholder = options.placeholder;
  textarea.setAttribute('data-field-key', options.fieldKey);
  let initialValue = textarea.value;
  const commit = (): void => {
    if (textarea.value === initialValue) return;
    initialValue = textarea.value;
    options.onCommit(textarea.value);
  };
  textarea.onblur = commit;
  textarea.onkeydown = (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      textarea.value = initialValue;
      textarea.blur();
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      commit();
      textarea.blur();
    }
  };
  field.append(label, textarea);
  return field;
}

function createPane(title: string): HTMLElement {
  const pane = document.createElement('div');
  pane.className = 'branch-inline-pane';
  const heading = document.createElement('div');
  heading.className = 'branch-inline-pane-title';
  heading.textContent = title;
  pane.appendChild(heading);
  return pane;
}

function createActionButton(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-sm branch-inline-action';
  button.textContent = label;
  button.disabled = disabled;
  button.onclick = onClick;
  return button;
}

function createSegmentButton(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `branch-inline-segment${active ? ' is-active' : ''}`;
  button.textContent = label;
  button.onclick = onClick;
  return button;
}

function createEmpty(text: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'branch-inline-empty';
  empty.textContent = text;
  return empty;
}

function normalizeChannel(channel: 'pda' | 'f2f' | undefined, fallback: 'pda' | 'f2f'): 'pda' | 'f2f' {
  return channel === 'f2f' ? 'f2f' : channel === 'pda' ? 'pda' : fallback;
}

function openPanel(
  conversationId: number,
  turnNumber: number,
  choiceIndex: number | null,
  mode: BranchInlinePanelMode,
  selectedOutcomeIndex: number | null = null,
): void {
  store.openBranchInlinePanel({ conversationId, turnNumber, choiceIndex, mode, selectedOutcomeIndex });
}

function resolveCommandSelection(turn: Turn, choice: Choice | null, encodedIndex: number | null): CommandSelection | null {
  const entries = choice ? (choice.preconditions ?? []) : (turn.preconditions ?? []);
  if (encodedIndex != null && encodedIndex < 0) {
    const index = decodePreconditionIndex(encodedIndex);
    if (index >= 0 && index < entries.length) return { kind: 'precondition', index };
  }
  if (choice && encodedIndex != null && encodedIndex >= 0 && encodedIndex < choice.outcomes.length) {
    return { kind: 'outcome', index: encodedIndex };
  }
  if (choice && choice.outcomes.length > 0) return { kind: 'outcome', index: 0 };
  if (entries.length > 0) return { kind: 'precondition', index: 0 };
  return null;
}

function getInitialCommandSelection(turn: Turn, choice: Choice | null): number | null {
  if (choice && choice.outcomes.length > 0) return 0;
  const entries = choice ? (choice.preconditions ?? []) : (turn.preconditions ?? []);
  return entries.length > 0 ? encodePreconditionIndex(0) : null;
}

function getInitialCommandSelectionAfterDelete(lengthBeforeDelete: number, deletedIndex: number): number | null {
  const lengthAfterDelete = lengthBeforeDelete - 1;
  return lengthAfterDelete > 0 ? encodePreconditionIndex(Math.min(deletedIndex, lengthAfterDelete - 1)) : null;
}

function encodePreconditionIndex(index: number): number {
  return -index - 1;
}

function decodePreconditionIndex(encoded: number): number {
  return Math.abs(encoded) - 1;
}

function formatPreconditionLabel(entry: PreconditionEntry): string {
  if (entry.type === 'simple') {
    const schema = getAddablePreconditionSchemas('conversation').find((candidate) => candidate.name === entry.command);
    return schema?.label ?? entry.command;
  }
  if (entry.type === 'any') return 'Any group';
  if (entry.type === 'not') return 'Not condition';
  return 'Invalid condition';
}

function modeLabel(mode: BranchInlinePanelMode, choice: Choice | null): string {
  if (mode === 'outcomes') return choice ? 'Preconditions / Outcomes' : 'Preconditions';
  if (mode === 'continuation') return 'Continuation';
  return 'Dialogue Text';
}

function stepMatchesMode(label: string, mode: BranchInlinePanelMode): boolean {
  if (label === 'Dialogue Text') return mode === 'dialogue';
  if (label === 'Preconditions' || label === 'Preconditions / Outcomes') return mode === 'outcomes';
  if (label === 'Continuation') return mode === 'continuation';
  return false;
}
