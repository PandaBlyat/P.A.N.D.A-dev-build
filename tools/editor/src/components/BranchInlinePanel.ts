import { store, type BranchInlinePanelMode } from '../lib/state';
import type { Choice, Conversation, FactionId, Outcome, SimplePrecondition, Turn } from '../lib/types';
import { FACTION_DISPLAY_NAMES, getConversationFaction } from '../lib/types';
import { OUTCOME_SCHEMAS, groupByCategory, type CommandSchema } from '../lib/schema';
import { FACTION_IDS } from '../lib/constants';
import {
  getChoiceFieldKey,
  getOutcomeChanceFieldKey,
  getOutcomeItemFieldKey,
  getOutcomeParamFieldKey,
  getTurnFieldKey,
} from '../lib/validation';
import { requestFlowCenter } from '../lib/flow-navigation';
import { STORY_NPC_OPTIONS } from '../lib/generated/story-npc-catalog';
import {
  createCustomNpcBuilderEditor,
  createOptionPickerPanelEditor,
  createTurnPreconditionOwner,
  getAddablePreconditionSchemas,
  renderParamEditors,
  renderPlaceholderPicker,
  renderPreconditionList,
} from './CommandEditorFields';

type TurnLabels = {
  getLongLabel(turnNumber: number): string;
};

export function renderBranchInlinePanel(options: {
  conv: Conversation;
  turn: Turn;
  choice: Choice | null;
  mode: BranchInlinePanelMode;
  selectedOutcomeIndex: number | null;
  turnLabels: TurnLabels;
}): HTMLElement {
  const { conv, turn, choice, mode, selectedOutcomeIndex, turnLabels } = options;
  const panel = document.createElement('section');
  panel.className = `branch-inline-panel branch-inline-panel-${mode}`;
  panel.onclick = (event) => event.stopPropagation();
  panel.onpointerdown = (event) => event.stopPropagation();

  panel.appendChild(renderHeader(conv, turn, choice, mode, turnLabels));
  const body = document.createElement('div');
  body.className = 'branch-inline-panel-body';
  panel.appendChild(body);

  if (mode === 'opener') {
    renderOpenerPanel(body, conv, turn);
  } else if (!choice) {
    body.appendChild(createEmpty('Select player choice first.'));
  } else if (mode === 'outcomes') {
    renderOutcomesPanel(body, conv, turn, choice, selectedOutcomeIndex);
  } else if (mode === 'continuation') {
    renderContinuationPanel(body, conv, turn, choice, turnLabels);
  } else {
    renderChoicePanel(body, conv, turn, choice);
  }

  return panel;
}

function renderHeader(
  conv: Conversation,
  turn: Turn,
  choice: Choice | null,
  mode: BranchInlinePanelMode,
  turnLabels: TurnLabels,
): HTMLElement {
  const header = document.createElement('div');
  header.className = 'branch-inline-panel-header';

  const title = document.createElement('div');
  title.className = 'branch-inline-panel-title';
  const scope = choice ? `${turnLabels.getLongLabel(turn.turnNumber)} / Choice ${choice.index}` : turnLabels.getLongLabel(turn.turnNumber);
  title.textContent = `${scope} - ${modeLabel(mode)}`;

  const tabs = document.createElement('div');
  tabs.className = 'branch-inline-tabs';
  tabs.appendChild(createModeButton('Opener', mode === 'opener', () => openPanel(conv.id, turn.turnNumber, null, 'opener')));
  if (choice) {
    tabs.appendChild(createModeButton('Dialogue', mode === 'choice', () => openPanel(conv.id, turn.turnNumber, choice.index, 'choice')));
    tabs.appendChild(createModeButton(`Outcomes (${choice.outcomes.length})`, mode === 'outcomes', () => openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', getSelectedOutcomeIndex(choice))));
    tabs.appendChild(createModeButton('Continuation', mode === 'continuation', () => openPanel(conv.id, turn.turnNumber, choice.index, 'continuation')));
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-sm branch-inline-close';
  close.textContent = 'Close';
  close.onclick = () => store.closeBranchInlinePanel();

  header.append(title, tabs, close);
  return header;
}

function renderOpenerPanel(container: HTMLElement, conv: Conversation, turn: Turn): void {
  const grid = document.createElement('div');
  grid.className = 'branch-inline-grid branch-inline-grid-two';

  const textPane = createPane('NPC Opener');
  textPane.appendChild(createTextarea({
    label: 'Opening Message',
    value: turn.openingMessage ?? '',
    placeholder: 'NPC opening line for this branch',
    fieldKey: getTurnFieldKey(conv.id, turn.turnNumber, 'opening-message'),
    onCommit: (value) => store.updateTurn(conv.id, turn.turnNumber, { openingMessage: value }),
  }));
  textPane.appendChild(createChannelControls(conv, turn));

  const preconditionPane = createPane('Opener Preconditions');
  renderPreconditionAdder(preconditionPane, conv, turn);
  const entries = turn.preconditions ?? [];
  if (entries.length === 0) {
    preconditionPane.appendChild(createEmpty('No preconditions. Opener can run whenever story reaches branch.'));
  } else {
    renderPreconditionList(preconditionPane, createTurnPreconditionOwner(conv, turn));
  }

  grid.append(textPane, preconditionPane);
  container.appendChild(grid);
}

function renderChoicePanel(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice): void {
  const grid = document.createElement('div');
  grid.className = 'branch-inline-grid branch-inline-grid-two';

  const dialoguePane = createPane('Dialogue Text');
  dialoguePane.appendChild(createTextarea({
    label: 'Player Dialogue Choice',
    value: choice.text,
    placeholder: 'Player choice text',
    fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'text'),
    onCommit: (value) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { text: value }),
  }));
  dialoguePane.appendChild(createTextarea({
    label: 'NPC Reply',
    value: choice.reply,
    placeholder: 'NPC response after player picks this choice',
    fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply'),
    onCommit: (value) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { reply: value }),
  }));

  const placeholderPane = createPane('Dynamic Placeholders');
  renderPlaceholderPicker(placeholderPane, `branch-inline-${conv.id}-${turn.turnNumber}-${choice.index}-placeholders`);

  const actionRow = document.createElement('div');
  actionRow.className = 'branch-inline-action-row';
  actionRow.append(
    createActionButton(`Outcomes (${choice.outcomes.length})`, () => openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', getSelectedOutcomeIndex(choice))),
    createActionButton('Continuation', () => openPanel(conv.id, turn.turnNumber, choice.index, 'continuation')),
  );
  placeholderPane.appendChild(actionRow);

  grid.append(dialoguePane, placeholderPane);
  container.appendChild(grid);
}

function renderOutcomesPanel(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice, selectedOutcomeIndex: number | null): void {
  const selectedIndex = isValidOutcomeIndex(choice, selectedOutcomeIndex) ? selectedOutcomeIndex! : (choice.outcomes.length > 0 ? 0 : null);
  const grid = document.createElement('div');
  grid.className = 'branch-inline-grid branch-inline-grid-outcomes';

  const listPane = createPane('Outcome List');
  renderOutcomeSearch(listPane, conv, turn, choice);
  renderCurrentOutcomeList(listPane, conv, turn, choice, selectedIndex);

  const detailPane = createPane('Outcome Details');
  if (selectedIndex == null) {
    detailPane.appendChild(createEmpty('Pick outcome from list to add it, then edit properties here.'));
  } else {
    renderOutcomeDetails(detailPane, conv, turn, choice, selectedIndex);
  }

  grid.append(listPane, detailPane);
  container.appendChild(grid);
}

function renderContinuationPanel(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice, turnLabels: TurnLabels): void {
  const grid = document.createElement('div');
  grid.className = 'branch-inline-grid branch-inline-grid-two';

  const pathPane = createPane('How Dialogue Continues');
  const currentChannel = normalizeChannel(choice.continueChannel ?? choice.continue_channel, normalizeChannel(turn.channel, normalizeChannel(conv.initialChannel, 'pda')));
  const channelRow = document.createElement('div');
  channelRow.className = 'branch-inline-segmented';
  channelRow.append(
    createSegmentButton('PDA', currentChannel === 'pda', () => ensureContinuation(conv, turn, choice, 'pda')),
    createSegmentButton('F2F', currentChannel === 'f2f', () => ensureContinuation(conv, turn, choice, 'f2f')),
  );
  pathPane.appendChild(channelRow);

  const linkRow = document.createElement('div');
  linkRow.className = 'branch-inline-action-row';
  linkRow.append(
    createActionButton('Create New Branch', () => {
      const created = store.ensureChoiceContinuationTurn(conv.id, turn.turnNumber, choice.index, currentChannel);
      if (created != null) requestFlowCenter({ conversationId: conv.id, turnNumber: created });
    }),
    createActionButton('End Here', () => store.clearChoiceContinuation(conv.id, turn.turnNumber, choice.index), choice.continueTo == null),
  );
  pathPane.appendChild(linkRow);
  pathPane.appendChild(renderExistingBranchLinks(conv, turn, choice, turnLabels));

  const npcPane = createPane('Who Continues It');
  const sameNpcActive = !choice.cont_npc_id && !choice.allow_generic_stalker && (choice.npc_faction_filters?.length ?? 0) === 0;
  const npcMode = document.createElement('div');
  npcMode.className = 'branch-inline-segmented';
  npcMode.append(
    createSegmentButton('Same NPC', sameNpcActive, () => store.updateChoice(conv.id, turn.turnNumber, choice.index, {
      cont_npc_id: undefined,
      npc_faction_filters: undefined,
      npc_profile_filters: undefined,
      allow_generic_stalker: false,
    })),
    createSegmentButton('New NPC', !sameNpcActive, () => undefined),
  );
  npcPane.appendChild(npcMode);
  renderNpcContinuationOptions(npcPane, conv, turn, choice);

  grid.append(pathPane, npcPane);
  container.appendChild(grid);
}

function renderPreconditionAdder(container: HTMLElement, conv: Conversation, turn: Turn): void {
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'branch-inline-search';
  search.placeholder = 'Search opener preconditions...';
  const results = document.createElement('div');
  results.className = 'branch-inline-command-results';

  const render = (): void => {
    const query = search.value.trim().toLowerCase();
    results.replaceChildren();
    const schemas = getAddablePreconditionSchemas('turn').filter((schema) => commandMatches(schema, query)).slice(0, 18);
    if (schemas.length === 0) {
      results.appendChild(createEmpty('No matching preconditions.'));
      return;
    }
    for (const schema of schemas) {
      results.appendChild(createSchemaButton(schema, () => {
        const entry: SimplePrecondition = {
          type: 'simple',
          command: schema.name,
          params: schema.params.map((param) => param.placeholder || ''),
        };
        store.updateTurn(conv.id, turn.turnNumber, {
          preconditions: [...(turn.preconditions ?? []), entry],
        });
      }));
    }
  };
  search.oninput = render;
  render();
  container.append(search, results);
}

function renderOutcomeSearch(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice): void {
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'branch-inline-search';
  search.placeholder = 'Search outcomes...';

  const results = document.createElement('div');
  results.className = 'branch-inline-schema-groups';

  const render = (): void => {
    const query = search.value.trim().toLowerCase();
    results.replaceChildren();
    const schemas = OUTCOME_SCHEMAS.filter((schema) => commandMatches(schema, query));
    if (schemas.length === 0) {
      results.appendChild(createEmpty('No matching outcomes.'));
      return;
    }
    for (const [category, group] of groupByCategory(schemas)) {
      const section = document.createElement('section');
      section.className = 'branch-inline-schema-group';
      const heading = document.createElement('div');
      heading.className = 'branch-inline-schema-group-title';
      heading.textContent = category;
      section.appendChild(heading);
      for (const schema of group) {
        section.appendChild(createSchemaButton(schema, () => {
          const outcome: Outcome = {
            command: schema.name,
            params: schema.params.map((param) => param.placeholder || ''),
          };
          const nextIndex = choice.outcomes.length;
          store.batch(() => {
            store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: [...choice.outcomes, outcome] });
            openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', nextIndex);
          });
        }));
      }
      results.appendChild(section);
    }
  };
  search.oninput = render;
  render();
  container.append(search, results);
}

function renderCurrentOutcomeList(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice, selectedIndex: number | null): void {
  const wrap = document.createElement('div');
  wrap.className = 'branch-inline-current-outcomes';
  const title = document.createElement('div');
  title.className = 'branch-inline-subtitle';
  title.textContent = 'Current Outcomes';
  wrap.appendChild(title);

  if (choice.outcomes.length === 0) {
    wrap.appendChild(createEmpty('No outcomes on this choice.'));
    container.appendChild(wrap);
    return;
  }

  choice.outcomes.forEach((outcome, index) => {
    const schema = OUTCOME_SCHEMAS.find((candidate) => candidate.name === outcome.command);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `branch-inline-current-outcome${index === selectedIndex ? ' is-active' : ''}`;
    row.setAttribute('data-field-key', getOutcomeItemFieldKey(conv.id, turn.turnNumber, choice.index, index));
    row.textContent = `${index + 1}. ${schema?.label ?? outcome.command}`;
    row.onclick = () => openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', index);
    wrap.appendChild(row);
  });
  container.appendChild(wrap);
}

function renderOutcomeDetails(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice, outcomeIndex: number): void {
  const outcome = choice.outcomes[outcomeIndex];
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
    }),
  );
  container.appendChild(actions);
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
  const options = document.createElement('div');
  options.className = 'branch-inline-npc-options';

  const storyField = document.createElement('div');
  storyField.className = 'branch-inline-field-block';
  const storyLabel = document.createElement('div');
  storyLabel.className = 'branch-inline-subtitle';
  storyLabel.textContent = 'Story NPC';
  const storyPicker = createOptionPickerPanelEditor(
    choice.cont_npc_id?.startsWith('npc:') ? '' : (choice.cont_npc_id ?? ''),
    (value) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { cont_npc_id: value.trim() || undefined }),
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

  const customField = document.createElement('div');
  customField.className = 'branch-inline-field-block';
  const customLabel = document.createElement('div');
  customLabel.className = 'branch-inline-subtitle';
  customLabel.textContent = 'Custom NPC';
  const currentTemplate = choice.cont_npc_id?.startsWith('npc:') ? choice.cont_npc_id.slice(4) : '';
  const customEditor = createCustomNpcBuilderEditor(
    currentTemplate,
    (templateId) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { cont_npc_id: templateId ? `npc:${templateId}` : undefined }),
    `${getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'cont-npc-id')}-custom`,
    { showSpawnDistance: true },
  );
  customField.append(customLabel, customEditor);
  options.appendChild(customField);

  const simField = document.createElement('div');
  simField.className = 'branch-inline-field-block';
  const simTitle = document.createElement('div');
  simTitle.className = 'branch-inline-subtitle';
  simTitle.textContent = 'Friendly Faction Sim NPC';
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

function createSchemaButton(schema: CommandSchema, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'branch-inline-schema-option';
  const strong = document.createElement('strong');
  strong.textContent = schema.label;
  const span = document.createElement('span');
  span.textContent = schema.description;
  button.append(strong, span);
  button.onclick = onClick;
  return button;
}

function createModeButton(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `branch-inline-tab${active ? ' is-active' : ''}`;
  button.textContent = label;
  button.disabled = active;
  button.onclick = onClick;
  return button;
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

function commandMatches(schema: CommandSchema, query: string): boolean {
  if (!query) return true;
  return `${schema.label} ${schema.name} ${schema.description} ${schema.category}`.toLowerCase().includes(query);
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

function getSelectedOutcomeIndex(choice: Choice): number | null {
  return choice.outcomes.length > 0 ? 0 : null;
}

function isValidOutcomeIndex(choice: Choice, index: number | null): boolean {
  return index != null && index >= 0 && index < choice.outcomes.length;
}

function modeLabel(mode: BranchInlinePanelMode): string {
  if (mode === 'opener') return 'NPC Opener';
  if (mode === 'outcomes') return 'Outcomes';
  if (mode === 'continuation') return 'Continuation';
  return 'Dialogue';
}
