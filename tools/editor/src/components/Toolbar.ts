// P.A.N.D.A. Conversation Editor — Toolbar

import { store } from '../lib/state';
import { FACTION_IDS } from '../lib/constants';
import { FACTION_DISPLAY_NAMES } from '../lib/types';
import { exportProjectJson, exportXml, importFromXml, importFromJson } from './App';

export function renderToolbar(): HTMLElement {
  const state = store.get();
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  toolbar.innerHTML = `<span class="toolbar-title">P.A.N.D.A. Editor</span>`;

  // Faction selector
  const factionSelect = document.createElement('select');
  factionSelect.title = 'Target Faction';
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

  // Import buttons
  const importXmlBtn = btn('Import XML', importFromXml);
  const importJsonBtn = btn('Open Project', importFromJson);
  toolbar.appendChild(importXmlBtn);
  toolbar.appendChild(importJsonBtn);

  toolbar.appendChild(sep());

  // Export buttons
  const exportXmlBtn = btn('Export XML', exportXml);
  exportXmlBtn.classList.add('btn-primary');
  const saveBtn = btn('Save Project', exportProjectJson);
  toolbar.appendChild(saveBtn);
  toolbar.appendChild(exportXmlBtn);

  toolbar.appendChild(sep());

  // XML Preview toggle
  const previewBtn = btn(state.showXmlPreview ? 'Hide XML' : 'Show XML', () => store.toggleXmlPreview());
  toolbar.appendChild(previewBtn);

  // Undo/Redo
  toolbar.appendChild(sep());
  const undoBtn = btn('Undo', () => store.undo());
  const redoBtn = btn('Redo', () => store.redo());
  toolbar.appendChild(undoBtn);
  toolbar.appendChild(redoBtn);

  // Spacer + status
  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer';
  toolbar.appendChild(spacer);

  const status = document.createElement('span');
  status.className = 'toolbar-status';
  const convCount = state.project.conversations.length;
  status.textContent = `${convCount} conversation${convCount !== 1 ? 's' : ''}${state.dirty ? ' (unsaved)' : ''}`;
  toolbar.appendChild(status);

  return toolbar;
}

function btn(text: string, onclick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.onclick = onclick;
  return b;
}

function sep(): HTMLElement {
  const s = document.createElement('div');
  s.className = 'toolbar-separator';
  return s;
}
