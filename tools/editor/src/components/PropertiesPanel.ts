// P.A.N.D.A. Conversation Editor — Properties Panel (Right Panel)

import { createStateChange, store } from '../lib/state';
import type { BranchInlinePanelState, PropertiesTab } from '../lib/state';
import { createTurnDisplayLabeler } from '../lib/turn-labels';
import type { Conversation, Turn, Choice, PreconditionEntry, AnyPreconditionOption, SimplePrecondition, Outcome, FactionId } from '../lib/types';
import { FACTION_DISPLAY_NAMES, getConversationFaction } from '../lib/types';
import { PRECONDITION_SCHEMAS, OUTCOME_SCHEMAS, groupByCategory } from '../lib/schema';
import {
  getChoiceFieldKey,
  getChoicePreconditionItemFieldKey,
  getChoicePreconditionParamFieldKey,
  getConversationFieldKey,
  getOutcomeChanceFieldKey,
  getOutcomeItemFieldKey,
  getOutcomeParamFieldKey,
  getPreconditionItemFieldKey,
  getPreconditionParamFieldKey,
  getTurnPreconditionItemFieldKey,
  getTurnPreconditionParamFieldKey,
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
import { createCatalogPickerPanelEditor, type CatalogPickerOption } from './CatalogPickerPanel';
import { createCustomNpcBuilderEditor } from './NpcTemplatePanel';
import { formatGameItemLabel } from '../lib/item-catalog';
import { requestFlowCenter } from '../lib/flow-navigation';
import { createUiText } from '../lib/ui-language';

function ui(en: string, ru: string): string {
  return createUiText(store.get().uiLanguage)(en, ru);
}
import {
  acquireCollabLock,
  collabCanEditPath,
  getCollabFieldLock,
  getCollabPathForFieldKey,
  notifyCollabLocalEdit,
  releaseCollabLock,
} from '../lib/collab-session';
import { createBadge, createIcon, setButtonContent } from './icons';
import { STORY_NPC_OPTIONS } from '../lib/generated/story-npc-catalog';
import { setBeginnerTooltip, type BeginnerTooltipPresetId } from '../lib/beginner-tooltips';

const ADDABLE_PRECONDITION_SCHEMAS = PRECONDITION_SCHEMAS.filter((schema) => !schema.pickerHidden);
const NESTED_PRECONDITION_BLOCKLIST = new Set([
  'req_story_npc',
  'req_custom_story_npc',
]);
const CHANNEL_OPTIONS: Array<{ value: 'pda' | 'f2f'; label: string }> = [
  { value: 'pda', label: 'PDA' },
  { value: 'f2f', label: 'In-person (F2F)' },
];
// Editor-side mirror of PANDA_INLINE_EMOJI_TEXTURES in
// gamedata/scripts/pda_private_tab.script. Each entry maps a shortcode to its
// texture id (panda_emoji_<shortcode>, registered in
// configs/ui/textures_descr/ui_panda_emoji.xml) and a 64x64 PNG preview shipped
// under tools/editor/public/emoji/<shortcode>.png for in-browser rendering.
// Keep this list, the Lua map, and the textures_descr XML in sync.
export const PANDA_EMOJI_CATALOG: ReadonlyArray<{ shortcode: string; label: string }> = [
  { shortcode: 'smile',      label: 'Smile' },
  { shortcode: 'laugh',      label: 'Laugh' },
  { shortcode: 'wink',       label: 'Wink' },
  { shortcode: 'ok',         label: 'OK' },
  { shortcode: 'sad',        label: 'Sad' },
  { shortcode: 'cry',        label: 'Cry' },
  { shortcode: 'angry',      label: 'Angry' },
  { shortcode: 'fear',       label: 'Fear' },
  { shortcode: 'love',       label: 'Love' },
  { shortcode: 'thumbsup',   label: 'Thumbs up' },
  { shortcode: 'thumbsdown', label: 'Thumbs down' },
  { shortcode: 'clap',       label: 'Clap' },
  { shortcode: 'wave',       label: 'Wave' },
  { shortcode: 'warning',    label: 'Warning' },
  { shortcode: 'exclaim',    label: 'Exclaim' },
  { shortcode: 'question',   label: 'Question' },
  { shortcode: 'radio',      label: 'Radio' },
  { shortcode: 'pda',        label: 'PDA' },
  { shortcode: 'map',        label: 'Map' },
  { shortcode: 'target',     label: 'Target' },
  { shortcode: 'stash',      label: 'Stash' },
  { shortcode: 'key',        label: 'Key' },
  { shortcode: 'money',      label: 'Money' },
  { shortcode: 'artifact',   label: 'Artifact' },
  { shortcode: 'anomaly',    label: 'Anomaly' },
  { shortcode: 'zone',       label: 'Zone' },
  { shortcode: 'rad',        label: 'Radiation' },
  { shortcode: 'fire',       label: 'Fire' },
  { shortcode: 'skull',      label: 'Skull' },
  { shortcode: 'mutant',     label: 'Mutant' },
  { shortcode: 'gun',        label: 'Gun' },
  { shortcode: 'knife',      label: 'Knife' },
  { shortcode: 'ammo',       label: 'Ammo' },
  { shortcode: 'helmet',     label: 'Helmet' },
  { shortcode: 'armor',      label: 'Armor' },
  { shortcode: 'medkit',     label: 'Medkit' },
  { shortcode: 'food',       label: 'Food' },
  { shortcode: 'drink',      label: 'Drink' },
  { shortcode: 'doc',        label: 'Document' },
];

export const PANDA_EMOJI_FALLBACK_SHORTCODE = 'question';

export const PANDA_EMOJI_SHORTCODES: ReadonlySet<string> = new Set(
  PANDA_EMOJI_CATALOG.map((entry) => entry.shortcode),
);

export function pandaEmojiTextureId(shortcode: string): string {
  return `panda_emoji_${shortcode}`;
}

export function pandaEmojiPreviewUrl(shortcode: string): string {
  return `${import.meta.env.BASE_URL}emoji/${shortcode}.png`;
}

const PANDA_EMOJI_OPTIONS: Array<{ shortcode: string; rawShortcode: string; label: string; previewUrl: string }> =
  PANDA_EMOJI_CATALOG.map((entry) => ({
    shortcode: `:${entry.shortcode}:`,
    rawShortcode: entry.shortcode,
    label: entry.label,
    previewUrl: pandaEmojiPreviewUrl(entry.shortcode),
  }));

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

const CONVERSATION_TEXT_RENDER = createStateChange('conversationList', 'propertiesPanel');
const PROPERTIES_TEXT_RENDER = createStateChange('propertiesPanel');
const SELECTION_TEXT_RENDER = createStateChange('flowEditor', 'propertiesPanel');

function slugTooltipId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'field';
}

function getFieldTooltipPreset(labelText: string): BeginnerTooltipPresetId | null {
  const normalized = labelText.toLowerCase();
  if (normalized === 'label') return 'field-label';
  if (normalized === 'opening message') return 'field-opening-message';
  if (normalized === 'player choice text') return 'field-choice-text';
  if (normalized === 'npc reply') return 'field-npc-reply';
  if (normalized === 'continue as') return 'field-continue-as';
  return null;
}

function getSectionTooltipPreset(title: string): BeginnerTooltipPresetId | null {
  const normalized = title.toLowerCase();
  if (normalized.includes('dynamic placeholders')) return 'section-placeholders';
  if (normalized.includes('emoji')) return 'section-placeholders';
  if (normalized.includes('relationship variant')) return 'section-reply-variants';
  if (normalized.includes('available when talking to')) return 'section-f2f-targeting';
  if (normalized.includes('advanced channel')) return 'section-advanced-channel';
  if (normalized.includes('branch preconditions')) return 'section-branch-preconditions';
  if (normalized.includes('choice preconditions')) return 'section-choice-preconditions';
  if (normalized.includes('preconditions')) return 'section-preconditions';
  if (normalized.includes('outcomes')) return 'section-outcomes';
  if (normalized.includes('continuation')) return 'section-continuation';
  if (normalized.includes('timeout')) return 'section-timeout';
  return null;
}

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
  const tooltipPreset = getSectionTooltipPreset(title);
  if (tooltipPreset) {
    setBeginnerTooltip(wrapper, tooltipPreset);
  }

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

function flushDebounced(key: string): void {
  const timer = debounceTimers.get(key);
  if (timer != null) {
    clearTimeout(timer);
  }
  debounceTimers.delete(key);
  const fn = debounceFns.get(key);
  debounceFns.delete(key);
  if (fn) fn();
}

/** Immediately execute all pending debounced callbacks (used when Enter is pressed). */
export function flushAllDebounced(): void {
  for (const key of [...debounceTimers.keys()]) {
    flushDebounced(key);
  }
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
  setBeginnerTooltip(convTab, 'inspector-story-tab');
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
  setBeginnerTooltip(selTab, 'inspector-selection-tab');
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

  if (state.branchInlinePanel && activeTab === 'selection') {
    renderBranchInlineInspectorSummary(content, conv, state.branchInlinePanel, turnLabels);
  } else if (activeTab === 'conversation') {
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

function renderBranchInlineInspectorSummary(
  container: HTMLElement,
  conv: Conversation,
  inlinePanel: BranchInlinePanelState,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): void {
  const turn = conv.turns.find((candidate) => candidate.turnNumber === inlinePanel.turnNumber);
  const choice = inlinePanel.choiceIndex == null
    ? null
    : turn?.choices.find((candidate) => candidate.index === inlinePanel.choiceIndex) ?? null;

  const section = document.createElement('div');
  section.className = 'inline-inspector-summary';
  const title = document.createElement('div');
  title.className = 'section-title';
  title.textContent = 'Branch Inline Editor';
  section.appendChild(title);

  const summary = document.createElement('div');
  summary.className = 'field-hint';
  if (!turn) {
    summary.textContent = 'Inline branch panel points to branch that no longer exists.';
  } else if (choice) {
    summary.textContent = `${turnLabels.getLongLabel(turn.turnNumber)} / Choice ${choice.index}: editing ${inlinePanel.mode}.`;
  } else {
    summary.textContent = `${turnLabels.getLongLabel(turn.turnNumber)} opener: editing ${inlinePanel.mode}.`;
  }
  section.appendChild(summary);

  if (turn) {
    const facts = document.createElement('div');
    facts.className = 'inline-inspector-facts';
    facts.append(
      createInlineInspectorFact('Branch', turnLabels.getLongLabel(turn.turnNumber)),
      createInlineInspectorFact('Mode', normalizeChannel(turn.channel, normalizeChannel(conv.initialChannel, 'pda')).toUpperCase()),
      createInlineInspectorFact('Choices', String(turn.choices.length)),
    );
    if (choice) {
      facts.append(
        createInlineInspectorFact('Choice checks', String((choice.preconditions ?? []).length)),
        createInlineInspectorFact('Outcomes', String(choice.outcomes.length)),
        createInlineInspectorFact('Next', choice.continueTo == null ? 'Ends here' : turnLabels.getLongLabel(choice.continueTo)),
      );
    } else {
      facts.append(createInlineInspectorFact('Opener checks', String((turn.preconditions ?? []).length)));
    }
    section.appendChild(facts);
  }

  const actions = document.createElement('div');
  actions.className = 'inspector-action-row inspector-action-row-wrap';
  actions.appendChild(createActionButton('Advanced properties', 'Close inline editor and show full advanced properties for selected branch or choice', () => {
    store.closeBranchInlinePanel();
    if (turn) {
      store.selectTurn(turn.turnNumber);
      if (choice) store.selectChoice(choice.index);
    }
    store.setPropertiesTab('selection');
  }, 'add'));
  section.appendChild(actions);
  container.appendChild(section);
}

function createInlineInspectorFact(label: string, value: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'inline-inspector-fact';
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const valueEl = document.createElement('strong');
  valueEl.textContent = value;
  item.append(labelEl, valueEl);
  return item;
}

// ─── Conversation Properties ──────────────────────────────────────────────

function renderConversationProperties(container: HTMLElement, conv: Conversation): void {
  const turnLabels = createTurnDisplayLabeler(conv);
  const advancedMode = store.get().advancedMode;
  // Section title
  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'props-section-intro';
  sectionTitle.innerHTML = `<span class="section-title">General</span>`;
  container.appendChild(sectionTitle);

  // Label
  const conversationLabelFieldKey = getConversationFieldKey(conv.id, 'label');
  const labelField = createField('Label', 'text', conv.label, (val) => {
    store.updateConversation(conv.id, { label: val }, {
      change: CONVERSATION_TEXT_RENDER,
      textSessionKey: conversationLabelFieldKey,
    });
  }, 'A short name for this story (only used in the editor)', conversationLabelFieldKey, {
    onCommit: () => store.commitTextEdit(conversationLabelFieldKey),
  });
  container.appendChild(labelField);

  // Start Mode — controls how this conversation is triggered
  const startModeField = document.createElement('div');
  startModeField.className = 'field';
  setBeginnerTooltip(startModeField, 'field-start-mode');
  const startModeLabel = document.createElement('label');
  startModeLabel.textContent = 'Start Mode';
  startModeField.appendChild(startModeLabel);
  const startModeHint = document.createElement('div');
  startModeHint.className = 'field-hint';
  startModeHint.textContent = 'PDA: conversation triggers via a PDA message. F2F: conversation triggers as a dialogue option when the player talks to the NPC.';
  startModeField.appendChild(startModeHint);
  const startModeSelect = document.createElement('select');
  startModeSelect.className = 'channel-select';
  startModeSelect.dataset.fieldKey = getConversationFieldKey(conv.id, 'start-mode');
  const startModeOptionPda = document.createElement('option');
  startModeOptionPda.value = 'pda';
  startModeOptionPda.textContent = 'PDA (default)';
  const startModeOptionF2f = document.createElement('option');
  startModeOptionF2f.value = 'f2f';
  startModeOptionF2f.textContent = 'Face-to-Face';
  startModeSelect.appendChild(startModeOptionPda);
  startModeSelect.appendChild(startModeOptionF2f);
  startModeSelect.value = conv.startMode ?? 'pda';
  startModeSelect.onchange = () => {
    const nextMode = startModeSelect.value as 'pda' | 'f2f';
    store.updateConversation(conv.id, { startMode: nextMode });
    // setConversationInitialChannel auto-configures Turn 1 channel + entry flags
    store.setConversationInitialChannel(conv.id, nextMode);
  };
  startModeField.appendChild(startModeSelect);
  container.appendChild(startModeField);

  const repeatableWrap = document.createElement('div');
  repeatableWrap.className = 'field';
  const repeatableField = document.createElement('label');
  repeatableField.style.cssText = 'display:flex; flex-direction:row; align-items:center; gap:8px; margin:0;';
  const repeatableInput = document.createElement('input');
  repeatableInput.type = 'checkbox';
  repeatableInput.checked = conv.repeatable !== false;
  repeatableInput.dataset.fieldKey = getConversationFieldKey(conv.id, 'repeatable');
  repeatableInput.onchange = () => {
    store.updateConversation(conv.id, { repeatable: repeatableInput.checked });
  };
  const repeatableText = document.createElement('span');
  repeatableText.textContent = 'Repeatable in Same Playthrough';
  repeatableField.append(repeatableInput, repeatableText);
  const repeatableHint = document.createElement('div');
  repeatableHint.className = 'field-hint';
  repeatableHint.textContent = 'When off, this story will not start again after it finishes or times out in this save.';
  repeatableWrap.append(repeatableField, repeatableHint);
  container.appendChild(repeatableWrap);

  if (advancedMode) {
  const initialChannelField = document.createElement('div');
  initialChannelField.className = 'field';
  setBeginnerTooltip(initialChannelField, 'field-initial-channel');
  const initialChannelLabel = document.createElement('label');
  initialChannelLabel.textContent = 'Initial Conversation Channel';
  initialChannelField.appendChild(initialChannelLabel);
  const initialChannelHint = document.createElement('div');
  initialChannelHint.className = 'field-hint';
  initialChannelHint.textContent = 'Sets how Branch 1 starts. Choose PDA for default text-message flow, or F2F for in-person opener flow.';
  initialChannelField.appendChild(initialChannelHint);
  const initialChannel = normalizeChannel(conv.initialChannel, normalizeChannel(conv.turns.find((turn) => turn.turnNumber === 1)?.channel, 'pda'));
  initialChannelField.appendChild(createChannelSelect(
    initialChannel,
    (nextChannel) => store.setConversationInitialChannel(conv.id, nextChannel),
    getConversationFieldKey(conv.id, 'initial-channel'),
  ));
  container.appendChild(initialChannelField);

  const { wrapper: advancedWrapper, body: advancedBody } = createCollapsibleSection(
    `conv-${conv.id}-advanced-channel-controls`,
    'Advanced Channel Controls',
    undefined,
    { defaultCollapsed: true },
  );
  const advancedHint = document.createElement('div');
  advancedHint.className = 'field-hint';
  advancedHint.style.marginBottom = '10px';
  advancedHint.textContent = 'Use this section for explicit F2F entry metadata and compatibility with legacy channel workflows.';
  advancedBody.appendChild(advancedHint);
  renderF2FEntrySection(advancedBody, conv, turnLabels);
  container.appendChild(advancedWrapper);
  }

  // Preconditions — collapsible section
  const { wrapper: precondWrapper, body: precondBody } = createCollapsibleSection(
    `conv-${conv.id}-preconditions`,
    advancedMode ? `Preconditions (${conv.preconditions.length})` : `When Can This Start? (${conv.preconditions.length})`,
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
        title: ui('Add precondition', 'Добавить предусловие'),
        searchPlaceholder: ui('Search preconditions...', 'Поиск предусловий...'),
        emptyMessage: ui('No matching preconditions', 'Подходящих предусловий нет'),
      });
    },
    { defaultCollapsed: advancedMode },
  );

  if (!advancedMode) {
    renderStartRuleShortcuts(precondBody, conv);
  }
  if (conv.preconditions.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'No preconditions set — this story will trigger for any NPC. Click "+ Add" to add conditions.';
    if (!advancedMode) {
      hint.textContent = 'Pick who can start this story. Friendly NPC is safest first rule.';
    }
    precondBody.appendChild(hint);
  } else {
    renderPreconditionList(precondBody, createConversationPreconditionOwner(conv));
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

  const timeoutMessageFieldKey = getConversationFieldKey(conv.id, 'timeout-message');
  const timeoutMsgField = createField('Timeout Message', 'textarea', conv.timeoutMessage || '', (val) => {
    store.updateConversation(conv.id, { timeoutMessage: val || undefined }, {
      change: PROPERTIES_TEXT_RENDER,
      textSessionKey: timeoutMessageFieldKey,
    });
  }, 'Message shown when the story times out', timeoutMessageFieldKey, {
    onCommit: () => store.commitTextEdit(timeoutMessageFieldKey),
  });
  timeoutBody.appendChild(timeoutMsgField);
  container.appendChild(timeoutWrapper);
}

function renderStartRuleShortcuts(container: HTMLElement, conv: Conversation): void {
  const faction = getConversationFaction(conv);
  const cards = createAuthorShortcutGrid();
  cards.append(
    createAuthorShortcutCard({
      title: 'Any friendly NPC',
      body: 'Story can start from NPCs not hostile to player.',
      onClick: () => addConversationRule(conv, { type: 'simple', command: 'req_npc_friendly', params: [] }),
    }),
    createAuthorShortcutCard({
      title: `Friendly ${FACTION_DISPLAY_NAMES[faction]}`,
      body: `Story can start from friendly ${FACTION_DISPLAY_NAMES[faction]} NPCs only.`,
      onClick: () => {
        const nextRules: PreconditionEntry[] = [
          ...conv.preconditions,
          { type: 'simple', command: 'req_npc_friendly', params: [faction] },
          { type: 'simple', command: 'req_npc_faction', params: [faction] },
        ];
        store.updateConversation(conv.id, { preconditions: nextRules });
      },
    }),
    createAuthorShortcutCard({
      title: 'Named story NPC',
      body: 'Adds named NPC rule. Pick NPC from catalog after card appears.',
      onClick: () => addConversationRule(conv, { type: 'simple', command: 'req_story_npc', params: [''] }),
    }),
  );
  container.appendChild(cards);
}

function addConversationRule(conv: Conversation, rule: PreconditionEntry): void {
  store.updateConversation(conv.id, {
    preconditions: [...conv.preconditions, rule],
  });
}

function createAuthorShortcutGrid(): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'author-shortcut-grid';
  return grid;
}

function createAuthorShortcutCard(options: {
  title: string;
  body: string;
  onClick: () => void;
}): HTMLButtonElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'author-shortcut-card';
  const title = document.createElement('strong');
  title.textContent = options.title;
  const body = document.createElement('span');
  body.textContent = options.body;
  card.append(title, body);
  card.onclick = options.onClick;
  return card;
}

function normalizeChannel(channel: Choice['channel'] | Choice['continue_channel'] | Turn['channel'] | undefined, fallback: 'pda' | 'f2f'): 'pda' | 'f2f' {
  if (channel === 'pda' || channel === 'f2f') return channel;
  return fallback;
}

function isPdaToF2FHandoff(choice: Choice): boolean {
  const choiceChannel = normalizeChannel(choice.channel, 'pda');
  const continueChannel = normalizeChannel(choice.continueChannel ?? choice.continue_channel, 'pda');
  return choiceChannel === 'pda' && continueChannel === 'f2f';
}

function collectSegmentStartTurns(conv: Conversation): Set<number> {
  const segmentStarts = new Set<number>();
  const turnByNumber = new Map(conv.turns.map((candidate) => [candidate.turnNumber, candidate] as const));

  const firstPdaEntryTurn = conv.turns
    .filter((candidate) => normalizeChannel(candidate.channel, 'pda') === 'pda' && candidate.pda_entry === true)
    .sort((a, b) => a.turnNumber - b.turnNumber)[0];
  if (firstPdaEntryTurn) {
    segmentStarts.add(firstPdaEntryTurn.turnNumber);
  } else if (turnByNumber.has(1)) {
    segmentStarts.add(1);
  }

  const firstF2FEntryTurn = conv.turns
    .filter((candidate) => normalizeChannel(candidate.channel, 'pda') === 'f2f' && candidate.f2f_entry === true)
    .sort((a, b) => a.turnNumber - b.turnNumber)[0];
  if (firstF2FEntryTurn) {
    segmentStarts.add(firstF2FEntryTurn.turnNumber);
  }

  for (const sourceTurn of conv.turns) {
    for (const choice of sourceTurn.choices) {
      if (choice.terminal === true || choice.continueTo == null) continue;
      const sourceChannel = normalizeChannel(choice.channel, 'pda');
      const destinationChannel = normalizeChannel(choice.continueChannel ?? choice.continue_channel, 'pda');
      if (sourceChannel === destinationChannel) continue;
      if (turnByNumber.has(choice.continueTo)) {
        segmentStarts.add(choice.continueTo);
      }
    }
  }

  return segmentStarts;
}

function renderF2FEntrySection(
  container: HTMLElement,
  conv: Conversation,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): void {
  const f2fTurns = conv.turns
    .filter((turn) => normalizeChannel(turn.channel, 'pda') === 'f2f')
    .sort((a, b) => a.turnNumber - b.turnNumber);
  const turnByNumber = new Map(conv.turns.map((turn) => [turn.turnNumber, turn] as const));
  const invalidPdaToF2FHandoffs: Array<{ fromTurnNumber: number; choiceIndex: number; reason: string }> = [];

  for (const turn of conv.turns) {
    for (const choice of turn.choices) {
      if (!isPdaToF2FHandoff(choice) || choice.continueTo == null) continue;
      const target = turnByNumber.get(choice.continueTo);
      if (!target) {
        invalidPdaToF2FHandoffs.push({
          fromTurnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          reason: `target ${choice.continueTo} does not exist`,
        });
        continue;
      }
      if (target.f2f_entry !== true) {
        invalidPdaToF2FHandoffs.push({
          fromTurnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          reason: `${turnLabels.getCompactLabel(target.turnNumber)} is not marked as an F2F entry turn`,
        });
        continue;
      }
    }
  }

  const f2fEntryBody = document.createElement('div');

  const f2fEntryHint = document.createElement('div');
  f2fEntryHint.className = 'field-hint';
  f2fEntryHint.style.marginBottom = '10px';
  f2fEntryHint.textContent = 'Mark entry turn(s) for F2F and configure optional first-actor behavior if your runtime supports it.';
  f2fEntryBody.appendChild(f2fEntryHint);

  if (invalidPdaToF2FHandoffs.length > 0) {
    const warningWrap = document.createElement('div');
    warningWrap.style.cssText = 'border:1px solid var(--warning); border-radius:8px; padding:10px; margin:0 0 10px 0; background:color-mix(in srgb, var(--warning) 8%, transparent);';

    const warningHeader = document.createElement('div');
    warningHeader.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:6px;';
    warningHeader.appendChild(createBadge('warning', 'Blocking warning', 'warning'));
    const warningTitle = document.createElement('strong');
    warningTitle.textContent = 'PDA → F2F handoff is invalid until a valid F2F entry turn is configured.';
    warningHeader.appendChild(warningTitle);
    warningWrap.appendChild(warningHeader);

    const warningList = document.createElement('ul');
    warningList.style.cssText = 'margin:0; padding-left:18px;';
    for (const item of invalidPdaToF2FHandoffs) {
      const li = document.createElement('li');
      li.textContent = `${turnLabels.getCompactLabel(item.fromTurnNumber)} / Choice ${item.choiceIndex}: ${item.reason}.`;
      warningList.appendChild(li);
    }
    warningWrap.appendChild(warningList);
    f2fEntryBody.appendChild(warningWrap);
  }

  if (f2fTurns.length === 0) {
    const emptyHint = document.createElement('div');
    emptyHint.className = 'empty-hint';
    emptyHint.textContent = 'No F2F turns yet. Set a turn visibility channel to In-person (F2F) first.';
    f2fEntryBody.appendChild(emptyHint);
    container.appendChild(f2fEntryBody);
    return;
  }

  for (const turn of f2fTurns) {
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.style.marginBottom = '10px';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'choice-card-header';
    const title = document.createElement('span');
    title.className = 'choice-card-title';
    title.textContent = turnLabels.getLongLabel(turn.turnNumber);
    cardHeader.appendChild(title);

    const channelBadge = document.createElement('span');
    channelBadge.style.cssText = 'font-size:10px; font-family:var(--font-mono); color:var(--accent);';
    channelBadge.textContent = 'F2F';
    cardHeader.appendChild(channelBadge);
    card.appendChild(cardHeader);

    const body = document.createElement('div');
    body.style.cssText = 'padding:8px;';

    const entryToggleField = document.createElement('label');
    entryToggleField.className = 'choice-chip';
    entryToggleField.style.cssText = 'display:inline-flex; align-items:center; gap:8px; margin-bottom:8px;';
    const entryInput = document.createElement('input');
    entryInput.type = 'checkbox';
    entryInput.checked = turn.f2f_entry === true;
    entryInput.setAttribute('data-field-key', getTurnFieldKey(conv.id, turn.turnNumber, 'f2f-entry'));
    entryInput.onchange = () => store.updateTurn(conv.id, turn.turnNumber, { f2f_entry: entryInput.checked });
    const entryText = document.createElement('span');
    entryText.textContent = 'Use as F2F entry turn';
    entryToggleField.append(entryInput, entryText);
    body.appendChild(entryToggleField);

    const firstSpeakerField = document.createElement('div');
    firstSpeakerField.className = 'field';
    const firstSpeakerLabel = document.createElement('label');
    firstSpeakerLabel.textContent = 'First actor (optional runtime override)';
    firstSpeakerField.appendChild(firstSpeakerLabel);
    const firstSpeakerHint = document.createElement('div');
    firstSpeakerHint.className = 'field-hint';
    firstSpeakerHint.textContent = 'Use if your runtime supports actor-first alternatives. Default remains NPC-first.';
    firstSpeakerField.appendChild(firstSpeakerHint);
    const firstSpeakerSelect = document.createElement('select');
    firstSpeakerSelect.value = turn.firstSpeaker === 'player' ? 'player' : 'npc';
    firstSpeakerSelect.setAttribute('data-field-key', getTurnFieldKey(conv.id, turn.turnNumber, 'first-speaker'));
    [
      { value: 'npc', label: 'NPC first (default)' },
      { value: 'player', label: 'Player first (runtime-dependent)' },
    ].forEach((option) => {
      const el = document.createElement('option');
      el.value = option.value;
      el.textContent = option.label;
      el.selected = option.value === firstSpeakerSelect.value;
      firstSpeakerSelect.appendChild(el);
    });
    firstSpeakerSelect.onchange = () => {
      const nextFirstSpeaker = firstSpeakerSelect.value === 'player' ? 'player' : 'npc';
      store.updateTurn(conv.id, turn.turnNumber, {
        firstSpeaker: nextFirstSpeaker,
        requiresNpcFirst: nextFirstSpeaker === 'npc',
      });
    };
    firstSpeakerField.appendChild(firstSpeakerSelect);
    body.appendChild(firstSpeakerField);

    const requiresNpcFirstField = document.createElement('label');
    requiresNpcFirstField.className = 'choice-chip';
    requiresNpcFirstField.style.cssText = 'display:inline-flex; align-items:center; gap:8px;';
    const requiresNpcFirstInput = document.createElement('input');
    requiresNpcFirstInput.type = 'checkbox';
    requiresNpcFirstInput.checked = turn.requiresNpcFirst ?? true;
    requiresNpcFirstInput.setAttribute('data-field-key', getTurnFieldKey(conv.id, turn.turnNumber, 'requires-npc-first'));
    requiresNpcFirstInput.onchange = () => store.updateTurn(conv.id, turn.turnNumber, { requiresNpcFirst: requiresNpcFirstInput.checked });
    const requiresNpcFirstText = document.createElement('span');
    requiresNpcFirstText.textContent = 'Require NPC opener before responses';
    requiresNpcFirstField.append(requiresNpcFirstInput, requiresNpcFirstText);
    body.appendChild(requiresNpcFirstField);

    const continuationHint = document.createElement('div');
    continuationHint.className = 'field-hint';
    continuationHint.style.marginTop = '8px';
    continuationHint.textContent = 'F2F continuation turns use normal back-and-forth flow; author opening text on segment starts.';
    body.appendChild(continuationHint);

    card.appendChild(body);
    f2fEntryBody.appendChild(card);
  }

  container.appendChild(f2fEntryBody);
}

function channelLabel(channel: 'pda' | 'f2f'): string {
  if (channel === 'pda') return 'PDA';
  return 'F2F';
}

function createChannelSelect(
  value: 'pda' | 'f2f',
  onChange: (value: 'pda' | 'f2f') => void,
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
  select.onchange = () => onChange(select.value as 'pda' | 'f2f');
  return select;
}

// ─── Turn Properties ──────────────────────────────────────────────────────

function renderTurnProperties(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): void {
  const currentTurnChannel = normalizeChannel(turn.channel, 'pda');
  const effectivePdaEntry = turn.pda_entry ?? turn.turnNumber === 1;
  const effectiveF2FEntry = turn.f2f_entry ?? false;
  const segmentStartTurns = collectSegmentStartTurns(conv);
  const isSegmentStartTurn = segmentStartTurns.has(turn.turnNumber);
  const canPasteChoice = store.hasCopiedChoice(conv.id) && turn.choices.length < 4;
  const advancedMode = store.get().advancedMode;
  const title = document.createElement('div');
  title.className = 'section-header';
  const titleSpan = document.createElement('span');
  titleSpan.className = 'section-title';
  titleSpan.textContent = turnLabels.getLongLabel(turn.turnNumber);
  title.appendChild(titleSpan);
  container.appendChild(title);

  const isNonEntryF2FTurn = currentTurnChannel === 'f2f' && !effectiveF2FEntry;
  const hasNewBranchSpeaker = !!(
    (turn.speaker_npc_id && turn.speaker_npc_id.trim() !== '')
    || ((turn.speaker_npc_faction_filters?.length ?? 0) > 0)
    || turn.speaker_allow_generic_stalker === true
  );
  const isF2FContinuationSameNpc = isNonEntryF2FTurn && !hasNewBranchSpeaker;
  const hasOpeningText = (turn.openingMessage ?? '').trim().length > 0;

  if (isSegmentStartTurn) {
    const openingMessageFieldKey = getTurnFieldKey(conv.id, turn.turnNumber, 'opening-message');
    const msgField = createField('Opening Message', 'textarea', turn.openingMessage || '', (val) => {
      store.updateTurn(conv.id, turn.turnNumber, { openingMessage: val }, {
        change: SELECTION_TEXT_RENDER,
        textSessionKey: openingMessageFieldKey,
      });
    }, 'Opening text for this segment start turn. Re-enter opener text only when the flow starts a new channel segment.', openingMessageFieldKey, {
      onCommit: () => store.commitTextEdit(openingMessageFieldKey),
    });
    container.appendChild(msgField);

    renderEmojiPicker(container, `conv-${conv.id}-turn-${turn.turnNumber}-opening-emojis`);

    const openingAudioFieldKey = getTurnFieldKey(conv.id, turn.turnNumber, 'opening-audio');
    const openingAudioField = createField('Opening Audio', 'text', turn.openingAudio || '', (val) => {
      store.updateTurn(conv.id, turn.turnNumber, { openingAudio: val.trim() || undefined });
    }, 'Optional sound filename under gamedata/sounds/panda/audio. Extension is optional; playback waits for player click.', openingAudioFieldKey);
    container.appendChild(openingAudioField);
  } else if (!isF2FContinuationSameNpc) {
    const openingMessageFieldKey = getTurnFieldKey(conv.id, turn.turnNumber, 'opening-message');
    const newSpeakerLabel = hasNewBranchSpeaker ? 'NPC Opener' : 'NPC Opener (Optional)';
    const newSpeakerHint = hasNewBranchSpeaker
      ? 'Required. This branch hands off to a different NPC, so they need an opening message to introduce the new speaker.'
      : 'Optional. NPCs can send multiple messages in a row — add an opener here if this NPC should send a follow-up message before player choices appear.';
    const msgField = createField(newSpeakerLabel, 'textarea', turn.openingMessage || '', (val) => {
      store.updateTurn(conv.id, turn.turnNumber, { openingMessage: val }, {
        change: SELECTION_TEXT_RENDER,
        textSessionKey: openingMessageFieldKey,
      });
    }, newSpeakerHint, openingMessageFieldKey, {
      onCommit: () => store.commitTextEdit(openingMessageFieldKey),
    });
    container.appendChild(msgField);

    renderEmojiPicker(container, `conv-${conv.id}-turn-${turn.turnNumber}-opening-emojis`);
  } else {
    const openerHintField = document.createElement('div');
    openerHintField.className = 'field';
    openerHintField.setAttribute('data-field-key', getTurnFieldKey(conv.id, turn.turnNumber, 'opening-message'));
    const openerHintLabel = document.createElement('label');
    openerHintLabel.textContent = 'Opening Message';
    openerHintLabel.style.opacity = '0.75';
    openerHintField.appendChild(openerHintLabel);
    const openerHint = document.createElement('div');
    openerHint.className = 'field-hint';
    openerHint.textContent = `Not applicable on non-entry F2F continuation turns — opener text is not exported for these branches.`;
    openerHintField.appendChild(openerHint);

    if (hasOpeningText) {
      const openerPreview = document.createElement('div');
      openerPreview.className = 'field-hint';
      openerPreview.style.cssText = 'margin-top:6px; padding:8px; border:1px dashed var(--border); border-radius:8px; color:var(--text-dim); white-space:pre-wrap;';
      openerPreview.textContent = `Legacy opener text retained for cleanup: ${turn.openingMessage}`;
      openerHintField.appendChild(openerPreview);
    }
    container.appendChild(openerHintField);
  }

  if (hasOpeningText && isF2FContinuationSameNpc) {
    const warningRow = document.createElement('div');
    warningRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-top:-2px; margin-bottom:8px; flex-wrap:wrap;';
    warningRow.appendChild(createBadge('warning', 'Migration cleanup: ignored non-entry F2F opener', 'warning'));

    const warningText = document.createElement('div');
    warningText.className = 'field-hint';
    warningText.style.margin = '0';
    warningText.textContent = 'This opener text is ignored for non-entry F2F branches. Keep opener text only at segment starts and remove legacy continuation opener text.';
    warningRow.appendChild(warningText);
    container.appendChild(warningRow);
  }

  renderPlaceholderPicker(container, `conv-${conv.id}-turn-${turn.turnNumber}-dynamic-placeholders`);

  const { wrapper: branchPrecondWrapper, body: branchPrecondBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-preconditions`,
    advancedMode ? `Branch Preconditions (${(turn.preconditions ?? []).length})` : `When Can This Scene Happen? (${(turn.preconditions ?? []).length})`,
    (trigger) => {
      showCommandPicker(trigger, getAddablePreconditionSchemas('turn'), (schema) => {
        const newPrecond: SimplePrecondition = {
          type: 'simple',
          command: schema.name,
          params: schema.params.map(p => p.placeholder || ''),
        };
        const nextPreconditions = [...(turn.preconditions ?? []), newPrecond];
        store.updateTurn(conv.id, turn.turnNumber, { preconditions: nextPreconditions });
      }, {
        title: ui('Add branch precondition', 'Добавить предусловие ветки'),
        searchPlaceholder: ui('Search branch preconditions...', 'Поиск предусловий ветки...'),
        emptyMessage: ui('No matching branch preconditions', 'Подходящих предусловий ветки нет'),
      });
    },
    { defaultCollapsed: advancedMode },
  );
  if ((turn.preconditions ?? []).length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'No branch preconditions — this branch is available whenever the story reaches it.';
    branchPrecondBody.appendChild(hint);
  } else {
    renderPreconditionList(branchPrecondBody, createTurnPreconditionOwner(conv, turn));
  }
  container.appendChild(branchPrecondWrapper);

  const pdaEntryAllowed = currentTurnChannel !== 'f2f';
  const f2fEntryAllowed = currentTurnChannel !== 'pda';

  const createEntryToggle = (
    label: string,
    checked: boolean,
    key: 'pda_entry' | 'f2f_entry',
    fieldSuffix: 'pda-entry' | 'f2f-entry',
    enabled: boolean,
  ): HTMLElement => {
    const wrapper = document.createElement('label');
    wrapper.style.cssText = 'display:inline-flex; align-items:center; gap:6px; font-size:12px;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = enabled ? checked : false;
    input.disabled = !enabled;
    input.setAttribute('data-field-key', getTurnFieldKey(conv.id, turn.turnNumber, fieldSuffix));
    input.onchange = () => store.updateTurn(conv.id, turn.turnNumber, { [key]: input.checked });
    const text = document.createElement('span');
    text.textContent = label;
    if (!enabled) {
      text.style.opacity = '0.65';
    }
    wrapper.append(input, text);
    return wrapper;
  };

  if (advancedMode) {
  const { wrapper: turnAdvancedWrapper, body: turnAdvancedBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-advanced-channel-controls`,
    'Advanced Channel Controls',
    undefined,
    { defaultCollapsed: true },
  );
  const visibilityWrapper = document.createElement('div');
  visibilityWrapper.className = 'field';
  const visibilityLabel = document.createElement('label');
  visibilityLabel.textContent = 'Turn Visibility Channel';
  visibilityWrapper.appendChild(visibilityLabel);
  const visibilityHint = document.createElement('div');
  visibilityHint.className = 'field-hint';
  visibilityHint.textContent = 'Turns are exclusive to one channel: PDA or in-person (F2F). Legacy "Both" values are migrated to PDA.';
  visibilityWrapper.appendChild(visibilityHint);
  visibilityWrapper.appendChild(createChannelSelect(
    currentTurnChannel,
    (nextChannel) => store.updateTurn(conv.id, turn.turnNumber, {
      channel: nextChannel,
      ...(nextChannel === 'pda' ? { f2f_entry: false } : { pda_entry: false }),
    }),
    getTurnFieldKey(conv.id, turn.turnNumber, 'channel'),
  ));
  turnAdvancedBody.appendChild(visibilityWrapper);

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
  entryScopeRow.append(
    createEntryToggle('PDA entry turn', effectivePdaEntry, 'pda_entry', 'pda-entry', pdaEntryAllowed),
    createEntryToggle('F2F entry turn', effectiveF2FEntry, 'f2f_entry', 'f2f-entry', f2fEntryAllowed),
  );
  entryScopeField.appendChild(entryScopeRow);
  turnAdvancedBody.appendChild(entryScopeField);
  container.appendChild(turnAdvancedWrapper);
  }

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
    const effectiveTurnChannel = normalizeChannel(turn.channel, 'pda');
    const effectiveChoiceChannel = normalizeChannel(choice.channel, effectiveTurnChannel);
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
    channelBadge.textContent = channelLabel(effectiveChoiceChannel);
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

    const delBtn = createActionButton('X', 'Delete this choice', () => {
      store.deleteChoice(conv.id, turn.turnNumber, choice.index);
    }, 'delete', 'danger');
    delBtn.setAttribute('aria-label', `Delete Choice ${choice.index}`);
    actionGroup.appendChild(delBtn);

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
      const rawContinueChannel = choice.continueChannel ?? choice.continue_channel;
      const effectiveContinueChannel = normalizeChannel(rawContinueChannel, effectiveChoiceChannel);
      badge.textContent = `\u2192 ${channelLabel(effectiveContinueChannel)} to ${turnLabels.getLongLabel(choice.continueTo)}`;
      if (choice.cont_npc_id) {
        badge.textContent += ` \u2022 NPC: ${choice.cont_npc_id}`;
      }
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
  const advancedMode = store.get().advancedMode;
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

  const deleteBtn = createActionButton('X', 'Delete this choice', () => {
    store.deleteChoice(conv.id, turn.turnNumber, choice.index);
  }, 'delete', 'danger');
  deleteBtn.setAttribute('aria-label', `Delete Choice ${choice.index}`);
  titleActions.appendChild(deleteBtn);

  title.appendChild(titleActions);
  container.appendChild(title);

  // Choice text
  const choiceTextFieldKey = getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'text');
  const textField = createField('Player Choice Text', 'textarea', choice.text, (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { text: val }, {
      change: SELECTION_TEXT_RENDER,
      textSessionKey: choiceTextFieldKey,
    });
  }, 'What the player says when choosing this option', choiceTextFieldKey, {
    onCommit: () => store.commitTextEdit(choiceTextFieldKey),
  });
  container.appendChild(textField);
  renderEmojiPicker(container, `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-text-emojis`);

  // NPC Reply
  const choiceReplyFieldKey = getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply');
  const replyField = createField('NPC Reply', 'textarea', choice.reply, (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { reply: val }, {
      change: SELECTION_TEXT_RENDER,
      textSessionKey: choiceReplyFieldKey,
    });
  }, 'The NPC\'s response to this choice', choiceReplyFieldKey, {
    onCommit: () => store.commitTextEdit(choiceReplyFieldKey),
  });
  container.appendChild(replyField);
  renderEmojiPicker(container, `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-reply-emojis`);

  const replyAudioFieldKey = getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply-audio');
  const replyAudioField = createField('NPC Reply Audio', 'text', choice.replyAudio || '', (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyAudio: val.trim() || undefined });
  }, 'Optional sound filename under gamedata/sounds/panda/audio. Extension is optional; playback waits for player click.', replyAudioFieldKey);
  container.appendChild(replyAudioField);

  renderPlaceholderPicker(container, `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-dynamic-placeholders`);

  const { wrapper: replyVariantsWrapper, body: replyVariantsBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-relationship-variants`,
    'Relationship Variant Replies',
    undefined,
    { defaultCollapsed: true },
  );

  const replyRelHighFieldKey = getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply-rel-high');
  const relHighField = createField('Reply (High Relationship, \u2265300)', 'textarea', choice.replyRelHigh || '', (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyRelHigh: val || undefined }, {
      change: PROPERTIES_TEXT_RENDER,
      textSessionKey: replyRelHighFieldKey,
    });
  }, 'Alternative reply when relationship score is 300 or higher (optional)', replyRelHighFieldKey, {
    onCommit: () => store.commitTextEdit(replyRelHighFieldKey),
  });
  replyVariantsBody.appendChild(relHighField);

  const replyRelLowFieldKey = getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply-rel-low');
  const relLowField = createField('Reply (Low Relationship, \u2264-300)', 'textarea', choice.replyRelLow || '', (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyRelLow: val || undefined }, {
      change: PROPERTIES_TEXT_RENDER,
      textSessionKey: replyRelLowFieldKey,
    });
  }, 'Alternative reply when relationship score is -300 or lower (optional)', replyRelLowFieldKey, {
    onCommit: () => store.commitTextEdit(replyRelLowFieldKey),
  });
  replyVariantsBody.appendChild(relLowField);
  container.appendChild(replyVariantsWrapper);

  const { wrapper: choicePrecondWrapper, body: choicePrecondBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-preconditions`,
    advancedMode ? `Choice Preconditions (${(choice.preconditions ?? []).length})` : `When Can This Reply Show? (${(choice.preconditions ?? []).length})`,
    (trigger) => {
      showCommandPicker(trigger, getAddablePreconditionSchemas('choice'), (schema) => {
        const newPrecond: SimplePrecondition = {
          type: 'simple',
          command: schema.name,
          params: schema.params.map(p => p.placeholder || ''),
        };
        const nextPreconditions = [...(choice.preconditions ?? []), newPrecond];
        store.updateChoice(conv.id, turn.turnNumber, choice.index, { preconditions: nextPreconditions });
      }, {
        title: ui('Add choice precondition', 'Добавить предусловие ответа'),
        searchPlaceholder: ui('Search choice preconditions...', 'Поиск предусловий ответа...'),
        emptyMessage: ui('No matching choice preconditions', 'Подходящих предусловий ответа нет'),
      });
    },
    { defaultCollapsed: advancedMode },
  );
  if ((choice.preconditions ?? []).length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'No choice preconditions — this option is always visible when this branch is active.';
    choicePrecondBody.appendChild(hint);
  } else {
    renderPreconditionList(choicePrecondBody, createChoicePreconditionOwner(conv, turn, choice));
  }
  container.appendChild(choicePrecondWrapper);

  if (advancedMode) {
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
  }

  // Outcomes — collapsible section
  const { wrapper: outcomeWrapper, body: outcomeBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-outcomes`,
    advancedMode ? `Outcomes (${choice.outcomes.length})` : `What Happens After This Reply? (${choice.outcomes.length})`,
    (trigger) => {
      showCommandPicker(trigger, OUTCOME_SCHEMAS, (schema) => {
        const newOutcome: Outcome = {
          command: schema.name,
          params: schema.params.map(p => p.placeholder || ''),
        };
        store.appendOutcomeToChoice(conv.id, turn.turnNumber, choice.index, newOutcome);
      }, {
        title: ui('Add outcome', 'Добавить результат'),
        searchPlaceholder: ui('Search outcomes...', 'Поиск результатов...'),
        emptyMessage: ui('No matching outcomes', 'Подходящих результатов нет'),
      });
    },
    { defaultCollapsed: advancedMode },
  );

  if (!advancedMode) {
    renderEffectShortcuts(outcomeBody, conv, turn, choice);
  }
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
    advancedMode ? 'Continuation / Branching' : 'Next Scene',
    undefined,
    { defaultCollapsed: advancedMode },
  );

  if (!advancedMode) {
    renderAuthorContinuationControls(continuationBody, conv, turn, choice, turnLabels);
    container.appendChild(continuationWrapper);
    return;
  }

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

  const currentTurnChannel = normalizeChannel(turn.channel, normalizeChannel(conv.initialChannel, 'pda'));
  const currentChoiceChannel = currentTurnChannel;
  const currentContinuationChannel = normalizeChannel(choice.continueChannel ?? choice.continue_channel, currentChoiceChannel);
  const continueAsField = document.createElement('div');
  continueAsField.className = 'field';
  setBeginnerTooltip(continueAsField, 'field-continue-as');
  const continueAsLabel = document.createElement('label');
  continueAsLabel.textContent = 'Continue As';
  continueAsField.appendChild(continueAsLabel);
  const continueAsHint = document.createElement('div');
  continueAsHint.className = 'field-hint';
  continueAsHint.textContent = 'Choices inherit this branch channel automatically. If no continuation turn is linked yet, Continue as PDA/F2F now creates one and links it for you.';
  continueAsField.appendChild(continueAsHint);
  const continueAsRow = document.createElement('div');
  continueAsRow.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap;';
  const createContinueAsButton = (channel: 'pda' | 'f2f', label: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn-sm${currentContinuationChannel === channel ? ' active' : ''}`;
    button.textContent = label;
    button.onclick = () => {
      if (choice.continueTo == null) {
        const createdTurnNumber = store.ensureChoiceContinuationTurn(conv.id, turn.turnNumber, choice.index, channel);
        if (createdTurnNumber != null) {
          requestFlowCenter({ conversationId: conv.id, turnNumber: createdTurnNumber });
        }
        return;
      }
      store.setChoiceContinuationChannel(conv.id, turn.turnNumber, choice.index, channel);
    };
    return button;
  };
  continueAsRow.append(
    createContinueAsButton('pda', 'Continue as PDA'),
    createContinueAsButton('f2f', 'Continue as F2F'),
  );
  continueAsField.appendChild(continueAsRow);
  const requiresNewF2FSegment = currentChoiceChannel !== currentContinuationChannel && currentContinuationChannel === 'f2f';
  const continuationDetails = document.createElement('div');
  continuationDetails.className = 'field-hint';
  continuationDetails.style.marginTop = '8px';
  continuationDetails.textContent = choice.continueTo == null
    ? 'No continuation target linked yet: choosing Continue as PDA/F2F will create and link a new branch turn with the selected channel preset.'
    : (requiresNewF2FSegment
      ? 'New F2F segment: the target turn is auto-marked as F2F entry and should include an Opening Message.'
      : 'Same-channel continuation: no entry opener metadata is required on the next turn.');
  continueAsField.appendChild(continuationDetails);
  continuationBody.appendChild(continueAsField);

  const pdaDelayField = document.createElement('div');
  pdaDelayField.className = 'field';
  const pdaDelayLabel = document.createElement('label');
  pdaDelayLabel.textContent = 'Delay Before PDA Follow-up (seconds)';
  pdaDelayField.appendChild(pdaDelayLabel);
  const pdaDelayHint = document.createElement('div');
  pdaDelayHint.className = 'field-hint';
  pdaDelayHint.textContent = 'Only used when this F2F choice continues as PDA. Leave blank or use 0 for an immediate follow-up after the face-to-face dialog closes.';
  pdaDelayField.appendChild(pdaDelayHint);
  const pdaDelayFieldKey = getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'pda-delay-seconds');
  const pdaDelayInput = document.createElement('input');
  pdaDelayInput.type = 'number';
  pdaDelayInput.min = '0';
  pdaDelayInput.step = '1';
  pdaDelayInput.placeholder = '0';
  pdaDelayInput.value = choice.pdaDelaySeconds != null ? String(choice.pdaDelaySeconds) : '';
  pdaDelayInput.setAttribute('data-field-key', pdaDelayFieldKey);
  pdaDelayInput.oninput = () => {
    debounced(pdaDelayFieldKey, () => {
      const trimmed = pdaDelayInput.value.trim();
      if (trimmed === '') {
        store.updateChoice(conv.id, turn.turnNumber, choice.index, { pdaDelaySeconds: undefined });
        return;
      }
      const parsed = Number.parseInt(trimmed, 10);
      store.updateChoice(conv.id, turn.turnNumber, choice.index, {
        pdaDelaySeconds: Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined,
      });
    });
  };
  pdaDelayField.appendChild(pdaDelayInput);
  continuationBody.appendChild(pdaDelayField);

  // Multi-NPC handoff: pick a different NPC to deliver the next continuation turn
  const contNpcField = document.createElement('div');
  contNpcField.className = 'field';
  const contNpcLabel = document.createElement('label');
  contNpcLabel.textContent = 'Hand off to Different NPC';
  contNpcField.appendChild(contNpcLabel);
  const contNpcHint = document.createElement('div');
  contNpcHint.className = 'field-hint';
  contNpcHint.textContent = 'When this choice continues to the next branch, the specified NPC will send those messages instead of the current sender. Leave blank to keep the same NPC.';
  contNpcField.appendChild(contNpcHint);
  const contNpcEditor = createOptionPickerPanelEditor(
    choice.cont_npc_id ?? '',
    (value) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { cont_npc_id: value.trim() || undefined }),
    getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'cont-npc-id'),
    {
      title: 'NPC Handoff Catalog',
      subtitle: 'Select the NPC who should deliver the next branch.',
      searchPlaceholder: 'Search by NPC id, faction, or role...',
      emptyLabel: 'Same NPC continues',
      options: STORY_NPC_OPTIONS,
    },
  );
  contNpcField.appendChild(contNpcEditor);
  continuationBody.appendChild(contNpcField);

  const { wrapper: choiceAdvancedWrapper, body: choiceAdvancedBody } = createCollapsibleSection(
    `conv-${conv.id}-turn-${turn.turnNumber}-choice-${choice.index}-advanced-channel-controls`,
    'Advanced Channel Controls',
    undefined,
    { defaultCollapsed: true },
  );
  const choiceVisibilityHint = document.createElement('div');
  choiceVisibilityHint.className = 'field-hint';
  choiceVisibilityHint.textContent = `Choice visibility is inherited from Branch ${turn.turnNumber} (${channelLabel(currentChoiceChannel)}).`;
  choiceAdvancedBody.appendChild(choiceVisibilityHint);

  const handoffField = document.createElement('div');
  handoffField.className = 'field';
  const handoffLabel = document.createElement('label');
  handoffLabel.textContent = 'Explicit Handoff Channel';
  handoffField.appendChild(handoffLabel);
  const handoffHint = document.createElement('div');
  handoffHint.className = 'field-hint';
  handoffHint.textContent = 'Used when this choice continues to another turn. Handoffs are exclusive to PDA or F2F.';
  handoffField.appendChild(handoffHint);
  const handoffSelect = createChannelSelect(
    currentContinuationChannel,
    (nextChannel) => store.setChoiceContinuationChannel(conv.id, turn.turnNumber, choice.index, nextChannel),
    getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-channel'),
  );
  handoffField.appendChild(handoffSelect);
  choiceAdvancedBody.appendChild(handoffField);
  continuationBody.appendChild(choiceAdvancedWrapper);

  container.appendChild(continuationWrapper);
}

function renderEffectShortcuts(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice): void {
  const addOutcome = (outcome: Outcome): void => {
    store.appendOutcomeToChoice(conv.id, turn.turnNumber, choice.index, outcome);
  };

  const cards = createAuthorShortcutGrid();
  cards.append(
    createAuthorShortcutCard({
      title: 'Give 500 RU',
      body: 'Reward player with money after this reply.',
      onClick: () => addOutcome({ command: 'reward_money', params: ['500'] }),
    }),
    createAuthorShortcutCard({
      title: 'Give medkit',
      body: 'Put a basic medkit in player inventory.',
      onClick: () => addOutcome({ command: 'give_item', params: ['medkit'] }),
    }),
    createAuthorShortcutCard({
      title: 'Send to location',
      body: 'Mark Cordon location on map. Author can change place after.',
      onClick: () => addOutcome({ command: 'watch_location', params: ['%cordon_panda_st_key%', '85'] }),
    }),
    createAuthorShortcutCard({
      title: 'Improve goodwill',
      body: 'Make chosen faction like player a bit more.',
      onClick: () => addOutcome({ command: 'reward_gw', params: ['50', getConversationFaction(conv)] }),
    }),
  );
  container.appendChild(cards);
}

function renderAuthorContinuationControls(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  choice: Choice,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): void {
  const field = document.createElement('div');
  field.className = 'field';
  const label = document.createElement('label');
  label.textContent = 'Next scene';
  field.appendChild(label);

  const summary = document.createElement('div');
  summary.className = 'field-hint';
  if (choice.continueTo == null) {
    summary.textContent = 'This reply ends story. Add follow-up scene to continue branch.';
  } else {
    const channel = normalizeChannel(choice.continueChannel ?? choice.continue_channel, normalizeChannel(turn.channel, 'pda'));
    summary.textContent = `Continues as ${channelLabel(channel)} to ${turnLabels.getLongLabel(choice.continueTo)}.`;
  }
  field.appendChild(summary);

  const row = document.createElement('div');
  row.className = 'inspector-action-row inspector-action-row-wrap';

  const addFollowUp = (channel: 'pda' | 'f2f'): void => {
    const createdTurnNumber = store.ensureChoiceContinuationTurn(conv.id, turn.turnNumber, choice.index, channel);
    if (createdTurnNumber != null) {
      requestFlowCenter({ conversationId: conv.id, turnNumber: createdTurnNumber });
    }
  };
  row.append(
    createActionButton('Add PDA follow-up', 'Create or retarget next scene as PDA message', () => addFollowUp('pda'), 'add'),
    createActionButton('Add in-person follow-up', 'Create or retarget next scene as face-to-face talk', () => addFollowUp('f2f'), 'add'),
  );

  if (choice.continueTo != null) {
    const endHere = createActionButton('End story here', 'Remove next scene link from this reply', () => {
      store.clearChoiceContinuation(conv.id, turn.turnNumber, choice.index);
    }, 'delete');
    row.appendChild(endHere);
  }

  field.appendChild(row);
  container.appendChild(field);
}

// ─── Precondition List ────────────────────────────────────────────────────

type PreconditionPathSegment = number | 'inner' | 'options' | 'entries';
type PreconditionPath = PreconditionPathSegment[];

export type PreconditionScope = 'conversation' | 'turn' | 'choice';

export type PreconditionOwner = {
  scope: PreconditionScope;
  conversation: Conversation;
  entries: PreconditionEntry[];
  updateEntries: (entries: PreconditionEntry[]) => void;
  getItemFieldKey: (preconditionIndex: number) => string;
  getParamFieldKey: (preconditionIndex: number, paramIndex: number) => string;
};

function clonePreconditions(entries: PreconditionEntry[]): PreconditionEntry[] {
  return JSON.parse(JSON.stringify(entries)) as PreconditionEntry[];
}

export function getAddablePreconditionSchemas(scope: PreconditionScope): CommandSchema[] {
  if (scope === 'conversation') {
    return ADDABLE_PRECONDITION_SCHEMAS;
  }
  return ADDABLE_PRECONDITION_SCHEMAS.filter((schema) => !NESTED_PRECONDITION_BLOCKLIST.has(schema.name));
}

function createConversationPreconditionOwner(conv: Conversation): PreconditionOwner {
  return {
    scope: 'conversation',
    conversation: conv,
    entries: conv.preconditions,
    updateEntries: (entries) => store.updateConversation(conv.id, { preconditions: entries }),
    getItemFieldKey: (preconditionIndex) => getPreconditionItemFieldKey(conv.id, preconditionIndex),
    getParamFieldKey: (preconditionIndex, paramIndex) => getPreconditionParamFieldKey(conv.id, preconditionIndex, paramIndex),
  };
}

export function createTurnPreconditionOwner(conv: Conversation, turn: Turn): PreconditionOwner {
  return {
    scope: 'turn',
    conversation: conv,
    entries: turn.preconditions ?? [],
    updateEntries: (entries) => store.updateTurn(conv.id, turn.turnNumber, { preconditions: entries }),
    getItemFieldKey: (preconditionIndex) => getTurnPreconditionItemFieldKey(conv.id, turn.turnNumber, preconditionIndex),
    getParamFieldKey: (preconditionIndex, paramIndex) => getTurnPreconditionParamFieldKey(conv.id, turn.turnNumber, preconditionIndex, paramIndex),
  };
}

export function createChoicePreconditionOwner(conv: Conversation, turn: Turn, choice: Choice): PreconditionOwner {
  return {
    scope: 'choice',
    conversation: conv,
    entries: choice.preconditions ?? [],
    updateEntries: (entries) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { preconditions: entries }),
    getItemFieldKey: (preconditionIndex) => getChoicePreconditionItemFieldKey(conv.id, turn.turnNumber, choice.index, preconditionIndex),
    getParamFieldKey: (preconditionIndex, paramIndex) => getChoicePreconditionParamFieldKey(conv.id, turn.turnNumber, choice.index, preconditionIndex, paramIndex),
  };
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

function updatePreconditionTree(owner: PreconditionOwner, mutate: (entries: PreconditionEntry[]) => void): void {
  const updated = clonePreconditions(owner.entries);
  mutate(updated);
  owner.updateEntries(updated.map(normalizePrecondition));
}

function removePreconditionAtPath(owner: PreconditionOwner, path: PreconditionPath): void {
  updatePreconditionTree(owner, (entries) => {
    const container = path.length === 1 ? entries : getPreconditionValueAtPath(entries, path.slice(0, -1));
    const index = path[path.length - 1];
    if (Array.isArray(container) && typeof index === 'number') {
      container.splice(index, 1);
    }
  });
}

function updatePreconditionAtPath(owner: PreconditionOwner, path: PreconditionPath, updater: (entry: PreconditionEntry) => PreconditionEntry): void {
  updatePreconditionTree(owner, (entries) => {
    const container = path.length === 1 ? entries : getPreconditionValueAtPath(entries, path.slice(0, -1));
    const index = path[path.length - 1];
    if (Array.isArray(container) && typeof index === 'number') {
      container[index] = updater(container[index] as PreconditionEntry);
    }
  });
}

export function renderPreconditionList(container: HTMLElement, owner: PreconditionOwner): void {
  const list = document.createElement('div');
  list.className = 'precond-list';

  let dragSrcIdx: number | null = null;

  owner.entries.forEach((entry, idx) => {
    const editorEl = renderPreconditionEditor(owner, entry, [idx], 0, true);
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
      const reordered = [...owner.entries];
      const [moved] = reordered.splice(dragSrcIdx, 1);
      reordered.splice(idx, 0, moved);
      owner.updateEntries(reordered.map(normalizePrecondition));
    };

    list.appendChild(editorEl);
  });

  container.appendChild(list);
}

function renderPreconditionEditor(
  owner: PreconditionOwner,
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
  item.setAttribute('data-field-key', owner.getItemFieldKey(path[0] as number));
  setBeginnerTooltip(item, 'command-row');

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
        removePreconditionAtPath(owner, path);
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
          updatePreconditionAtPath(owner, path, (current) => current.type === 'simple'
            ? { ...current, params: newParams }
            : current);
        }, (paramIndex) => owner.getParamFieldKey(path[0] as number, paramIndex), owner.conversation);
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
    wrapper.appendChild(renderPreconditionEditor(owner, entry.inner, [...path, 'inner'], depth + 1, false, 'NOT branch'));
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
        removePreconditionAtPath(owner, optionPath);
      };
      groupHeader.appendChild(delBtn);
      groupWrap.appendChild(groupHeader);

      option.entries.forEach((groupEntry, groupIdx) => {
        groupWrap.appendChild(renderPreconditionEditor(owner, groupEntry, [...optionPath, 'entries', groupIdx], depth + 2, true, `Condition ${groupIdx + 1}`));
      });

      wrapper.appendChild(groupWrap);
      return;
    }

    wrapper.appendChild(renderPreconditionEditor(owner, option, optionPath, depth + 1, true, `Option ${idx + 1}`));
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
    setBeginnerTooltip(item, 'command-row');

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

export function renderParamEditors(
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
    if (schema.name === 'panda_task_escort') {
      const targetKind = (currentParams[4] || '').trim();
      if (paramDef.name === 'target_id') {
        if (targetKind === '' || targetKind === 'sender') {
          return;
        }
      }
      if (paramDef.name === 'spawn_distance') {
        if (targetKind !== 'custom_npc' && targetKind !== 'spawn_faction' && targetKind !== 'story_npc') {
          return;
        }
      }
    }
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
    setBeginnerTooltip(field, {
      id: `command-param-${schema.name}-${paramDef.name}`,
      title: paramDef.label,
      body: paramDef.helpText
        ?? (paramDef.examples?.length ? `Example: ${paramDef.examples[0]}` : 'Command parameter exported into generated PANDA command syntax.'),
      placement: 'left',
    });

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

    let richEditor: HTMLElement | null = null;
    if (schema.name === 'panda_task_escort' && paramDef.name === 'target_id') {
      const targetKind = (currentParams[4] || '').trim();
      const value = currentParams[i] || '';
      if (targetKind === 'story_npc') {
        richEditor = createOptionPickerPanelEditor(value, updateParam, paramKey, {
          title: 'Browse story NPCs',
          subtitle: 'Pick the story NPC to escort. They will be teleported next to the player when the task starts.',
          searchPlaceholder: 'Search story NPC name or id...',
          emptyLabel: '-- Search for a story NPC --',
          options: STORY_NPC_OPTIONS,
          facets: [
            { label: 'Faction', field: 'faction', allLabel: 'All factions' },
            { label: 'Role', field: 'role', allLabel: 'All roles' },
            { label: 'Level', field: 'level', allLabel: 'All levels' },
          ],
          richRows: true,
        });
      } else if (targetKind === 'custom_npc') {
        richEditor = createCustomNpcBuilderEditor(value, updateParam, paramKey, { showSpawnDistance: false });
      } else if (targetKind === 'spawn_faction') {
        const select = document.createElement('select');
        select.className = 'rich-editor-input';
        select.setAttribute('data-field-key', paramKey);
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- Select faction --';
        select.appendChild(emptyOpt);
        for (const fid of FACTION_IDS) {
          const opt = document.createElement('option');
          opt.value = fid;
          opt.textContent = FACTION_DISPLAY_NAMES[fid];
          opt.selected = value === fid;
          select.appendChild(opt);
        }
        if (value && !FACTION_IDS.includes(value as FactionId)) {
          const customOpt = document.createElement('option');
          customOpt.value = value;
          customOpt.textContent = `Custom: ${value}`;
          customOpt.selected = true;
          select.appendChild(customOpt);
        }
        select.value = value;
        select.onchange = () => updateParam(select.value);
        richEditor = select;
      }
    }
    if (!richEditor) {
      richEditor = renderRichParamEditor(
        schema,
        paramDef,
        currentParams[i] || '',
        updateParam,
        paramKey,
        conv,
        currentParams,
        i,
      );
    }

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

  // Optional PDA hover/list overrides for panda_task_* outcomes. Authors can fill in
  // the title and description that appear in the player's PDA when this task is
  // active. Stored as trailing key=value tokens (title=..., descr=...) so the Lua
  // side can pick them up without changing positional argument order.
  if (schema.name.startsWith('panda_task_')) {
    appendTaskAuthorMetaEditors(div, currentParams, schema.params.length, onChange, getFieldKey);
  }

  return div;
}

const TASK_META_TITLE_PREFIX = 'title=';
const TASK_META_DESCR_PREFIX = 'descr=';

function decodeTaskMetaValue(raw: string): string {
  return raw.replace(/\+/g, ' ');
}

function encodeTaskMetaValue(raw: string): string {
  return raw.trim().replace(/[:+]/g, ' ').replace(/\s+/g, '+');
}

function splitTaskAuthorMeta(currentParams: string[], positionalCount: number): {
  positional: string[];
  title: string;
  description: string;
} {
  const positional: string[] = [];
  let title = '';
  let description = '';
  let cursor = 0;
  for (const value of currentParams) {
    if (cursor < positionalCount) {
      positional.push(value ?? '');
      cursor += 1;
      continue;
    }
    const v = value ?? '';
    if (v.startsWith(TASK_META_TITLE_PREFIX)) {
      title = decodeTaskMetaValue(v.slice(TASK_META_TITLE_PREFIX.length));
    } else if (v.startsWith(TASK_META_DESCR_PREFIX)) {
      description = decodeTaskMetaValue(v.slice(TASK_META_DESCR_PREFIX.length));
    } else if (v.startsWith('description=')) {
      description = decodeTaskMetaValue(v.slice('description='.length));
    } else if (v.startsWith('desc=')) {
      description = decodeTaskMetaValue(v.slice('desc='.length));
    } else {
      // Unknown trailing token — keep it as positional for forward-compat.
      positional.push(v);
    }
  }
  return { positional, title, description };
}

function joinTaskAuthorMeta(positional: string[], title: string, description: string): string[] {
  const out = [...positional];
  if (title.trim() !== '') out.push(`${TASK_META_TITLE_PREFIX}${encodeTaskMetaValue(title)}`);
  if (description.trim() !== '') out.push(`${TASK_META_DESCR_PREFIX}${encodeTaskMetaValue(description)}`);
  return out;
}

function appendTaskAuthorMetaEditors(
  container: HTMLElement,
  currentParams: string[],
  positionalCount: number,
  onChange: (params: string[]) => void,
  getFieldKey: (paramIndex: number) => string,
): void {
  const meta = splitTaskAuthorMeta(currentParams, positionalCount);

  const wrap = document.createElement('div');
  wrap.className = 'task-meta-overrides';
  wrap.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border, #444);';

  const heading = document.createElement('div');
  heading.className = 'field-hint';
  heading.style.cssText = 'font-weight: 600; margin-bottom: 4px;';
  heading.textContent = 'PDA hover text (optional)';
  wrap.appendChild(heading);

  const help = document.createElement('div');
  help.className = 'field-hint';
  help.textContent = 'Override the title and description that appear in the player\'s PDA task list. Leave blank to use the auto-generated text. Placeholders: $location, $target, $item, $giver.';
  wrap.appendChild(help);

  const titleField = document.createElement('div');
  titleField.className = 'field';
  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'PDA Title';
  titleField.appendChild(titleLabel);
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'rich-editor-input';
  titleInput.value = meta.title;
  titleInput.placeholder = 'e.g. Help the trapped stalker';
  const titleKey = `${getFieldKey(positionalCount)}-meta-title`;
  titleInput.setAttribute('data-field-key', titleKey);
  titleInput.oninput = () => debounced(titleKey, () => {
    onChange(joinTaskAuthorMeta(meta.positional, titleInput.value, descrInput.value));
  });
  titleField.appendChild(titleInput);
  wrap.appendChild(titleField);

  const descrField = document.createElement('div');
  descrField.className = 'field';
  const descrLabel = document.createElement('label');
  descrLabel.textContent = 'PDA Description';
  descrField.appendChild(descrLabel);
  const descrInput = document.createElement('textarea');
  descrInput.className = 'rich-editor-input';
  descrInput.rows = 3;
  descrInput.value = meta.description;
  descrInput.placeholder = 'e.g. Bandits have $target pinned at $location. Get them out alive.';
  const descrKey = `${getFieldKey(positionalCount + 1)}-meta-descr`;
  descrInput.setAttribute('data-field-key', descrKey);
  descrInput.oninput = () => debounced(descrKey, () => {
    onChange(joinTaskAuthorMeta(meta.positional, titleInput.value, descrInput.value));
  });
  descrField.appendChild(descrInput);
  wrap.appendChild(descrField);

  container.appendChild(wrap);
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
    case 'static_select':
      return createStaticSelectEditor(editor.options, currentValue, onChange, fieldKey, {
        emptyLabel: editor.emptyLabel ?? (paramDef.required ? '-- Select --' : '(optional)'),
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
        facets: [
          { label: 'Faction', field: 'faction', allLabel: 'All factions' },
          { label: 'Role', field: 'role', allLabel: 'All roles' },
          { label: 'Level', field: 'level', allLabel: 'All levels' },
        ],
        richRows: true,
      });
    case 'catalog_picker_panel':
      return createOptionPickerPanelEditor(currentValue, onChange, fieldKey, {
        title: editor.title,
        subtitle: editor.subtitle,
        searchPlaceholder: editor.searchPlaceholder,
        emptyLabel: editor.emptyLabel ?? '-- Search options --',
        browseLabel: editor.browseLabel ?? 'Browse catalog...',
        options: editor.options,
        facets: editor.facets,
        richRows: editor.richRows,
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
    case 'custom_npc_builder':
      return createCustomNpcBuilderEditor(currentValue, onChange, fieldKey, {
        showSpawnDistance: schema?.name === 'spawn_custom_npc',
      });
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

  const select = document.createElement('select');
  select.className = 'rich-editor-input';
  select.setAttribute('data-field-key', fieldKey);

  if (config.emptyLabel) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = config.emptyLabel;
    select.appendChild(emptyOption);
  }

  for (const option of options) {
    const item = document.createElement('option');
    item.value = option.value;
    item.textContent = option.label;
    select.appendChild(item);
  }

  if (currentValue && !options.some((option) => option.value === currentValue)) {
    const customOption = document.createElement('option');
    customOption.value = currentValue;
    customOption.textContent = `Custom: ${currentValue}`;
    select.appendChild(customOption);
  }

  select.value = currentValue;

  const summary = document.createElement('div');
  summary.className = 'command-description';
  const updateSummary = (): void => {
    const selected = options.find((option) => option.value === select.value);
    summary.textContent = selected
      ? selected.label
      : (select.value ? `Using custom value ${select.value}.` : 'Select one vanilla option.');
  };

  select.onchange = () => {
    onChange(select.value);
    updateSummary();
  };

  updateSummary();
  wrapper.append(select, summary);
  return wrapper;
}

function createStaticSelectEditor(
  options: ParamOption[],
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  config: {
    emptyLabel: string;
  },
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-searchable';

  const select = document.createElement('select');
  select.className = 'rich-editor-input';
  select.setAttribute('data-field-key', fieldKey);

  if (config.emptyLabel) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = config.emptyLabel;
    select.appendChild(emptyOption);
  }

  for (const option of options) {
    const item = document.createElement('option');
    item.value = option.value;
    item.textContent = option.label;
    select.appendChild(item);
  }

  if (currentValue && !options.some((option) => option.value === currentValue)) {
    const customOption = document.createElement('option');
    customOption.value = currentValue;
    customOption.textContent = `Custom: ${currentValue}`;
    select.appendChild(customOption);
  }

  select.value = currentValue;

  const summary = document.createElement('div');
  summary.className = 'command-description';

  const updateSummary = (): void => {
    const selected = options.find((option) => option.value === select.value);
    summary.textContent = selected
      ? selected.label
      : (select.value ? `Using custom value ${select.value}.` : 'Select one vanilla option.');
  };

  select.onchange = () => {
    onChange(select.value);
    updateSummary();
  };

  updateSummary();
  wrapper.append(select, summary);
  return wrapper;
}


export function createOptionPickerPanelEditor(
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  config: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    emptyLabel: string;
    browseLabel?: string;
    options: ParamOption[];
    facets?: Array<{
      label: string;
      allLabel: string;
      field?: string;
      keywordIndex?: number;
    }>;
    richRows?: boolean;
  },
): HTMLElement {
  const options: CatalogPickerOption[] = config.options.map((option) => ({ ...(option as CatalogPickerOption) }));
  return createCatalogPickerPanelEditor(currentValue, onChange, fieldKey, {
    title: config.title,
    subtitle: config.subtitle,
    searchPlaceholder: config.searchPlaceholder,
    emptyLabel: config.emptyLabel,
    options,
    browseLabel: config.browseLabel ?? 'Browse catalog...',
    facets: config.facets,
    richRows: config.richRows,
  });
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

  const getCommittedValue = () => {
    if (!levelSelect.value) {
      return '';
    }
    if (selectionMode === 'placeholder' && levelSelect.value !== '__all__') {
      return `%${levelSelect.value}_panda_st_key%`;
    }
    return selectionMode === 'exact' ? (selectedTerrain || '') : '';
  };

  const commitSelection = () => {
    onChange(getCommittedValue());
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
        commitSelection();
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
      : options.allowPlaceholder
        ? 'Choose a smart terrain key for this level or switch back to the dynamic placeholder.'
        : 'Choose a smart terrain key for this level. The field updates after you pick an exact terrain.';
  };

  levelSelect.onchange = () => {
    selectedTerrain = '';
    if (!levelSelect.value) {
      selectionMode = '';
      commitSelection();
    } else if (options.allowPlaceholder && levelSelect.value !== '__all__') {
      selectionMode = 'placeholder';
      commitSelection();
    } else {
      selectionMode = '';
    }
    renderTerrainList();
    updateSummary();
  };

  searchInput.oninput = () => renderTerrainList();
  selectPlaceholderButton.onclick = () => {
    if (!levelSelect.value || levelSelect.value === '__all__') return;
    selectionMode = 'placeholder';
    selectedTerrain = '';
    commitSelection();
    updateSummary();
    renderTerrainList();
  };
  clearButton.onclick = () => {
    selectionMode = '';
    selectedTerrain = '';
    onChange('');
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

  const splitChain = (raw: string): string[] =>
    raw.split(chainSeparator).map((s) => s.trim()).filter((s) => s.length > 0);
  const joinChain = (parts: string[]): string =>
    parts.map((s) => s.trim()).filter((s) => s.length > 0).join(chainSeparator);

  let chain: string[] = splitChain(currentValue);

  const commitChain = () => {
    const next = joinChain(chain);
    onChange(next);
  };

  const chainList = document.createElement('div');
  chainList.className = 'command-builder-chain';
  chainList.style.cssText = 'display:flex; flex-direction:column; gap:6px;';

  const renderChain = () => {
    chainList.replaceChildren();
    if (chain.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-hint';
      empty.textContent = 'No trigger commands yet. Pick one below and click Add, or type one in the box.';
      chainList.appendChild(empty);
      return;
    }
    chain.forEach((cmd, index) => {
      const row = document.createElement('div');
      row.className = 'command-builder-chain-row';
      row.style.cssText = 'display:flex; gap:6px; align-items:center;';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'rich-editor-input';
      input.style.flex = '1';
      input.value = cmd;
      input.setAttribute('data-field-key', `${fieldKey}-chain-${index}`);
      input.oninput = () => debounced(`${fieldKey}-chain-${index}`, () => {
        chain[index] = input.value;
        commitChain();
      });
      row.appendChild(input);

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'btn-sm';
      upBtn.textContent = '↑';
      upBtn.title = 'Move up';
      upBtn.disabled = index === 0;
      upBtn.onclick = (e) => {
        e.preventDefault();
        if (index === 0) return;
        const tmp = chain[index - 1];
        chain[index - 1] = chain[index];
        chain[index] = tmp;
        commitChain();
        renderChain();
      };
      row.appendChild(upBtn);

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'btn-sm';
      downBtn.textContent = '↓';
      downBtn.title = 'Move down';
      downBtn.disabled = index === chain.length - 1;
      downBtn.onclick = (e) => {
        e.preventDefault();
        if (index === chain.length - 1) return;
        const tmp = chain[index + 1];
        chain[index + 1] = chain[index];
        chain[index] = tmp;
        commitChain();
        renderChain();
      };
      row.appendChild(downBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-sm btn-danger';
      delBtn.textContent = '✕';
      delBtn.title = 'Remove this trigger command';
      delBtn.onclick = (e) => {
        e.preventDefault();
        chain.splice(index, 1);
        commitChain();
        renderChain();
      };
      row.appendChild(delBtn);

      chainList.appendChild(row);
    });
  };

  wrapper.appendChild(chainList);

  const controls = document.createElement('div');
  controls.className = 'rich-editor-toolbar';

  const suggestionSelect = document.createElement('select');
  suggestionSelect.className = 'rich-editor-input';
  const emptySuggestion = document.createElement('option');
  emptySuggestion.value = '';
  emptySuggestion.textContent = 'Pick a suggested trigger command...';
  suggestionSelect.appendChild(emptySuggestion);
  for (const suggestion of suggestions) {
    const opt = document.createElement('option');
    opt.value = suggestion.value;
    opt.textContent = suggestion.label;
    suggestionSelect.appendChild(opt);
  }
  controls.appendChild(suggestionSelect);

  let configuredCommand = '';
  const configPanel = document.createElement('div');
  configPanel.className = 'command-builder-config';
  configPanel.style.cssText = 'display:none; margin-top:8px;';

  const previewLine = document.createElement('div');
  previewLine.className = 'field-hint';
  previewLine.style.cssText = 'margin-top:6px; font-family: var(--font-mono, monospace); word-break: break-all;';

  const buildConfiguredCommand = (): string => configuredCommand || suggestionSelect.value;

  const renderSuggestionConfig = () => {
    configuredCommand = '';
    configPanel.replaceChildren();
    const parsed = parseCommandBuilderSuggestion(suggestionSelect.value);
    if (!parsed) {
      configPanel.style.display = 'none';
      previewLine.textContent = '';
      return;
    }

    const commandSchema = OUTCOME_SCHEMAS.find((item) => item.name === parsed.command);
    if (!commandSchema || commandSchema.params.length === 0) {
      configPanel.style.display = 'none';
      configuredCommand = serializeCommandBuilderSuggestion(parsed.command, parsed.params);
      previewLine.textContent = `Will add: ${configuredCommand}`;
      return;
    }

    // configParams is mutated in place by renderInner so subsequent param edits
    // see the latest snapshot — fixes a bug where picking a non-default value
    // (e.g. a different vanilla squad) was overwritten back to the suggestion
    // default when "Add to chain" fired.
    const configParams: string[] = [...parsed.params];
    configuredCommand = serializeCommandBuilderSuggestion(parsed.command, configParams);
    previewLine.textContent = `Will add: ${configuredCommand}`;

    const renderInner = () => {
      const editorTree = document.createElement('div');
      const header = document.createElement('div');
      header.className = 'field-hint';
      header.textContent = `Configure ${commandSchema.label}`;
      editorTree.appendChild(header);
      editorTree.appendChild(renderParamEditors(
        commandSchema,
        configParams,
        (nextParams) => {
          configParams.length = 0;
          for (const value of nextParams) configParams.push(value);
          configuredCommand = serializeCommandBuilderSuggestion(parsed.command, configParams);
          previewLine.textContent = `Will add: ${configuredCommand}`;
        },
        (paramIndex) => `${fieldKey}-suggestion-${parsed.command}-${paramIndex}`,
      ));
      configPanel.replaceChildren(editorTree);
    };

    renderInner();
    configPanel.style.display = '';
  };

  suggestionSelect.onchange = renderSuggestionConfig;

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-sm btn-primary';
  addBtn.textContent = 'Add to chain';
  addBtn.onclick = (e) => {
    e.preventDefault();
    if (!suggestionSelect.value) return;
    chain.push(buildConfiguredCommand());
    commitChain();
    renderChain();
  };
  controls.appendChild(addBtn);

  const replaceBtn = document.createElement('button');
  replaceBtn.type = 'button';
  replaceBtn.className = 'btn-sm';
  replaceBtn.textContent = 'Replace chain';
  replaceBtn.title = 'Discard the current chain and start over with the configured command';
  replaceBtn.onclick = (e) => {
    e.preventDefault();
    if (!suggestionSelect.value) return;
    chain = [buildConfiguredCommand()];
    commitChain();
    renderChain();
  };
  controls.appendChild(replaceBtn);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn-sm';
  clearBtn.textContent = 'Clear all';
  clearBtn.onclick = (e) => {
    e.preventDefault();
    chain = [];
    commitChain();
    renderChain();
  };
  controls.appendChild(clearBtn);

  wrapper.appendChild(controls);
  wrapper.appendChild(previewLine);
  wrapper.appendChild(configPanel);

  const builderHint = document.createElement('div');
  builderHint.className = 'command-description';
  builderHint.textContent = `${schema.label}: each row is one trigger command. Picking a suggestion adds a new row; use the arrows to reorder and ✕ to remove a row. Multiple rows are joined with "${chainSeparator}".`;
  wrapper.appendChild(builderHint);

  renderChain();
  return wrapper;
}

function parseCommandBuilderSuggestion(value: string): { command: string; params: string[] } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  const command = parts.shift()?.trim();
  if (!command) return null;
  return { command, params: parts };
}

function serializeCommandBuilderSuggestion(command: string, params: string[]): string {
  return [command, ...params.filter((param) => param.trim() !== '')].join(':');
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

  const catalogEntry = SMART_TERRAIN_OPTIONS_ALL.find((entry) => entry.id === value);
  return {
    level: catalogEntry?.level && catalogEntry.level !== 'other' ? catalogEntry.level : '',
    terrain: value,
    usesPlaceholder: false,
  };
}

// ─── Command Picker Dropdown ──────────────────────────────────────────────

export function showCommandPicker(
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
  panel.setAttribute('aria-label', options.title ?? ui('Command picker', 'Выбор команды'));
  panel.style.position = 'fixed';

  const header = document.createElement('div');
  header.className = 'command-picker-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'command-picker-title-wrap';

  const title = document.createElement('div');
  title.className = 'command-picker-title';
  title.textContent = options.title ?? ui('Add command', 'Добавить команду');
  titleWrap.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'command-picker-subtitle';
  subtitle.textContent = ui('Browse by category or search to narrow the list.', 'Выберите категорию или используйте поиск.');
  titleWrap.appendChild(subtitle);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'command-picker-close btn-icon btn-sm';
  closeBtn.textContent = '×';
  closeBtn.title = ui('Close picker', 'Закрыть список');

  header.append(titleWrap, closeBtn);
  panel.appendChild(header);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = options.searchPlaceholder ?? ui('Search commands...', 'Поиск команд...');
  searchInput.className = 'dropdown-search command-picker-search';
  setBeginnerTooltip(searchInput, 'command-picker-search');
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
  const advancedMode = store.get().advancedMode;

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
      setBeginnerTooltip(button, 'command-picker-category');
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
      empty.textContent = options.emptyMessage ?? ui('No matching commands', 'Подходящих команд нет');
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
    groupMeta.textContent = items.length === 1
      ? ui('1 command', '1 команда')
      : ui(`${items.length} commands`, `${items.length} команд`);

    groupHeader.append(groupTitle, groupMeta);
    resultPane.appendChild(groupHeader);

    const cards = document.createElement('div');
    cards.className = 'command-picker-grid';

    for (const schema of items) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'command-picker-card';
      setBeginnerTooltip(card, {
        id: `command-picker-card-${schema.name}`,
        title: schema.label,
        body: schema.helpText ?? schema.description,
        placement: 'left',
      });
      const paramsSummary = schema.params.length > 0
        ? (schema.params.length === 1
          ? ui('1 param', '1 параметр')
          : ui(`${schema.params.length} params`, `${schema.params.length} параметров`))
        : ui('No params', 'Без параметров');
      card.innerHTML = `
        <span class="command-picker-card-title-row">
          <span class="command-picker-card-title">${schema.label}</span>
          <span class="command-picker-card-pill">${paramsSummary}</span>
        </span>
        ${advancedMode ? `<span class="command-picker-card-name">${schema.name}</span>` : ''}
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
    if (target instanceof Element && target.closest('.beginner-tooltip')) return;
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

export function renderPlaceholderPicker(container: HTMLElement, collapseKey: string, options: { defaultCollapsed?: boolean } = {}): void {
  const { wrapper, body } = createCollapsibleSection(
    collapseKey,
    'Dynamic Placeholders',
    undefined,
    { defaultCollapsed: options.defaultCollapsed ?? true },
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

export function renderEmojiPicker(
  container: HTMLElement,
  collapseKey: string,
  options: { defaultCollapsed?: boolean; insertionRoot?: HTMLElement; helperText?: string } = {},
): void {
  const { wrapper, body } = createCollapsibleSection(
    collapseKey,
    'Emoji Shortcodes',
    undefined,
    { defaultCollapsed: options.defaultCollapsed ?? true },
  );

  const helperCopy = document.createElement('div');
  helperCopy.className = 'placeholder-helper-copy';
  helperCopy.textContent = options.helperText ?? 'Picker inserts shortcode tokens. Game renders known tokens as PDA texture icons.';
  body.appendChild(helperCopy);

  const picker = document.createElement('div');
  picker.className = 'placeholder-picker emoji-dropdown-picker';

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'emoji-dropdown-search';
  search.placeholder = 'Search emoji shortcode...';
  search.setAttribute('aria-label', 'Search emoji shortcode');

  const grid = document.createElement('div');
  grid.className = 'emoji-image-grid';
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', 'Emoji shortcode');
  let selectedShortcode = PANDA_EMOJI_OPTIONS[0]?.shortcode ?? ':question:';

  const insert = document.createElement('button');
  insert.type = 'button';
  insert.className = 'btn-sm emoji-dropdown-insert';
  insert.textContent = 'Insert';

  const renderOptions = (filter = ''): void => {
    const normalized = filter.trim().toLowerCase();
    grid.replaceChildren();
    let rendered = 0;
    for (const option of PANDA_EMOJI_OPTIONS) {
      if (
        normalized
        && !option.label.toLowerCase().includes(normalized)
        && !option.shortcode.toLowerCase().includes(normalized)
      ) {
        continue;
      }
      rendered += 1;
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = `emoji-image-option${selectedShortcode === option.shortcode ? ' is-selected' : ''}`;
      entry.dataset.shortcode = option.shortcode;
      entry.title = `${option.label} ${option.shortcode}`;
      entry.setAttribute('role', 'option');
      entry.setAttribute('aria-selected', selectedShortcode === option.shortcode ? 'true' : 'false');

      const img = document.createElement('img');
      img.src = option.previewUrl;
      img.alt = option.label;
      img.loading = 'lazy';
      img.onerror = () => {
        entry.classList.add('is-missing-preview');
        img.remove();
      };

      const label = document.createElement('span');
      label.textContent = option.rawShortcode;
      entry.append(img, label);
      entry.onclick = () => {
        selectedShortcode = option.shortcode;
        grid.querySelectorAll<HTMLButtonElement>('.emoji-image-option').forEach((button) => {
          const active = button.dataset.shortcode === selectedShortcode;
          button.classList.toggle('is-selected', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      };
      entry.ondblclick = () => {
        insertOrCopyPlaceholder(options.insertionRoot ?? container, option.shortcode, entry, 'Insert');
      };
      grid.appendChild(entry);
    }
    const firstVisible = grid.querySelector<HTMLButtonElement>('.emoji-image-option');
    if (!firstVisible) {
      selectedShortcode = PANDA_EMOJI_OPTIONS[0]?.shortcode ?? ':question:';
    } else if (!grid.querySelector(`[data-shortcode="${CSS.escape(selectedShortcode)}"]`)) {
      selectedShortcode = firstVisible.dataset.shortcode || selectedShortcode;
      firstVisible.classList.add('is-selected');
      firstVisible.setAttribute('aria-selected', 'true');
    }
    insert.disabled = rendered === 0;
  };

  renderOptions();
  search.oninput = () => renderOptions(search.value);
  insert.onclick = (event) => {
    event.preventDefault();
    insertOrCopyPlaceholder(options.insertionRoot ?? container, selectedShortcode, insert, 'Insert');
  };

  picker.append(search, grid, insert);

  body.appendChild(picker);
  container.appendChild(wrapper);
}

function insertOrCopyPlaceholder(container: HTMLElement, value: string, button: HTMLButtonElement, idleLabel: string): void {
  const inserted = insertIntoFocusedTextarea(container, value);
  if (inserted) return;

  navigator.clipboard.writeText(value).then(() => {
    // Picker buttons that contain element children (e.g. emoji <img> thumbnails)
    // can't have their textContent swapped without losing the visual. Use a
    // transient class + title for those; fall back to text-swap otherwise.
    if (button.firstElementChild) {
      button.classList.add('placeholder-btn-copied');
      const previousTitle = button.title;
      button.title = `Copied ${value}`;
      setTimeout(() => {
        button.classList.remove('placeholder-btn-copied');
        button.title = previousTitle;
      }, 1000);
      return;
    }
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

type FieldOptions = {
  onCommit?: (value: string) => void;
};

function createField(
  labelText: string,
  type: string,
  value: string,
  onChange: (val: string) => void,
  hint?: string,
  fieldKey?: string,
  options: FieldOptions = {},
): HTMLElement {
  const field = document.createElement('div');
  field.className = 'field';
  const tooltipPreset = getFieldTooltipPreset(labelText);
  if (tooltipPreset) {
    setBeginnerTooltip(field, tooltipPreset);
  } else if (hint) {
    setBeginnerTooltip(field, {
      id: `field-${slugTooltipId(labelText)}`,
      title: labelText,
      body: hint,
      placement: 'left',
    });
  }
  const resolvedFieldKey = fieldKey || 'field-' + labelText.replace(/\s+/g, '-').toLowerCase();
  const collabPath = getCollabPathForFieldKey(resolvedFieldKey);
  const collabLock = getCollabFieldLock(collabPath);
  const isLockedByRemote = Boolean(collabLock && collabLock.authorId !== store.get().collab.localPublisherId);
  if (isLockedByRemote) {
    field.classList.add('collab-field-locked');
    field.title = `${collabLock?.username ?? 'Co-author'} editing`;
  }
  const commitField = (nextValue: string): void => {
    flushDebounced(resolvedFieldKey);
    options.onCommit?.(nextValue);
  };
  const canWrite = (control: HTMLInputElement | HTMLTextAreaElement): boolean => {
    if (collabCanEditPath(collabPath)) {
      return true;
    }
    control.value = value;
    return false;
  };

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
    textarea.classList.toggle('collab-input-locked', isLockedByRemote);
    textarea.onfocus = () => acquireCollabLock(collabPath);
    textarea.oninput = () => {
      if (!canWrite(textarea)) return;
      debounced(resolvedFieldKey, () => {
        onChange(textarea.value);
        notifyCollabLocalEdit();
      });
    };
    textarea.onblur = () => {
      releaseCollabLock(collabPath);
      commitField(textarea.value);
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
      if (!canWrite(textarea)) return;
      onChange(textarea.value);
      notifyCollabLocalEdit();
    });
    field.appendChild(textarea);
  } else {
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.setAttribute('data-field-key', resolvedFieldKey);
    input.classList.toggle('collab-input-locked', isLockedByRemote);
    input.onfocus = () => acquireCollabLock(collabPath);
    input.oninput = () => {
      if (!canWrite(input)) return;
      debounced(resolvedFieldKey, () => {
        onChange(input.value);
        notifyCollabLocalEdit();
      });
    };
    input.onblur = () => {
      releaseCollabLock(collabPath);
      commitField(input.value);
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
