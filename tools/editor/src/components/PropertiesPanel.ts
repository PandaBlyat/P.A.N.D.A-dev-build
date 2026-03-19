// P.A.N.D.A. Conversation Editor — Properties Panel (Right Panel)

import { store } from '../lib/state';
import type { PropertiesTab } from '../lib/state';
import type { Conversation, Turn, Choice, PreconditionEntry, AnyPreconditionOption, SimplePrecondition, Outcome, FactionId } from '../lib/types';
import { FACTION_DISPLAY_NAMES } from '../lib/types';
import { PRECONDITION_SCHEMAS, OUTCOME_SCHEMAS, groupByCategory } from '../lib/schema';
import type { CommandSchema } from '../lib/schema';
import { FACTION_IDS, RANKS, MUTANT_TYPES, DYNAMIC_PLACEHOLDERS, LEVEL_DISPLAY_NAMES, SMART_TERRAIN_LEVELS } from '../lib/constants';

// ─── Debounce helper ─────────────────────────────────────────────────────
const debounceTimers = new Map<string, number>();
function debounced(key: string, fn: () => void, delay = 300): void {
  const prev = debounceTimers.get(key);
  if (prev != null) clearTimeout(prev);
  debounceTimers.set(key, window.setTimeout(() => {
    debounceTimers.delete(key);
    fn();
  }, delay));
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
    selTab.textContent = `T${turn.turnNumber} / C${choice.index}`;
  } else if (turn) {
    selTab.textContent = `Turn ${turn.turnNumber}`;
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
    renderChoiceProperties(content, conv, turn, choice);
  } else if (turn) {
    renderTurnProperties(content, conv, turn);
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
  }, 'A short name for this conversation (only used in the editor)');
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
  }, 'Auto-close conversation after this many seconds (leave empty for no timeout)');
  container.appendChild(timeoutField);

  const timeoutMsgField = createField('Timeout Message', 'textarea', conv.timeoutMessage || '', (val) => {
    store.updateConversation(conv.id, { timeoutMessage: val || undefined });
  }, 'Message shown when the conversation times out');
  container.appendChild(timeoutMsgField);
}

// ─── Turn Properties ──────────────────────────────────────────────────────

function renderTurnProperties(container: HTMLElement, conv: Conversation, turn: Turn): void {
  const title = document.createElement('div');
  title.className = 'section-header';
  const titleSpan = document.createElement('span');
  titleSpan.className = 'section-title';
  titleSpan.textContent = `Turn ${turn.turnNumber}`;
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
    }, 'The first message the NPC sends when starting this conversation');
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
      badge.textContent = `\u2192 Continues to Turn ${choice.continueTo}`;
      card.appendChild(badge);
    }

    choicesSection.appendChild(card);
  }

  container.appendChild(choicesSection);
}

// ─── Choice Properties ────────────────────────────────────────────────────

function renderChoiceProperties(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice): void {
  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-sm';
  backBtn.textContent = '\u2190 Back to Turn ' + turn.turnNumber;
  backBtn.title = 'Return to turn overview';
  backBtn.onclick = () => store.selectChoice(null);
  backBtn.style.marginBottom = '10px';
  container.appendChild(backBtn);

  const title = document.createElement('div');
  title.className = 'section-header';
  title.innerHTML = `<span class="section-title">Turn ${turn.turnNumber} / Choice ${choice.index}</span>`;
  container.appendChild(title);

  // Choice text
  const textField = createField('Player Choice Text', 'textarea', choice.text, (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { text: val });
  }, 'What the player says when choosing this option');
  container.appendChild(textField);

  // NPC Reply
  const replyField = createField('NPC Reply', 'textarea', choice.reply, (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { reply: val });
  }, 'The NPC\'s response to this choice');
  container.appendChild(replyField);

  // Placeholder picker
  renderPlaceholderPicker(container);

  // Reply variants
  const relHighField = createField('Reply (High Relationship, \u2265300)', 'textarea', choice.replyRelHigh || '', (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyRelHigh: val || undefined });
  }, 'Alternative reply when relationship score is 300 or higher (optional)');
  container.appendChild(relHighField);

  const relLowField = createField('Reply (Low Relationship, \u2264-300)', 'textarea', choice.replyRelLow || '', (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyRelLow: val || undefined });
  }, 'Alternative reply when relationship score is -300 or lower (optional)');
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

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '(End conversation)';
  noneOpt.selected = choice.continueTo == null;
  contSelect.appendChild(noneOpt);

  for (const t of conv.turns) {
    if (t.turnNumber === turn.turnNumber) continue; // Can't continue to self
    const opt = document.createElement('option');
    opt.value = String(t.turnNumber);
    opt.textContent = `Turn ${t.turnNumber}`;
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
    const schema = PRECONDITION_SCHEMAS.find(s => s.name === entry.command);
    if (schema && schema.params.length > 0) {
      wrapper.appendChild(renderParamEditors(schema, entry.params, (newParams) => {
        updatePreconditionAtPath(conv, path, (current) => {
          if (current.type !== 'simple') return current;
          return { ...current, params: newParams };
        });
      }));
    }

    if (schema) {
      const desc = document.createElement('div');
      desc.className = 'command-description';
      desc.textContent = schema.description;
      wrapper.appendChild(desc);
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
      });
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

function renderParamEditors(schema: CommandSchema, currentParams: string[], onChange: (params: string[]) => void): HTMLElement {
  const div = document.createElement('div');
  div.style.cssText = 'padding: 4px 8px 8px; background: var(--bg-darkest); border-radius: var(--radius); margin-bottom: 4px;';

  schema.params.forEach((paramDef, i) => {
    const field = document.createElement('div');
    field.style.cssText = 'display:flex; align-items:center; gap:4px; margin-bottom:4px;';

    const label = document.createElement('label');
    label.textContent = paramDef.label;
    label.style.cssText = 'min-width:90px; margin:0;';
    if (paramDef.required) {
      label.textContent += ' *';
      label.title = 'Required';
    }
    field.appendChild(label);

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
    const paramKey = `param-${schema.name}-${i}`;
    input.setAttribute('data-field-key', paramKey);
    const handler = () => {
      const newParams = [...currentParams];
      while (newParams.length <= i) newParams.push('');
      newParams[i] = input.value;
      onChange(newParams);
    };
    // Text inputs get debounced oninput; selects get immediate onchange
    if (input instanceof HTMLSelectElement) {
      input.onchange = handler;
    } else {
      input.oninput = () => debounced(paramKey, handler);
    }

    field.appendChild(input);
    div.appendChild(field);
  });

  return div;
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
      // Try to insert at cursor of the last focused textarea in the panel
      const panel = container.closest('.panel-body') || container;
      const textareas = panel.querySelectorAll('textarea');
      let inserted = false;

      for (const ta of textareas) {
        if (ta === document.activeElement) {
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const text = ta.value;
          ta.value = text.substring(0, start) + ph.key + text.substring(end);
          ta.selectionStart = ta.selectionEnd = start + ph.key.length;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.focus();
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        navigator.clipboard.writeText(ph.key).then(() => {
          btn.textContent = 'Copied!';
          btn.style.color = 'var(--accent)';
          setTimeout(() => {
            btn.textContent = ph.key;
            btn.style.color = '';
          }, 1000);
        });
      }
    };
    picker.appendChild(btn);
  }

  // Smart terrain placeholders
  const stBtn = document.createElement('button');
  stBtn.className = 'placeholder-btn';
  stBtn.textContent = '%smart_terrain%';
  stBtn.title = 'Insert smart terrain placeholder — click to copy';
  stBtn.style.borderColor = 'var(--accent-dim)';
  stBtn.draggable = true;
  stBtn.addEventListener('dragstart', (e) => {
    e.dataTransfer!.setData('text/plain', '%smart_terrain%');
    e.dataTransfer!.setData('application/x-panda-placeholder', '%smart_terrain%');
    e.dataTransfer!.effectAllowed = 'copy';
  });
  stBtn.onclick = () => {
    // Show level picker
    const levelKeys = Object.keys(SMART_TERRAIN_LEVELS);
    const sel = prompt(
      'Enter level key for smart terrain placeholder:\n\n' +
      levelKeys.map(k => `  ${k} (${LEVEL_DISPLAY_NAMES[k]})`).join('\n') +
      '\n\nThis will insert %<level>_panda_st% in text and %<level>_panda_st_key% for outcomes.'
    );
    if (sel && levelKeys.includes(sel)) {
      const placeholder = `%${sel}_panda_st%`;
      navigator.clipboard.writeText(placeholder).then(() => {
        stBtn.textContent = 'Copied!';
        stBtn.style.color = 'var(--accent)';
        setTimeout(() => {
          stBtn.textContent = '%smart_terrain%';
          stBtn.style.color = '';
        }, 1000);
      });
    }
  };
  picker.appendChild(stBtn);

  wrapper.appendChild(picker);
  container.appendChild(wrapper);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function createField(labelText: string, type: string, value: string, onChange: (val: string) => void, hint?: string): HTMLElement {
  const field = document.createElement('div');
  field.className = 'field';
  const fieldKey = 'field-' + labelText.replace(/\s+/g, '-').toLowerCase();

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
    textarea.setAttribute('data-field-key', fieldKey);
    textarea.oninput = () => {
      debounced(fieldKey, () => onChange(textarea.value));
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
    input.setAttribute('data-field-key', fieldKey);
    input.oninput = () => {
      debounced(fieldKey, () => onChange(input.value));
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
