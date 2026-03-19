// P.A.N.D.A. Conversation Editor — Properties Panel (Right Panel)

import { store } from '../lib/state';
import type { Conversation, Turn, Choice, PreconditionEntry, SimplePrecondition, Outcome, FactionId } from '../lib/types';
import { FACTION_DISPLAY_NAMES } from '../lib/types';
import { PRECONDITION_SCHEMAS, OUTCOME_SCHEMAS, groupByCategory } from '../lib/schema';
import type { CommandSchema } from '../lib/schema';
import { FACTION_IDS, RANKS, MUTANT_TYPES, DYNAMIC_PLACEHOLDERS, LEVEL_DISPLAY_NAMES, SMART_TERRAIN_LEVELS } from '../lib/constants';

export function renderPropertiesPanel(container: HTMLElement): void {
  const state = store.get();
  const conv = store.getSelectedConversation();

  if (!conv) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">No selection</div>
        <div class="empty-state-hint">Select a conversation to edit its properties.</div>
      </div>
    `;
    return;
  }

  const turn = store.getSelectedTurn();
  const choice = store.getSelectedChoice();

  // If a specific choice is selected, show choice editor
  if (turn && choice) {
    renderChoiceProperties(container, conv, turn, choice);
    return;
  }

  // If a turn is selected, show turn properties
  if (turn) {
    renderTurnProperties(container, conv, turn);
    return;
  }

  // Otherwise show conversation properties
  renderConversationProperties(container, conv);
}

// ─── Conversation Properties ──────────────────────────────────────────────

function renderConversationProperties(container: HTMLElement, conv: Conversation): void {
  // Label
  const labelField = createField('Label', 'text', conv.label, (val) => {
    store.updateConversation(conv.id, { label: val });
  });
  container.appendChild(labelField);

  // Preconditions
  const precondSection = document.createElement('div');
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
  renderPreconditionList(precondSection, conv);
  container.appendChild(precondSection);

  // Timeout
  container.appendChild(document.createElement('hr'));
  const timeoutField = createField('Timeout (seconds)', 'number', String(conv.timeout || ''), (val) => {
    store.updateConversation(conv.id, { timeout: val ? parseInt(val, 10) : undefined });
  });
  container.appendChild(timeoutField);

  const timeoutMsgField = createField('Timeout Message', 'textarea', conv.timeoutMessage || '', (val) => {
    store.updateConversation(conv.id, { timeoutMessage: val || undefined });
  });
  container.appendChild(timeoutMsgField);
}

// ─── Turn Properties ──────────────────────────────────────────────────────

function renderTurnProperties(container: HTMLElement, conv: Conversation, turn: Turn): void {
  const title = document.createElement('div');
  title.className = 'section-header';
  title.innerHTML = `<span class="section-title">Turn ${turn.turnNumber}</span>`;
  container.appendChild(title);

  // Opening message (turn 1 only)
  if (turn.turnNumber === 1) {
    const msgField = createField('Opening Message', 'textarea', turn.openingMessage || '', (val) => {
      store.updateTurn(conv.id, turn.turnNumber, { openingMessage: val });
    });
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
      delBtn.style.color = 'var(--danger)';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        store.deleteChoice(conv.id, turn.turnNumber, choice.index);
      };
      header.appendChild(delBtn);
    }

    card.appendChild(header);

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
  });
  container.appendChild(textField);

  // NPC Reply
  const replyField = createField('NPC Reply', 'textarea', choice.reply, (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { reply: val });
  });
  container.appendChild(replyField);

  // Placeholder picker
  renderPlaceholderPicker(container);

  // Reply variants
  const relHighField = createField('Reply (High Relationship, \u2265300)', 'textarea', choice.replyRelHigh || '', (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyRelHigh: val || undefined });
  });
  container.appendChild(relHighField);

  const relLowField = createField('Reply (Low Relationship, \u2264-300)', 'textarea', choice.replyRelLow || '', (val) => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { replyRelLow: val || undefined });
  });
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
  renderOutcomeList(outcomeSection, conv, turn, choice);
  container.appendChild(outcomeSection);

  // Continuation
  container.appendChild(document.createElement('hr'));
  const contField = document.createElement('div');
  contField.className = 'field';
  const contLabel = document.createElement('label');
  contLabel.textContent = 'Continue To Turn';
  contField.appendChild(contLabel);

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

function renderPreconditionList(container: HTMLElement, conv: Conversation): void {
  const list = document.createElement('ul');
  list.className = 'precond-list';

  conv.preconditions.forEach((entry, idx) => {
    const item = document.createElement('li');
    item.className = 'precond-item';

    const display = renderPreconditionDisplay(entry);
    item.appendChild(display);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-sm';
    delBtn.textContent = '\u00d7';
    delBtn.style.color = 'var(--danger)';
    delBtn.onclick = () => {
      const updated = [...conv.preconditions];
      updated.splice(idx, 1);
      store.updateConversation(conv.id, { preconditions: updated });
    };
    item.appendChild(delBtn);

    list.appendChild(item);

    // Editable params for simple preconditions
    if (entry.type === 'simple') {
      const schema = PRECONDITION_SCHEMAS.find(s => s.name === entry.command);
      if (schema && schema.params.length > 0) {
        const paramsDiv = renderParamEditors(schema, entry.params, (newParams) => {
          const updated = [...conv.preconditions];
          (updated[idx] as SimplePrecondition).params = newParams;
          store.updateConversation(conv.id, { preconditions: updated });
        });
        list.appendChild(paramsDiv);
      }
    }
  });

  container.appendChild(list);
}

function renderPreconditionDisplay(entry: PreconditionEntry): HTMLElement {
  const span = document.createElement('span');
  span.style.flex = '1';

  if (entry.type === 'simple') {
    const cmd = document.createElement('span');
    cmd.className = 'precond-cmd';
    cmd.textContent = entry.command;
    span.appendChild(cmd);
    if (entry.params.length > 0 && entry.params.some(p => p !== '')) {
      const params = document.createElement('span');
      params.className = 'precond-params';
      params.textContent = ' : ' + entry.params.filter(p => p !== '').join(' : ');
      span.appendChild(params);
    }
  } else if (entry.type === 'not') {
    span.innerHTML = `<span style="color:var(--warning)">NOT</span> `;
    span.appendChild(renderPreconditionDisplay(entry.inner));
  } else {
    span.innerHTML = `<span style="color:var(--info)">ANY</span> (${entry.options.length} options)`;
  }

  return span;
}

// ─── Outcome List ─────────────────────────────────────────────────────────

function renderOutcomeList(container: HTMLElement, conv: Conversation, turn: Turn, choice: Choice): void {
  const list = document.createElement('ul');
  list.className = 'outcome-list';

  if (choice.outcomes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'outcome-item';
    empty.innerHTML = '<span class="outcome-cmd" style="color:var(--text-dim)">none</span>';
    list.appendChild(empty);
    container.appendChild(list);
    return;
  }

  choice.outcomes.forEach((outcome, idx) => {
    const item = document.createElement('li');
    item.className = 'outcome-item';

    const display = document.createElement('span');
    display.style.flex = '1';

    if (outcome.chancePercent != null && outcome.chancePercent < 100) {
      const chanceBadge = document.createElement('span');
      chanceBadge.style.cssText = 'color:var(--warning); margin-right:4px;';
      chanceBadge.textContent = `${outcome.chancePercent}%`;
      display.appendChild(chanceBadge);
    }

    const cmd = document.createElement('span');
    cmd.className = 'outcome-cmd';
    cmd.textContent = outcome.command;
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
    delBtn.style.color = 'var(--danger)';
    delBtn.onclick = () => {
      const updated = [...choice.outcomes];
      updated.splice(idx, 1);
      store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: updated });
    };
    item.appendChild(delBtn);

    list.appendChild(item);

    // Editable params
    const schema = OUTCOME_SCHEMAS.find(s => s.name === outcome.command);
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
        // Smart terrain: show as text input with placeholder format hint
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
    input.onchange = () => {
      const newParams = [...currentParams];
      while (newParams.length <= i) newParams.push('');
      newParams[i] = input.value;
      onChange(newParams);
    };

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

  const groups = groupByCategory(schemas);
  for (const [category, items] of groups) {
    const catLabel = document.createElement('div');
    catLabel.className = 'dropdown-category';
    catLabel.textContent = category;
    menu.appendChild(catLabel);

    for (const schema of items) {
      const opt = document.createElement('button');
      opt.className = 'dropdown-option';
      opt.innerHTML = `${schema.label}<span class="dropdown-option-desc">${schema.description}</span>`;
      opt.onclick = () => {
        menu.remove();
        onSelect(schema);
      };
      menu.appendChild(opt);
    }
  }

  // Position near the add button
  const wrapper = document.createElement('div');
  wrapper.className = 'dropdown-editor';
  wrapper.style.position = 'relative';
  wrapper.appendChild(menu);
  parent.appendChild(wrapper);

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
  const picker = document.createElement('div');
  picker.className = 'placeholder-picker';

  for (const ph of DYNAMIC_PLACEHOLDERS) {
    const btn = document.createElement('button');
    btn.className = 'placeholder-btn';
    btn.textContent = ph.key;
    btn.title = ph.description;
    btn.onclick = () => {
      // Insert at cursor of the last focused textarea
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLTextAreaElement) {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        const text = activeEl.value;
        activeEl.value = text.substring(0, start) + ph.key + text.substring(end);
        activeEl.selectionStart = activeEl.selectionEnd = start + ph.key.length;
        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
        activeEl.focus();
      } else {
        // Copy to clipboard as fallback
        navigator.clipboard.writeText(ph.key);
      }
    };
    picker.appendChild(btn);
  }

  // Smart terrain placeholders
  const stBtn = document.createElement('button');
  stBtn.className = 'placeholder-btn';
  stBtn.textContent = '%smart_terrain%';
  stBtn.title = 'Insert smart terrain placeholder';
  stBtn.style.borderColor = 'var(--accent-dim)';
  stBtn.onclick = () => {
    // Show level picker
    const levelKeys = Object.keys(SMART_TERRAIN_LEVELS);
    const sel = prompt(
      'Enter level key for smart terrain placeholder:\n\n' +
      levelKeys.map(k => `  ${k} (${LEVEL_DISPLAY_NAMES[k]})`).join('\n') +
      '\n\nThis will insert %<level>_panda_st% in text and %<level>_panda_st_key% for outcomes.'
    );
    if (sel && levelKeys.includes(sel)) {
      const activeEl = document.activeElement;
      const placeholder = `%${sel}_panda_st%`;
      if (activeEl instanceof HTMLTextAreaElement) {
        const start = activeEl.selectionStart;
        const text = activeEl.value;
        activeEl.value = text.substring(0, start) + placeholder + text.substring(activeEl.selectionEnd);
        activeEl.selectionStart = activeEl.selectionEnd = start + placeholder.length;
        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
        activeEl.focus();
      } else {
        navigator.clipboard.writeText(placeholder);
      }
    }
  };
  picker.appendChild(stBtn);

  container.appendChild(picker);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function createField(labelText: string, type: string, value: string, onChange: (val: string) => void): HTMLElement {
  const field = document.createElement('div');
  field.className = 'field';

  const label = document.createElement('label');
  label.textContent = labelText;
  field.appendChild(label);

  if (type === 'textarea') {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.oninput = () => onChange(textarea.value);
    field.appendChild(textarea);
  } else {
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.oninput = () => onChange(input.value);
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
    addBtn.onclick = onAdd;
    header.appendChild(addBtn);
  }

  return header;
}
