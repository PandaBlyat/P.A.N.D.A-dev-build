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
import { createSmartTerrainPickerEditor } from './CatalogPickerPanel';
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
type OpenerNpcMode = 'friendly_faction' | 'story_npc' | 'custom_npc';
type BranchNpcMode = 'same' | 'sim' | 'story' | 'custom';
type OpenerNpcTarget = {
  mode: OpenerNpcMode;
  faction: FactionId;
  storyNpcId: string;
  customNpcTemplateId: string;
  customNpcSmartTerrain: string;
};
type BranchNpcTarget = {
  mode: BranchNpcMode;
  faction: FactionId;
  storyNpcId: string;
  customNpcTemplateId: string;
};

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
  const safeMode: BranchInlinePanelMode = !choice && (mode === 'outcomes' || mode === 'continuation') ? 'preconditions' : mode;
  const panel = document.createElement('section');
  panel.className = `branch-inline-panel branch-inline-panel-${safeMode}${choice ? ' is-choice-scope' : ' is-opener-scope'}`;
  panel.onclick = (event) => event.stopPropagation();
  panel.onpointerdown = (event) => event.stopPropagation();
  panel.onwheel = (event) => event.stopPropagation();

  panel.appendChild(renderHeader(conv, turn, choice, safeMode, turnLabels, onClose, panel));
  const workspace = document.createElement('div');
  workspace.className = 'branch-inline-workspace';
  workspace.appendChild(renderSidebar(conv, turn, choice, safeMode));

  const body = document.createElement('div');
  body.className = 'branch-inline-panel-body';
  workspace.appendChild(body);
  panel.appendChild(workspace);

  if (safeMode === 'dialogue') {
    renderDialoguePanel(body, conv, turn, choice);
  } else if (safeMode === 'preconditions') {
    renderPreconditionsPanel(body, conv, turn, choice, selectedOutcomeIndex);
  } else if (safeMode === 'outcomes') {
    renderOutcomesPanel(body, conv, turn, choice, selectedOutcomeIndex);
  } else if (choice) {
    renderContinuationPanel(body, conv, turn, choice, turnLabels);
  } else {
    body.appendChild(createEmpty('Pick player choice before continuation.'));
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
  panel?: HTMLElement,
): HTMLElement {
  const header = document.createElement('div');
  header.className = 'branch-inline-panel-header';

  const title = document.createElement('div');
  title.className = 'branch-inline-panel-title';
  const scope = choice ? `${turnLabels.getLongLabel(turn.turnNumber)} / Choice ${choice.index}` : turnLabels.getLongLabel(turn.turnNumber);
  title.textContent = `${scope} - ${modeLabel(mode, choice)}`;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-sm branch-inline-close';
  close.textContent = 'Close';
  close.setAttribute('aria-label', 'Close branch editor');
  const closePanel = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    flushBranchInlineEdits(panel ?? header.closest('.branch-inline-panel') ?? header);
    if (onClose) {
      onClose();
    } else {
      store.closeBranchInlinePanel();
    }
    requestAnimationFrame(() => store.closeBranchInlinePanel());
  };
  close.addEventListener('pointerdown', closePanel, true);
  close.addEventListener('pointerup', closePanel, true);
  close.addEventListener('click', closePanel, true);

  header.append(title, close);
  return header;
}

function renderSidebar(conv: Conversation, turn: Turn, choice: Choice | null, mode: BranchInlinePanelMode): HTMLElement {
  const sidebar = document.createElement('nav');
  sidebar.className = 'branch-inline-sidebar';
  sidebar.setAttribute('aria-label', 'Branch editor sections');
  const tabs: Array<{ mode: BranchInlinePanelMode; label: string; count?: number }> = choice
    ? [
      { mode: 'dialogue', label: 'Dialogue' },
      { mode: 'preconditions', label: 'Preconditions', count: choice.preconditions?.length ?? 0 },
      { mode: 'outcomes', label: 'Outcomes', count: choice.outcomes.length },
      { mode: 'continuation', label: 'Continuation' },
    ]
    : [
      { mode: 'dialogue', label: 'Dialogue' },
      { mode: 'preconditions', label: 'Preconditions', count: turn.preconditions.length },
    ];

  for (const tabInfo of tabs) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `branch-inline-sidebar-tab${mode === tabInfo.mode ? ' is-active' : ''}`;
    tab.disabled = mode === tabInfo.mode;
    tab.onclick = () => {
      const initialSelection = tabInfo.mode === 'preconditions'
        ? getInitialPreconditionSelection(turn, choice)
        : tabInfo.mode === 'outcomes'
        ? getInitialOutcomeSelection(choice)
        : null;
      openPanel(conv.id, turn.turnNumber, choice?.index ?? null, tabInfo.mode, initialSelection);
    };
    const label = document.createElement('span');
    label.textContent = tabInfo.label;
    tab.appendChild(label);
    if (tabInfo.count != null) {
      const badge = document.createElement('strong');
      badge.textContent = String(tabInfo.count);
      tab.appendChild(badge);
    }
    sidebar.appendChild(tab);
  }
  return sidebar;
}

function flushBranchInlineEdits(root: Element): void {
  root.querySelectorAll('textarea').forEach((textarea) => {
    textarea.dispatchEvent(new Event('branch-inline-commit'));
  });
  if (document.activeElement instanceof HTMLElement && root.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  store.flushPendingTextEdits();
}

function renderDialoguePanel(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice | null): void {
  const grid = document.createElement('div');
  grid.className = 'branch-inline-grid branch-inline-grid-two';

  const textPane = createPane(choice ? 'Dialogue Text' : 'NPC Opener');
  textPane.appendChild(createHint(choice
    ? 'Player Choice Text is what player clicks. NPC Reply is response shown after that choice.'
    : 'NPC Opener starts this branch. PDA means distant message flow; F2F means face-to-face NPC dialogue.',
  ));
  if (!choice) {
    textPane.appendChild(createTextarea({
      label: 'NPC Opener Message',
      value: turn.openingMessage ?? '',
      placeholder: 'NPC opening line for this branch',
      fieldKey: getTurnFieldKey(conv.id, turn.turnNumber, 'opening-message'),
      onCommit: (value) => store.updateTurn(conv.id, turn.turnNumber, { openingMessage: value }),
    }));
    textPane.appendChild(createTextInput({
      label: 'Opener DDS Image',
      value: turn.openingImage ?? '',
      placeholder: 'panda_file',
      fieldKey: getTurnFieldKey(conv.id, turn.turnNumber, 'opening-image'),
      onCommit: (value) => store.updateTurn(conv.id, turn.turnNumber, { openingImage: value.trim() || undefined }),
    }));
    textPane.appendChild(createChannelControls(conv, turn));
    if (turn.turnNumber === 1) {
      textPane.appendChild(renderOpenerNpcTargetPanel(conv));
    } else {
      textPane.appendChild(renderBranchNpcTargetPanel(conv, turn));
    }
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
    textPane.appendChild(createTextInput({
      label: 'NPC Reply DDS Image',
      value: choice.replyImage ?? '',
      placeholder: 'panda_file',
      description: 'file name for dds image inside textures/ui',
      fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply-image'),
      onCommit: (value) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyImage: value.trim() || undefined }),
    }));
  }

  const placeholderPane = createPane('Dynamic Placeholder List');
  renderPlaceholderPicker(placeholderPane, `branch-inline-${conv.id}-${turn.turnNumber}-${choice?.index ?? 'opener'}-placeholders`, { defaultCollapsed: true });

  const actionRow = document.createElement('div');
  actionRow.className = 'branch-inline-action-row branch-inline-stage-row';
  actionRow.append(createActionButton(`Preconditions (${choice ? (choice.preconditions?.length ?? 0) : turn.preconditions.length})`, () => {
    openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'preconditions', getInitialPreconditionSelection(turn, choice));
  }));
  if (choice) {
    actionRow.append(createActionButton(`Outcomes (${choice.outcomes.length})`, () => {
      openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', getInitialOutcomeSelection(choice));
    }));
  }
  placeholderPane.appendChild(actionRow);

  grid.append(textPane, placeholderPane);
  container.appendChild(grid);
}

const OPENER_NPC_TARGET_COMMANDS = new Set([
  'req_npc_friendly',
  'req_npc_faction',
  'req_story_npc',
  'req_custom_story_npc',
]);

function renderOpenerNpcTargetPanel(conv: Conversation): HTMLElement {
  const target = inferOpenerNpcTarget(conv);
  const field = document.createElement('div');
  field.className = 'branch-inline-field-block branch-inline-opener-target';

  const label = document.createElement('div');
  label.className = 'branch-inline-subtitle';
  label.textContent = 'First Branch NPC';

  const modeRow = document.createElement('div');
  modeRow.className = 'branch-inline-npc-mode-row';
  modeRow.append(
    createSegmentButton('Any Friendly x Faction', target.mode === 'friendly_faction', () => updateOpenerNpcTarget(conv, {
      ...target,
      mode: 'friendly_faction',
    })),
    createSegmentButton('Story NPC', target.mode === 'story_npc', () => updateOpenerNpcTarget(conv, {
      ...target,
      mode: 'story_npc',
    })),
    createSegmentButton('Custom NPC', target.mode === 'custom_npc', () => updateOpenerNpcTarget(conv, {
      ...target,
      mode: 'custom_npc',
    })),
  );
  field.append(label, modeRow);

  if (target.mode === 'friendly_faction') {
    const factionSelect = document.createElement('select');
    for (const factionId of FACTION_IDS) {
      const option = document.createElement('option');
      option.value = factionId;
      option.textContent = FACTION_DISPLAY_NAMES[factionId];
      option.selected = target.faction === factionId;
      factionSelect.appendChild(option);
    }
    factionSelect.onchange = () => updateOpenerNpcTarget(conv, {
      ...target,
      mode: 'friendly_faction',
      faction: factionSelect.value as FactionId,
    });
    field.appendChild(factionSelect);
    return field;
  }

  if (target.mode === 'story_npc') {
    field.appendChild(createOptionPickerPanelEditor(
      target.storyNpcId,
      (storyNpcId) => updateOpenerNpcTarget(conv, {
        ...target,
        mode: 'story_npc',
        storyNpcId: storyNpcId.trim() || 'bar_visitors_barman_stalker_trader',
      }),
      `branch-inline-opener-${conv.id}-story-npc`,
      {
        title: 'First Branch Story NPC',
        subtitle: 'Pick existing story NPC who starts this storyline.',
        searchPlaceholder: 'Search story NPC id, faction, level, or role...',
        emptyLabel: 'Pick story NPC',
        options: STORY_NPC_OPTIONS,
      },
    ));
    return field;
  }

  field.appendChild(createCustomNpcBuilderEditor(
    target.customNpcTemplateId,
    (customNpcTemplateId) => updateOpenerNpcTarget(conv, {
      ...target,
      mode: 'custom_npc',
      customNpcTemplateId,
    }),
    `branch-inline-opener-${conv.id}-custom-npc`,
    { showSpawnDistance: false },
  ));
  const terrainLabel = document.createElement('div');
  terrainLabel.className = 'branch-inline-subtitle';
  terrainLabel.textContent = 'Spawn smart terrain';
  field.append(
    terrainLabel,
    createSmartTerrainPickerEditor(
      target.customNpcSmartTerrain,
      (customNpcSmartTerrain) => updateOpenerNpcTarget(conv, {
        ...target,
        mode: 'custom_npc',
        customNpcSmartTerrain,
      }),
      `branch-inline-opener-${conv.id}-custom-terrain`,
      { allowPlaceholder: true },
    ),
  );
  return field;
}

function inferOpenerNpcTarget(conv: Conversation): OpenerNpcTarget {
  const entries = conv.preconditions ?? [];
  const faction = getSimpleRuleParam(entries, 'req_npc_faction') as FactionId | null;
  const storyNpcId = getSimpleRuleParam(entries, 'req_story_npc');
  const customRule = entries.find((entry): entry is SimplePrecondition => entry.type === 'simple' && entry.command === 'req_custom_story_npc');
  const fallbackFaction = faction && FACTION_IDS.includes(faction) ? faction : getConversationFaction(conv);
  const base = {
    faction: fallbackFaction,
    storyNpcId: storyNpcId || 'bar_visitors_barman_stalker_trader',
    customNpcTemplateId: customRule?.params[0] || 'informant',
    customNpcSmartTerrain: customRule?.params[1] || '%cordon_panda_st_key%',
  };
  if (customRule) return { ...base, mode: 'custom_npc' };
  if (storyNpcId) return { ...base, mode: 'story_npc' };
  return { ...base, mode: 'friendly_faction' };
}

function updateOpenerNpcTarget(conv: Conversation, target: OpenerNpcTarget): void {
  const kept = (conv.preconditions ?? []).filter((entry) => {
    return !(entry.type === 'simple' && OPENER_NPC_TARGET_COMMANDS.has(entry.command));
  });
  const next: PreconditionEntry[] = [...kept];
  if (target.mode === 'story_npc') {
    next.push({ type: 'simple', command: 'req_story_npc', params: [target.storyNpcId || 'bar_visitors_barman_stalker_trader'] });
  } else if (target.mode === 'custom_npc') {
    next.push({
      type: 'simple',
      command: 'req_custom_story_npc',
      params: [target.customNpcTemplateId || 'informant', target.customNpcSmartTerrain || '%cordon_panda_st_key%'],
    });
  } else {
    next.push({ type: 'simple', command: 'req_npc_friendly', params: [] });
    next.push({ type: 'simple', command: 'req_npc_faction', params: [target.faction || getConversationFaction(conv)] });
  }
  store.updateConversation(conv.id, { preconditions: next });
}

function renderBranchNpcTargetPanel(conv: Conversation, turn: Turn): HTMLElement {
  const target = inferBranchNpcTarget(conv, turn);
  const field = document.createElement('div');
  field.className = 'branch-inline-field-block branch-inline-opener-target';

  const label = document.createElement('div');
  label.className = 'branch-inline-subtitle';
  label.textContent = 'Branch NPC';

  const modeRow = document.createElement('div');
  modeRow.className = 'branch-inline-npc-mode-row';
  modeRow.append(
    createSegmentButton('Same NPC', target.mode === 'same', () => updateBranchNpcTarget(conv, turn, { ...target, mode: 'same' })),
    createSegmentButton('Any Sim x Faction NPC', target.mode === 'sim', () => updateBranchNpcTarget(conv, turn, { ...target, mode: 'sim' })),
    createSegmentButton('Story NPC', target.mode === 'story', () => updateBranchNpcTarget(conv, turn, { ...target, mode: 'story' })),
    createSegmentButton('Custom NPC', target.mode === 'custom', () => updateBranchNpcTarget(conv, turn, { ...target, mode: 'custom' })),
  );
  field.append(label, modeRow);

  if (target.mode === 'same') {
    field.appendChild(createEmpty('Previous NPC delivers this branch.'));
    return field;
  }

  if (target.mode === 'sim') {
    const factionSelect = document.createElement('select');
    for (const factionId of FACTION_IDS) {
      const option = document.createElement('option');
      option.value = factionId;
      option.textContent = FACTION_DISPLAY_NAMES[factionId];
      option.selected = target.faction === factionId;
      factionSelect.appendChild(option);
    }
    factionSelect.onchange = () => updateBranchNpcTarget(conv, turn, {
      ...target,
      mode: 'sim',
      faction: factionSelect.value as FactionId,
    });
    field.appendChild(factionSelect);
    return field;
  }

  if (target.mode === 'story') {
    field.appendChild(createOptionPickerPanelEditor(
      target.storyNpcId,
      (storyNpcId) => updateBranchNpcTarget(conv, turn, {
        ...target,
        mode: 'story',
        storyNpcId: storyNpcId.trim() || 'bar_visitors_barman_stalker_trader',
      }),
      `branch-inline-branch-${conv.id}-${turn.turnNumber}-story-npc`,
      {
        title: 'Branch Story NPC',
        subtitle: 'Pick existing story NPC who delivers this branch.',
        searchPlaceholder: 'Search story NPC id, faction, level, or role...',
        emptyLabel: 'Same NPC',
        options: STORY_NPC_OPTIONS,
      },
    ));
    return field;
  }

  field.appendChild(createCustomNpcBuilderEditor(
    target.customNpcTemplateId,
    (customNpcTemplateId) => updateBranchNpcTarget(conv, turn, {
      ...target,
      mode: 'custom',
      customNpcTemplateId,
    }),
    `branch-inline-branch-${conv.id}-${turn.turnNumber}-custom-npc`,
    { showSpawnDistance: false },
  ));
  return field;
}

function inferBranchNpcTarget(conv: Conversation, turn: Turn): BranchNpcTarget {
  const fallbackFaction = turn.speaker_npc_faction_filters?.[0] ?? getConversationFaction(conv);
  const base = {
    faction: fallbackFaction,
    storyNpcId: turn.speaker_npc_id?.startsWith('npc:') ? 'bar_visitors_barman_stalker_trader' : (turn.speaker_npc_id ?? 'bar_visitors_barman_stalker_trader'),
    customNpcTemplateId: turn.speaker_npc_id?.startsWith('npc:') ? turn.speaker_npc_id.slice(4) : 'informant',
  };
  if (turn.speaker_allow_generic_stalker || (turn.speaker_npc_faction_filters?.length ?? 0) > 0) {
    return { ...base, mode: 'sim' };
  }
  if (turn.speaker_npc_id?.startsWith('npc:')) return { ...base, mode: 'custom' };
  if (turn.speaker_npc_id) return { ...base, mode: 'story' };
  return { ...base, mode: 'same' };
}

function updateBranchNpcTarget(conv: Conversation, turn: Turn, target: BranchNpcTarget): void {
  if (target.mode === 'same') {
    store.updateTurn(conv.id, turn.turnNumber, {
      speaker_npc_id: undefined,
      speaker_npc_faction_filters: undefined,
      speaker_allow_generic_stalker: false,
    });
    return;
  }
  if (target.mode === 'sim') {
    store.updateTurn(conv.id, turn.turnNumber, {
      speaker_npc_id: undefined,
      speaker_npc_faction_filters: [target.faction || getConversationFaction(conv)],
      speaker_allow_generic_stalker: true,
    });
    return;
  }
  if (target.mode === 'custom') {
    store.updateTurn(conv.id, turn.turnNumber, {
      speaker_npc_id: target.customNpcTemplateId ? `npc:${target.customNpcTemplateId}` : undefined,
      speaker_npc_faction_filters: undefined,
      speaker_allow_generic_stalker: false,
    });
    return;
  }
  store.updateTurn(conv.id, turn.turnNumber, {
    speaker_npc_id: target.storyNpcId || 'bar_visitors_barman_stalker_trader',
    speaker_npc_faction_filters: undefined,
    speaker_allow_generic_stalker: false,
  });
}

function getSimpleRuleParam(entries: PreconditionEntry[], command: string, paramIndex = 0): string | null {
  const rule = entries.find((entry): entry is SimplePrecondition => entry.type === 'simple' && entry.command === command);
  return rule?.params[paramIndex]?.trim() || null;
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
  listPane.appendChild(createHint(choice
    ? 'Preconditions gate whether player can see this choice. Outcomes run after player picks it.'
    : 'Opener preconditions gate whether this branch can start.',
  ));
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

function renderPreconditionsPanel(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  choice: Choice | null,
  selectedOutcomeIndex: number | null,
): void {
  const selection = resolvePreconditionSelection(turn, choice, selectedOutcomeIndex);
  const grid = document.createElement('div');
  grid.className = 'branch-inline-grid branch-inline-grid-preconditions';

  const listPane = createPane(choice ? 'Choice Preconditions' : 'Opener Preconditions');
  listPane.appendChild(createHint(choice
    ? 'Preconditions are required checks. If any check fails, this choice stays hidden.'
    : 'Opener preconditions are required checks before this branch can begin.',
  ));
  renderPreconditionAddControls(listPane, conv, turn, choice);
  renderCurrentPreconditionList(listPane, conv, turn, choice, selection);

  const detailPane = createPane('Details / Properties');
  if (selection == null) {
    detailPane.appendChild(createEmpty(choice ? 'Pick or add precondition to edit properties here.' : 'Pick or add opener precondition to edit properties here.'));
  } else {
    renderPreconditionDetails(detailPane, conv, turn, choice, selection);
  }

  grid.append(listPane, detailPane);
  container.appendChild(grid);
}

function renderOutcomesPanel(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  choice: Choice | null,
  selectedOutcomeIndex: number | null,
): void {
  if (!choice) {
    container.appendChild(createEmpty('Outcomes belong to player choices.'));
    return;
  }

  const selection = resolveOutcomeSelection(choice, selectedOutcomeIndex);
  const grid = document.createElement('div');
  grid.className = 'branch-inline-grid branch-inline-grid-outcomes';

  const listPane = createPane('Choice Outcomes');
  listPane.appendChild(createHint('Outcomes are effects after player picks this choice: money, items, reputation, tasks, spawns, teleport, and similar changes.'));
  renderOutcomeAddControls(listPane, conv, turn, choice);
  renderCurrentOutcomeList(listPane, conv, turn, choice, selection);

  const detailPane = createPane('Details / Properties');
  if (selection == null) {
    detailPane.appendChild(createEmpty('Pick or add outcome to edit properties here.'));
  } else {
    renderOutcomeDetails(detailPane, conv, turn, choice, selection);
  }
  const continueRow = document.createElement('div');
  continueRow.className = 'branch-inline-action-row branch-inline-next-row';
  continueRow.appendChild(createActionButton('Continuation', () => openPanel(conv.id, turn.turnNumber, choice.index, 'continuation')));
  detailPane.appendChild(continueRow);

  grid.append(listPane, detailPane);
  container.appendChild(grid);
}

function renderContinuationPanel(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice, turnLabels: TurnLabels): void {
  const grid = document.createElement('div');
  grid.className = 'branch-inline-grid branch-inline-grid-continuation';

  const pathPane = createPane('How Does This Dialogue Continue?');
  pathPane.appendChild(createHint('Pick PDA to continue through distant messages. Pick F2F to continue through face-to-face NPC dialogue.'));
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
  npcPane.appendChild(createHint('Same NPC keeps current speaker. New NPC hands next branch to story NPC, custom spawned NPC, or any matching sim NPC.'));
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

function renderPreconditionAddControls(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice | null): void {
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
  container.appendChild(controls);
}

function renderOutcomeAddControls(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice): void {
  const controls = document.createElement('div');
  controls.className = 'branch-inline-picker-actions';
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
  container.appendChild(controls);
}

function renderCurrentPreconditionList(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  choice: Choice | null,
  selectedIndex: number | null,
): void {
  const wrap = document.createElement('div');
  wrap.className = 'branch-inline-current-outcomes';
  const title = document.createElement('div');
  title.className = 'branch-inline-subtitle';
  title.textContent = 'Current Preconditions';
  wrap.appendChild(title);

  const entries = choice ? (choice.preconditions ?? []) : (turn.preconditions ?? []);
  if (entries.length === 0) {
    wrap.appendChild(createEmpty(choice ? 'No preconditions on this choice.' : 'No opener preconditions.'));
    container.appendChild(wrap);
    return;
  }

  entries.forEach((entry, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `branch-inline-current-outcome${selectedIndex === index ? ' is-active' : ''}`;
    row.setAttribute('data-field-key', choice
      ? getChoicePreconditionItemFieldKey(conv.id, turn.turnNumber, choice.index, index)
      : getTurnPreconditionItemFieldKey(conv.id, turn.turnNumber, index));
    row.textContent = `${index + 1}. ${formatPreconditionLabel(entry)}`;
    row.onclick = () => openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'preconditions', encodePreconditionIndex(index));
    wrap.appendChild(row);
  });
  container.appendChild(wrap);
}

function renderCurrentOutcomeList(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  choice: Choice,
  selectedIndex: number | null,
): void {
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
    row.className = `branch-inline-current-outcome${selectedIndex === index ? ' is-active' : ''}`;
    row.setAttribute('data-field-key', getOutcomeItemFieldKey(conv.id, turn.turnNumber, choice.index, index));
    row.textContent = `${index + 1}. ${schema?.label ?? outcome.command}`;
    row.onclick = () => openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', index);
    wrap.appendChild(row);
  });
  container.appendChild(wrap);
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
      openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'preconditions', getInitialCommandSelectionAfterDelete(entries.length, preconditionIndex));
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
      openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', next.length > 0 ? Math.min(outcomeIndex, next.length - 1) : null);
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
    openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'preconditions', encodePreconditionIndex(nextIndex));
  });
}

function addOutcomeEntry(conv: Conversation, turn: Turn, choice: Choice, schema: CommandSchema): void {
  const outcome: Outcome = {
    command: schema.name,
    params: schema.params.map((param) => param.placeholder || ''),
  };
  const nextIndex = store.appendOutcomeToChoice(conv.id, turn.turnNumber, choice.index, outcome);
  if (nextIndex != null) {
    openPanel(conv.id, turn.turnNumber, choice.index, 'outcomes', nextIndex);
  }
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
    openPanel(conv.id, turn.turnNumber, choice?.index ?? null, 'preconditions', encodePreconditionIndex(nextIndex));
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
  textarea.addEventListener('branch-inline-commit', commit);
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

function createTextInput(options: {
  label: string;
  value: string;
  placeholder: string;
  description?: string;
  fieldKey: string;
  onCommit: (value: string) => void;
}): HTMLElement {
  const field = document.createElement('label');
  field.className = 'branch-inline-field';
  const label = document.createElement('span');
  label.textContent = options.label;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = options.value;
  input.placeholder = options.placeholder;
  input.setAttribute('data-field-key', options.fieldKey);
  const commit = (): void => options.onCommit(input.value);
  input.onchange = commit;
  input.onblur = commit;
  field.append(label, input);
  if (options.description) {
    field.appendChild(createHint(options.description));
  }
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

function createHint(text: string): HTMLElement {
  const hint = document.createElement('div');
  hint.className = 'branch-inline-hint';
  hint.textContent = text;
  return hint;
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

function resolvePreconditionSelection(turn: Turn, choice: Choice | null, encodedIndex: number | null): number | null {
  const entries = choice ? (choice.preconditions ?? []) : (turn.preconditions ?? []);
  if (entries.length === 0) return null;
  if (encodedIndex != null && encodedIndex < 0) {
    const index = decodePreconditionIndex(encodedIndex);
    if (index >= 0 && index < entries.length) return index;
  }
  return 0;
}

function resolveOutcomeSelection(choice: Choice, encodedIndex: number | null): number | null {
  if (choice.outcomes.length === 0) return null;
  if (encodedIndex != null && encodedIndex >= 0 && encodedIndex < choice.outcomes.length) return encodedIndex;
  return 0;
}

function getInitialCommandSelection(turn: Turn, choice: Choice | null): number | null {
  if (choice && choice.outcomes.length > 0) return 0;
  const entries = choice ? (choice.preconditions ?? []) : (turn.preconditions ?? []);
  return entries.length > 0 ? encodePreconditionIndex(0) : null;
}

function getInitialPreconditionSelection(turn: Turn, choice: Choice | null): number | null {
  const entries = choice ? (choice.preconditions ?? []) : (turn.preconditions ?? []);
  return entries.length > 0 ? encodePreconditionIndex(0) : null;
}

function getInitialOutcomeSelection(choice: Choice | null): number | null {
  return choice && choice.outcomes.length > 0 ? 0 : null;
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
  if (mode === 'preconditions') return 'Preconditions';
  if (mode === 'outcomes') return 'Outcomes';
  if (mode === 'continuation') return 'Continuation';
  return 'Dialogue Text';
}

function stepMatchesMode(label: string, mode: BranchInlinePanelMode): boolean {
  if (label === 'Dialogue Text') return mode === 'dialogue';
  if (label === 'Preconditions') return mode === 'preconditions';
  if (label === 'Outcomes') return mode === 'outcomes';
  if (label === 'Continuation') return mode === 'continuation';
  return false;
}
