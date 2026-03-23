// P.A.N.D.A. Conversation Editor — Root App Component

import { store, type BottomWorkspaceTab, type AppState, type RenderTarget } from '../lib/state';
import { renderToolbar as renderToolbarContent } from './Toolbar';
import {
  centerConversationSelection,
  deleteConversationSelection,
  duplicateConversationSelection,
  renderConversationList as renderConversationListContent,
} from './ConversationList';
import { renderFlowEditor as renderFlowEditorContent } from './FlowEditor';
import { renderPropertiesPanel as renderPropertiesPanelContent } from './PropertiesPanel';
import { renderBottomWorkspace as renderBottomWorkspaceContent } from './BottomWorkspace';
import { mountMotivationTicker } from './MotivationTicker';
import { shouldShowFirstRunExperience, renderFirstRunExperience } from './Onboarding';
import { createBlankProject } from '../lib/project-io';
import { setButtonContent, createIcon } from './icons';
import { getFactionThemeVariables } from '../lib/faction-colors';
import { getConversationFaction } from '../lib/types';

const PANEL_MIN_WIDTH = 220;
const PANEL_MAX_WIDTH = 520;
const PANEL_COLLAPSED_WIDTH = 52;
const TABLET_BREAKPOINT = 1180;
const MOBILE_BREAKPOINT = 760;

type ResponsiveLayoutMode = 'desktop' | 'tablet' | 'mobile';
type DrawerSide = 'left' | 'right' | null;

type LayoutDefaults = {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
};

const layoutState = {
  leftWidth: 320,
  rightWidth: 360,
  leftCollapsed: false,
  rightCollapsed: false,
  responsiveMode: 'desktop' as ResponsiveLayoutMode,
  activeDrawer: null as DrawerSide,
  toolbarHidden: false,
  wasFirstRun: false,
};

type AppShell = {
  container: HTMLElement;
  toolbarRegion: HTMLDivElement;
  mainLayout: HTMLDivElement;
  layoutScrim: HTMLButtonElement;
  utilityRail: HTMLDivElement;
  leftPanel: HTMLDivElement;
  leftActions: HTMLDivElement;
  leftBody: HTMLDivElement;
  leftSplitter: HTMLDivElement;
  centerPanel: HTMLDivElement;
  centerHeader: HTMLDivElement;
  centerTitle: HTMLSpanElement;
  centerActions: HTMLDivElement;
  centerBody: HTMLDivElement;
  rightPanel: HTMLDivElement;
  rightActions: HTMLDivElement;
  rightBody: HTMLDivElement;
  rightSplitter: HTMLDivElement;
  bottomRegion: HTMLDivElement;
  workspaceRegion: HTMLDivElement;
  tickerRegion: HTMLDivElement;
  modalHost: HTMLDivElement;
};

let appShell: AppShell | null = null;
let resizeListenerAttached = false;

type AppRenderContext = {
  shell: AppShell;
  conv: ReturnType<typeof store.getSelectedConversation>;
  firstRun: boolean;
};

export function renderApp(container: HTMLElement): void {
  const context = getRenderContext(container);
  const { shell, firstRun } = context;

  renderToolbar(container);
  shell.leftSplitter.hidden = firstRun;
  shell.rightSplitter.hidden = firstRun;
  renderConversationList(container);
  renderFlowEditor(container);
  renderPropertiesPanel(container);
  renderBottomWorkspace(container);
  renderUtilityRail(shell, firstRun);
  renderToolbarToggle(shell);
  updateOverlayState(shell);
}

export function renderToolbar(container: HTMLElement): void {
  const { shell } = getRenderContext(container);
  shell.toolbarRegion.replaceChildren(renderToolbarContent(layoutState.responsiveMode));
  shell.toolbarRegion.hidden = layoutState.toolbarHidden;
}

export function renderConversationList(container: HTMLElement): void {
  const { shell, firstRun } = getRenderContext(container);
  renderLeftPanel(shell, firstRun);
}

export function renderFlowEditor(container: HTMLElement): void {
  const { shell, conv, firstRun } = getRenderContext(container);
  renderCenterPanel(shell, conv, firstRun);
}

export function renderPropertiesPanel(container: HTMLElement): void {
  const { shell, firstRun } = getRenderContext(container);
  renderRightPanel(shell, firstRun);
}

export function renderBottomWorkspace(container: HTMLElement): void {
  const { shell, firstRun } = getRenderContext(container);
  renderBottomRegion(shell, firstRun);
}

export function getRenderRoot(container: HTMLElement, target: Exclude<RenderTarget, 'appShell'>): HTMLElement | null {
  const shell = getAppShell(container);
  switch (target) {
    case 'conversationList':
      return shell.leftPanel;
    case 'flowEditor':
      return shell.centerPanel;
    case 'propertiesPanel':
      return shell.rightPanel;
    case 'bottomWorkspace':
      return shell.bottomRegion;
    case 'toolbar':
      return shell.toolbarRegion;
  }
}

function getRenderContext(container: HTMLElement): AppRenderContext {
  const shell = getAppShell(container);
  ensureResponsiveListener(container);

  const state = store.get();
  const conv = store.getSelectedConversation();
  const firstRun = state.project.conversations.length === 0 && shouldShowFirstRunExperience();

  applyFactionTheme(container, getConversationFaction(conv, state.project.faction));

  if (firstRun) {
    layoutState.toolbarHidden = true;
  } else if (layoutState.wasFirstRun) {
    layoutState.toolbarHidden = false;
  }
  layoutState.wasFirstRun = firstRun;

  syncResponsiveLayout(shell.mainLayout);
  shell.mainLayout.classList.toggle('main-layout-onboarding', firstRun);

  return { shell, conv, firstRun };
}

function getAppShell(container: HTMLElement): AppShell {
  if (appShell?.container === container && container.contains(appShell.mainLayout)) {
    return appShell;
  }

  const toolbarRegion = document.createElement('div');
  toolbarRegion.className = 'app-toolbar-region';

  const mainLayout = document.createElement('div');
  mainLayout.className = 'main-layout';

  const leftPanel = document.createElement('div');
  const leftHeader = document.createElement('div');
  leftHeader.className = 'panel-header panel-header-conversations';
  const leftTitle = document.createElement('span');
  leftTitle.className = 'panel-header-title panel-header-title-conversations';
  leftTitle.textContent = 'Conversations';
  const leftActions = document.createElement('div');
  leftActions.className = 'panel-header-actions panel-header-actions-conversations';
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

  const layoutScrim = document.createElement('button');
  layoutScrim.type = 'button';
  layoutScrim.className = 'layout-scrim';
  layoutScrim.title = 'Close open panel';
  layoutScrim.setAttribute('aria-label', 'Close open panel');
  layoutScrim.onclick = () => {
    layoutState.activeDrawer = null;
    renderApp(container);
  };

  const utilityRail = document.createElement('div');
  utilityRail.className = 'utility-rail';

  const leftSplitter = createSplitter('left', mainLayout);
  const rightSplitter = createSplitter('right', mainLayout);

  mainLayout.append(
    leftPanel,
    leftSplitter,
    centerPanel,
    rightSplitter,
    rightPanel,
    layoutScrim,
    utilityRail,
  );

  const bottomRegion = document.createElement('div');
  bottomRegion.className = 'app-bottom-region';
  const workspaceRegion = document.createElement('div');
  workspaceRegion.className = 'app-workspace-region';
  const tickerRegion = document.createElement('div');
  tickerRegion.className = 'app-ticker-region';
  bottomRegion.append(workspaceRegion, tickerRegion);

  const modalHost = document.createElement('div');
  modalHost.className = 'app-modal-host';
  modalHost.id = 'app-modal-host';
  modalHost.setAttribute('aria-hidden', 'true');

  container.replaceChildren(toolbarRegion, mainLayout, bottomRegion, modalHost);

  // The ticker has entirely self-contained lifecycle logic (its own rotation
  // timer and DOM state). Mount it once here so it is never touched by the
  // regular render cycle. Faction theme colour reaches it via the inherited
  // --accent CSS variable set on the container element.
  mountMotivationTicker(tickerRegion);

  appShell = {
    container,
    toolbarRegion,
    mainLayout,
    layoutScrim,
    utilityRail,
    leftPanel,
    leftActions,
    leftBody,
    leftSplitter,
    centerPanel,
    centerHeader,
    centerTitle,
    centerActions,
    centerBody,
    rightPanel,
    rightActions,
    rightBody,
    rightSplitter,
    bottomRegion,
    workspaceRegion,
    tickerRegion,
    modalHost,
  };

  return appShell;
}

function renderLeftPanel(shell: AppShell, firstRun = false): void {
  const isOverlay = layoutState.responsiveMode !== 'desktop';
  const isDrawerOpen = isOverlay && layoutState.activeDrawer === 'left';
  const selectedConversationId = store.get().selectedConversationId;

  shell.leftPanel.hidden = firstRun;
  shell.leftPanel.className = `panel panel-left${layoutState.leftCollapsed && !isOverlay ? ' is-collapsed' : ''}${isDrawerOpen ? ' is-drawer-open' : ''}`;
  shell.leftPanel.dataset.drawerOpen = String(isDrawerOpen);
  shell.leftPanel.setAttribute('aria-hidden', String(isOverlay && !isDrawerOpen));
  const leftPanelActions = [
    createAddConversationButton(),
    createSelectedConversationActionButton('locate', 'Center', 'Center selected conversation in the flow editor', () => {
      if (selectedConversationId != null) centerConversationSelection(selectedConversationId);
    }, selectedConversationId == null),
    createSelectedConversationActionButton('duplicate', 'Duplicate', 'Duplicate selected conversation', () => {
      if (selectedConversationId != null) duplicateConversationSelection(selectedConversationId);
    }, selectedConversationId == null),
    createSelectedConversationActionButton('delete', 'Delete', 'Delete selected conversation', () => {
      if (selectedConversationId != null) deleteConversationSelection(selectedConversationId);
    }, selectedConversationId == null, true),
    createPanelToggleButton('left'),
  ];
  const collapsedDesktopLeftPanel = layoutState.leftCollapsed && !isOverlay;
  shell.leftActions.replaceChildren(...(collapsedDesktopLeftPanel ? [leftPanelActions[leftPanelActions.length - 1]!] : leftPanelActions));
  shell.leftBody.hidden = layoutState.leftCollapsed && !isOverlay;
  shell.leftBody.replaceChildren();
  renderConversationListContent(shell.leftBody);
}

function renderCenterPanel(shell: AppShell, conv: ReturnType<typeof store.getSelectedConversation>, firstRun: boolean): void {
  shell.centerPanel.classList.toggle('panel-onboarding', firstRun);
  shell.centerHeader.hidden = firstRun;
  shell.centerTitle.textContent = `Flow Editor${conv ? ` — ${conv.label}` : ''}`;
  shell.centerActions.replaceChildren();

  if (!firstRun && layoutState.responsiveMode !== 'desktop') {
    shell.centerActions.append(
      createPanelLauncherButton('left', 'Conversations'),
      createPanelLauncherButton('right', 'Inspector'),
    );
  }

  if (conv) {
    const autoLayoutBtn = document.createElement('button');
    autoLayoutBtn.className = 'btn-sm';
    setButtonContent(autoLayoutBtn, 'locate', 'Auto Layout');
    autoLayoutBtn.onclick = () => store.autoLayoutConversation(conv.id);

    const addTurnBtn = document.createElement('button');
    addTurnBtn.className = 'btn-sm btn-primary flow-add-turn-button';
    setButtonContent(addTurnBtn, 'add', '+ Turn');
    addTurnBtn.title = 'Add a new turn to create another branch';
    addTurnBtn.setAttribute('aria-label', addTurnBtn.title);
    addTurnBtn.onclick = () => store.addTurn(conv.id);

    shell.centerActions.append(autoLayoutBtn, addTurnBtn);
  }

  shell.centerBody.replaceChildren();
  if (firstRun) {
    renderFirstRunExperience(shell.centerBody);
    return;
  }
  renderFlowEditorContent(shell.centerBody);
}

function renderRightPanel(shell: AppShell, firstRun = false): void {
  const isOverlay = layoutState.responsiveMode !== 'desktop';
  const isDrawerOpen = isOverlay && layoutState.activeDrawer === 'right';

  shell.rightPanel.hidden = firstRun;
  shell.rightPanel.className = `panel panel-right${layoutState.rightCollapsed && !isOverlay ? ' is-collapsed' : ''}${isDrawerOpen ? ' is-drawer-open' : ''}`;
  shell.rightPanel.dataset.drawerOpen = String(isDrawerOpen);
  shell.rightPanel.setAttribute('aria-hidden', String(isOverlay && !isDrawerOpen));
  shell.rightActions.replaceChildren(createPanelToggleButton('right'));
  shell.rightBody.hidden = layoutState.rightCollapsed && !isOverlay;
  shell.rightBody.replaceChildren();
  renderPropertiesPanelContent(shell.rightBody);
}

function renderBottomRegion(shell: AppShell, firstRun = false): void {
  shell.bottomRegion.hidden = firstRun;
  shell.bottomRegion.dataset.layoutMode = layoutState.responsiveMode;
  if (firstRun) {
    shell.workspaceRegion.replaceChildren();
    return;
  }
  renderBottomWorkspaceContent(shell.workspaceRegion);
}

function renderUtilityRail(shell: AppShell, firstRun = false): void {
  shell.utilityRail.replaceChildren();
  const state = store.get();
  const isCompact = layoutState.responsiveMode !== 'desktop';
  shell.utilityRail.hidden = firstRun || !isCompact;
  if (!isCompact) return;

  const issueCount = state.validationMessages.length;
  const issueButton = createUtilityRailButton(
    'Issues',
    issueCount > 0 ? `${issueCount}` : undefined,
    issueCount === 0,
    () => toggleConversationIssues(state),
  );
  issueButton.title = issueCount > 0 ? `Open issues (${issueCount})` : 'No project issues';

  const stringsButton = createUtilityRailButton('Strings', undefined, false, () => activateWorkspaceTab('strings'));
  stringsButton.title = state.showSystemStringsPanel ? 'Focus system strings workspace' : 'Open system strings workspace';

  const xmlButton = createUtilityRailButton('XML', undefined, false, () => activateWorkspaceTab('xml'));
  xmlButton.title = state.showXmlPreview ? 'Focus XML preview workspace' : 'Open XML preview workspace';

  shell.utilityRail.append(
    createUtilityRailButton('List', undefined, false, () => toggleDrawer('left')),
    createUtilityRailButton('Inspector', undefined, false, () => toggleDrawer('right')),
    issueButton,
    stringsButton,
    xmlButton,
  );
}

function updateOverlayState(shell: AppShell): void {
  const isOverlay = layoutState.responsiveMode !== 'desktop';
  const drawerOpen = isOverlay && layoutState.activeDrawer !== null;
  shell.mainLayout.dataset.layoutMode = layoutState.responsiveMode;
  shell.mainLayout.dataset.drawerOpen = String(drawerOpen);
  shell.mainLayout.classList.toggle('has-open-drawer', drawerOpen);
  shell.layoutScrim.hidden = !drawerOpen;
}

function applyFactionTheme(container: HTMLElement, faction: ReturnType<typeof store.get>['project']['faction']): void {
  const theme = getFactionThemeVariables(faction);
  container.style.setProperty('--accent', theme.accent);
  container.style.setProperty('--accent-hover', theme.accentHover);
  container.style.setProperty('--accent-dim', theme.accentDim);
  container.style.setProperty('--accent-glow', theme.accentGlow);
  container.style.setProperty('--accent-glow-strong', theme.accentGlowStrong);
  container.style.setProperty('--bg-selected', theme.bgSelected);
  container.style.setProperty('--bg-selected-border', theme.bgSelectedBorder);
  container.style.setProperty('--edge-color', theme.edgeColor);
  container.style.setProperty('--focus-ring', theme.focusRing);
}

function createAddConversationButton(): HTMLButtonElement {
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-sm btn-icon conversation-panel-action panel-action-add';
  addBtn.appendChild(createIcon('add'));
  addBtn.title = 'New conversation';
  addBtn.setAttribute('aria-label', 'New conversation');
  addBtn.onclick = () => createBlankProject();
  return addBtn;
}

function createSelectedConversationActionButton(
  icon: Parameters<typeof setButtonContent>[1],
  _label: string,
  title: string,
  onClick: () => void,
  disabled: boolean,
  dangerous = false,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn-sm btn-icon conversation-panel-action${dangerous ? ' btn-danger' : ''}`;
  button.appendChild(createIcon(icon));
  button.title = title;
  button.setAttribute('aria-label', title);
  button.disabled = disabled;
  button.onclick = onClick;
  return button;
}

function createPanelLauncherButton(side: 'left' | 'right', label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-sm panel-launcher-button';
  button.textContent = label;
  button.title = `Open ${label.toLowerCase()}`;
  button.setAttribute('aria-label', button.title);
  button.onclick = () => toggleDrawer(side);
  return button;
}

function createPanelToggleButton(side: 'left' | 'right'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `btn-sm btn-icon panel-toggle-button${side === 'left' ? ' conversation-panel-action' : ''}`;

  if (layoutState.responsiveMode !== 'desktop') {
    const open = layoutState.activeDrawer === side;
    button.textContent = open ? '✕' : '↗';
    button.title = `${open ? 'Close' : 'Open'} ${side === 'left' ? 'conversation list' : 'properties panel'}`;
  } else {
    const collapsed = side === 'left' ? layoutState.leftCollapsed : layoutState.rightCollapsed;
    button.textContent = collapsed ? (side === 'left' ? '⟩' : '⟨') : (side === 'left' ? '⟨' : '⟩');
    button.title = `${collapsed ? 'Expand' : 'Collapse'} ${side === 'left' ? 'conversation list' : 'properties panel'}`;
  }

  button.setAttribute('aria-label', button.title);
  button.onclick = () => {
    if (layoutState.responsiveMode !== 'desktop') {
      toggleDrawer(side);
      return;
    }

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
  splitter.onpointerdown = (event) => startPanelResize(event, side, main);
  return splitter;
}

function startPanelResize(event: PointerEvent, side: 'left' | 'right', main: HTMLElement): void {
  if (layoutState.responsiveMode !== 'desktop') return;

  event.preventDefault();
  const rect = main.getBoundingClientRect();
  const startWidth = side === 'left' ? layoutState.leftWidth : layoutState.rightWidth;

  const onMove = (moveEvent: PointerEvent): void => {
    if (layoutState.responsiveMode !== 'desktop') return;
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
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
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
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
}

function applyPanelLayout(main: HTMLElement): void {
  const isDesktop = layoutState.responsiveMode === 'desktop';
  const leftWidth = isDesktop
    ? (layoutState.leftCollapsed ? PANEL_COLLAPSED_WIDTH : layoutState.leftWidth)
    : layoutState.leftWidth;
  const rightWidth = isDesktop
    ? (layoutState.rightCollapsed ? PANEL_COLLAPSED_WIDTH : layoutState.rightWidth)
    : layoutState.rightWidth;

  main.style.setProperty('--panel-left-width', `${leftWidth}px`);
  main.style.setProperty('--panel-right-width', `${rightWidth}px`);
  main.style.setProperty('--panel-left-drawer-width', `${leftWidth}px`);
  main.style.setProperty('--panel-right-drawer-width', `${rightWidth}px`);
  main.dataset.leftCollapsed = String(layoutState.leftCollapsed);
  main.dataset.rightCollapsed = String(layoutState.rightCollapsed);
  main.dataset.layoutMode = layoutState.responsiveMode;
}

function syncResponsiveLayout(main: HTMLElement): void {
  const nextMode = getResponsiveMode(window.innerWidth);
  if (layoutState.responsiveMode !== nextMode) {
    applyLayoutDefaults(nextMode);
  }

  layoutState.leftWidth = clampWidth(layoutState.leftWidth);
  layoutState.rightWidth = clampWidth(layoutState.rightWidth);
  applyPanelLayout(main);
}

function getResponsiveMode(width: number): ResponsiveLayoutMode {
  if (width <= MOBILE_BREAKPOINT) return 'mobile';
  if (width <= TABLET_BREAKPOINT) return 'tablet';
  return 'desktop';
}

function applyLayoutDefaults(mode: ResponsiveLayoutMode): void {
  const defaults = getLayoutDefaults(mode, window.innerWidth);
  layoutState.responsiveMode = mode;
  layoutState.leftWidth = defaults.leftWidth;
  layoutState.rightWidth = defaults.rightWidth;
  layoutState.leftCollapsed = defaults.leftCollapsed;
  layoutState.rightCollapsed = defaults.rightCollapsed;
  layoutState.activeDrawer = null;
}

function getLayoutDefaults(mode: ResponsiveLayoutMode, viewportWidth: number): LayoutDefaults {
  if (mode === 'mobile') {
    const drawerWidth = Math.max(260, Math.min(360, Math.round(viewportWidth * 0.88)));
    return {
      leftWidth: drawerWidth,
      rightWidth: drawerWidth,
      leftCollapsed: true,
      rightCollapsed: true,
    };
  }

  if (mode === 'tablet') {
    const drawerWidth = Math.max(280, Math.min(360, Math.round(viewportWidth * 0.34)));
    return {
      leftWidth: drawerWidth,
      rightWidth: Math.max(300, Math.min(400, drawerWidth + 24)),
      leftCollapsed: true,
      rightCollapsed: true,
    };
  }

  return {
    leftWidth: 320,
    rightWidth: 360,
    leftCollapsed: false,
    rightCollapsed: false,
  };
}

function toggleConversationIssues(state: AppState = store.get()): void {
  if (state.validationMessages.length === 0) return;

  if (layoutState.responsiveMode !== 'desktop') {
    layoutState.activeDrawer = 'left';
  }

  store.toggleValidationPanel();
}

function ensureResponsiveListener(container: HTMLElement): void {
  if (resizeListenerAttached) return;
  resizeListenerAttached = true;

  let frame = 0;
  window.addEventListener('resize', () => {
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      renderApp(container);
    });
  });
}

function activateWorkspaceTab(tab: BottomWorkspaceTab): void {
  const state = store.get();

  if (tab === 'strings') {
    if (!state.showSystemStringsPanel) {
      store.toggleSystemStringsPanel();
      return;
    }
    store.setBottomWorkspaceTab('strings');
    return;
  }

  if (!state.showXmlPreview) {
    store.toggleXmlPreview();
    return;
  }
  store.setBottomWorkspaceTab('xml');
}

function createUtilityRailButton(
  label: string,
  badge: string | undefined,
  disabled: boolean,
  onclick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'utility-rail-button';
  button.disabled = disabled;
  button.onclick = onclick;

  const labelEl = document.createElement('span');
  labelEl.className = 'utility-rail-label';
  labelEl.textContent = label;
  button.appendChild(labelEl);

  if (badge) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'utility-rail-badge';
    badgeEl.textContent = badge;
    button.appendChild(badgeEl);
  }

  return button;
}

function renderToolbarToggle(shell: AppShell): void {
  const existingToggle = shell.mainLayout.querySelector('.toolbar-visibility-toggle');
  if (existingToggle) existingToggle.remove();

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'toolbar-visibility-toggle';
  toggle.title = layoutState.toolbarHidden ? 'Show toolbar' : 'Hide toolbar';
  toggle.setAttribute('aria-label', toggle.title);
  toggle.textContent = layoutState.toolbarHidden ? '▼' : '▲';
  toggle.onclick = () => {
    layoutState.toolbarHidden = !layoutState.toolbarHidden;
    renderApp(shell.container);
  };
  shell.mainLayout.appendChild(toggle);
}

function toggleDrawer(side: 'left' | 'right'): void {
  if (layoutState.responsiveMode === 'desktop') return;
  layoutState.activeDrawer = layoutState.activeDrawer === side ? null : side;
  renderApp(document.getElementById('app')!);
}

function clampWidth(value: number): number {
  return Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, value));
}

/** Merge conversations from the community library into the current project,
 *  auto-selecting the first imported conversation afterward. */
export function importConversations(conversations: import('../lib/types').Conversation[], faction?: import('../lib/types').FactionId): void {
  const normalizedConversations = conversations.map((conversation) => ({
    ...conversation,
    faction: getConversationFaction(conversation, faction ?? store.get().project.faction),
  }));
  const firstId = store.mergeConversations(normalizedConversations);
  if (firstId != null) {
    store.selectConversation(firstId);
  }
}
