// P.A.N.D.A. Conversation Editor — Root App Component

import { store } from '../lib/state';
import { generateXml } from '../lib/xml-export';
import { importXml } from '../lib/xml-import';
import { renderToolbar } from './Toolbar';
import { renderConversationList } from './ConversationList';
import { renderFlowEditor } from './FlowEditor';
import { renderPropertiesPanel } from './PropertiesPanel';
import { renderValidationBar } from './ValidationBar';
import { renderXmlPreview } from './XmlPreview';

export function renderApp(container: HTMLElement): void {
  const state = store.get();

  container.innerHTML = '';

  // Toolbar
  const toolbar = renderToolbar();
  container.appendChild(toolbar);

  // Main layout
  const main = document.createElement('div');
  main.className = 'main-layout';

  // Left panel
  const left = document.createElement('div');
  left.className = 'panel panel-left';
  const leftHeader = document.createElement('div');
  leftHeader.className = 'panel-header';
  leftHeader.innerHTML = `<span>Conversations</span>`;
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-sm';
  addBtn.textContent = '+ New';
  addBtn.onclick = () => store.addConversation();
  leftHeader.appendChild(addBtn);
  left.appendChild(leftHeader);

  const leftBody = document.createElement('div');
  leftBody.className = 'panel-body';
  renderConversationList(leftBody);
  left.appendChild(leftBody);

  // Center panel
  const center = document.createElement('div');
  center.className = 'panel panel-center';
  const centerHeader = document.createElement('div');
  centerHeader.className = 'panel-header';
  const conv = store.getSelectedConversation();
  centerHeader.innerHTML = `<span>Flow Editor${conv ? ` — ${conv.label}` : ''}</span>`;

  if (conv) {
    const addTurnBtn = document.createElement('button');
    addTurnBtn.className = 'btn-sm';
    addTurnBtn.textContent = '+ Turn';
    addTurnBtn.onclick = () => store.addTurn(conv.id);
    centerHeader.appendChild(addTurnBtn);
  }
  center.appendChild(centerHeader);

  const centerBody = document.createElement('div');
  centerBody.className = 'panel-body';
  centerBody.style.padding = '0';
  renderFlowEditor(centerBody);
  center.appendChild(centerBody);

  // Right panel
  const right = document.createElement('div');
  right.className = 'panel panel-right';
  const rightHeader = document.createElement('div');
  rightHeader.className = 'panel-header';
  rightHeader.innerHTML = '<span>Properties</span>';
  right.appendChild(rightHeader);

  const rightBody = document.createElement('div');
  rightBody.className = 'panel-body';
  rightBody.style.padding = '0';
  rightBody.style.display = 'flex';
  rightBody.style.flexDirection = 'column';
  renderPropertiesPanel(rightBody);
  right.appendChild(rightBody);

  main.appendChild(left);
  main.appendChild(center);
  main.appendChild(right);
  container.appendChild(main);

  // Bottom area: validation + optional XML preview
  renderValidationBar(container);

  if (state.showXmlPreview) {
    renderXmlPreview(container);
  }
}

/** Export project as .panda JSON file */
export function exportProjectJson(): void {
  const state = store.get();
  const data = JSON.stringify({
    ...state.project,
    systemStrings: Object.fromEntries(state.systemStrings),
  }, null, 2);
  downloadFile(data, `panda_${state.project.faction}_conversations.panda`, 'application/json');
}

/** Export as game-ready XML */
export function exportXml(): void {
  const state = store.get();
  const xml = generateXml(state.project, state.systemStrings);
  const faction = state.project.faction === 'stalker' ? 'loner' : state.project.faction;
  downloadFile(xml, `st_PANDA_${faction}_interactive_conversations.xml`, 'application/xml');
}

/** Import from XML file */
export function importFromXml(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xml';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importXml(reader.result as string);
      if (result) {
        store.loadProject(result.project, result.systemStrings);
      } else {
        alert('Failed to parse XML file. Make sure it is a valid P.A.N.D.A. conversation file.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/** Import from .panda JSON file */
export function importFromJson(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.panda,.json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const systemStrings = new Map<string, string>(Object.entries(data.systemStrings || {}));
        delete data.systemStrings;
        store.loadProject(data, systemStrings);
      } catch {
        alert('Failed to parse project file.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
