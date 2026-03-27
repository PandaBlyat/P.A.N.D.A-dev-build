// P.A.N.D.A. Conversation Editor — Properties Panel (Right Panel)

import { store } from '../lib/state';
import type { PropertiesTab } from '../lib/state';
import { createTurnDisplayLabeler } from '../lib/turn-labels';
import type { Conversation, Turn, Choice, PreconditionEntry, AnyPreconditionOption, SimplePrecondition, Outcome, FactionId } from '../lib/types';
import { FACTION_DISPLAY_NAMES } from '../lib/types';
import { PRECONDITION_SCHEMAS, OUTCOME_SCHEMAS, groupByCategory } from '../lib/schema';
import {
  getChoiceFieldKey,
  getConversationFieldKey,
  getOutcomeChanceFieldKey,
  getOutcomeItemFieldKey,
  getOutcomeParamFieldKey,
  getPreconditionItemFieldKey,
  getPreconditionParamFieldKey,
  getTurnFieldKey,
} from '../lib/validation';
import type { CommandSchema, ParamDef, ParamOption } from '../lib/schema';
import {
  FACTION_IDS,
  RANKS,
  MUTANT_TYPES,
  DYNAMIC_PLACEHOLDERS,
  LEVEL_DISPLAY_NAMES,
  SMART_TERRAIN_LEVELS,
  SMART_TERRAIN_OPTIONS_ALL,
  SMART_TERRAIN_OPTIONS_BY_LEVEL,
  type SmartTerrainOption,
} from '../lib/constants';
import { createOnboardingNudge } from './Onboarding';
import { createItemChainPickerPanelEditor, createItemPickerPanelEditor } from './ItemPickerPanel';
import { formatGameItemLabel } from '../lib/item-catalog';
import { requestFlowCenter } from '../lib/flow-navigation';
import { createIcon, setButtonContent } from './icons';
import { STORY_NPC_OPTIONS } from '../lib/generated/story-npc-catalog';

const ADDABLE_PRECONDITION_SCHEMAS = PRECONDITION_SCHEMAS.filter((schema) => !schema.pickerHidden);
const CHANNEL_OPTIONS: Array<{ value: 'pda' | 'f2f' | 'both'; label: string }> = [
  { value: 'pda', label: 'PDA' },
  { value: 'f2f', label: 'In-person (F2F)' },
  { value: 'both', label: 'Both' },
];

const STORY_NPC_PROFILE_OPTIONS = Array.from(
  new Set(
    STORY_NPC_OPTIONS
      .map((option) => option.keywords?.[2]?.trim() ?? '')
      .filter((value) => value.length > 0),
  ),
).sort((a, b) => a.localeCompare(b));

// Track collapsed state of collapsible sections per key
const collapsedSections = new Set<string>();
const initializedCollapsibleSections = new Set<string>();
let activeCommandPickerCleanup: (() => void) | null = null;
let activeCommandPickerTrigger: HTMLElement | null = null;
let activeOptionPickerCleanup: (() => void) | null = null;
let activeOptionPickerTrigger: HTMLElement | null = null;
let collapsibleSectionId = 0;

function createCollapsibleSection(
  key: string,
  title: string,
  addCallback?: (trigger: HTMLButtonElement) => void,
  options?: { defaultCollapsed?: boolean },
): { wrapper: HTMLElement; body: HTMLElement } {
  if (!initializedCollapsibleSections.has(key)) {
    if (options?.defaultCollapsed) {
      collapsedSections.add(key);
    } else {
      collapsedSections.delete(key);
    }
    initializedCollapsibleSections.add(key);
  }

  const isCollapsed = collapsedSections.has(key);
  const wrapper = document.createElement('div');
  wrapper.className = `props-collapsible${isCollapsed ? ' is-collapsed' : ''}`;

  const header = document.createElement('div');
  header.className = 'props-collapsible-header';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'props-collapsible-toggle';

  const titleEl = document.createElement('span');
  titleEl.className = 'section-title';
  titleEl.textContent = title;

  const chevron = document.createElement('span');
  chevron.className = 'props-collapsible-chevron';
  chevron.appendChild(createIcon('play'));

  toggle.append(titleEl, chevron);

  const actions = document.createElement('div');
  actions.className = 'props-collapsible-actions inspector-action-row';

  if (addCallback) {
    const addBtn = createActionButton('Add', 'Add a new item to this section', () => {
      addCallback(addBtn);
    }, 'add');
    addBtn.onclick = (e) => {
      e.stopPropagation();
      addCallback(addBtn);
    };
    actions.appendChild(addBtn);
  }

  const body = document.createElement('div');
  body.className = 'props-collapsible-body';
  body.id = `props-collapsible-body-${++collapsibleSectionId}`;

  const setCollapsedState = (nextCollapsed: boolean) => {
    if (nextCollapsed) {
      collapsedSections.add(key);
    } else {
      collapsedSections.delete(key);
    }
    wrapper.classList.toggle('is-collapsed', nextCollapsed);
    toggle.setAttribute('aria-expanded', String(!nextCollapsed));
  };

  toggle.setAttribute('aria-controls', body.id);
  toggle.setAttribute('aria-expanded', String(!isCollapsed));
  toggle.onclick = () => {
    const nextCollapsed = !collapsedSections.has(key);
    setCollapsedState(nextCollapsed);
  };

  header.append(toggle, actions);
  header.onclick = (event) => {
    if (event.target instanceof HTMLElement && event.target.closest('button')) {
      return;
    }
    setCollapsedState(!collapsedSections.has(key));
  };

  wrapper.append(header, body);
  return { wrapper, body };
}

// ─── Debounce helper ─────────────────────────────────────────────────────
const debounceTimers = new Map<string, number>();
const debounceFns = new Map<string, () => void>();
function debounced(key: string, fn: () => void, delay = 300): void {
  const prev = debounceTimers.get(key);
  if (prev != null) clearTimeout(prev);
  debounceFns.set(key, fn);
  debounceTimers.set(key, window.setTimeout(() => {
    debounceTimers.delete(key);
    debounceFns.delete(key);
    fn();
  }, delay));
}

/** Immediately execute all pending debounced callbacks (used when Enter is pressed). */
export function flushAllDebounced(): void {
  for (const [key, timer] of debounceTimers) {
    clearTimeout(timer);
    const fn = debounceFns.get(key);
    if (fn) fn();
  }
  debounceTimers.clear();
  debounceFns.clear();
}

export function renderPropertiesPanel(container: HTMLElement): void {
  const state = store.get();
  const conv = store.getSelectedConversation();

  if (!conv) {
    container.replaceChildren(createOnboardingNudge({
      title: 'No properties to edit yet',
      body: 'Use the onboarding flow to start a blank project, import XML, or pull in a Community Library story, then edit preconditions, replies, and branch data here.',
    }));
    return;
  }

  const turn = store.getSelectedTurn();
  const choice = store.getSelectedChoice();
  const activeTab = state.propertiesTab;
  const turnLabels = createTurnDisplayLabeler(conv);

  // ─── Tab Bar ─────────────────────────────────────────
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';

  const convTab = document.createElement('button');
  convTab.className = 'tab' + (activeTab === 'conversation' ? ' active' : '');
  convTab.textContent = 'Story';
  convTab.title = 'Edit story label, preconditions & settings';
  convTab.onclick = () => store.setPropertiesTab('conversation');
  tabBar.appendChild(convTab);

  // Selection tab — show what's selected (turn/choice) or "Turn/Choice" if nothing
  const selTab = document.createElement('button');
  selTab.className = 'tab' + (activeTab === 'selection' ? ' active' : '');
  if (turn && choice) {
    selTab.textContent = `${turnLabels.getCompactLabel(turn.turnNumber)} / C${choice.index}`;
  } else if (turn) {
    selTab.textContent = turnLabels.getLongLabel(turn.turnNumber);
  } else {
    selTab.textContent = 'Turn / Choice';
  }
  selTab.title = turn ? 'Edit selected turn or choice properties' : 'Select a turn in the flow editor';
  selTab.onclick = () => {
    if (turn) {
      store.setPropertiesTab('selection');
    }
  };
  if (!turn) {
    selTab.style.opacity = '0.4';
    selTab.style.cursor = 'default';
  }
  tabBar.appendChild(selTab);

  container.appendChild(tabBar);

  // ─── Tab Content ─────────────────────────────────────
  const content = document.createElement('div');
  content.style.cssText = 'padding: 10px 12px; overflow-y: auto; flex: 1;';

  if (activeTab === 'conversation') {
    renderConversationProperties(content, conv);
  } else if (turn && choice) {
    renderChoiceProperties(content, conv, turn, choice, turnLabels);
  } else if (turn) {
    renderTurnProperties(content, conv, turn, turnLabels);
  } else {
    // Nothing selected — show a hint
    content.appendChild(createOnboardingNudge({
      title: 'Pick a turn to tune',
      body: 'Select a node in the flow editor to edit replies and outcomes, or stay on the Story tab to shape preconditions before you branch further.',
      compact: true,
    }));
  }

  container.appendChild(content);
}

// ─── Conversation Properties ──────────────────────────────────────────────

function renderConversationProperties(container: HTMLElement, conv: Conversation): void {
  // Section title
  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'props-section-intro';
  sectionTitle.innerHTML = `<span class="section-title">General</span>`;
  container.appendChild(sectionTitle);

  // Label
  const labelField = createField('Label', 'text', conv.label, (val) => {
    store.updateConversation(conv.id, { label: val });
  }, 'A short name for this story (only used in the editor)', getConversationFieldKey(conv.id, 'label'));
  container.appendChild(labelField);

  // Preconditions — collapsible section
  const { wrapper: precondWrapper, body: precondBody } = createCollapsibleSection(
    `conv-${conv.id}-preconditions`,
    `Preconditions (${conv.preconditions.length})`,
    (trigger) => {
      showCommandPicker(trigger, ADDABLE_PRECONDITION_SCHEMAS, (schema) => {
        const newPrecond: SimplePrecondition = {
          type: 'simple',
          command: schema.name,
          params: schema.params.map(p => p.placeholder || ''),
        };
        store.updateConversation(conv.id, {
          preconditions: [...conv.preconditions, newPrecond],
        });
      }, {
        title: 'Add precondition',
        searchPlaceholder: 'Search preconditions...',
        emptyMessage: 'No matching preconditions',
      });
    },
    { defaultCollapsed: true },
  );

  if (conv.preconditions.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'No preconditions set — this story will trigger for any NPC. Click "+ Add" to add conditions.';
    precondBody.appendChild(hint);
  } else {
    renderPreconditionList(precondBody, conv);
  }
  container.appendChild(precondWrapper);

  // Timeout — collapsible section
  const { wrapper: timeoutWrapper, body: timeoutBody } = createCollapsibleSection(
    `conv-${conv.id}-timeout`,
    'Timeout',
    undefined,
    { defaultCollapsed: true },
  );

  const timeoutField = createField('Timeout (seconds)', 'number', String(conv.timeout || ''), (val) => {
    store.updateConversation(conv.id, { timeout: val ? parseInt(val, 10) : undefined });
  }, 'Auto-close story after this many seconds (leave empty for no timeout)', getConversationFieldKey(conv.id, 'timeout'));
  timeoutBody.appendChild(timeoutField);

  const timeoutMsgField = createField('Timeout Message', 'textarea', conv.timeoutMessage || '', (val) => {
    store.updateConversation(conv.id, { timeoutMessage: val || undefined });
  }, 'Message shown when the story times out', getConversationFieldKey(conv.id, 'timeout-message'));
  timeoutBody.appendChild(timeoutMsgField);
  container.appendChild(timeoutWrapper);
}

function normalizeChannel(channel: Choice['channel'] | Choice['continue_channel'] | Turn['channel'] | undefined, fallback: 'pda' | 'both'): 'pda' | 'f2f' | 'both' {
  if (channel === 'pda' || channel === 'f2f' || channel === 'both') return channel;
  return fallback;
}

function channelLabel(channel: 'pda' | 'f2f' | 'both'): string {
  if (channel === 'pda') return 'PDA';
  if (channel === 'f2f') return 'F2F';
  return 'Both';
}

function createChannelSelect(
  value: 'pda' | 'f2f' | 'both',
  onChange: (value: 'pda' | 'f2f' | 'both') => void,
  fieldKey: string,
): HTMLSelectElement {
  const select = document.createElement('select');
  select.setAttribute('data-field-key', fieldKey);
  for (const option of CHANNEL_OPTIONS) {
    const el = document.createElement('option');
    el.value = option.value;
    el.textContent = option.label;
    el.selected = option.value === value;
    select.appendChild(el);
  }
  select.onchange = () => onChange(select.value as 'pda' | 'f2f' | 'both');
  return select;
}

// ─── Turn Properties ──────────────────────────────────────────────────────

function renderTurnProperties(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): void {
  const canPasteChoice = store.hasCopiedChoice(conv.id) && turn.choices.length < 4;
  const title = document.createElement('div');
  title.className = 'section-header';
  const titleSpan = document.createElement('span');
  titleSpan.className = 'section-title';
  titleSpan.textContent = turnLabels.getLongLabel(turn.turnNumber);
  title.appendChild(titleSpan);
  container.appendChild(title);

  // Opening message (turn 1 only)
  if (turn.turnNumber === 1) {
    const msgField = createField('Opening Message', 'textarea', turn.openingMessage || '', (val) => {
      store.updateTurn(conv.id, turn.turnNumber, { openingMessage: val });
    }, 'The first message the NPC sends when starting this conversation', getTurnFieldKey(conv.id, turn.turnNumber, 'opening-message'));
    container.appendChild(msgField);

    renderPlaceholderPicker(container, `conv-${conv.id}-turn-${turn.turnNumber}-dynamic-placeholders`);
  }

  const currentTurnChannel = normalizeChannel(turn.channel, 'both');
  const visibilityWrapper = document.createElement('div');
  visibilityWrapper.className = 'field';
  const visibilityLabel = document.createElement('label');
  visibilityLabel.textContent = 'Turn Visibility Channel';
  visibilityWrapper.appendChild(visibilityLabel);
  const visibilityHint = document.createElement('div');
  visibilityHint.className = 'field-hint';
  visibilityHint.textContent = 'Conservative default is Both for existing turns; choices still default to PDA-only.';
  visibilityWrapper.appendChild(visibilityHint);
  visibilityWrapper.appendChild(createChannelSelect(
    currentTurnChannel,
    (nextChannel) => store.updateTurn(conv.id, turn.turnNumber, { channel: nextChannel }),
    getTurnFieldKey(conv.id, turn.turnNumber, 'channel'),
  ));
  container.appendChild(visibilityWrapper);

  const entryScopeField = document.createElement('div');
  entryScopeField.className = 'field';
  const entryScopeLabel = document.createElement('label');
  entryScopeLabel.textContent = 'Entry Turn Flags';
  entryScopeField.appendChild(entryScopeLabel);
  const entryScopeHint = document.createElement('div');
  entryScopeHint.className = 'field-hint';
  entryScopeHint.textContent = 'Mark if this branch can be used as a channel entry target for handoffs.';
  entryScopeField.appendChild(entryScopeHint);
  const entryScopeRow = document.createElement('div');
  entryScopeRow.style.cssText = 'display:flex; gap:12px; flex-wrap:wrap;';

  const createEntryToggle = (label: string, checked: boolean, key: 'pda_entry' | 'f2f_entry', fieldSuffix: 'pda-entry' | 'f2f-entry'): HTMLElement => {
    const wrapper = document.createElement('label');
    wrapper.style.cssText = 'display:inline-flex; align-items:center; gap:6px; font-size:12px;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.setAttribute('data-field-key', getTurnFieldKey(conv.id, turn.turnNumber, fieldSuffix));
    input.onchange = () => store.updateTurn(conv.id, turn.turnNumber, { [key]: input.checked });
    const text = document.createElement('span');
    text.textContent = label;
    wrapper.append(input, text);
    return wrapper;
  };

  entryScopeRow.append(
    createEntryToggle('PDA entry turn', turn.pda_entry ?? turn.turnNumber === 1, 'pda_entry', 'pda-entry'),
    createEntryToggle('F2F entry turn', turn.f2f_entry ?? false, 'f2f_entry', 'f2f-entry'),
  );
  entryScopeField.appendChild(entryScopeRow);
  container.appendChild(entryScopeField);

  const { wrapper: turnActionsWrapper, body: turnActionsBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-actions`,
    'Turn Actions',
    undefined,
    { defaultCollapsed: true },
  );
  const turnActionsRow = document.createElement('div');
  turnActionsRow.className = 'inspector-action-row inspector-action-row-wrap';

  const pasteChoiceBtn = createActionButton('Paste Choice', 'Paste a copied choice into this turn', () => {
    store.pasteChoice(conv.id, turn.turnNumber);
  }, 'add');
  pasteChoiceBtn.disabled = !canPasteChoice;
  turnActionsRow.appendChild(pasteChoiceBtn);

  if (turn.turnNumber > 1) {
    const delTurnBtn = createActionButton('Delete Turn', 'Remove this turn from the story', () => {
      store.deleteTurn(conv.id, turn.turnNumber);
    }, 'delete', 'danger');
    turnActionsRow.appendChild(delTurnBtn);
  }

  turnActionsBody.appendChild(turnActionsRow);
  container.appendChild(turnActionsWrapper);

  // Choices section
  const { wrapper: choicesWrapper, body: choicesBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-choices`,
    `Choices (${turn.choices.length}/4)`,
    turn.choices.length < 4 ? () => store.addChoice(conv.id, turn.turnNumber) : undefined,
    { defaultCollapsed: true },
  );

  if (turn.choices.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'No choices yet. Use "+ Add" to create a response branch from this turn.';
    choicesBody.appendChild(hint);
  }

  for (const choice of turn.choices) {
    const card = document.createElement('div');
    card.className = 'choice-card';
    const header = document.createElement('div');
    header.className = 'choice-card-header';
    header.tabIndex = 0;
    header.setAttribute('role', 'button');
    header.setAttribute('aria-label', `Edit Choice ${choice.index}`);
    header.onclick = () => store.selectChoice(choice.index);
    header.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        store.selectChoice(choice.index);
      }
    };

    const cardTitle = document.createElement('span');
    cardTitle.className = 'choice-card-title';
    cardTitle.textContent = `Choice ${choice.index}`;
    header.appendChild(cardTitle);

    const previewText = document.createElement('span');
    previewText.style.cssText = 'flex:1; font-size:11px; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-left:8px;';
    previewText.textContent = choice.text || '(empty)';
    header.appendChild(previewText);

    const channelBadge = document.createElement('span');
    channelBadge.style.cssText = 'font-size:10px; font-family:var(--font-mono); color:var(--accent);';
    channelBadge.textContent = channelLabel(normalizeChannel(choice.channel, 'pda'));
    header.appendChild(channelBadge);

    const actionGroup = document.createElement('div');
    actionGroup.className = 'inspector-action-row';

    const duplicateBtn = createActionButton('Duplicate', 'Duplicate this choice', () => {
      store.duplicateChoice(conv.id, turn.turnNumber, choice.index);
    }, 'duplicate');
    duplicateBtn.disabled = turn.choices.length >= 4;
    actionGroup.appendChild(duplicateBtn);

    const copyBtn = createActionButton('Copy', 'Copy this choice to paste into another turn in this story', () => {
      store.copyChoice(conv.id, turn.turnNumber, choice.index);
    }, 'share');
    actionGroup.appendChild(copyBtn);

    if (turn.choices.length > 1) {
      const delBtn = createActionButton('Delete', 'Delete this choice', () => {
        store.deleteChoice(conv.id, turn.turnNumber, choice.index);
      }, 'delete', 'danger');
      actionGroup.appendChild(delBtn);
    }

    header.appendChild(actionGroup);

    card.appendChild(header);

    // Show outcome count badge
    if (choice.outcomes.length > 0) {
      const badge = document.createElement('div');
      badge.style.cssText = 'padding:2px 10px; font-size:10px; color:var(--text-dim); font-family:var(--font-mono);';
      badge.textContent = `${choice.outcomes.length} outcome${choice.outcomes.length !== 1 ? 's' : ''}`;
      card.appendChild(badge);
    }

    // Show continuation badge if set
    if (choice.continueTo != null) {
      const badge = document.createElement('div');
      badge.style.cssText = 'padding:2px 10px; font-size:10px; color:var(--accent); font-family:var(--font-mono);';
      badge.textContent = `\u2192 ${channelLabel(normalizeChannel(choice.continue_channel, 'pda'))} to ${turnLabels.getLongLabel(choice.continueTo)}`;
      card.appendChild(badge);
    }

    choicesBody.appendChild(card);
  }

  container.appendChild(choicesWrapper);
}

// ─── Choice Properties ────────────────────────────────────────────────────

function renderChoiceProperties(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  choice: Choice,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): void {
  const canDuplicateChoice = turn.choices.length < 4;
  const canPasteChoice = store.hasCopiedChoice(conv.id) && turn.choices.length < 4;
  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-sm';
  backBtn.setAttribute('aria-label', `Back to ${turnLabels.getLongLabel(turn.turnNumber)}`);
  backBtn.textContent = `\u2190 Back to ${turnLabels.getLongLabel(turn.turnNumber)}`;
  backBtn.title = 'Return to turn overview';
  backBtn.onclick = () => store.selectChoice(null);
  backBtn.style.marginBottom = '10px';
  container.appendChild(backBtn);

  const title = document.createElement('div');
  title.className = 'section-header';
  const titleText = document.createElement('span');
  titleText.className = 'section-title';
  titleText.textContent = `${turnLabels.getLongLabel(turn.turnNumber)} / Choice ${choice.index}`;
  title.appendChild(titleText);

  const titleActions = document.createElement('div');
  titleActions.className = 'inspector-action-row inspector-action-row-wrap';

  const duplicateBtn = createActionButton('Duplicate', 'Duplicate this choice', () => {
    store.duplicateChoice(conv.id, turn.turnNumber, choice.index);
  }, 'duplicate');
  duplicateBtn.disabled = !canDuplicateChoice;
  titleActions.appendChild(duplicateBtn);

  const copyBtn = createActionButton('Copy', 'Copy this choice', () => {
    store.copyChoice(conv.id, turn.turnNumber, choice.index);
  }, 'share');
  titleActions.appendChild(copyBtn);

  const pasteBtn = createActionButton('Paste', 'Paste the copied choice into this turn', () => {
    store.pasteChoice(conv.id, turn.turnNumber);
  }, 'add');
  pasteBtn.disabled = !canPasteChoice;
  titleActions.appendChild(pasteBtn);

  title.appendChild(titleActions);
  container.appendChild(title);

  // Choice text
  const textField = createField('Player Choice Text', 'textarea', choice.text, (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { text: val });
  }, 'What the player says when choosing this option', getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'text'));
  container.appendChild(textField);

  // NPC Reply
  const replyField = createField('NPC Reply', 'textarea', choice.reply, (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { reply: val });
  }, 'The NPC\'s response to this choice', getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply'));
  container.appendChild(replyField);

  renderPlaceholderPicker(container, `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-dynamic-placeholders`);

  const { wrapper: replyVariantsWrapper, body: replyVariantsBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-relationship-variants`,
    'Relationship Variant Replies',
    undefined,
    { defaultCollapsed: true },
  );

  const relHighField = createField('Reply (High Relationship, \u2265300)', 'textarea', choice.replyRelHigh || '', (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyRelHigh: val || undefined });
  }, 'Alternative reply when relationship score is 300 or higher (optional)', getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply-rel-high'));
  replyVariantsBody.appendChild(relHighField);

  const relLowField = createField('Reply (Low Relationship, \u2264-300)', 'textarea', choice.replyRelLow || '', (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyRelLow: val || undefined });
  }, 'Alternative reply when relationship score is -300 or lower (optional)', getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply-rel-low'));
  replyVariantsBody.appendChild(relLowField);
  container.appendChild(replyVariantsWrapper);

  const currentChoiceChannel = normalizeChannel(choice.channel, 'pda');
  const choiceVisibilityField = document.createElement('div');
  choiceVisibilityField.className = 'field';
  const choiceVisibilityLabel = document.createElement('label');
  choiceVisibilityLabel.textContent = 'Choice Visibility Channel';
  choiceVisibilityField.appendChild(choiceVisibilityLabel);
  const choiceVisibilityHint = document.createElement('div');
  choiceVisibilityHint.className = 'field-hint';
  choiceVisibilityHint.textContent = 'Default remains PDA to avoid accidental F2F exposure in existing projects.';
  choiceVisibilityField.appendChild(choiceVisibilityHint);
  choiceVisibilityField.appendChild(createChannelSelect(
    currentChoiceChannel,
    (nextChannel) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { channel: nextChannel }),
    getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'channel'),
  ));
  container.appendChild(choiceVisibilityField);

  const { wrapper: targetingWrapper, body: targetingBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-f2f-targeting`,
    'Available When Talking To',
    undefined,
    { defaultCollapsed: true },
  );

  const storyNpcEditor = createOptionPickerPanelEditor(
    choice.story_npc_id ?? '',
    (value) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { story_npc_id: value.trim() || undefined }),
    getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'story-npc-id'),
    {
      title: 'Story NPC Catalog',
      subtitle: 'Select a specific story NPC from story-npc-catalog.',
      searchPlaceholder: 'Search story NPCs by id, faction, or role...',
      emptyLabel: 'No specific story NPC',
      options: STORY_NPC_OPTIONS,
    },
  );
  const storyNpcField = document.createElement('div');
  storyNpcField.className = 'field';
  const storyNpcLabel = document.createElement('label');
  storyNpcLabel.textContent = 'Story NPC Picker';
  storyNpcField.append(storyNpcLabel, storyNpcEditor);
  targetingBody.appendChild(storyNpcField);

  const factionFilterField = document.createElement('div');
  factionFilterField.className = 'field';
  const factionFilterLabel = document.createElement('label');
  factionFilterLabel.textContent = 'Faction Scope';
  factionFilterField.appendChild(factionFilterLabel);
  const factionFilterHint = document.createElement('div');
  factionFilterHint.className = 'field-hint';
  factionFilterHint.textContent = 'Restrict sim NPC matches to one or more factions.';
  factionFilterField.appendChild(factionFilterHint);
  const factionFilterSelect = document.createElement('select');
  factionFilterSelect.multiple = true;
  factionFilterSelect.size = Math.min(8, FACTION_IDS.length);
  factionFilterSelect.setAttribute('data-field-key', getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'npc-faction-filters'));
  for (const factionId of FACTION_IDS) {
    const option = document.createElement('option');
    option.value = factionId;
    option.textContent = FACTION_DISPLAY_NAMES[factionId];
    option.selected = (choice.npc_faction_filters ?? []).includes(factionId);
    factionFilterSelect.appendChild(option);
  }
  factionFilterSelect.onchange = () => {
    const values = Array.from(factionFilterSelect.selectedOptions).map((option) => option.value as FactionId);
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { npc_faction_filters: values.length > 0 ? values : undefined });
  };
  factionFilterField.appendChild(factionFilterSelect);
  targetingBody.appendChild(factionFilterField);

  const profileFilterField = document.createElement('div');
  profileFilterField.className = 'field';
  const profileFilterLabel = document.createElement('label');
  profileFilterLabel.textContent = 'Profile Scope';
  profileFilterField.appendChild(profileFilterLabel);
  const profileFilterHint = document.createElement('div');
  profileFilterHint.className = 'field-hint';
  profileFilterHint.textContent = 'Pick one or more sim profile IDs (derived from story-npc-catalog metadata).';
  profileFilterField.appendChild(profileFilterHint);
  const profileFilterSelect = document.createElement('select');
  profileFilterSelect.multiple = true;
  profileFilterSelect.size = Math.min(8, Math.max(3, STORY_NPC_PROFILE_OPTIONS.length));
  profileFilterSelect.setAttribute('data-field-key', getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'npc-profile-filters'));
  for (const profileId of STORY_NPC_PROFILE_OPTIONS) {
    const option = document.createElement('option');
    option.value = profileId;
    option.textContent = profileId;
    option.selected = (choice.npc_profile_filters ?? []).includes(profileId);
    profileFilterSelect.appendChild(option);
  }
  profileFilterSelect.onchange = () => {
    const values = Array.from(profileFilterSelect.selectedOptions).map((option) => option.value.trim()).filter(Boolean);
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { npc_profile_filters: values.length > 0 ? values : undefined });
  };
  profileFilterField.appendChild(profileFilterSelect);
  targetingBody.appendChild(profileFilterField);

  const broadScopeField = document.createElement('div');
  broadScopeField.className = 'field';
  const broadScopeToggle = document.createElement('label');
  broadScopeToggle.style.cssText = 'display:inline-flex; align-items:center; gap:6px; font-size:12px;';
  const broadScopeInput = document.createElement('input');
  broadScopeInput.type = 'checkbox';
  broadScopeInput.checked = choice.allow_generic_stalker === true;
  broadScopeInput.setAttribute('data-field-key', getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'allow-generic-stalker'));
  broadScopeInput.onchange = () => store.updateChoice(conv.id, turn.turnNumber, choice.index, { allow_generic_stalker: broadScopeInput.checked });
  const broadScopeText = document.createElement('span');
  broadScopeText.textContent = 'Allow generic sim stalker fallback';
  broadScopeToggle.append(broadScopeInput, broadScopeText);
  broadScopeField.appendChild(broadScopeToggle);
  targetingBody.appendChild(broadScopeField);
  container.appendChild(targetingWrapper);

  // Outcomes — collapsible section
  const { wrapper: outcomeWrapper, body: outcomeBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-outcomes`,
    `Outcomes (${choice.outcomes.length})`,
    (trigger) => {
      showCommandPicker(trigger, OUTCOME_SCHEMAS, (schema) => {
        const newOutcome: Outcome = {
          command: schema.name,
          params: schema.params.map(p => p.placeholder || ''),
        };
        store.updateChoice(conv.id, turn.turnNumber, choice.index, {
          outcomes: [...choice.outcomes, newOutcome],
        });
      }, {
        title: 'Add outcome',
        searchPlaceholder: 'Search outcomes...',
        emptyMessage: 'No matching outcomes',
      });
    },
    { defaultCollapsed: true },
  );

  if (choice.outcomes.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'No outcomes — this choice is dialogue-only. Click "+ Add" to add rewards, spawns, or other effects.';
    outcomeBody.appendChild(hint);
  } else {
    renderOutcomeList(outcomeBody, conv, turn, choice);
  }
  container.appendChild(outcomeWrapper);

  const { wrapper: continuationWrapper, body: continuationBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-continuation`,
    'Continuation / Branching',
    undefined,
    { defaultCollapsed: true },
  );

  // Continuation
  const contField = document.createElement('div');
  contField.className = 'field';
  const contLabel = document.createElement('label');
  contLabel.textContent = 'Continue To Turn';
  contField.appendChild(contLabel);

  const contHint = document.createElement('div');
  contHint.className = 'field-hint';
  contHint.textContent = 'Link this choice to another turn for multi-step stories';
  contField.appendChild(contHint);

  const contControls = document.createElement('div');
  contControls.style.cssText = 'display:flex; gap:8px; align-items:center;';

  const contSelect = document.createElement('select');
  contSelect.style.flex = '1 1 auto';
  contSelect.setAttribute('data-field-key', getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-to'));

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '(End story)';
  noneOpt.selected = choice.continueTo == null;
  contSelect.appendChild(noneOpt);

  for (const t of conv.turns) {
    if (t.turnNumber === turn.turnNumber) continue; // Can't continue to self
    const opt = document.createElement('option');
    opt.value = String(t.turnNumber);
    opt.textContent = turnLabels.getLongLabel(t.turnNumber);
    opt.selected = choice.continueTo === t.turnNumber;
    contSelect.appendChild(opt);
  }

  contSelect.onchange = () => {
    const val = contSelect.value;
    store.updateChoice(conv.id, turn.turnNumber, choice.index, {
      continueTo: val ? parseInt(val, 10) : undefined,
    });
  };

  const createBranchButton = document.createElement('button');
  createBranchButton.type = 'button';
  createBranchButton.className = 'btn-sm inspector-action-btn';
  setButtonContent(createBranchButton, 'add', 'Create New Branch');
  createBranchButton.title = 'Create and connect a new turn to this choice';
  createBranchButton.onclick = () => {
    const createdTurnNumber = store.createConnectedTurn(conv.id, turn.turnNumber, choice.index);
    if (createdTurnNumber != null) {
      requestFlowCenter({ conversationId: conv.id, turnNumber: createdTurnNumber });
    }
  };

  contControls.append(contSelect, createBranchButton);
  contField.appendChild(contControls);
  continuationBody.appendChild(contField);

  const handoffField = document.createElement('div');
  handoffField.className = 'field';
  const handoffLabel = document.createElement('label');
  handoffLabel.textContent = 'Explicit Handoff Channel';
  handoffField.appendChild(handoffLabel);
  const handoffHint = document.createElement('div');
  handoffHint.className = 'field-hint';
  handoffHint.textContent = 'Used when this choice continues to another turn. Set to continue via PDA or in-person.';
  handoffField.appendChild(handoffHint);
  const handoffSelect = createChannelSelect(
    normalizeChannel(choice.continue_channel, 'pda'),
    (nextChannel) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { continue_channel: nextChannel }),
    getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-channel'),
  );
  handoffField.appendChild(handoffSelect);
  continuationBody.appendChild(handoffField);

  container.appendChild(continuationWrapper);
}

// ─── Precondition List ────────────────────────────────────────────────────

type PreconditionPathSegment = number | 'inner' | 'options' | 'entries';
type PreconditionPath = PreconditionPathSegment[];

function clonePreconditions(entries: PreconditionEntry[]): PreconditionEntry[] {
  return JSON.parse(JSON.stringify(entries)) as PreconditionEntry[];
}

function getPreconditionValueAtPath(root: PreconditionEntry[], path: PreconditionPath): unknown {
  let current: unknown = root;
  for (const segment of path) {
    current = (current as any)[segment];
  }
  return current;
}

function normalizeAnyOption(option: AnyPreconditionOption): AnyPreconditionOption | null {
  if (option.type !== 'all') return option;
  if (option.entries.length === 0) return null;
  if (option.entries.length === 1) return option.entries[0];
  return option;
}

function normalizePrecondition(entry: PreconditionEntry): PreconditionEntry {
  switch (entry.type) {
    case 'simple':
    case 'invalid':
      return entry;
    case 'not':
      return { ...entry, inner: normalizePrecondition(entry.inner) };
    case 'any': {
      const options = entry.options
        .map((option) => option.type === 'all'
          ? normalizeAnyOption({
            ...option,
            entries: option.entries.map(normalizePrecondition),
          })
          : normalizePrecondition(option))
        .filter((option): option is AnyPreconditionOption => option != null);
      return { ...entry, options };
    }
  }
}

function updatePreconditionTree(conv: Conversation, mutate: (entries: PreconditionEntry[]) => void): void {
  const updated = clonePreconditions(conv.preconditions);
  mutate(updated);
  store.updateConversation(conv.id, {
    preconditions: updated.map(normalizePrecondition),
  });
}

function removePreconditionAtPath(conv: Conversation, path: PreconditionPath): void {
  updatePreconditionTree(conv, (entries) => {
    const container = path.length === 1 ? entries : getPreconditionValueAtPath(entries, path.slice(0, -1));
    const index = path[path.length - 1];
    if (Array.isArray(container) && typeof index === 'number') {
      container.splice(index, 1);
    }
  });
}

function updatePreconditionAtPath(conv: Conversation, path: PreconditionPath, updater: (entry: PreconditionEntry) => PreconditionEntry): void {
  updatePreconditionTree(conv, (entries) => {
    const container = path.length === 1 ? entries : getPreconditionValueAtPath(entries, path.slice(0, -1));
    const index = path[path.length - 1];
    if (Array.isArray(container) && typeof index === 'number') {
      container[index] = updater(container[index] as PreconditionEntry);
    }
  });
}

function renderPreconditionList(container: HTMLElement, conv: Conversation): void {
  const list = document.createElement('div');
  list.className = 'precond-list';

  let dragSrcIdx: number | null = null;

  conv.preconditions.forEach((entry, idx) => {
    const editorEl = renderPreconditionEditor(conv, entry, [idx], 0, true);
    editorEl.classList.add('precond-entry-shell');

    // Add drag handle to top-level preconditions
    editorEl.draggable = true;
    editorEl.dataset.precondIdx = String(idx);

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to reorder';
    const firstItem = editorEl.querySelector('.precond-item');
    if (firstItem) firstItem.prepend(handle);

    editorEl.ondragstart = (e) => {
      dragSrcIdx = idx;
      editorEl.classList.add('dragging');
      e.dataTransfer?.setData('text/plain', String(idx));
    };
    editorEl.ondragend = () => {
      dragSrcIdx = null;
      editorEl.classList.remove('dragging');
      list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    };
    editorEl.ondragover = (e) => {
      e.preventDefault();
      if (dragSrcIdx !== null && dragSrcIdx !== idx) {
        editorEl.classList.add('drag-over');
      }
    };
    editorEl.ondragleave = () => editorEl.classList.remove('drag-over');
    editorEl.ondrop = (e) => {
      e.preventDefault();
      editorEl.classList.remove('drag-over');
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      const reordered = [...conv.preconditions];
      const [moved] = reordered.splice(dragSrcIdx, 1);
      reordered.splice(idx, 0, moved);
      store.updateConversation(conv.id, { preconditions: reordered });
    };

    list.appendChild(editorEl);
  });

  container.appendChild(list);
}

function renderPreconditionEditor(
  conv: Conversation,
  entry: PreconditionEntry,
  path: PreconditionPath,
  depth: number,
  removable: boolean,
  branchLabel?: string,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'precond-editor';
  wrapper.style.marginLeft = `${depth * 14}px`;

  if (branchLabel) {
    const label = document.createElement('div');
    label.className = 'precond-branch-label';
    label.textContent = branchLabel;
    wrapper.appendChild(label);
  }

  const item = document.createElement('div');
  item.className = 'precond-item clickable';
  item.setAttribute('data-field-key', getPreconditionItemFieldKey(conv.id, path[0] as number));

  const indexBadge = document.createElement('span');
  indexBadge.className = 'logic-row-index';
  indexBadge.textContent = String((path[0] as number) + 1);
  item.appendChild(indexBadge);

  const display = renderPreconditionDisplay(entry);
  item.appendChild(display);

  if (removable) {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-sm';
    delBtn.textContent = '×';
    delBtn.title = 'Remove this precondition';
    delBtn.style.color = 'var(--danger)';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      removePreconditionAtPath(conv, path);
    };
    item.appendChild(delBtn);
  }

  wrapper.appendChild(item);

  if (entry.type === 'simple') {
    const schema = PRECONDITION_SCHEMAS.find((candidate) => candidate.name === entry.command);
    if (schema) {
      const desc = document.createElement('div');
      desc.className = 'command-description';
      desc.textContent = schema.description;
      wrapper.appendChild(desc);

      if (schema.params.length > 0) {
        const paramsDiv = renderParamEditors(schema, entry.params, (newParams) => {
          updatePreconditionAtPath(conv, path, (current) => current.type === 'simple'
            ? { ...current, params: newParams }
            : current);
        }, (paramIndex) => getPreconditionParamFieldKey(conv.id, path[0] as number, paramIndex), conv);
        wrapper.appendChild(paramsDiv);
      }
    }
    return wrapper;
  }

  if (entry.type === 'invalid') {
    const error = document.createElement('div');
    error.className = 'command-description';
    error.style.color = 'var(--danger)';
    error.textContent = entry.error;
    wrapper.appendChild(error);
    if (entry.raw) {
      const raw = document.createElement('div');
      raw.className = 'command-description';
      raw.textContent = `Raw: ${entry.raw}`;
      wrapper.appendChild(raw);
    }
    return wrapper;
  }

  if (entry.type === 'not') {
    wrapper.appendChild(renderPreconditionEditor(conv, entry.inner, [...path, 'inner'], depth + 1, false, 'NOT branch'));
    return wrapper;
  }

  entry.options.forEach((option, idx) => {
    const optionPath: PreconditionPath = [...path, 'options', idx];
    if (option.type === 'all') {
      const groupWrap = document.createElement('div');
      groupWrap.className = 'precond-group';
      groupWrap.style.marginLeft = `${(depth + 1) * 14}px`;

      const groupHeader = document.createElement('div');
      groupHeader.className = 'precond-item clickable';

      const groupLabel = document.createElement('span');
      groupLabel.style.flex = '1';
      groupLabel.innerHTML = '<span style="color:var(--info)">Option ' + (idx + 1) + '</span><span class="precond-params"> · ALL (' + option.entries.length + ' conditions)</span>';
      groupHeader.appendChild(groupLabel);

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon btn-sm';
      delBtn.textContent = '×';
      delBtn.title = 'Remove this any() option';
      delBtn.style.color = 'var(--danger)';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        removePreconditionAtPath(conv, optionPath);
      };
      groupHeader.appendChild(delBtn);
      groupWrap.appendChild(groupHeader);

      option.entries.forEach((groupEntry, groupIdx) => {
        groupWrap.appendChild(renderPreconditionEditor(conv, groupEntry, [...optionPath, 'entries', groupIdx], depth + 2, true, `Condition ${groupIdx + 1}`));
      });

      wrapper.appendChild(groupWrap);
      return;
    }

    wrapper.appendChild(renderPreconditionEditor(conv, option, optionPath, depth + 1, true, `Option ${idx + 1}`));
  });

  return wrapper;
}

function renderPreconditionDisplay(entry: PreconditionEntry): HTMLElement {
  const span = document.createElement('span');
  span.className = 'logic-row-content';
  span.style.flex = '1';

  const typeBadge = document.createElement('span');
  typeBadge.className = 'logic-type-badge';
  span.appendChild(typeBadge);

  if (entry.type === 'simple') {
    const schema = PRECONDITION_SCHEMAS.find(s => s.name === entry.command);
    typeBadge.textContent = 'CHECK';
    const cmd = document.createElement('span');
    cmd.className = 'precond-cmd';
    cmd.textContent = schema ? schema.label : entry.command;
    cmd.title = entry.command;
    span.appendChild(cmd);
    if (entry.params.length > 0 && entry.params.some(p => p !== '')) {
      const params = document.createElement('span');
      params.className = 'precond-params';
      params.textContent = ' : ' + formatCommandParamsForDisplay(schema, entry.params).join(' : ');
      span.appendChild(params);
    }
  } else if (entry.type === 'not') {
    typeBadge.textContent = 'NEGATE';
    const notLabel = document.createElement('span');
    notLabel.style.color = 'var(--warning)';
    notLabel.textContent = 'NOT';
    span.appendChild(notLabel);
  } else if (entry.type === 'any') {
    typeBadge.textContent = 'GROUP';
    const anyLabel = document.createElement('span');
    anyLabel.style.color = 'var(--info)';
    anyLabel.textContent = `ANY (${entry.options.length} options)`;
    span.appendChild(anyLabel);
  } else {
    typeBadge.textContent = 'INVALID';
    const invalidLabel = document.createElement('span');
    invalidLabel.style.color = 'var(--danger)';
    invalidLabel.textContent = 'INVALID PRECONDITION';
    span.appendChild(invalidLabel);
  }

  return span;
}

// ─── Outcome List ─────────────────────────────────────────────────────────

function renderOutcomeList(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice): void {
  const list = document.createElement('div');
  list.className = 'outcome-list';

  let dragSrcIdx: number | null = null;

  choice.outcomes.forEach((outcome, idx) => {
    const card = document.createElement('div');
    card.className = 'outcome-card';

    const item = document.createElement('div');
    item.className = 'outcome-item clickable';
    item.tabIndex = -1;
    item.draggable = true;
    item.dataset.outcomeIdx = String(idx);
    item.setAttribute('data-field-key', getOutcomeItemFieldKey(conv.id, turn.turnNumber, choice.index, idx));

    // Drag handle
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to reorder';
    item.appendChild(handle);

    // Drag events
    item.ondragstart = (e) => {
      dragSrcIdx = idx;
      item.classList.add('dragging');
      e.dataTransfer?.setData('text/plain', String(idx));
    };
    item.ondragend = () => {
      dragSrcIdx = null;
      item.classList.remove('dragging');
      list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    };
    item.ondragover = (e) => {
      e.preventDefault();
      if (dragSrcIdx !== null && dragSrcIdx !== idx) item.classList.add('drag-over');
    };
    item.ondragleave = () => item.classList.remove('drag-over');
    item.ondrop = (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      const reordered = [...choice.outcomes];
      const [moved] = reordered.splice(dragSrcIdx, 1);
      reordered.splice(idx, 0, moved);
      store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: reordered });
    };

    const display = document.createElement('span');
    display.className = 'logic-row-content';
    display.style.flex = '1';

    const indexBadge = document.createElement('span');
    indexBadge.className = 'logic-row-index';
    indexBadge.textContent = String(idx + 1);
    item.appendChild(indexBadge);

    const typeBadge = document.createElement('span');
    typeBadge.className = 'logic-type-badge';
    typeBadge.textContent = 'EFFECT';
    display.appendChild(typeBadge);

    if (outcome.chancePercent != null && outcome.chancePercent < 100) {
      const chanceBadge = document.createElement('span');
      chanceBadge.style.cssText = 'color:var(--warning); margin-right:4px;';
      chanceBadge.textContent = `${outcome.chancePercent}%`;
      display.appendChild(chanceBadge);
    }

    const schema = OUTCOME_SCHEMAS.find(s => s.name === outcome.command);
    const cmd = document.createElement('span');
    cmd.className = 'outcome-cmd';
    cmd.textContent = schema ? schema.label : outcome.command;
    cmd.title = outcome.command;
    display.appendChild(cmd);

    if (outcome.params.length > 0 && outcome.params.some(p => p !== '')) {
      const params = document.createElement('span');
      params.className = 'outcome-params';
      params.textContent = ' : ' + formatCommandParamsForDisplay(schema, outcome.params).join(' : ');
      display.appendChild(params);
    }

    item.appendChild(display);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-sm';
    delBtn.textContent = '\u00d7';
    delBtn.title = 'Remove this outcome';
    delBtn.style.color = 'var(--danger)';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      const updated = [...choice.outcomes];
      updated.splice(idx, 1);
      store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: updated });
    };
    item.appendChild(delBtn);

    card.appendChild(item);

    // Description from schema
    if (schema) {
      const desc = document.createElement('div');
      desc.className = 'command-description';
      desc.textContent = schema.description;
      card.appendChild(desc);
    }

    // Editable params — always visible
    if (schema && schema.params.length > 0) {
      const paramsDiv = renderParamEditors(schema, outcome.params, (newParams) => {
        const updated = [...choice.outcomes];
        updated[idx] = { ...updated[idx], params: newParams };
        store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: updated });
      }, (paramIndex) => getOutcomeParamFieldKey(conv.id, turn.turnNumber, choice.index, idx, paramIndex), conv);
      card.appendChild(paramsDiv);
    }

    // Chance editor
    const chanceDiv = document.createElement('div');
    chanceDiv.style.cssText = 'padding:2px 8px; display:flex; align-items:center; gap:4px; font-size:11px;';
    const chanceLabel = document.createElement('label');
    chanceLabel.textContent = 'Chance %';
    chanceLabel.title = 'Probability this outcome fires (1-100, default: always)';
    chanceLabel.style.cssText = 'margin:0; min-width: 60px;';
    const chanceInput = document.createElement('input');
    chanceInput.type = 'number';
    chanceInput.min = '1';
    chanceInput.max = '100';
    chanceInput.value = String(outcome.chancePercent || '');
    chanceInput.placeholder = '100';
    chanceInput.style.width = '60px';
    chanceInput.setAttribute('data-field-key', getOutcomeChanceFieldKey(conv.id, turn.turnNumber, choice.index, idx));
    chanceInput.onchange = () => {
      const updated = [...choice.outcomes];
      const val = parseInt(chanceInput.value, 10);
      updated[idx] = { ...updated[idx], chancePercent: val && val < 100 ? val : undefined };
      store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: updated });
    };
    chanceDiv.appendChild(chanceLabel);
    chanceDiv.appendChild(chanceInput);
    card.appendChild(chanceDiv);
    list.appendChild(card);
  });

  container.appendChild(list);
}

// ─── Parameter Editors ────────────────────────────────────────────────────

function renderParamEditors(
  schema: CommandSchema,
  currentParams: string[],
  onChange: (params: string[]) => void,
  getFieldKey: (paramIndex: number) => string,
  conv?: Conversation,
): HTMLElement {
  const div = document.createElement('div');
  div.style.cssText = 'padding: 4px 8px 8px; background: var(--bg-darkest); border-radius: var(--radius); margin-bottom: 4px;';

  if (schema.helpText || (schema.examples && schema.examples.length > 0)) {
    div.appendChild(createInlineHelpBox(schema.helpText, schema.examples));
  }

  schema.params.forEach((paramDef, i) => {
    if (schema.name === 'panda_task_artifact' && paramDef.name === 'zone_mode') {
      if ((currentParams[i] || '') !== 'random_level') {
        const normalizedParams = [...currentParams];
        while (normalizedParams.length <= i) normalizedParams.push('');
        normalizedParams[i] = 'random_level';
        onChange(normalizedParams);
      }
      return;
    }
    if (schema.name === 'panda_task_artifact' && paramDef.name === 'zone_name') {
      const existing = (currentParams[i] || '').trim();
      if (existing && !existing.startsWith('level:')) {
        const levelMatch = /^([a-z0-9]+)_/i.exec(existing);
        if (levelMatch?.[1]) {
          const normalizedParams = [...currentParams];
          while (normalizedParams.length <= i) normalizedParams.push('');
          normalizedParams[i] = `level:${levelMatch[1].toLowerCase()}`;
          onChange(normalizedParams);
        }
      }
    }

    const field = document.createElement('div');
    field.className = 'param-editor-field';
    field.style.cssText = 'display:flex; flex-direction:column; align-items:stretch; gap:4px; margin-bottom:8px;';

    const label = document.createElement('label');
    label.textContent = paramDef.label;
    label.style.cssText = 'margin:0;';
    if (paramDef.required) {
      label.textContent += ' *';
      label.title = 'Required';
    }
    field.appendChild(label);

    const paramKey = getFieldKey(i);
    const updateParam = (value: string) => {
      const newParams = [...currentParams];
      while (newParams.length <= i) newParams.push('');
      newParams[i] = value;
      onChange(newParams);
    };

    const richEditor = renderRichParamEditor(
      schema,
      paramDef,
      currentParams[i] || '',
      updateParam,
      paramKey,
      conv,
      currentParams,
      i,
    );

    if (richEditor) {
      field.appendChild(richEditor);
    } else {
      let input: HTMLInputElement | HTMLSelectElement;

      switch (paramDef.type) {
        case 'faction': {
          input = document.createElement('select');
          const emptyOpt = document.createElement('option');
          emptyOpt.value = '';
          emptyOpt.textContent = paramDef.required ? '-- Select --' : '(any)';
          input.appendChild(emptyOpt);
          for (const fid of FACTION_IDS) {
            const opt = document.createElement('option');
            opt.value = fid;
            opt.textContent = FACTION_DISPLAY_NAMES[fid];
            opt.selected = currentParams[i] === fid;
            input.appendChild(opt);
          }
          break;
        }
        case 'rank': {
          input = document.createElement('select');
          for (const rank of RANKS) {
            const opt = document.createElement('option');
            opt.value = rank;
            opt.textContent = rank;
            opt.selected = currentParams[i] === rank;
            input.appendChild(opt);
          }
          break;
        }
        case 'level': {
          input = document.createElement('select');
          const emptyOpt = document.createElement('option');
          emptyOpt.value = '';
          emptyOpt.textContent = '-- Select Level --';
          input.appendChild(emptyOpt);
          for (const [key, name] of Object.entries(LEVEL_DISPLAY_NAMES)) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = name;
            opt.selected = currentParams[i] === key;
            input.appendChild(opt);
          }
          break;
        }
        case 'mutant_type': {
          input = document.createElement('select');
          for (const mt of MUTANT_TYPES) {
            const opt = document.createElement('option');
            opt.value = mt;
            opt.textContent = mt;
            opt.selected = currentParams[i] === mt;
            input.appendChild(opt);
          }
          break;
        }
        case 'smart_terrain': {
          input = document.createElement('input');
          input.type = 'text';
          input.value = currentParams[i] || '';
          input.placeholder = '%level_panda_st_key%';
          break;
        }
        case 'slot': {
          input = document.createElement('select');
          for (let s = 0; s <= 12; s++) {
            const opt = document.createElement('option');
            opt.value = String(s);
            opt.textContent = `Slot ${s}`;
            opt.selected = currentParams[i] === String(s);
            input.appendChild(opt);
          }
          break;
        }
        case 'number': {
          input = document.createElement('input');
          input.type = 'number';
          if (paramDef.min != null) input.min = String(paramDef.min);
          if (paramDef.max != null) input.max = String(paramDef.max);
          input.value = currentParams[i] || '';
          input.placeholder = paramDef.placeholder || '';
          break;
        }
        default: {
          input = document.createElement('input');
          input.type = 'text';
          input.value = currentParams[i] || '';
          input.placeholder = paramDef.placeholder || '';
          break;
        }
      }

      input.style.flex = '1';
      input.setAttribute('data-field-key', paramKey);
      const handler = () => updateParam(input.value);
      if (input instanceof HTMLSelectElement) {
        input.onchange = handler;
      } else {
        input.oninput = () => debounced(paramKey, handler);
      }

      field.appendChild(input);
    }

    if (paramDef.helpText || (paramDef.examples && paramDef.examples.length > 0)) {
      field.appendChild(createInlineHelpBox(paramDef.helpText, paramDef.examples));
    }

    div.appendChild(field);
  });

  return div;
}

function renderRichParamEditor(
  schema: CommandSchema,
  paramDef: ParamDef,
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  conv?: Conversation,
  currentParams: string[] = [],
  paramIndex = -1,
): HTMLElement | null {
  const editor = paramDef.editor;
  if (!editor) return null;

  switch (editor.kind) {
    case 'searchable_select':
      return createSearchableSelectEditor(editor.options, currentValue, onChange, fieldKey, {
        emptyLabel: editor.emptyLabel ?? (paramDef.required ? '-- Select --' : '(optional)'),
        placeholder: paramDef.placeholder ?? `Search ${paramDef.label.toLowerCase()}...`,
      });
    case 'smart_terrain_picker':
      return createSmartTerrainEditor(currentValue, onChange, fieldKey, {
        allowPlaceholder: editor.allowPlaceholder ?? true,
      });
    case 'turn_reference':
      return createTurnReferenceEditor(currentValue, onChange, fieldKey, conv, editor.emptyLabel);
    case 'item_picker_panel':
      return createItemPickerPanelEditor(currentValue, onChange, fieldKey, {
        allowEmpty: !paramDef.required,
        placeholder: paramDef.placeholder ?? 'medkit_army',
      });
    case 'item_chain_picker_panel':
      return createItemChainPickerPanelEditor(currentValue, onChange, fieldKey, {
        placeholder: paramDef.placeholder ?? 'medkit+bandage+vodka',
        chainSeparator: editor.chainSeparator ?? '+',
      });
    case 'story_npc_picker_panel':
      return createOptionPickerPanelEditor(currentValue, onChange, fieldKey, {
        title: 'Browse story NPCs',
        subtitle: 'Search by NPC name, story id, or aliases and pick a canonical story NPC id.',
        searchPlaceholder: 'Search story NPC name or id...',
        emptyLabel: editor.emptyLabel ?? '-- Search for a story NPC --',
        options: editor.options,
      });
    case 'level_option_picker_panel':
      return createLevelOptionPickerPanelEditor(currentValue, onChange, fieldKey, {
        title: 'Browse anomaly fields',
        subtitle: 'Search across anomaly zone/task ids and filter by level to pick the canonical field quickly.',
        searchPlaceholder: paramDef.placeholder ?? `Search ${paramDef.label.toLowerCase()}...`,
        emptyLabel: editor.emptyLabel ?? '-- Search options --',
        options: editor.options,
      });
    case 'command_builder':
      return createCommandBuilderEditor(schema, paramDef, currentValue, onChange, fieldKey, editor.suggestions, editor.chainSeparator ?? '+');
  }
}

function formatCommandParamsForDisplay(schema: CommandSchema | undefined, params: string[]): string[] {
  return params
    .map((value, index) => formatParamValueForDisplay(schema?.params[index], value))
    .filter((value) => value !== '');
}

function formatParamValueForDisplay(paramDef: ParamDef | undefined, value: string): string {
  if (!value) return '';
  if (paramDef?.type === 'item_section') {
    return formatGameItemLabel(value);
  }
  if (paramDef?.editor?.kind === 'item_chain_picker_panel') {
    return value
      .split(paramDef.editor.chainSeparator ?? '+')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => formatGameItemLabel(item))
      .join(' + ');
  }
  return value;
}

function createSearchableSelectEditor(
  options: ParamOption[],
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  config: {
    emptyLabel: string;
    placeholder: string;
  },
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-searchable';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rich-editor-input';
  input.value = currentValue;
  input.placeholder = config.placeholder;
  input.setAttribute('data-field-key', fieldKey);

  const listId = `${fieldKey}-options`;
  input.setAttribute('list', listId);

  const datalist = document.createElement('datalist');
  datalist.id = listId;

  if (config.emptyLabel) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.label = config.emptyLabel;
    datalist.appendChild(emptyOption);
  }

  for (const option of options) {
    const item = document.createElement('option');
    item.value = option.value;
    item.label = `${option.label} (${option.value})`;
    datalist.appendChild(item);
  }

  input.oninput = () => debounced(fieldKey, () => onChange(input.value));
  input.onchange = () => onChange(input.value);

  const summary = document.createElement('div');
  summary.className = 'command-description';
  summary.textContent = options.find((option) => option.value === currentValue)?.label
    ?? 'Type to filter available options.';

  input.addEventListener('input', () => {
    const selected = options.find((option) => option.value === input.value);
    summary.textContent = selected ? selected.label : 'Type to filter available options.';
  });

  wrapper.appendChild(input);
  wrapper.appendChild(datalist);
  wrapper.appendChild(summary);
  return wrapper;
}


function createOptionPickerPanelEditor(
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  config: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    emptyLabel: string;
    options: ParamOption[];
  },
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-item-picker';

  const launcherRow = document.createElement('div');
  launcherRow.className = 'rich-editor-toolbar item-picker-toolbar';

  const browseButton = document.createElement('button');
  browseButton.type = 'button';
  browseButton.className = 'item-picker-launcher';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'btn-sm';
  clearButton.textContent = 'Clear';

  const rawInput = document.createElement('input');
  rawInput.type = 'text';
  rawInput.className = 'rich-editor-input';
  rawInput.value = currentValue;
  rawInput.placeholder = config.emptyLabel;
  rawInput.setAttribute('data-field-key', fieldKey);

  const summary = document.createElement('div');
  summary.className = 'command-description';

  const readFacet = (option: ParamOption, index: number, fallback: string): string => {
    const facet = option.keywords?.[index]?.trim();
    return facet ? facet : fallback;
  };

  const storyNpcMeta = config.options.map((option) => ({
    option,
    faction: readFacet(option, 1, 'Unknown faction'),
    role: readFacet(option, 3, 'Other role'),
  }));

  const factions = Array.from(new Set(storyNpcMeta.map((entry) => entry.faction))).sort((a, b) => a.localeCompare(b));
  const roles = Array.from(new Set(storyNpcMeta.map((entry) => entry.role))).sort((a, b) => a.localeCompare(b));

  const syncUi = (value: string): void => {
    rawInput.value = value;
    const selected = config.options.find((option) => option.value === value);

    browseButton.textContent = '';
    const label = document.createElement('span');
    label.className = 'item-picker-launcher-label';
    label.textContent = selected ? selected.label : 'Browse story NPCs…';
    const icon = document.createElement('span');
    icon.className = 'item-picker-launcher-icon';
    icon.textContent = '▾';
    browseButton.append(label, icon);

    summary.textContent = selected
      ? `Selected ${selected.label} (${selected.value}).`
      : 'Pick a story NPC from the searchable panel or type a custom story id manually.';

    clearButton.disabled = value.length === 0;
  };

  const openPicker = (): void => {
    if (activeOptionPickerCleanup) {
      const shouldToggleClosed = activeOptionPickerTrigger === browseButton;
      activeOptionPickerCleanup();
      if (shouldToggleClosed) return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'item-picker-overlay';
    overlay.setAttribute('role', 'presentation');

    const panel = document.createElement('div');
    panel.className = 'item-picker-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.onclick = (event) => event.stopPropagation();

    const header = document.createElement('div');
    header.className = 'item-picker-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'item-picker-title-wrap';

    const title = document.createElement('div');
    title.className = 'item-picker-title';
    title.textContent = config.title;

    const subtitle = document.createElement('div');
    subtitle.className = 'item-picker-subtitle';
    subtitle.textContent = config.subtitle;

    const closeButton = document.createElement('button');
    closeButton.className = 'btn-icon btn-sm';
    closeButton.textContent = '×';
    closeButton.title = 'Close story NPC picker';

    titleWrap.append(title, subtitle);
    header.append(titleWrap, closeButton);
    panel.appendChild(header);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'item-picker-search-wrap';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'item-picker-search-icon';
    searchIcon.textContent = '⌕';
    searchIcon.setAttribute('aria-hidden', 'true');

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dropdown-search item-picker-search';
    searchInput.placeholder = config.searchPlaceholder;

    searchWrap.append(searchIcon, searchInput);
    panel.appendChild(searchWrap);

    const factionChipBar = document.createElement('div');
    factionChipBar.className = 'item-picker-chip-bar';

    const roleChipBar = document.createElement('div');
    roleChipBar.className = 'item-picker-chip-bar item-picker-subchip-bar';

    panel.append(factionChipBar, roleChipBar);

    const list = document.createElement('div');
    list.className = 'item-picker-list';

    const listContent = document.createElement('div');
    listContent.className = 'item-picker-list-content item-picker-list-content-static';

    const empty = document.createElement('div');
    empty.className = 'item-picker-empty';
    empty.textContent = 'No story NPCs match this search.';
    empty.hidden = true;

    list.append(listContent, empty);
    panel.appendChild(list);

    let activeFaction = '';
    let activeRole = '';
    const factionButtons = new Map<string, HTMLButtonElement>();
    const roleButtons = new Map<string, HTMLButtonElement>();

    const renderList = (): void => {
      const query = searchInput.value.trim().toLowerCase();
      const maxRenderedOptions = 250;

      const matches = storyNpcMeta.filter(({ option, faction, role }) => {
        if (activeFaction && faction !== activeFaction) return false;
        if (activeRole && role !== activeRole) return false;
        if (!query) return true;
        const haystack = [option.label, option.value, ...(option.keywords ?? [])].join(' ').toLowerCase();
        return haystack.includes(query);
      });

      listContent.innerHTML = '';
      empty.hidden = matches.length !== 0;

      const fragment = document.createDocumentFragment();
      for (const { option } of matches.slice(0, maxRenderedOptions)) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'item-picker-option item-picker-option-static';
        if (option.value === rawInput.value) row.classList.add('is-selected');
        row.innerHTML = `<span class="item-picker-option-title">${option.label}</span><span class="item-picker-option-meta">${option.value}</span>`;
        row.onclick = () => {
          cleanup();
          syncUi(option.value);
          onChange(option.value);
        };
        fragment.appendChild(row);
      }
      listContent.appendChild(fragment);

      if (matches.length > maxRenderedOptions) {
        const overflow = document.createElement('div');
        overflow.className = 'command-description';
        overflow.textContent = `Showing ${maxRenderedOptions} of ${matches.length} story NPCs. Keep typing to narrow results.`;
        listContent.appendChild(overflow);
      }

      const factionCounts = new Map<string, number>();
      const roleCounts = new Map<string, number>();

      for (const { faction, role } of storyNpcMeta) {
        if (!activeRole || role === activeRole) {
          factionCounts.set(faction, (factionCounts.get(faction) ?? 0) + 1);
          factionCounts.set('', (factionCounts.get('') ?? 0) + 1);
        }
        if (!activeFaction || faction === activeFaction) {
          roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
          roleCounts.set('', (roleCounts.get('') ?? 0) + 1);
        }
      }

      for (const [value, button] of factionButtons) {
        const count = factionCounts.get(value) ?? 0;
        button.classList.toggle('is-active', value === activeFaction);
        const countEl = button.querySelector('.item-picker-chip-count');
        if (countEl) countEl.textContent = String(count);
      }

      for (const [value, button] of roleButtons) {
        const count = roleCounts.get(value) ?? 0;
        button.classList.toggle('is-active', value === activeRole);
        const countEl = button.querySelector('.item-picker-chip-count');
        if (countEl) countEl.textContent = String(count);
      }
    };

    const addChip = (
      parent: HTMLElement,
      label: string,
      value: string,
      onClick: (nextValue: string) => void,
      store: Map<string, HTMLButtonElement>,
    ): void => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'item-picker-chip';
      chip.innerHTML = `${label} <span class="item-picker-chip-count"></span>`;
      chip.onclick = () => {
        onClick(value);
        renderList();
      };
      store.set(value, chip);
      parent.appendChild(chip);
    };

    addChip(factionChipBar, 'All factions', '', (nextValue) => {
      activeFaction = nextValue;
    }, factionButtons);
    for (const faction of factions) {
      addChip(factionChipBar, faction, faction, (nextValue) => {
        activeFaction = nextValue;
      }, factionButtons);
    }

    addChip(roleChipBar, 'All roles', '', (nextValue) => {
      activeRole = nextValue;
    }, roleButtons);
    for (const role of roles) {
      addChip(roleChipBar, role, role, (nextValue) => {
        activeRole = nextValue;
      }, roleButtons);
    }

    let isClosed = false;
    const cleanup = (): void => {
      if (isClosed) return;
      isClosed = true;
      overlay.remove();
      document.removeEventListener('keydown', handleEscape, true);
      if (activeOptionPickerCleanup === cleanup) {
        activeOptionPickerCleanup = null;
        activeOptionPickerTrigger = null;
      }
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cleanup();
      browseButton.focus();
    };

    closeButton.onclick = () => {
      cleanup();
      browseButton.focus();
    };
    overlay.onclick = (event) => {
      if (event.target === overlay) cleanup();
    };
    searchInput.oninput = renderList;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    activeOptionPickerCleanup = cleanup;
    activeOptionPickerTrigger = browseButton;

    renderList();
    requestAnimationFrame(() => searchInput.focus());
    document.addEventListener('keydown', handleEscape, true);
  };

  browseButton.onclick = openPicker;
  clearButton.onclick = () => {
    syncUi('');
    onChange('');
    rawInput.focus();
  };
  rawInput.oninput = () => onChange(rawInput.value);
  rawInput.onchange = () => {
    syncUi(rawInput.value);
    onChange(rawInput.value);
  };
  rawInput.addEventListener('input', () => syncUi(rawInput.value));

  launcherRow.append(browseButton, clearButton);
  wrapper.append(launcherRow, rawInput, summary);

  syncUi(currentValue);
  return wrapper;
}

function createLevelOptionPickerPanelEditor(
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  config: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    emptyLabel: string;
    options: ParamOption[];
  },
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-item-picker';

  const launcherRow = document.createElement('div');
  launcherRow.className = 'rich-editor-toolbar item-picker-toolbar';

  const browseButton = document.createElement('button');
  browseButton.type = 'button';
  browseButton.className = 'item-picker-launcher';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'btn-sm';
  clearButton.textContent = 'Clear';

  const rawInput = document.createElement('input');
  rawInput.type = 'text';
  rawInput.className = 'rich-editor-input';
  rawInput.value = currentValue;
  rawInput.placeholder = config.emptyLabel;
  rawInput.setAttribute('data-field-key', fieldKey);

  const summary = document.createElement('div');
  summary.className = 'command-description';

  const levelLabel = (levelKey: string): string => LEVEL_DISPLAY_NAMES[levelKey] || levelKey.toUpperCase();

  const getLevelKey = (value: string): string => {
    const match = /^([a-z0-9]+)_/i.exec(value.trim());
    return match?.[1]?.toLowerCase() || 'other';
  };

  const optionMeta = config.options.map((option) => ({
    option,
    level: getLevelKey(option.value),
  }));

  const levels = Array.from(new Set(optionMeta.map((entry) => entry.level))).sort((a, b) => {
    if (a === 'other') return 1;
    if (b === 'other') return -1;
    return levelLabel(a).localeCompare(levelLabel(b));
  });

  const syncUi = (value: string): void => {
    rawInput.value = value;
    const selected = config.options.find((option) => option.value === value);

    browseButton.textContent = '';
    const label = document.createElement('span');
    label.className = 'item-picker-launcher-label';
    label.textContent = selected ? selected.label : 'Browse anomaly fields…';
    const icon = document.createElement('span');
    icon.className = 'item-picker-launcher-icon';
    icon.textContent = '▾';
    browseButton.append(label, icon);

    summary.textContent = selected
      ? `Selected ${selected.label} (${selected.value}).`
      : 'Use the searchable panel to browse by level, or type a custom anomaly field id manually.';
    clearButton.disabled = value.length === 0;
  };

  const openPicker = (): void => {
    if (activeOptionPickerCleanup) {
      const shouldToggleClosed = activeOptionPickerTrigger === browseButton;
      activeOptionPickerCleanup();
      if (shouldToggleClosed) return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'item-picker-overlay';
    overlay.setAttribute('role', 'presentation');

    const panel = document.createElement('div');
    panel.className = 'item-picker-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.onclick = (event) => event.stopPropagation();

    const header = document.createElement('div');
    header.className = 'item-picker-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'item-picker-title-wrap';
    const title = document.createElement('div');
    title.className = 'item-picker-title';
    title.textContent = config.title;
    const subtitle = document.createElement('div');
    subtitle.className = 'item-picker-subtitle';
    subtitle.textContent = config.subtitle;

    const closeButton = document.createElement('button');
    closeButton.className = 'btn-icon btn-sm';
    closeButton.textContent = '×';
    closeButton.title = 'Close anomaly field picker';

    titleWrap.append(title, subtitle);
    header.append(titleWrap, closeButton);
    panel.appendChild(header);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'item-picker-search-wrap';
    const searchIcon = document.createElement('span');
    searchIcon.className = 'item-picker-search-icon';
    searchIcon.textContent = '⌕';
    searchIcon.setAttribute('aria-hidden', 'true');
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dropdown-search item-picker-search';
    searchInput.placeholder = config.searchPlaceholder;
    searchWrap.append(searchIcon, searchInput);
    panel.appendChild(searchWrap);

    const levelChipBar = document.createElement('div');
    levelChipBar.className = 'item-picker-chip-bar';
    panel.appendChild(levelChipBar);

    const list = document.createElement('div');
    list.className = 'item-picker-list';
    const listContent = document.createElement('div');
    listContent.className = 'item-picker-list-content item-picker-list-content-static';
    const empty = document.createElement('div');
    empty.className = 'item-picker-empty';
    empty.textContent = 'No anomaly fields match this search.';
    empty.hidden = true;
    list.append(listContent, empty);
    panel.appendChild(list);

    let activeLevel = '';
    const levelButtons = new Map<string, HTMLButtonElement>();

    const renderList = (): void => {
      const query = searchInput.value.trim().toLowerCase();
      const matches = optionMeta.filter(({ option, level }) => {
        if (activeLevel && level !== activeLevel) return false;
        if (!query) return true;
        const haystack = [option.label, option.value, ...(option.keywords ?? [])].join(' ').toLowerCase();
        return haystack.includes(query);
      });

      listContent.innerHTML = '';
      empty.hidden = matches.length !== 0;

      const grouped = new Map<string, typeof matches>();
      for (const entry of matches) {
        if (!grouped.has(entry.level)) grouped.set(entry.level, []);
        grouped.get(entry.level)?.push(entry);
      }

      for (const level of levels) {
        const entries = grouped.get(level);
        if (!entries || entries.length === 0) continue;
        const heading = document.createElement('div');
        heading.className = 'command-description';
        heading.textContent = `${levelLabel(level)} (${entries.length})`;
        listContent.appendChild(heading);

        for (const { option } of entries) {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'item-picker-option item-picker-option-static';
          if (option.value === rawInput.value) row.classList.add('is-selected');
          row.innerHTML = `<span class="item-picker-option-title">${option.label}</span><span class="item-picker-option-meta">${option.value}</span>`;
          row.onclick = () => {
            cleanup();
            syncUi(option.value);
            onChange(option.value);
          };
          listContent.appendChild(row);
        }
      }

      const counts = new Map<string, number>();
      counts.set('', optionMeta.length);
      for (const { level } of optionMeta) {
        counts.set(level, (counts.get(level) ?? 0) + 1);
      }

      for (const [value, button] of levelButtons) {
        button.classList.toggle('is-active', value === activeLevel);
        const countEl = button.querySelector('.item-picker-chip-count');
        if (countEl) countEl.textContent = String(counts.get(value) ?? 0);
      }
    };

    const addChip = (label: string, value: string): void => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'item-picker-chip';
      chip.innerHTML = `${label} <span class="item-picker-chip-count"></span>`;
      chip.onclick = () => {
        activeLevel = value;
        renderList();
      };
      levelButtons.set(value, chip);
      levelChipBar.appendChild(chip);
    };

    addChip('All levels', '');
    for (const level of levels) addChip(levelLabel(level), level);

    let isClosed = false;
    const cleanup = (): void => {
      if (isClosed) return;
      isClosed = true;
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
      activeOptionPickerCleanup = null;
      activeOptionPickerTrigger = null;
      browseButton.setAttribute('aria-expanded', 'false');
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup();
      }
    };

    closeButton.onclick = () => cleanup();
    overlay.onclick = () => cleanup();
    searchInput.oninput = () => renderList();

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeyDown);

    activeOptionPickerCleanup = cleanup;
    activeOptionPickerTrigger = browseButton;
    browseButton.setAttribute('aria-expanded', 'true');

    renderList();
    searchInput.focus();
  };

  browseButton.onclick = openPicker;
  clearButton.onclick = () => {
    syncUi('');
    onChange('');
    rawInput.focus();
  };
  rawInput.oninput = () => {
    syncUi(rawInput.value);
    debounced(fieldKey, () => onChange(rawInput.value));
  };
  rawInput.onchange = () => onChange(rawInput.value);

  launcherRow.append(browseButton, clearButton);
  wrapper.append(launcherRow, rawInput, summary);

  syncUi(currentValue);
  return wrapper;
}

function createSmartTerrainEditor(
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  options: {
    allowPlaceholder: boolean;
  },
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-smart-terrain';

  const { level, terrain, usesPlaceholder } = parseSmartTerrainReference(currentValue);
  const initialLevel = level || (terrain ? '__all__' : '');

  const levelSelect = document.createElement('select');
  levelSelect.className = 'rich-editor-input';
  levelSelect.setAttribute('data-field-key', fieldKey);

  const emptyLevel = document.createElement('option');
  emptyLevel.value = '';
  emptyLevel.textContent = '-- Select level --';
  levelSelect.appendChild(emptyLevel);

  const allLevels = document.createElement('option');
  allLevels.value = '__all__';
  allLevels.textContent = 'All levels (vanilla catalog)';
  allLevels.selected = initialLevel === '__all__';
  levelSelect.appendChild(allLevels);

  for (const levelKey of Object.keys(SMART_TERRAIN_LEVELS)) {
    const opt = document.createElement('option');
    opt.value = levelKey;
    opt.textContent = LEVEL_DISPLAY_NAMES[levelKey] || levelKey;
    opt.selected = initialLevel === levelKey;
    levelSelect.appendChild(opt);
  }

  const searchInput = document.createElement('input');
  searchInput.className = 'rich-editor-input';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search by id or location name…';

  const quickActions = document.createElement('div');
  quickActions.className = 'smart-terrain-toolbar';

  const selectPlaceholderButton = document.createElement('button');
  selectPlaceholderButton.type = 'button';
  selectPlaceholderButton.className = 'ghost';
  selectPlaceholderButton.textContent = 'Use dynamic placeholder';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'ghost';
  clearButton.textContent = 'Clear';

  if (options.allowPlaceholder) quickActions.appendChild(selectPlaceholderButton);
  quickActions.appendChild(clearButton);

  const terrainList = document.createElement('div');
  terrainList.className = 'smart-terrain-results';

  let selectionMode: 'placeholder' | 'exact' | '' = usesPlaceholder ? 'placeholder' : (terrain ? 'exact' : '');
  let selectedTerrain = terrain;

  const getLevelOptions = (selectedLevel: string): SmartTerrainOption[] => {
    if (!selectedLevel) return [];
    if (selectedLevel === '__all__') return SMART_TERRAIN_OPTIONS_ALL;
    const curated = SMART_TERRAIN_OPTIONS_BY_LEVEL[selectedLevel] || [];
    const extras = SMART_TERRAIN_OPTIONS_ALL
      .filter((entry) => entry.level === 'other' && entry.id.includes(`_${selectedLevel.slice(0, 3)}_`));
    return [...curated, ...extras];
  };

  const applySelection = () => {
    if (!levelSelect.value) {
      onChange('');
      return;
    }
    if (selectionMode === 'placeholder' && levelSelect.value !== '__all__') {
      onChange(`%${levelSelect.value}_panda_st_key%`);
      return;
    }
    onChange(selectedTerrain || '');
  };

  const renderTerrainList = () => {
    terrainList.innerHTML = '';
    const selectedLevel = levelSelect.value;
    if (!selectedLevel) {
      const hint = document.createElement('div');
      hint.className = 'command-description';
      hint.textContent = 'Choose a level to browse smart terrain ids.';
      terrainList.appendChild(hint);
      return;
    }

    const query = searchInput.value.trim().toLowerCase();
    const optionsForLevel = getLevelOptions(selectedLevel);
    const filtered = optionsForLevel.filter((entry) => {
      if (!query) return true;
      return entry.id.toLowerCase().includes(query) || entry.description.toLowerCase().includes(query);
    });

    const maxItems = 120;
    for (const entry of filtered.slice(0, maxItems)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'smart-terrain-result';
      if (selectionMode === 'exact' && selectedTerrain === entry.id) btn.classList.add('is-selected');
      const idText = document.createElement('span');
      idText.className = 'smart-terrain-result-id';
      idText.textContent = entry.id;
      const descText = document.createElement('span');
      descText.className = 'smart-terrain-result-desc';
      descText.textContent = entry.description;
      btn.appendChild(idText);
      btn.appendChild(descText);
      btn.onclick = () => {
        selectedTerrain = entry.id;
        selectionMode = 'exact';
        applySelection();
        updateSummary();
        renderTerrainList();
      };
      terrainList.appendChild(btn);
    }

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'command-description';
      empty.textContent = 'No smart terrains match this search.';
      terrainList.appendChild(empty);
      return;
    }
    if (filtered.length > maxItems) {
      const overflow = document.createElement('div');
      overflow.className = 'command-description';
      overflow.textContent = `Showing ${maxItems} of ${filtered.length} matches. Keep typing to narrow the list.`;
      terrainList.appendChild(overflow);
    }
  };

  const summary = document.createElement('div');
  summary.className = 'command-description';
  const updateSummary = () => {
    selectPlaceholderButton.disabled = !levelSelect.value || levelSelect.value === '__all__';
    if (!levelSelect.value) {
      summary.textContent = 'Pick a level first, then choose either a specific vanilla smart terrain key or a dynamic %<level>_panda_st_key% placeholder.';
      return;
    }
    if (selectionMode === 'placeholder' && levelSelect.value !== '__all__') {
      summary.textContent = `Using dynamic placeholder %${levelSelect.value}_panda_st_key% for ${LEVEL_DISPLAY_NAMES[levelSelect.value] || levelSelect.value}.`;
      return;
    }
    summary.textContent = selectedTerrain
      ? `Using exact smart terrain key ${selectedTerrain}.`
      : 'Choose a smart terrain key for this level.';
  };

  levelSelect.onchange = () => {
    selectedTerrain = '';
    selectionMode = options.allowPlaceholder && levelSelect.value && levelSelect.value !== '__all__' ? 'placeholder' : '';
    applySelection();
    renderTerrainList();
    updateSummary();
  };

  searchInput.oninput = () => renderTerrainList();
  selectPlaceholderButton.onclick = () => {
    if (!levelSelect.value || levelSelect.value === '__all__') return;
    selectionMode = 'placeholder';
    selectedTerrain = '';
    applySelection();
    updateSummary();
    renderTerrainList();
  };
  clearButton.onclick = () => {
    selectionMode = '';
    selectedTerrain = '';
    applySelection();
    updateSummary();
    renderTerrainList();
  };

  levelSelect.value = initialLevel;
  renderTerrainList();
  updateSummary();
  wrapper.appendChild(levelSelect);
  wrapper.appendChild(searchInput);
  wrapper.appendChild(quickActions);
  wrapper.appendChild(terrainList);
  wrapper.appendChild(summary);
  return wrapper;
}

function createTurnReferenceEditor(
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  conv?: Conversation,
  emptyLabel?: string,
): HTMLElement {
  const turnLabels = conv ? createTurnDisplayLabeler(conv) : null;
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-turn-ref';

  const select = document.createElement('select');
  select.className = 'rich-editor-input';
  select.setAttribute('data-field-key', fieldKey);

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = emptyLabel ?? '-- Select turn --';
  select.appendChild(emptyOption);

  for (const turn of conv?.turns ?? []) {
    const opt = document.createElement('option');
    opt.value = String(turn.turnNumber);
    opt.textContent = turnLabels?.getLongLabel(turn.turnNumber) ?? `Branch ${turn.turnNumber}`;
    opt.selected = currentValue === String(turn.turnNumber);
    select.appendChild(opt);
  }

  select.onchange = () => onChange(select.value);
  wrapper.appendChild(select);

  const summary = document.createElement('div');
  summary.className = 'command-description';
  const getBranchSummary = (value: string): string => value
    ? `Branches to ${turnLabels?.getLongLabel(Number(value)) ?? `Branch ${value}`}.`
    : 'Select one of the turns already defined in this story.';
  summary.textContent = getBranchSummary(currentValue);
  select.addEventListener('change', () => {
    summary.textContent = getBranchSummary(select.value);
  });
  wrapper.appendChild(summary);
  return wrapper;
}

function createCommandBuilderEditor(
  schema: CommandSchema,
  paramDef: ParamDef,
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  suggestions: ParamOption[],
  chainSeparator: string,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-command-builder';

  const textarea = document.createElement('textarea');
  textarea.className = 'rich-editor-textarea';
  textarea.rows = 3;
  textarea.value = currentValue;
  textarea.placeholder = paramDef.placeholder || 'teleport_npc_to_smart:%cordon_panda_st_key%+spawn_mutant_at_smart:snork:%cordon_panda_st_key%';
  textarea.setAttribute('data-field-key', fieldKey);
  textarea.oninput = () => debounced(fieldKey, () => onChange(textarea.value));
  wrapper.appendChild(textarea);

  const controls = document.createElement('div');
  controls.className = 'rich-editor-toolbar';

  const suggestionSelect = document.createElement('select');
  suggestionSelect.className = 'rich-editor-input';
  const emptySuggestion = document.createElement('option');
  emptySuggestion.value = '';
  emptySuggestion.textContent = 'Suggested trigger commands...';
  suggestionSelect.appendChild(emptySuggestion);
  for (const suggestion of suggestions) {
    const opt = document.createElement('option');
    opt.value = suggestion.value;
    opt.textContent = suggestion.label;
    suggestionSelect.appendChild(opt);
  }
  controls.appendChild(suggestionSelect);

  const replaceBtn = document.createElement('button');
  replaceBtn.className = 'btn-sm';
  replaceBtn.textContent = 'Replace';
  replaceBtn.onclick = () => {
    if (!suggestionSelect.value) return;
    textarea.value = suggestionSelect.value;
    onChange(textarea.value);
    textarea.focus();
  };
  controls.appendChild(replaceBtn);

  const appendBtn = document.createElement('button');
  appendBtn.className = 'btn-sm';
  appendBtn.textContent = `Append ${chainSeparator}`;
  appendBtn.onclick = () => {
    if (!suggestionSelect.value) return;
    textarea.value = textarea.value.trim()
      ? `${textarea.value}${chainSeparator}${suggestionSelect.value}`
      : suggestionSelect.value;
    onChange(textarea.value);
    textarea.focus();
  };
  controls.appendChild(appendBtn);

  wrapper.appendChild(controls);

  const builderHint = document.createElement('div');
  builderHint.className = 'command-description';
  builderHint.textContent = `${schema.label} accepts normal outcome commands here. Use ${chainSeparator} to chain multiple deferred actions.`;
  wrapper.appendChild(builderHint);

  return wrapper;
}

function createInlineHelpBox(helpText?: string, examples?: string[]): HTMLElement {
  const box = document.createElement('div');
  box.className = 'param-help-box';

  if (helpText) {
    const help = document.createElement('div');
    help.className = 'field-hint';
    help.textContent = helpText;
    box.appendChild(help);
  }

  if (examples && examples.length > 0) {
    const list = document.createElement('div');
    list.className = 'param-help-examples';
    list.textContent = 'Examples: ' + examples.join('  •  ');
    box.appendChild(list);
  }

  return box;
}

function parseSmartTerrainReference(value: string): {
  level: string;
  terrain: string;
  usesPlaceholder: boolean;
} {
  if (!value) {
    return { level: '', terrain: '', usesPlaceholder: false };
  }

  const placeholderMatch = value.match(/^%([a-z_]+)_panda_st(?:_key)?%$/);
  if (placeholderMatch) {
    return {
      level: placeholderMatch[1],
      terrain: '',
      usesPlaceholder: true,
    };
  }

  for (const [levelKey, terrainKeys] of Object.entries(SMART_TERRAIN_LEVELS)) {
    if (terrainKeys.includes(value)) {
      return {
        level: levelKey,
        terrain: value,
        usesPlaceholder: false,
      };
    }
  }

  return { level: '', terrain: value, usesPlaceholder: false };
}

// ─── Command Picker Dropdown ──────────────────────────────────────────────

function showCommandPicker(
  trigger: HTMLElement,
  schemas: CommandSchema[],
  onSelect: (schema: CommandSchema) => void,
  options: {
    title?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
  } = {},
): void {
  if (activeCommandPickerCleanup) {
    const shouldToggleClosed = activeCommandPickerTrigger === trigger;
    activeCommandPickerCleanup();
    if (shouldToggleClosed) return;
  }

  const groups = Array.from(groupByCategory(schemas).entries());
  const panel = document.createElement('div');
  panel.className = 'command-picker-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', options.title ?? 'Command picker');
  panel.style.position = 'fixed';

  const header = document.createElement('div');
  header.className = 'command-picker-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'command-picker-title-wrap';

  const title = document.createElement('div');
  title.className = 'command-picker-title';
  title.textContent = options.title ?? 'Add command';
  titleWrap.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'command-picker-subtitle';
  subtitle.textContent = 'Browse by category or search to narrow the list.';
  titleWrap.appendChild(subtitle);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'command-picker-close btn-icon btn-sm';
  closeBtn.textContent = '×';
  closeBtn.title = 'Close picker';

  header.append(titleWrap, closeBtn);
  panel.appendChild(header);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = options.searchPlaceholder ?? 'Search commands...';
  searchInput.className = 'dropdown-search command-picker-search';
  panel.appendChild(searchInput);

  const content = document.createElement('div');
  content.className = 'command-picker-content';

  const categoryNav = document.createElement('div');
  categoryNav.className = 'command-picker-categories';

  const resultPane = document.createElement('div');
  resultPane.className = 'command-picker-results';

  content.append(categoryNav, resultPane);
  panel.appendChild(content);
  document.body.appendChild(panel);

  const inspectorScrollContainer = trigger.closest('.panel-body');
  const viewportGap = 12;
  let isClosed = false;
  let activeCategory = groups[0]?.[0] ?? '';

  const matchesFilter = (schema: CommandSchema, filter: string) => {
    if (!filter) return true;
    return schema.label.toLowerCase().includes(filter)
      || schema.description.toLowerCase().includes(filter)
      || schema.name.toLowerCase().includes(filter)
      || schema.category.toLowerCase().includes(filter);
  };

  const visibleGroups = (filter: string) => groups
    .map(([category, items]) => [category, items.filter((schema) => matchesFilter(schema, filter))] as const)
    .filter(([, items]) => items.length > 0);

  const renderCategories = (filter: string) => {
    const filteredGroups = visibleGroups(filter);
    if (filteredGroups.length > 0 && !filteredGroups.some(([category]) => category === activeCategory)) {
      activeCategory = filteredGroups[0][0];
    }

    categoryNav.innerHTML = '';
    for (const [category, items] of filteredGroups) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `command-picker-category${category === activeCategory ? ' is-active' : ''}`;
      button.innerHTML = `<span>${category}</span><span class="command-picker-category-count">${items.length}</span>`;
      button.onclick = () => {
        activeCategory = category;
        renderPicker(filter);
      };
      categoryNav.appendChild(button);
    }
  };

  const renderResults = (filter: string) => {
    resultPane.innerHTML = '';
    const filteredGroups = visibleGroups(filter);
    const currentGroup = filteredGroups.find(([category]) => category === activeCategory) ?? filteredGroups[0];
    if (!currentGroup) {
      const empty = document.createElement('div');
      empty.className = 'command-picker-empty';
      empty.textContent = options.emptyMessage ?? 'No matching commands';
      resultPane.appendChild(empty);
      return;
    }

    const [category, items] = currentGroup;
    const groupHeader = document.createElement('div');
    groupHeader.className = 'command-picker-results-header';

    const groupTitle = document.createElement('div');
    groupTitle.className = 'command-picker-results-title';
    groupTitle.textContent = category;

    const groupMeta = document.createElement('div');
    groupMeta.className = 'command-picker-results-meta';
    groupMeta.textContent = `${items.length} command${items.length === 1 ? '' : 's'}`;

    groupHeader.append(groupTitle, groupMeta);
    resultPane.appendChild(groupHeader);

    const cards = document.createElement('div');
    cards.className = 'command-picker-grid';

    for (const schema of items) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'command-picker-card';
      const paramsSummary = schema.params.length > 0
        ? `${schema.params.length} param${schema.params.length === 1 ? '' : 's'}`
        : 'No params';
      card.innerHTML = `
        <span class="command-picker-card-title-row">
          <span class="command-picker-card-title">${schema.label}</span>
          <span class="command-picker-card-pill">${paramsSummary}</span>
        </span>
        <span class="command-picker-card-name">${schema.name}</span>
        <span class="command-picker-card-desc">${schema.description}</span>
      `;
      card.onclick = () => {
        cleanup();
        onSelect(schema);
      };
      cards.appendChild(card);
    }

    resultPane.appendChild(cards);
  };

  const renderPicker = (filter: string) => {
    renderCategories(filter);
    renderResults(filter);
  };

  const positionPanel = () => {
    if (isClosed || !trigger.isConnected || !panel.isConnected) {
      cleanup();
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;

    let left = rect.left;
    let top = rect.bottom + 8;

    if (left + panelWidth > window.innerWidth - viewportGap) {
      left = Math.max(viewportGap, window.innerWidth - panelWidth - viewportGap);
    }
    if (top + panelHeight > window.innerHeight - viewportGap) {
      top = Math.max(viewportGap, rect.top - panelHeight - 8);
    }

    panel.style.left = `${Math.max(viewportGap, left)}px`;
    panel.style.top = `${top}px`;
  };

  const cleanup = () => {
    if (isClosed) return;
    isClosed = true;
    panel.remove();
    window.removeEventListener('resize', positionPanel);
    inspectorScrollContainer?.removeEventListener('scroll', positionPanel);
    document.removeEventListener('mousedown', handlePointerDown, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    if (activeCommandPickerCleanup === cleanup) {
      activeCommandPickerCleanup = null;
      activeCommandPickerTrigger = null;
    }
  };

  const handlePointerDown = (e: MouseEvent) => {
    const target = e.target as Node | null;
    if (target && (panel.contains(target) || trigger.contains(target))) return;
    cleanup();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    cleanup();
    trigger.focus();
  };

  closeBtn.onclick = () => {
    cleanup();
    trigger.focus();
  };
  searchInput.oninput = () => renderPicker(searchInput.value.toLowerCase().trim());

  activeCommandPickerCleanup = cleanup;
  activeCommandPickerTrigger = trigger;

  renderPicker('');
  positionPanel();
  requestAnimationFrame(() => {
    positionPanel();
    searchInput.focus();
  });

  window.addEventListener('resize', positionPanel);
  inspectorScrollContainer?.addEventListener('scroll', positionPanel, { passive: true });
  setTimeout(() => {
    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
  }, 0);
}

// ─── Placeholder Picker ──────────────────────────────────────────────────

function renderPlaceholderPicker(container: HTMLElement, collapseKey: string): void {
  const { wrapper, body } = createCollapsibleSection(
    collapseKey,
    'Dynamic Placeholders',
    undefined,
    { defaultCollapsed: true },
  );

  const helperCopy = document.createElement('div');
  helperCopy.className = 'placeholder-helper-copy';
  helperCopy.innerHTML = 'Text placeholders resolve into readable dialogue values. Command-key placeholders resolve into engine ids for command params — use <code>%&lt;level&gt;_panda_st%</code> in text, but <code>%&lt;level&gt;_panda_st_key%</code> in smart-terrain command fields.';
  body.appendChild(helperCopy);

  const categoryOrder = Array.from(new Set(DYNAMIC_PLACEHOLDERS.map((placeholder) => placeholder.category)));
  for (const category of categoryOrder) {
    const group = document.createElement('section');
    group.className = 'placeholder-category-group';

    const groupHeader = document.createElement('div');
    groupHeader.className = 'placeholder-category-title';
    groupHeader.textContent = category;
    group.appendChild(groupHeader);

    const picker = document.createElement('div');
    picker.className = 'placeholder-picker';

    for (const ph of DYNAMIC_PLACEHOLDERS.filter((placeholder) => placeholder.category === category)) {
      const btn = document.createElement('button');
      btn.className = 'placeholder-btn';
      btn.textContent = ph.key;
      btn.title = ph.description + (ph.kind === 'smart_terrain_picker'
        ? ' — choose a level-aware placeholder or exact key'
        : ' — drag to a text field or click to copy');

      if (ph.kind === 'smart_terrain_picker') {
        btn.style.borderColor = 'var(--accent-dim)';
        btn.onclick = (e) => {
          e.preventDefault();
          const existing = group.querySelector('.smart-terrain-placeholder-card');
          if (existing) {
            existing.remove();
            btn.classList.remove('active');
            return;
          }

          btn.classList.add('active');
          const editor = createPlaceholderSmartTerrainEditor(container, btn);
          group.appendChild(editor);
        };
      } else {
        btn.draggable = true;
        btn.addEventListener('dragstart', (e) => {
          e.dataTransfer!.setData('text/plain', ph.key);
          e.dataTransfer!.setData('application/x-panda-placeholder', ph.key);
          e.dataTransfer!.effectAllowed = 'copy';
          btn.classList.add('dragging');
        });
        btn.addEventListener('dragend', () => btn.classList.remove('dragging'));
        btn.onclick = (e) => {
          e.preventDefault();
          insertOrCopyPlaceholder(container, ph.key, btn, ph.key);
        };
      }

      picker.appendChild(btn);
    }

    group.appendChild(picker);
    body.appendChild(group);
  }

  container.appendChild(wrapper);
}

function insertOrCopyPlaceholder(container: HTMLElement, value: string, button: HTMLButtonElement, idleLabel: string): void {
  const inserted = insertIntoFocusedTextarea(container, value);
  if (inserted) return;

  navigator.clipboard.writeText(value).then(() => {
    button.textContent = 'Copied!';
    button.style.color = 'var(--accent)';
    setTimeout(() => {
      button.textContent = idleLabel;
      button.style.color = '';
    }, 1000);
  });
}

function insertIntoFocusedTextarea(container: HTMLElement, text: string): boolean {
  const panel = container.closest('.panel-body') || container;
  const textareas = panel.querySelectorAll('textarea');

  for (const ta of textareas) {
    if (ta !== document.activeElement) continue;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const currentText = ta.value;
    ta.value = currentText.substring(0, start) + text + currentText.substring(end);
    ta.selectionStart = ta.selectionEnd = start + text.length;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    return true;
  }

  return false;
}

function createPlaceholderSmartTerrainEditor(container: HTMLElement, triggerButton: HTMLButtonElement): HTMLElement {
  const card = document.createElement('div');
  card.className = 'smart-terrain-placeholder-card';

  const title = document.createElement('div');
  title.className = 'field-hint';
  title.textContent = 'Choose a level first, then pick either a dynamic placeholder or a specific smart terrain key.';
  card.appendChild(title);

  const controls = document.createElement('div');
  controls.className = 'smart-terrain-placeholder-controls';

  const levelSelect = document.createElement('select');
  const emptyLevel = document.createElement('option');
  emptyLevel.value = '';
  emptyLevel.textContent = '-- Select level --';
  levelSelect.appendChild(emptyLevel);
  for (const levelKey of Object.keys(SMART_TERRAIN_LEVELS)) {
    const option = document.createElement('option');
    option.value = levelKey;
    option.textContent = LEVEL_DISPLAY_NAMES[levelKey] || levelKey;
    levelSelect.appendChild(option);
  }

  const terrainSelect = document.createElement('select');
  terrainSelect.disabled = true;

  const syncTerrainOptions = () => {
    terrainSelect.innerHTML = '';
    const emptyTerrain = document.createElement('option');
    emptyTerrain.value = '';
    emptyTerrain.textContent = levelSelect.value ? '-- Select terrain or placeholder --' : 'Choose a level first';
    terrainSelect.appendChild(emptyTerrain);

    if (!levelSelect.value) {
      terrainSelect.disabled = true;
      return;
    }

    terrainSelect.disabled = false;

    const placeholderTextOpt = document.createElement('option');
    placeholderTextOpt.value = `text:%${levelSelect.value}_panda_st%`;
    placeholderTextOpt.textContent = `Text placeholder (%${levelSelect.value}_panda_st%)`;
    terrainSelect.appendChild(placeholderTextOpt);

    const placeholderKeyOpt = document.createElement('option');
    placeholderKeyOpt.value = `key:%${levelSelect.value}_panda_st_key%`;
    placeholderKeyOpt.textContent = `Command placeholder (%${levelSelect.value}_panda_st_key%)`;
    terrainSelect.appendChild(placeholderKeyOpt);

    for (const terrainKey of SMART_TERRAIN_LEVELS[levelSelect.value] || []) {
      const option = document.createElement('option');
      option.value = `exact:${terrainKey}`;
      option.textContent = terrainKey;
      terrainSelect.appendChild(option);
    }
  };

  const preview = document.createElement('div');
  preview.className = 'command-description';
  const updatePreview = () => {
    const selected = terrainSelect.value;
    if (!selected) {
      preview.textContent = 'Use the text placeholder inside dialogue, the _key placeholder inside command params, or choose a specific smart terrain key.';
      return;
    }

    const [, value] = selected.split(':', 2);
    preview.textContent = `Ready to insert or copy: ${value}`;
  };

  levelSelect.onchange = () => {
    syncTerrainOptions();
    updatePreview();
  };
  terrainSelect.onchange = updatePreview;

  controls.appendChild(levelSelect);
  controls.appendChild(terrainSelect);
  card.appendChild(controls);

  const actions = document.createElement('div');
  actions.className = 'rich-editor-toolbar';

  const insertBtn = document.createElement('button');
  insertBtn.className = 'btn-sm';
  insertBtn.textContent = 'Insert / Copy';
  insertBtn.onclick = () => {
    if (!terrainSelect.value) return;
    const [, value] = terrainSelect.value.split(':', 2);
    insertOrCopyPlaceholder(container, value, triggerButton, '%smart_terrain%');
  };
  actions.appendChild(insertBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-sm';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => {
    triggerButton.classList.remove('active');
    card.remove();
  };
  actions.appendChild(closeBtn);

  card.appendChild(actions);
  updatePreview();
  return card;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function createField(labelText: string, type: string, value: string, onChange: (val: string) => void, hint?: string, fieldKey?: string): HTMLElement {
  const field = document.createElement('div');
  field.className = 'field';
  const resolvedFieldKey = fieldKey || 'field-' + labelText.replace(/\s+/g, '-').toLowerCase();

  const label = document.createElement('label');
  label.textContent = labelText;
  field.appendChild(label);

  if (hint) {
    const hintEl = document.createElement('div');
    hintEl.className = 'field-hint';
    hintEl.textContent = hint;
    field.appendChild(hintEl);
  }

  if (type === 'textarea') {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('data-field-key', resolvedFieldKey);
    textarea.oninput = () => {
      debounced(resolvedFieldKey, () => onChange(textarea.value));
    };
    // Drag-drop support for placeholders
    textarea.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('application/x-panda-placeholder')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        textarea.classList.add('drag-over');
      }
    });
    textarea.addEventListener('dragleave', () => textarea.classList.remove('drag-over'));
    textarea.addEventListener('drop', (e) => {
      textarea.classList.remove('drag-over');
      const text = e.dataTransfer?.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      // Insert at drop position
      let insertPos = textarea.value.length;
      if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range && textarea.contains(range.startContainer)) {
          insertPos = range.startOffset;
        }
      }
      // Fallback: insert at end of current value with a space if needed
      const before = textarea.value.substring(0, insertPos);
      const after = textarea.value.substring(insertPos);
      const needsSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
      textarea.value = before + (needsSpace ? ' ' : '') + text + after;
      textarea.focus();
      const newPos = insertPos + (needsSpace ? 1 : 0) + text.length;
      textarea.setSelectionRange(newPos, newPos);
      onChange(textarea.value);
    });
    field.appendChild(textarea);
  } else {
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.setAttribute('data-field-key', resolvedFieldKey);
    input.oninput = () => {
      debounced(resolvedFieldKey, () => onChange(input.value));
    };
    field.appendChild(input);
  }

  return field;
}

function sectionHeader(title: string, onAdd?: () => void): HTMLElement {
  const header = document.createElement('div');
  header.className = 'section-header';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'section-title';
  titleSpan.textContent = title;
  header.appendChild(titleSpan);

  if (onAdd) {
    const addBtn = createActionButton('Add', `Add a new ${title.toLowerCase().replace(/\s*\(.*/, '')}`, onAdd, 'add');
    addBtn.setAttribute('aria-label', `Add a new ${title.toLowerCase().replace(/\s*\(.*/, '')}`);
    header.appendChild(addBtn);
  }

  return header;
}

function createActionButton(
  label: string,
  title: string,
  onClick: () => void,
  icon: 'add' | 'duplicate' | 'share' | 'delete' = 'add',
  tone: 'default' | 'danger' = 'default',
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn-sm inspector-action-btn${tone === 'danger' ? ' inspector-action-btn-danger' : ''}`;
  setButtonContent(button, icon, label);
  button.title = title;
  button.onclick = (event) => {
    event.stopPropagation();
    onClick();
  };
  return button;
}
