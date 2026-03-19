// P.A.N.D.A. Conversation Editor — Root App Component

import { store } from '../lib/state';
import { generateXml } from '../lib/xml-export';
import { importXml } from '../lib/xml-import';
import { renderToolbar } from './Toolbar';
import { renderConversationList } from './ConversationList';
import { renderFlowEditor } from './FlowEditor';
import { renderPropertiesPanel } from './PropertiesPanel';
import { renderValidationBar } from './ValidationBar';
import { renderBottomWorkspace } from './BottomWorkspace';
import { setButtonContent } from './icons';

const PANEL_MIN_WIDTH = 220;
const PANEL_MAX_WIDTH = 520;
const PANEL_COLLAPSED_WIDTH = 52;

const layoutState = {
  leftWidth: 280,
  rightWidth: 360,
  leftCollapsed: false,
  rightCollapsed: false,
};

export function renderApp(container: HTMLElement): void {
  const state = store.get();

  container.innerHTML = '';

  // Toolbar
  const toolbar = renderToolbar();
  container.appendChild(toolbar);

  // Main layout
  const main = document.createElement('div');
  main.className = 'main-layout';
  syncResponsiveLayout(main);
  applyPanelLayout(main);

  // Left panel
  const left = document.createElement('div');
  left.className = `panel panel-left${layoutState.leftCollapsed ? ' is-collapsed' : ''}`;
  const leftHeader = document.createElement('div');
  leftHeader.className = 'panel-header';
  const leftTitle = document.createElement('span');
  leftTitle.textContent = 'Conversations';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-sm';
  setButtonContent(addBtn, 'add', 'New');
  addBtn.onclick = () => store.addConversation();

  const leftActions = document.createElement('div');
  leftActions.className = 'panel-header-actions';
  leftActions.append(addBtn, createPanelToggleButton('left'));
  leftHeader.append(leftTitle, leftActions);
  left.appendChild(leftHeader);

  const leftBody = document.createElement('div');
  leftBody.className = 'panel-body';
  leftBody.hidden = layoutState.leftCollapsed;
  renderConversationList(leftBody);
  left.appendChild(leftBody);

  // Center panel
  const center = document.createElement('div');
  center.className = 'panel panel-center';
  const centerHeader = document.createElement('div');
  centerHeader.className = 'panel-header';
  const conv = store.getSelectedConversation();
  const centerTitle = document.createElement('span');
  centerTitle.textContent = `Flow Editor${conv ? ` — ${conv.label}` : ''}`;

  const centerActions = document.createElement('div');
  centerActions.className = 'panel-header-actions';
  if (conv) {
    const autoLayoutBtn = document.createElement('button');
    autoLayoutBtn.className = 'btn-sm';
    setButtonContent(autoLayoutBtn, 'locate', 'Auto Layout');
    autoLayoutBtn.onclick = () => store.autoLayoutConversation(conv.id);
    centerActions.appendChild(autoLayoutBtn);

    const addTurnBtn = document.createElement('button');
    addTurnBtn.className = 'btn-sm';
    setButtonContent(addTurnBtn, 'add', 'Turn');
    addTurnBtn.onclick = () => store.addTurn(conv.id);
    centerActions.appendChild(addTurnBtn);
  }
  centerHeader.append(centerTitle, centerActions);
  center.appendChild(centerHeader);

  const centerBody = document.createElement('div');
  centerBody.className = 'panel-body';
  centerBody.style.padding = '0';
  renderFlowEditor(centerBody);
  center.appendChild(centerBody);

  // Right panel
  const right = document.createElement('div');
  right.className = `panel panel-right${layoutState.rightCollapsed ? ' is-collapsed' : ''}`;
  const rightHeader = document.createElement('div');
  rightHeader.className = 'panel-header';
  const rightTitle = document.createElement('span');
  rightTitle.textContent = 'Properties';
  const rightActions = document.createElement('div');
  rightActions.className = 'panel-header-actions';
  rightActions.appendChild(createPanelToggleButton('right'));
  rightHeader.append(rightTitle, rightActions);
  right.appendChild(rightHeader);

  const rightBody = document.createElement('div');
  rightBody.className = 'panel-body';
  rightBody.hidden = layoutState.rightCollapsed;
  rightBody.style.padding = '0';
  rightBody.style.display = 'flex';
  rightBody.style.flexDirection = 'column';
  renderPropertiesPanel(rightBody);
  right.appendChild(rightBody);

  main.appendChild(left);
  main.appendChild(createSplitter('left', main));
  main.appendChild(center);
  main.appendChild(createSplitter('right', main));
  main.appendChild(right);
  container.appendChild(main);

  // Bottom area: validation summary + shared workspace
  renderValidationBar(container);
  renderBottomWorkspace(container);
}

function createPanelToggleButton(side: 'left' | 'right'): HTMLButtonElement {
  const button = document.createElement('button');
  const collapsed = side === 'left' ? layoutState.leftCollapsed : layoutState.rightCollapsed;
  button.type = 'button';
  button.className = 'btn-sm btn-icon panel-toggle-button';
  button.textContent = collapsed ? (side === 'left' ? '⟩' : '⟨') : (side === 'left' ? '⟨' : '⟩');
  button.title = `${collapsed ? 'Expand' : 'Collapse'} ${side === 'left' ? 'conversation list' : 'properties panel'}`;
  button.setAttribute('aria-label', button.title);
  button.onclick = () => {
    if (side === 'left') {
      layoutState.leftCollapsed = !layoutState.leftCollapsed;
    } else {
      layoutState.rightCollapsed = !layoutState.rightCollapsed;
    }
    renderApp(document.getElementById('app')!);
  };
  return button;
}

function createSplitter(side: 'left' | 'right', main: HTMLElement): HTMLDivElement {
  const splitter = document.createElement('div');
  splitter.className = 'panel-splitter';
  splitter.dataset.side = side;
  splitter.title = `Drag to resize the ${side === 'left' ? 'conversation list' : 'properties panel'}`;
  splitter.onmousedown = (event) => startPanelResize(event, side, main);
  return splitter;
}

function startPanelResize(event: MouseEvent, side: 'left' | 'right', main: HTMLElement): void {
  event.preventDefault();
  const rect = main.getBoundingClientRect();
  const startWidth = side === 'left' ? layoutState.leftWidth : layoutState.rightWidth;

  const onMove = (moveEvent: MouseEvent): void => {
    const nextWidth = side === 'left'
      ? moveEvent.clientX - rect.left
      : rect.right - moveEvent.clientX;
    const clampedWidth = clampWidth(nextWidth);
    if (side === 'left') {
      layoutState.leftWidth = clampedWidth;
      layoutState.leftCollapsed = false;
    } else {
      layoutState.rightWidth = clampedWidth;
      layoutState.rightCollapsed = false;
    }
    applyPanelLayout(main);
  };

  const onUp = (): void => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    document.body.classList.remove('is-resizing-panels');
    if (side === 'left' && layoutState.leftWidth !== startWidth) {
      renderApp(document.getElementById('app')!);
      return;
    }
    if (side === 'right' && layoutState.rightWidth !== startWidth) {
      renderApp(document.getElementById('app')!);
    }
  };

  document.body.classList.add('is-resizing-panels');
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp, { once: true });
}

function applyPanelLayout(main: HTMLElement): void {
  main.style.setProperty('--panel-left-width', `${layoutState.leftCollapsed ? PANEL_COLLAPSED_WIDTH : layoutState.leftWidth}px`);
  main.style.setProperty('--panel-right-width', `${layoutState.rightCollapsed ? PANEL_COLLAPSED_WIDTH : layoutState.rightWidth}px`);
  main.dataset.leftCollapsed = String(layoutState.leftCollapsed);
  main.dataset.rightCollapsed = String(layoutState.rightCollapsed);
}

function syncResponsiveLayout(main: HTMLElement): void {
  layoutState.leftWidth = clampWidth(layoutState.leftWidth);
  layoutState.rightWidth = clampWidth(layoutState.rightWidth);
  applyPanelLayout(main);
}

function clampWidth(value: number): number {
  return Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, value));
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
