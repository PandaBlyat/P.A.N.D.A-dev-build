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
import { FACTION_IDS, RANKS, MUTANT_TYPES, DYNAMIC_PLACEHOLDERS, LEVEL_DISPLAY_NAMES, SMART_TERRAIN_LEVELS } from '../lib/constants';

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
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#9881;</div>
        <div class="empty-state-text">No conversation selected</div>
        <div class="empty-state-hint">Select or create a conversation from the list on the left to edit its properties, preconditions, and dialogue.</div>
      </div>
    `;
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
  convTab.textContent = 'Conversation';
  convTab.title = 'Edit conversation label, preconditions & settings';
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
    content.innerHTML = `
      <div class="empty-state" style="height:auto; padding:20px;">
        <div class="empty-state-text">No turn selected</div>
        <div class="empty-state-hint">Click a turn node in the flow editor to edit its properties, or switch to the Conversation tab to edit preconditions.</div>
      </div>
    `;
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
  }, 'A short name for this conversation (only used in the editor)', getConversationFieldKey(conv.id, 'label'));
  container.appendChild(labelField);

  container.appendChild(document.createElement('hr'));

  // Preconditions — always visible and prominent
  const precondSection = document.createElement('div');
  precondSection.className = 'precond-section';
  precondSection.appendChild(sectionHeader('Preconditions', () => {
    showCommandPicker(precondSection, PRECONDITION_SCHEMAS, (schema) => {
      const newPrecond: SimplePrecondition = {
        type: 'simple',
        command: schema.name,
        params: schema.params.map(p => p.placeholder || ''),
      };
      store.updateConversation(conv.id, {
        preconditions: [...conv.preconditions, newPrecond],
      });
    });
  }));

  if (conv.preconditions.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'No preconditions set — this conversation will trigger for any NPC. Click "+ Add" to add conditions.';
    precondSection.appendChild(hint);
  } else {
    renderPreconditionList(precondSection, conv);
  }
  container.appendChild(precondSection);

  container.appendChild(document.createElement('hr'));

  // Timeout
  const timeoutTitle = document.createElement('div');
  timeoutTitle.innerHTML = `<span class="section-title">Timeout</span>`;
  timeoutTitle.style.marginBottom = '8px';
  container.appendChild(timeoutTitle);

  const timeoutField = createField('Timeout (seconds)', 'number', String(conv.timeout || ''), (val) => {
    store.updateConversation(conv.id, { timeout: val ? parseInt(val, 10) : undefined });
  }, 'Auto-close conversation after this many seconds (leave empty for no timeout)', getConversationFieldKey(conv.id, 'timeout'));
  container.appendChild(timeoutField);

  const timeoutMsgField = createField('Timeout Message', 'textarea', conv.timeoutMessage || '', (val) => {
    store.updateConversation(conv.id, { timeoutMessage: val || undefined });
  }, 'Message shown when the conversation times out', getConversationFieldKey(conv.id, 'timeout-message'));
  container.appendChild(timeoutMsgField);
}

// ─── Turn Properties ──────────────────────────────────────────────────────

function renderTurnProperties(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): void {
  const title = document.createElement('div');
  title.className = 'section-header';
  const titleSpan = document.createElement('span');
  titleSpan.className = 'section-title';
  titleSpan.textContent = turnLabels.getLongLabel(turn.turnNumber);
  title.appendChild(titleSpan);
  if (turn.turnNumber > 1) {
    const delTurnBtn = document.createElement('button');
    delTurnBtn.className = 'btn-sm btn-danger';
    delTurnBtn.textContent = 'Delete Turn';
    delTurnBtn.title = 'Remove this turn from the conversation';
    delTurnBtn.onclick = () => store.deleteTurn(conv.id, turn.turnNumber);
    title.appendChild(delTurnBtn);
  }
  container.appendChild(title);

  // Opening message (turn 1 only)
  if (turn.turnNumber === 1) {
    const msgField = createField('Opening Message', 'textarea', turn.openingMessage || '', (val) => {
      store.updateTurn(conv.id, turn.turnNumber, { openingMessage: val });
    }, 'The first message the NPC sends when starting this conversation', getTurnFieldKey(conv.id, turn.turnNumber, 'opening-message'));
    container.appendChild(msgField);

    // Placeholder picker for opening message
    renderPlaceholderPicker(container);
  }

  // Choices section
  const choicesSection = document.createElement('div');
  choicesSection.appendChild(sectionHeader(
    `Choices (${turn.choices.length}/4)`,
    turn.choices.length < 4 ? () => store.addChoice(conv.id, turn.turnNumber) : undefined,
  ));

  for (const choice of turn.choices) {
    const card = document.createElement('div');
    card.className = 'choice-card';
    const header = document.createElement('div');
    header.className = 'choice-card-header';
    header.onclick = () => store.selectChoice(choice.index);

    const cardTitle = document.createElement('span');
    cardTitle.className = 'choice-card-title';
    cardTitle.textContent = `Choice ${choice.index}`;
    header.appendChild(cardTitle);

    const previewText = document.createElement('span');
    previewText.style.cssText = 'flex:1; font-size:11px; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-left:8px;';
    previewText.textContent = choice.text || '(empty)';
    header.appendChild(previewText);

    if (turn.choices.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon btn-sm';
      delBtn.textContent = '\u00d7';
      delBtn.title = 'Delete this choice';
      delBtn.style.color = 'var(--danger)';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        store.deleteChoice(conv.id, turn.turnNumber, choice.index);
      };
      header.appendChild(delBtn);
    }

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
      badge.textContent = `\u2192 Continues to ${turnLabels.getLongLabel(choice.continueTo)}`;
      card.appendChild(badge);
    }

    choicesSection.appendChild(card);
  }

  container.appendChild(choicesSection);
}

// ─── Choice Properties ────────────────────────────────────────────────────

function renderChoiceProperties(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  choice: Choice,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): void {
  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-sm';
  backBtn.textContent = `\u2190 Back to ${turnLabels.getLongLabel(turn.turnNumber)}`;
  backBtn.title = 'Return to turn overview';
  backBtn.onclick = () => store.selectChoice(null);
  backBtn.style.marginBottom = '10px';
  container.appendChild(backBtn);

  const title = document.createElement('div');
  title.className = 'section-header';
  title.innerHTML = `<span class="section-title">${turnLabels.getLongLabel(turn.turnNumber)} / Choice ${choice.index}</span>`;
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

  // Placeholder picker
  renderPlaceholderPicker(container);

  // Reply variants
  const relHighField = createField('Reply (High Relationship, \u2265300)', 'textarea', choice.replyRelHigh || '', (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyRelHigh: val || undefined });
  }, 'Alternative reply when relationship score is 300 or higher (optional)', getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply-rel-high'));
  container.appendChild(relHighField);

  const relLowField = createField('Reply (Low Relationship, \u2264-300)', 'textarea', choice.replyRelLow || '', (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyRelLow: val || undefined });
  }, 'Alternative reply when relationship score is -300 or lower (optional)', getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply-rel-low'));
  container.appendChild(relLowField);

  // Outcomes
  const outcomeSection = document.createElement('div');
  outcomeSection.appendChild(sectionHeader('Outcomes', () => {
    showCommandPicker(outcomeSection, OUTCOME_SCHEMAS, (schema) => {
      const newOutcome: Outcome = {
        command: schema.name,
        params: schema.params.map(p => p.placeholder || ''),
      };
      store.updateChoice(conv.id, turn.turnNumber, choice.index, {
        outcomes: [...choice.outcomes, newOutcome],
      });
    });
  }));

  if (choice.outcomes.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'No outcomes — this choice is dialogue-only. Click "+ Add" to add rewards, spawns, or other effects.';
    outcomeSection.appendChild(hint);
  } else {
    renderOutcomeList(outcomeSection, conv, turn, choice);
  }
  container.appendChild(outcomeSection);

  // Continuation
  container.appendChild(document.createElement('hr'));
  const contField = document.createElement('div');
  contField.className = 'field';
  const contLabel = document.createElement('label');
  contLabel.textContent = 'Continue To Turn';
  contField.appendChild(contLabel);

  const contHint = document.createElement('div');
  contHint.className = 'field-hint';
  contHint.textContent = 'Link this choice to another turn for multi-step conversations';
  contField.appendChild(contHint);

  const contSelect = document.createElement('select');
  contSelect.style.width = '100%';
  contSelect.setAttribute('data-field-key', getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-to'));

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '(End conversation)';
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

  contField.appendChild(contSelect);
  container.appendChild(contField);
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

  conv.preconditions.forEach((entry, idx) => {
    list.appendChild(renderPreconditionEditor(conv, entry, [idx], 0, true));
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
  wrapper.style.cssText = `margin-left:${depth * 14}px; margin-bottom:8px;`;

  if (branchLabel) {
    const label = document.createElement('div');
    label.style.cssText = 'font-size:10px; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; margin:0 0 4px 2px;';
    label.textContent = branchLabel;
    wrapper.appendChild(label);
  }

  const item = document.createElement('div');
  item.className = 'precond-item clickable';
  item.style.marginBottom = '4px';
  item.setAttribute('data-field-key', getPreconditionItemFieldKey(conv.id, path[0] as number));

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
      groupWrap.style.cssText = `margin-left:${(depth + 1) * 14}px; margin-bottom:8px;`;

      const groupHeader = document.createElement('div');
      groupHeader.className = 'precond-item clickable';
      groupHeader.style.marginBottom = '4px';

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
  span.style.flex = '1';

  if (entry.type === 'simple') {
    const schema = PRECONDITION_SCHEMAS.find(s => s.name === entry.command);
    const cmd = document.createElement('span');
    cmd.className = 'precond-cmd';
    cmd.textContent = schema ? schema.label : entry.command;
    cmd.title = entry.command;
    span.appendChild(cmd);
    if (entry.params.length > 0 && entry.params.some(p => p !== '')) {
      const params = document.createElement('span');
      params.className = 'precond-params';
      params.textContent = ' : ' + entry.params.filter(p => p !== '').join(' : ');
      span.appendChild(params);
    }
  } else if (entry.type === 'not') {
    const notLabel = document.createElement('span');
    notLabel.style.color = 'var(--warning)';
    notLabel.textContent = 'NOT';
    span.appendChild(notLabel);
  } else if (entry.type === 'any') {
    const anyLabel = document.createElement('span');
    anyLabel.style.color = 'var(--info)';
    anyLabel.textContent = `ANY (${entry.options.length} options)`;
    span.appendChild(anyLabel);
  } else {
    const invalidLabel = document.createElement('span');
    invalidLabel.style.color = 'var(--danger)';
    invalidLabel.textContent = 'INVALID PRECONDITION';
    span.appendChild(invalidLabel);
  }

  return span;
}

// ─── Outcome List ─────────────────────────────────────────────────────────

function renderOutcomeList(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice): void {
  const list = document.createElement('ul');
  list.className = 'outcome-list';

  choice.outcomes.forEach((outcome, idx) => {
    const item = document.createElement('li');
    item.className = 'outcome-item clickable';
    item.tabIndex = -1;
    item.setAttribute('data-field-key', getOutcomeItemFieldKey(conv.id, turn.turnNumber, choice.index, idx));

    const display = document.createElement('span');
    display.style.flex = '1';

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
      params.textContent = ' : ' + outcome.params.filter(p => p !== '').join(' : ');
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

    list.appendChild(item);

    // Description from schema
    if (schema) {
      const desc = document.createElement('div');
      desc.className = 'command-description';
      desc.textContent = schema.description;
      list.appendChild(desc);
    }

    // Editable params — always visible
    if (schema && schema.params.length > 0) {
      const paramsDiv = renderParamEditors(schema, outcome.params, (newParams) => {
        const updated = [...choice.outcomes];
        updated[idx] = { ...updated[idx], params: newParams };
        store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: updated });
      }, (paramIndex) => getOutcomeParamFieldKey(conv.id, turn.turnNumber, choice.index, idx, paramIndex), conv);
      list.appendChild(paramsDiv);
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
    list.appendChild(chanceDiv);
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
    case 'command_builder':
      return createCommandBuilderEditor(schema, paramDef, currentValue, onChange, fieldKey, editor.suggestions, editor.chainSeparator ?? '+');
  }
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

  const levelSelect = document.createElement('select');
  levelSelect.className = 'rich-editor-input';
  levelSelect.setAttribute('data-field-key', fieldKey);

  const emptyLevel = document.createElement('option');
  emptyLevel.value = '';
  emptyLevel.textContent = '-- Select level --';
  levelSelect.appendChild(emptyLevel);

  for (const levelKey of Object.keys(SMART_TERRAIN_LEVELS)) {
    const opt = document.createElement('option');
    opt.value = levelKey;
    opt.textContent = LEVEL_DISPLAY_NAMES[levelKey] || levelKey;
    opt.selected = level === levelKey;
    levelSelect.appendChild(opt);
  }

  const terrainSelect = document.createElement('select');
  terrainSelect.className = 'rich-editor-input';

  const syncTerrainOptions = (selectedLevel: string, selectedTerrain: string, placeholderMode: boolean) => {
    terrainSelect.innerHTML = '';
    const emptyTerrain = document.createElement('option');
    emptyTerrain.value = '';
    emptyTerrain.textContent = selectedLevel ? '-- Select terrain --' : 'Choose a level first';
    terrainSelect.appendChild(emptyTerrain);

    if (!selectedLevel) {
      terrainSelect.disabled = true;
      return;
    }

    terrainSelect.disabled = false;
    if (options.allowPlaceholder) {
      const placeholderOpt = document.createElement('option');
      placeholderOpt.value = '__placeholder__';
      placeholderOpt.textContent = `Dynamic placeholder (%${selectedLevel}_panda_st_key%)`;
      placeholderOpt.selected = placeholderMode;
      terrainSelect.appendChild(placeholderOpt);
    }

    for (const terrainKey of SMART_TERRAIN_LEVELS[selectedLevel] || []) {
      const opt = document.createElement('option');
      opt.value = terrainKey;
      opt.textContent = terrainKey;
      opt.selected = !placeholderMode && selectedTerrain === terrainKey;
      terrainSelect.appendChild(opt);
    }
  };

  const syncValue = () => {
    const selectedLevel = levelSelect.value;
    const selectedTerrain = terrainSelect.value;
    if (!selectedLevel) {
      onChange('');
      return;
    }
    if (selectedTerrain === '__placeholder__') {
      onChange(`%${selectedLevel}_panda_st_key%`);
      return;
    }
    onChange(selectedTerrain);
  };

  syncTerrainOptions(level, terrain, usesPlaceholder);

  const summary = document.createElement('div');
  summary.className = 'command-description';
  const updateSummary = () => {
    if (!levelSelect.value) {
      summary.textContent = 'Pick a level first, then choose either a specific vanilla smart terrain key or a dynamic %<level>_panda_st_key% placeholder.';
      return;
    }
    if (terrainSelect.value === '__placeholder__') {
      summary.textContent = `Using dynamic placeholder %${levelSelect.value}_panda_st_key% for ${LEVEL_DISPLAY_NAMES[levelSelect.value] || levelSelect.value}.`;
      return;
    }
    summary.textContent = terrainSelect.value
      ? `Using exact smart terrain key ${terrainSelect.value}.`
      : 'Choose a smart terrain key for this level.';
  };

  levelSelect.onchange = () => {
    syncTerrainOptions(levelSelect.value, '', options.allowPlaceholder);
    if (options.allowPlaceholder && levelSelect.value) terrainSelect.value = '__placeholder__';
    syncValue();
    updateSummary();
  };

  terrainSelect.onchange = () => {
    syncValue();
    updateSummary();
  };

  updateSummary();
  wrapper.appendChild(levelSelect);
  wrapper.appendChild(terrainSelect);
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
    : 'Select one of the turns already defined in this conversation.';
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

function showCommandPicker(parent: HTMLElement, schemas: CommandSchema[], onSelect: (schema: CommandSchema) => void): void {
  // Close any existing dropdown
  const existing = parent.querySelector('.dropdown-menu');
  if (existing) { existing.remove(); return; }

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';

  // Search filter
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search commands...';
  searchInput.className = 'dropdown-search';
  searchInput.style.cssText = 'width:100%; margin-bottom:4px; padding:4px 8px; font-size:12px;';
  menu.appendChild(searchInput);

  const listContainer = document.createElement('div');

  function renderList(filter: string) {
    listContainer.innerHTML = '';
    const groups = groupByCategory(schemas);
    let hasResults = false;

    for (const [category, items] of groups) {
      const filtered = items.filter(s =>
        filter === '' ||
        s.label.toLowerCase().includes(filter) ||
        s.description.toLowerCase().includes(filter) ||
        s.name.toLowerCase().includes(filter)
      );
      if (filtered.length === 0) continue;
      hasResults = true;

      const catLabel = document.createElement('div');
      catLabel.className = 'dropdown-category';
      catLabel.textContent = category;
      listContainer.appendChild(catLabel);

      for (const schema of filtered) {
        const opt = document.createElement('button');
        opt.className = 'dropdown-option';
        opt.innerHTML = `${schema.label}<span class="dropdown-option-desc">${schema.description}</span>`;
        opt.onclick = () => {
          menu.remove();
          wrapper.remove();
          onSelect(schema);
        };
        listContainer.appendChild(opt);
      }
    }

    if (!hasResults) {
      const noResult = document.createElement('div');
      noResult.style.cssText = 'padding:8px; color:var(--text-dim); font-size:11px; text-align:center;';
      noResult.textContent = 'No matching commands';
      listContainer.appendChild(noResult);
    }
  }

  renderList('');
  searchInput.oninput = () => renderList(searchInput.value.toLowerCase().trim());

  menu.appendChild(listContainer);

  // Position near the add button
  const wrapper = document.createElement('div');
  wrapper.className = 'dropdown-editor';
  wrapper.style.position = 'relative';
  wrapper.appendChild(menu);
  parent.appendChild(wrapper);

  // Focus the search input
  requestAnimationFrame(() => searchInput.focus());

  // Close on outside click
  const closeHandler = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      wrapper.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

// ─── Placeholder Picker ──────────────────────────────────────────────────

function renderPlaceholderPicker(container: HTMLElement): void {
  const wrapper = document.createElement('div');
  wrapper.style.marginBottom = '8px';

  const header = document.createElement('div');
  header.style.cssText = 'font-size:10px; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;';
  header.textContent = 'Dynamic Placeholders (click to copy)';
  wrapper.appendChild(header);

  const picker = document.createElement('div');
  picker.className = 'placeholder-picker';

  for (const ph of DYNAMIC_PLACEHOLDERS) {
    const btn = document.createElement('button');
    btn.className = 'placeholder-btn';
    btn.textContent = ph.key;
    btn.title = ph.description + ' — drag to a text field or click to copy';
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
    picker.appendChild(btn);
  }

  const stBtn = document.createElement('button');
  stBtn.className = 'placeholder-btn';
  stBtn.textContent = '%smart_terrain%';
  stBtn.title = 'Choose a level, then a real smart terrain key or level placeholder';
  stBtn.style.borderColor = 'var(--accent-dim)';
  stBtn.onclick = (e) => {
    e.preventDefault();
    const existing = wrapper.querySelector('.smart-terrain-placeholder-card');
    if (existing) {
      existing.remove();
      stBtn.classList.remove('active');
      return;
    }

    stBtn.classList.add('active');
    const editor = createPlaceholderSmartTerrainEditor(container, stBtn);
    wrapper.appendChild(editor);
  };
  picker.appendChild(stBtn);

  wrapper.appendChild(picker);
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
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-sm';
    addBtn.textContent = '+ Add';
    addBtn.title = `Add a new ${title.toLowerCase().replace(/\s*\(.*/, '')}`;
    addBtn.onclick = onAdd;
    header.appendChild(addBtn);
  }

  return header;
}
