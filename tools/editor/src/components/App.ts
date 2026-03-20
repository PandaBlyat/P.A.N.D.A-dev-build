// P.A.N.D.A. Conversation Editor — Root App Component

import { store } from '../lib/state';
import { renderToolbar } from './Toolbar';
import { renderConversationList } from './ConversationList';
import { renderFlowEditor } from './FlowEditor';
import { renderPropertiesPanel } from './PropertiesPanel';
import { renderValidationBar } from './ValidationBar';
import { renderBottomWorkspace } from './BottomWorkspace';
import { shouldShowFirstRunExperience, renderFirstRunExperience } from './Onboarding';
import { createBlankProject } from '../lib/project-io';
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

type AppShell = {
  container: HTMLElement;
  toolbarRegion: HTMLDivElement;
  mainLayout: HTMLDivElement;
  leftPanel: HTMLDivElement;
  leftActions: HTMLDivElement;
  leftBody: HTMLDivElement;
  centerTitle: HTMLSpanElement;
  centerActions: HTMLDivElement;
  centerBody: HTMLDivElement;
  rightPanel: HTMLDivElement;
  rightActions: HTMLDivElement;
  rightBody: HTMLDivElement;
  bottomRegion: HTMLDivElement;
  validationRegion: HTMLDivElement;
  workspaceRegion: HTMLDivElement;
};

let appShell: AppShell | null = null;

export function renderApp(container: HTMLElement): void {
  const shell = getAppShell(container);
  const state = store.get();
  const conv = store.getSelectedConversation();
  const firstRun = state.project.conversations.length === 0 && shouldShowFirstRunExperience();

  shell.toolbarRegion.replaceChildren(renderToolbar());

  syncResponsiveLayout(shell.mainLayout);
  renderLeftPanel(shell);
  renderCenterPanel(shell, conv, firstRun);
  renderRightPanel(shell);
  renderBottomRegion(shell);
}

function getAppShell(container: HTMLElement): AppShell {
  if (appShell?.container === container && container.contains(appShell.mainLayout)) {
    return appShell;
  }

  const toolbarRegion = document.createElement('div');
  const mainLayout = document.createElement('div');
  mainLayout.className = 'main-layout';

  const leftPanel = document.createElement('div');
  const leftHeader = document.createElement('div');
  leftHeader.className = 'panel-header';
  const leftTitle = document.createElement('span');
  leftTitle.textContent = 'Conversations';
  const leftActions = document.createElement('div');
  leftActions.className = 'panel-header-actions';
  leftHeader.append(leftTitle, leftActions);
  leftPanel.appendChild(leftHeader);
  const leftBody = document.createElement('div');
  leftBody.className = 'panel-body';
  leftPanel.appendChild(leftBody);

  const centerPanel = document.createElement('div');
  centerPanel.className = 'panel panel-center';
  const centerHeader = document.createElement('div');
  centerHeader.className = 'panel-header';
  const centerTitle = document.createElement('span');
  const centerActions = document.createElement('div');
  centerActions.className = 'panel-header-actions';
  centerHeader.append(centerTitle, centerActions);
  centerPanel.appendChild(centerHeader);
  const centerBody = document.createElement('div');
  centerBody.className = 'panel-body';
  centerBody.style.padding = '0';
  centerPanel.appendChild(centerBody);

  const rightPanel = document.createElement('div');
  const rightHeader = document.createElement('div');
  rightHeader.className = 'panel-header';
  const rightTitle = document.createElement('span');
  rightTitle.textContent = 'Properties';
  const rightActions = document.createElement('div');
  rightActions.className = 'panel-header-actions';
  rightHeader.append(rightTitle, rightActions);
  rightPanel.appendChild(rightHeader);
  const rightBody = document.createElement('div');
  rightBody.className = 'panel-body';
  rightBody.style.padding = '0';
  rightBody.style.display = 'flex';
  rightBody.style.flexDirection = 'column';
  rightPanel.appendChild(rightBody);

  mainLayout.append(leftPanel, createSplitter('left', mainLayout), centerPanel, createSplitter('right', mainLayout), rightPanel);

  const bottomRegion = document.createElement('div');
  const validationRegion = document.createElement('div');
  const workspaceRegion = document.createElement('div');
  bottomRegion.append(validationRegion, workspaceRegion);

  container.replaceChildren(toolbarRegion, mainLayout, bottomRegion);

  appShell = {
    container,
    toolbarRegion,
    mainLayout,
    leftPanel,
    leftActions,
    leftBody,
    centerTitle,
    centerActions,
    centerBody,
    rightPanel,
    rightActions,
    rightBody,
    bottomRegion,
    validationRegion,
    workspaceRegion,
  };

  return appShell;
}

function renderLeftPanel(shell: AppShell): void {
  shell.leftPanel.className = `panel panel-left${layoutState.leftCollapsed ? ' is-collapsed' : ''}`;
  shell.leftActions.replaceChildren(createAddConversationButton(), createPanelToggleButton('left'));
  shell.leftBody.hidden = layoutState.leftCollapsed;
  shell.leftBody.replaceChildren();
  renderConversationList(shell.leftBody);
}

function renderCenterPanel(shell: AppShell, conv: ReturnType<typeof store.getSelectedConversation>, firstRun: boolean): void {
  shell.centerTitle.textContent = `Flow Editor${conv ? ` — ${conv.label}` : ''}`;
  shell.centerActions.replaceChildren();

  if (conv) {
    const autoLayoutBtn = document.createElement('button');
    autoLayoutBtn.className = 'btn-sm';
    setButtonContent(autoLayoutBtn, 'locate', 'Auto Layout');
    autoLayoutBtn.onclick = () => store.autoLayoutConversation(conv.id);

    const addTurnBtn = document.createElement('button');
    addTurnBtn.className = 'btn-sm';
    setButtonContent(addTurnBtn, 'add', 'Turn');
    addTurnBtn.onclick = () => store.addTurn(conv.id);

    shell.centerActions.append(autoLayoutBtn, addTurnBtn);
  }

  shell.centerBody.replaceChildren();
  if (firstRun) {
    renderFirstRunExperience(shell.centerBody);
    return;
  }
  renderFlowEditor(shell.centerBody);
}

function renderRightPanel(shell: AppShell): void {
  shell.rightPanel.className = `panel panel-right${layoutState.rightCollapsed ? ' is-collapsed' : ''}`;
  shell.rightActions.replaceChildren(createPanelToggleButton('right'));
  shell.rightBody.hidden = layoutState.rightCollapsed;
  shell.rightBody.replaceChildren();
  renderPropertiesPanel(shell.rightBody);
}

function renderBottomRegion(shell: AppShell): void {
  shell.validationRegion.replaceChildren();
  renderValidationBar(shell.validationRegion);
  shell.workspaceRegion.replaceChildren();
  renderBottomWorkspace(shell.workspaceRegion);
}

function createAddConversationButton(): HTMLButtonElement {
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-sm';
  setButtonContent(addBtn, 'add', 'New');
  addBtn.onclick = () => createBlankProject();
  return addBtn;
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

/** Merge conversations from the community library into the current project. */
export function importConversations(conversations: import('../lib/types').Conversation[]): void {
  store.mergeConversations(conversations);
}

