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
import { renderSystemStringsPanel } from './SystemStringsPanel';
import { setButtonContent } from './icons';

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
  setButtonContent(addBtn, 'add', 'New');
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
    const autoLayoutBtn = document.createElement('button');
    autoLayoutBtn.className = 'btn-sm';
    setButtonContent(autoLayoutBtn, 'locate', 'Auto Layout');
    autoLayoutBtn.onclick = () => store.autoLayoutConversation(conv.id);
    centerHeader.appendChild(autoLayoutBtn);

    const addTurnBtn = document.createElement('button');
    addTurnBtn.className = 'btn-sm';
    setButtonContent(addTurnBtn, 'add', 'Turn');
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

  // Bottom area: validation + optional drawers
  renderValidationBar(container);

  if (state.showSystemStringsPanel) {
    renderSystemStringsPanel(container);
  }

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
  openProjectFile('.xml', ['xml']);
}

/** Import from .panda JSON file */
export function importFromJson(): void {
  openProjectFile('.panda,.json,.xml', ['panda', 'json', 'xml']);
}

function openProjectFile(accept: string, preferredExtensions: string[]): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result as string;
      const extension = getFileExtension(file.name);
      const parseOrder = extension && preferredExtensions.includes(extension)
        ? [extension, ...preferredExtensions.filter(ext => ext !== extension)]
        : preferredExtensions;

      const result = tryLoadProjectFile(raw, parseOrder);
      if (!result) {
        const expectedFormats = preferredExtensions.map(ext => `.${ext}`).join(', ');
        alert(`Failed to parse project file. Supported formats: ${expectedFormats}.`);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function tryLoadProjectFile(raw: string, parseOrder: string[]): boolean {
  for (const format of parseOrder) {
    if (format === 'xml') {
      const result = importXml(raw);
      if (result) {
        store.loadProject(result.project, result.systemStrings);
        return true;
      }
      continue;
    }

    if (format === 'json' || format === 'panda') {
      try {
        const data = JSON.parse(raw);
        const systemStrings = new Map<string, string>(Object.entries(data.systemStrings || {}));
        delete data.systemStrings;
        store.loadProject(data, systemStrings);
        return true;
      } catch {
        continue;
      }
    }
  }

  return false;
}

function getFileExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return null;
  return filename.slice(lastDot + 1).toLowerCase();
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
