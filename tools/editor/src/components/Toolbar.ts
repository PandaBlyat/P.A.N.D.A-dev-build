// P.A.N.D.A. Conversation Editor — Toolbar

import { store } from '../lib/state';
import { FACTION_IDS } from '../lib/constants';
import { FACTION_DISPLAY_NAMES } from '../lib/types';
import { exportProjectJson, exportXml, importFromXml, importFromJson } from './App';

export function renderToolbar(): HTMLElement {
  const state = store.get();
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  toolbar.innerHTML = `<span class="toolbar-title">\u2622 P.A.N.D.A. Editor</span>`;

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

  // File group
  const fileGroup = document.createElement('div');
  fileGroup.className = 'toolbar-group';
  fileGroup.appendChild(btn('\u{1F4C2} Open', importFromJson, 'Open a saved .panda/.json project or import a PANDA XML file'));
  fileGroup.appendChild(btn('\u{1F4E5} Import XML', importFromXml, 'Import conversations from an existing game XML file'));
  fileGroup.appendChild(btn('\u{1F4BE} Save', exportProjectJson, 'Save as .panda project file (preserves editor data)'));
  const exportXmlBtn = btn('\u{1F4E4} Export XML', exportXml, 'Export as game-ready XML file for S.T.A.L.K.E.R. Anomaly');
  exportXmlBtn.classList.add('btn-primary');
  fileGroup.appendChild(exportXmlBtn);
  toolbar.appendChild(fileGroup);

  toolbar.appendChild(sep());

  // View group
  const viewGroup = document.createElement('div');
  viewGroup.className = 'toolbar-group';
  viewGroup.appendChild(btn(
    state.showXmlPreview ? '\u{1F4DC} Hide XML' : '\u{1F4DC} Show XML',
    () => store.toggleXmlPreview(),
    'Toggle live XML preview at the bottom of the screen'
  ));
  toolbar.appendChild(viewGroup);

  toolbar.appendChild(sep());

  // Undo/Redo group
  const histGroup = document.createElement('div');
  histGroup.className = 'toolbar-group';
  const undoBtn = btn('\u21A9 Undo', () => store.undo(), 'Undo last change (Ctrl+Z)');
  const redoBtn = btn('\u21AA Redo', () => store.redo(), 'Redo last undone change (Ctrl+Y)');
  if (state.undoStack.length === 0) undoBtn.style.opacity = '0.4';
  if (state.redoStack.length === 0) redoBtn.style.opacity = '0.4';
  histGroup.appendChild(undoBtn);
  histGroup.appendChild(redoBtn);
  toolbar.appendChild(histGroup);

  // Spacer + status
  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer';
  toolbar.appendChild(spacer);

  const status = document.createElement('span');
  status.className = 'toolbar-status';
  const convCount = state.project.conversations.length;
  if (state.dirty) {
    status.innerHTML = `<span class="unsaved-dot"></span> ${convCount} conv${convCount !== 1 ? 's' : ''} \u2022 unsaved`;
    status.style.color = 'var(--warning)';
  } else {
    status.textContent = `${convCount} conversation${convCount !== 1 ? 's' : ''}`;
  }
  toolbar.appendChild(status);

  return toolbar;
}

function btn(text: string, onclick: () => void, tooltip?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.onclick = onclick;
  if (tooltip) b.title = tooltip;
  return b;
}

function sep(): HTMLElement {
  const s = document.createElement('div');
  s.className = 'toolbar-separator';
  return s;
}
