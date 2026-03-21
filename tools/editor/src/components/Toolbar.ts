// P.A.N.D.A. Conversation Editor — Toolbar

import { requestFlowCenter } from '../lib/flow-navigation';
import { store, type FlowDensity } from '../lib/state';
import { createTurnDisplayLabeler } from '../lib/turn-labels';
import { FACTION_IDS } from '../lib/constants';
import { FACTION_DISPLAY_NAMES } from '../lib/types';
import { FACTION_COLORS } from '../lib/faction-colors';
import { exportProjectJson, exportXml, importFromXml, importFromJson } from '../lib/project-io';
import { openSharePanel } from './SharePanel';
import { openHelpModal } from './HelpModal';
import { openSupportPanel } from './SupportPanel';
import { createIcon, setButtonContent, type IconName } from './icons';
import { clearDraft } from '../lib/draft-storage';
import { createEmptyProject } from '../lib/xml-export';

type SearchResult = {
  label: string;
  meta: string;
  onSelect: () => void;
};

type ToolbarButtonOptions = {
  classes?: string[];
  tooltip?: string;
  ariaLabel?: string;
};

type ToolbarLayoutMode = 'desktop' | 'tablet' | 'mobile';

type OverflowAction = {
  icon: IconName;
  label: string;
  title?: string;
  onclick: () => void;
  disabled?: boolean;
};

export function renderToolbar(layoutMode: ToolbarLayoutMode = 'desktop'): HTMLElement {
  const state = store.get();
  const isCompact = layoutMode !== 'desktop';
  const isMobile = layoutMode === 'mobile';
  const toolbar = document.createElement('div');
  toolbar.className = `toolbar toolbar-${layoutMode}`;

  const projectTier = document.createElement('div');
  projectTier.className = 'toolbar-tier toolbar-tier-project';

  const branding = document.createElement('div');
  branding.className = 'toolbar-branding';

  const title = document.createElement('span');
  title.className = 'toolbar-title';
  title.append(createIcon('brand'), document.createTextNode('P.A.N.D.A. Editor'));

  branding.appendChild(title);
  projectTier.appendChild(branding);

  const factionPicker = document.createElement('div');
  factionPicker.className = 'toolbar-faction-picker';

  const factionLabel = document.createElement('span');
  factionLabel.className = 'toolbar-select-label';
  factionLabel.textContent = 'Player Faction';

  const factionSelect = document.createElement('select');
  factionSelect.className = 'toolbar-faction-select';
  factionSelect.title = 'Pick the player\'s faction — conversations will only trigger when the player belongs to this faction. Also determines the XML file prefix.';

  const placeholderOpt = document.createElement('option');
  placeholderOpt.disabled = true;
  placeholderOpt.textContent = '— Player\'s faction for conversations —';
  factionSelect.appendChild(placeholderOpt);

  for (const fid of FACTION_IDS) {
    const opt = document.createElement('option');
    opt.value = fid;
    opt.textContent = `● ${FACTION_DISPLAY_NAMES[fid]}`;
    opt.style.color = FACTION_COLORS[fid];
    opt.selected = fid === state.project.faction;
    factionSelect.appendChild(opt);
  }
  factionSelect.onchange = () => store.setFaction(factionSelect.value as typeof FACTION_IDS[number]);

  factionPicker.append(factionLabel, factionSelect);

  const fileGroup = document.createElement('div');
  fileGroup.className = 'toolbar-group toolbar-group-project';
  fileGroup.appendChild(factionPicker);
  fileGroup.appendChild(sep());

  const openBtn = btn('open', 'Open', importFromJson, 'Open a saved .panda/.json project or import a PANDA XML file');
  const saveBtn = btn('save', 'Save', exportProjectJson, 'Save as .panda project file (preserves editor data)');
  const importBtn = btn('import', 'Import', importFromXml, 'Import conversations from an existing game XML file');
  const exportXmlBtn = btn('export', 'Export XML', exportXml, 'Export as game-ready XML file for S.T.A.L.K.E.R. Anomaly', {
    classes: ['btn-subtle'],
  });
  const communityBtn = btn('share', 'Community', openSharePanel, 'Browse, import, and publish community conversations', {
    classes: ['btn-community', 'toolbar-button-primary'],
  });
  const helpBtn = btn('help', 'Help', openHelpModal, 'How to write P.A.N.D.A. conversations — full reference guide');

  if (isCompact) {
    const projectOverflowActions: OverflowAction[] = [];
    if (isMobile) {
      projectOverflowActions.push({ icon: 'save', label: 'Save', title: saveBtn.title, onclick: exportProjectJson });
    }
    projectOverflowActions.push(
      { icon: 'import', label: 'Import XML', title: importBtn.title, onclick: importFromXml },
      { icon: 'share', label: 'Community', title: communityBtn.title, onclick: openSharePanel },
      { icon: 'help', label: 'Help', title: helpBtn.title, onclick: openHelpModal },
    );

    fileGroup.appendChild(openBtn);
    if (!isMobile) fileGroup.appendChild(saveBtn);
    fileGroup.appendChild(exportXmlBtn);
    fileGroup.appendChild(createOverflowMenu(isMobile ? 'Project' : 'More', projectOverflowActions));
  } else {
    fileGroup.appendChild(openBtn);
    fileGroup.appendChild(importBtn);
    fileGroup.appendChild(sep());
    fileGroup.appendChild(saveBtn);
    fileGroup.appendChild(exportXmlBtn);
    fileGroup.appendChild(sep());
    fileGroup.appendChild(communityBtn);
    fileGroup.appendChild(helpBtn);
  }

  projectTier.appendChild(fileGroup);
  toolbar.appendChild(projectTier);

  const editTier = document.createElement('div');
  editTier.className = 'toolbar-tier toolbar-tier-edit';

  const search = renderQuickSearch();
  editTier.appendChild(search);

  const editGroup = document.createElement('div');
  editGroup.className = 'toolbar-group toolbar-group-edit';
  const densitySelect = document.createElement('select');
  densitySelect.className = 'toolbar-density-select toolbar-select-quiet';
  densitySelect.title = 'Adjust how much information each turn card shows in the flow editor.';
  const densityOptions: FlowDensity[] = ['compact', 'standard', 'detailed'];
  for (const density of densityOptions) {
    const option = document.createElement('option');
    option.value = density;
    option.textContent = density[0].toUpperCase() + density.slice(1);
    option.selected = density === state.flowDensity;
    densitySelect.appendChild(option);
  }
  densitySelect.onchange = () => store.setFlowDensity(densitySelect.value as FlowDensity);

  const undoBtn = iconBtn('undo', () => store.undo(), 'Undo', 'Undo last change (Ctrl+Z)');
  const redoBtn = iconBtn('redo', () => store.redo(), 'Redo', 'Redo last undone change (Ctrl+Y)');
  undoBtn.disabled = state.undoStack.length === 0;
  redoBtn.disabled = state.redoStack.length === 0;

  if (isCompact) {
    const quickActions = document.createElement('div');
    quickActions.className = 'toolbar-group toolbar-group-compact toolbar-group-history';
    quickActions.append(undoBtn, redoBtn);
    editTier.appendChild(quickActions);
    editTier.appendChild(createOverflowMenu('Editor', [
      {
        icon: 'locate',
        label: `Density: ${state.flowDensity}`,
        title: 'Cycle the amount of information shown on flow nodes',
        onclick: () => store.setFlowDensity(nextDensity(state.flowDensity)),
      },
    ]));
  } else {
    editGroup.appendChild(densitySelect);
    editGroup.appendChild(sep());

    const histGroup = document.createElement('div');
    histGroup.className = 'toolbar-group toolbar-group-compact';
    histGroup.appendChild(undoBtn);
    histGroup.appendChild(redoBtn);
    editGroup.appendChild(histGroup);
    editTier.appendChild(editGroup);
  }

  toolbar.appendChild(editTier);

  const utilityTier = document.createElement('div');
  utilityTier.className = 'toolbar-tier toolbar-tier-utility';

  if (!isCompact) {
    const utilityGroup = document.createElement('div');
    utilityGroup.className = 'toolbar-group toolbar-group-segmented';
    utilityGroup.appendChild(toggleBtn(
      'xml',
      'XML',
      state.showXmlPreview,
      () => store.toggleXmlPreview(),
      state.showXmlPreview ? 'Hide the live XML preview panel' : 'Show the live XML preview panel',
    ));
    utilityGroup.appendChild(toggleBtn(
      'strings',
      'Strings',
      state.showSystemStringsPanel,
      () => store.toggleSystemStringsPanel(),
      state.showSystemStringsPanel ? 'Hide the shared system strings manager' : 'Show the shared system strings manager',
    ));
    utilityTier.appendChild(utilityGroup);
  }

  const status = document.createElement('span');
  status.className = 'toolbar-status';
  const convCount = state.project.conversations.length;
  const stringCount = state.systemStrings.size;
  if (state.dirty) {
    status.innerHTML = `<span class="unsaved-dot"></span> ${formatStatus(convCount, stringCount, isMobile, true)}`;
    status.style.color = 'var(--warning)';
  } else {
    status.textContent = formatStatus(convCount, stringCount, isMobile, false);
  }
  utilityTier.appendChild(status);

  const supportTrigger = iconBtn('support', openSupportPanel, 'Support the Creator', 'Support the Creator');
  supportTrigger.classList.add('toolbar-support-trigger');
  utilityTier.appendChild(supportTrigger);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'toolbar-button toolbar-icon-button btn-icon toolbar-reset-btn';
  resetBtn.appendChild(createIcon('brand'));
  resetBtn.title = 'Clear workspace and show the intro sequence';
  resetBtn.setAttribute('aria-label', 'Reset to intro');
  resetBtn.onclick = () => {
    if (state.dirty && !window.confirm('You have unsaved changes. Clear workspace and return to the intro?')) return;
    clearDraft();
    store.loadProject(createEmptyProject('stalker'), new Map());
  };
  utilityTier.appendChild(resetBtn);

  toolbar.appendChild(utilityTier);

  return toolbar;
}

function renderQuickSearch(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'toolbar-search';

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'toolbar-search-input';
  input.placeholder = 'Jump to convo, turn, string…';
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
    const turnLabels = createTurnDisplayLabeler(conv);
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
          label: `C${conv.id} · ${turnLabels.getLongLabel(turn.turnNumber)}`,
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
          label: `C${conv.id} · ${turnLabels.getCompactLabel(turn.turnNumber)} · Choice ${choice.index}`,
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

function createOverflowMenu(label: string, actions: OverflowAction[]): HTMLElement {
  const details = document.createElement('details');
  details.className = 'toolbar-overflow';

  const summary = document.createElement('summary');
  summary.className = 'toolbar-button toolbar-overflow-toggle';
  summary.textContent = label;
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-label', `${label} menu`);
  details.appendChild(summary);

  const menu = document.createElement('div');
  menu.className = 'toolbar-overflow-menu';

  for (const action of actions) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'toolbar-overflow-item';
    setButtonContent(item, action.icon, action.label);
    item.title = action.title ?? action.label;
    item.disabled = Boolean(action.disabled);
    item.onclick = () => {
      details.open = false;
      action.onclick();
    };
    menu.appendChild(item);
  }

  details.appendChild(menu);
  return details;
}

function formatStatus(convCount: number, stringCount: number, compact: boolean, dirty: boolean): string {
  let visitorLabel = '';
  try {
    const { siteVisitorCount } = await_import_main();
    if (siteVisitorCount > 0) {
      visitorLabel = compact
        ? `${new Intl.NumberFormat().format(siteVisitorCount)} visitors • `
        : `${new Intl.NumberFormat().format(siteVisitorCount)} visitor${siteVisitorCount !== 1 ? 's' : ''} • `;
    }
  } catch { /* ignore */ }

  if (compact) {
    return `${visitorLabel}${convCount} conv • ${stringCount} strings${dirty ? ' • unsaved' : ''}`;
  }
  return `${visitorLabel}${convCount} conversation${convCount !== 1 ? 's' : ''} • ${stringCount} strings${dirty ? ' • unsaved' : ''}`;
}

/** Lazily access the visitor count from main.ts to avoid circular imports */
function await_import_main(): { siteVisitorCount: number } {
  // Access the exported variable from main module via a global bridge
  return { siteVisitorCount: (globalThis as any).__pandaVisitorCount ?? 0 };
}

function nextDensity(current: FlowDensity): FlowDensity {
  const densityOptions: FlowDensity[] = ['compact', 'standard', 'detailed'];
  const index = densityOptions.indexOf(current);
  return densityOptions[(index + 1) % densityOptions.length];
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

function btn(
  icon: IconName,
  label: string,
  onclick: () => void,
  tooltip?: string,
  options: ToolbarButtonOptions = {},
): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = ['toolbar-button', ...(options.classes ?? [])].join(' ');
  setButtonContent(b, icon, label);
  b.onclick = onclick;
  b.title = options.tooltip ?? tooltip ?? label;
  if (options.ariaLabel) b.setAttribute('aria-label', options.ariaLabel);
  return b;
}

function iconBtn(icon: IconName, onclick: () => void, ariaLabel: string, tooltip?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'toolbar-button toolbar-icon-button btn-icon';
  b.appendChild(createIcon(icon));
  b.onclick = onclick;
  b.title = tooltip ?? ariaLabel;
  b.setAttribute('aria-label', ariaLabel);
  return b;
}

function toggleBtn(
  icon: IconName,
  label: string,
  active: boolean,
  onclick: () => void,
  tooltip?: string,
): HTMLButtonElement {
  const b = btn(icon, label, onclick, tooltip, { classes: ['toolbar-toggle-button'] });
  if (active) {
    b.classList.add('is-active');
    b.setAttribute('aria-pressed', 'true');
  } else {
    b.setAttribute('aria-pressed', 'false');
  }
  return b;
}

function sep(): HTMLElement {
  const s = document.createElement('div');
  s.className = 'toolbar-separator';
  return s;
}
