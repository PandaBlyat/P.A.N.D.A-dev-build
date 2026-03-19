// P.A.N.D.A. Conversation Editor — Toolbar

import { requestFlowCenter } from '../lib/flow-navigation';
import { store, type FlowDensity } from '../lib/state';
import { FACTION_IDS } from '../lib/constants';
import { FACTION_DISPLAY_NAMES } from '../lib/types';
import { exportProjectJson, exportXml, importFromXml, importFromJson } from './App';
import { createIcon, setButtonContent, type IconName } from './icons';

type SearchResult = {
  label: string;
  meta: string;
  onSelect: () => void;
};

export function renderToolbar(): HTMLElement {
  const state = store.get();
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  const title = document.createElement('span');
  title.className = 'toolbar-title';
  title.append(createIcon('brand'), document.createTextNode('P.A.N.D.A. Editor'));
  toolbar.appendChild(title);

  // Faction selector
  const factionSelect = document.createElement('select');
  factionSelect.title = 'Select the faction these conversations belong to. Determines the XML file prefix.';
  for (const fid of FACTION_IDS) {
    const opt = document.createElement('option');
    opt.value = fid;
    opt.textContent = FACTION_DISPLAY_NAMES[fid];
    opt.selected = fid === state.project.faction;
    factionSelect.appendChild(opt);
  }
  factionSelect.onchange = () => store.setFaction(factionSelect.value as typeof FACTION_IDS[number]);
  toolbar.appendChild(factionSelect);

  toolbar.appendChild(sep());

  const fileGroup = document.createElement('div');
  fileGroup.className = 'toolbar-group';
  fileGroup.appendChild(btn('open', 'Open', importFromJson, 'Open a saved .panda/.json project or import a PANDA XML file'));
  fileGroup.appendChild(btn('import', 'Import XML', importFromXml, 'Import conversations from an existing game XML file'));
  fileGroup.appendChild(btn('save', 'Save', exportProjectJson, 'Save as .panda project file (preserves editor data)'));
  const exportXmlBtn = btn('export', 'Export XML', exportXml, 'Export as game-ready XML file for S.T.A.L.K.E.R. Anomaly');
  exportXmlBtn.classList.add('btn-primary');
  fileGroup.appendChild(exportXmlBtn);
  toolbar.appendChild(fileGroup);

  toolbar.appendChild(sep());

  const viewGroup = document.createElement('div');
  viewGroup.className = 'toolbar-group';
  viewGroup.appendChild(btn(
    'xml',
    state.showXmlPreview ? 'Hide XML' : 'Show XML',
    () => store.toggleXmlPreview(),
    'Toggle live XML preview at the bottom of the screen'
  ));
  viewGroup.appendChild(btn(
    'strings',
    state.showSystemStringsPanel ? 'Hide Strings' : 'Strings',
    () => store.toggleSystemStringsPanel(),
    'Open the shared system strings manager'
  ));

  const densitySelect = document.createElement('select');
  densitySelect.className = 'toolbar-density-select';
  densitySelect.title = 'Adjust how much information each turn card shows in the flow editor.';
  const densityOptions: FlowDensity[] = ['compact', 'standard', 'detailed'];
  for (const density of densityOptions) {
    const option = document.createElement('option');
    option.value = density;
    option.textContent = `Nodes: ${density}`;
    option.selected = density === state.flowDensity;
    densitySelect.appendChild(option);
  }
  densitySelect.onchange = () => store.setFlowDensity(densitySelect.value as FlowDensity);
  viewGroup.appendChild(densitySelect);
  toolbar.appendChild(viewGroup);

  toolbar.appendChild(sep());

  const search = renderQuickSearch();
  toolbar.appendChild(search);

  toolbar.appendChild(sep());

  const histGroup = document.createElement('div');
  histGroup.className = 'toolbar-group';
  const undoBtn = btn('undo', 'Undo', () => store.undo(), 'Undo last change (Ctrl+Z)');
  const redoBtn = btn('redo', 'Redo', () => store.redo(), 'Redo last undone change (Ctrl+Y)');
  undoBtn.disabled = state.undoStack.length === 0;
  redoBtn.disabled = state.redoStack.length === 0;
  histGroup.appendChild(undoBtn);
  histGroup.appendChild(redoBtn);
  toolbar.appendChild(histGroup);

  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer';
  toolbar.appendChild(spacer);

  const status = document.createElement('span');
  status.className = 'toolbar-status';
  const convCount = state.project.conversations.length;
  const stringCount = state.systemStrings.size;
  if (state.dirty) {
    status.innerHTML = `<span class="unsaved-dot"></span> ${convCount} conv${convCount !== 1 ? 's' : ''} • ${stringCount} strings • unsaved`;
    status.style.color = 'var(--warning)';
  } else {
    status.textContent = `${convCount} conversation${convCount !== 1 ? 's' : ''} • ${stringCount} strings`;
  }
  toolbar.appendChild(status);

  return toolbar;
}

function renderQuickSearch(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'toolbar-search';

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'toolbar-search-input';
  input.placeholder = 'Jump to conversation, turn, choice, command, string…';
  input.title = 'Quick navigation across conversations, choices, commands, and system strings (Ctrl/Cmd+P)';
  input.setAttribute('data-global-search', 'true');

  const results = document.createElement('div');
  results.className = 'toolbar-search-results';
  results.hidden = true;

  let currentResults: SearchResult[] = [];

  const activateResult = (result: SearchResult): void => {
    input.value = '';
    results.hidden = true;
    result.onSelect();
  };

  const renderResults = (query: string): void => {
    currentResults = buildSearchResults(query);
    results.replaceChildren();

    if (query.trim() === '' || currentResults.length === 0) {
      results.hidden = true;
      return;
    }

    currentResults.slice(0, 14).forEach((result) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'toolbar-search-result';
      item.innerHTML = `<strong>${escapeHtml(result.label)}</strong><span>${escapeHtml(result.meta)}</span>`;
      item.onclick = () => activateResult(result);
      results.appendChild(item);
    });

    results.hidden = false;
  };

  input.oninput = () => renderResults(input.value);
  input.onfocus = () => renderResults(input.value);
  input.onkeydown = (event) => {
    if (event.key === 'Escape') {
      results.hidden = true;
      input.blur();
      return;
    }

    if (event.key === 'Enter' && currentResults.length > 0) {
      event.preventDefault();
      activateResult(currentResults[0]);
    }
  };
  input.onblur = () => {
    window.setTimeout(() => {
      results.hidden = true;
    }, 120);
  };

  wrapper.append(input, results);
  return wrapper;
}

function buildSearchResults(query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return [];

  const { project, systemStrings } = store.get();
  const results: SearchResult[] = [];

  for (const conv of project.conversations) {
    const conversationText = `${conv.id} ${conv.label}`.toLowerCase();
    if (conversationText.includes(normalized)) {
      results.push({
        label: `Conversation ${conv.id}`,
        meta: conv.label || 'Untitled conversation',
        onSelect: () => {
          store.selectConversation(conv.id);
          requestFlowCenter({ conversationId: conv.id, fit: true });
        },
      });
    }

    for (const turn of conv.turns) {
      const turnText = `turn ${turn.turnNumber} ${turn.openingMessage || ''}`.toLowerCase();
      if (turnText.includes(normalized)) {
        results.push({
          label: `C${conv.id} · Turn ${turn.turnNumber}`,
          meta: truncate(turn.openingMessage || 'Select turn in flow editor', 72),
          onSelect: () => {
            store.selectConversation(conv.id);
            store.selectTurn(turn.turnNumber);
            requestFlowCenter({ conversationId: conv.id, turnNumber: turn.turnNumber });
          },
        });
      }

      for (const choice of turn.choices) {
        const commandList = choice.outcomes.map((outcome) => outcome.command).join(' ');
        const haystack = `${choice.text} ${choice.reply} ${commandList} ${choice.continueTo ?? ''}`.toLowerCase();
        if (!haystack.includes(normalized)) continue;
        results.push({
          label: `C${conv.id} · T${turn.turnNumber} · Choice ${choice.index}`,
          meta: truncate(choice.text || choice.reply || commandList || '(empty choice)', 72),
          onSelect: () => {
            store.selectConversation(conv.id);
            store.selectTurn(turn.turnNumber);
            store.selectChoice(choice.index);
            requestFlowCenter({ conversationId: conv.id, turnNumber: turn.turnNumber });
          },
        });
      }
    }
  }

  for (const [key, value] of [...systemStrings.entries()]) {
    const haystack = `${key} ${value}`.toLowerCase();
    if (!haystack.includes(normalized)) continue;
    results.push({
      label: `String · ${key}`,
      meta: truncate(value || '(empty system string)', 72),
      onSelect: () => {
        if (!store.get().showSystemStringsPanel) store.toggleSystemStringsPanel();
      },
    });
  }

  return results;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function escapeHtml(value: string): string {
  return value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

function btn(icon: IconName, label: string, onclick: () => void, tooltip?: string): HTMLButtonElement {
  const b = document.createElement('button');
  setButtonContent(b, icon, label);
  b.onclick = onclick;
  if (tooltip) b.title = tooltip;
  return b;
}

function sep(): HTMLElement {
  const s = document.createElement('div');
  s.className = 'toolbar-separator';
  return s;
}
