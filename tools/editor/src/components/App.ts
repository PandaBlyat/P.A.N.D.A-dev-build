// P.A.N.D.A. Conversation Editor — Root App Component

import { store, type BottomWorkspaceTab, type AppState, type ConversationSourceMetadata, type FlowDensity, type RenderTarget, type StateChange } from '../lib/state';
import { renderToolbar as renderToolbarContent } from './Toolbar';
import {
  centerConversationSelection,
  deleteConversationSelection,
  duplicateConversationSelection,
  renderConversationList as renderConversationListContent,
} from './ConversationList';
import { renderFlowEditor as renderFlowEditorContent, resetFlowViewState, syncFlowEditor, updateFlowSelection } from './FlowEditor';
import { renderPropertiesPanel as renderPropertiesPanelContent } from './PropertiesPanel';
import { renderBottomWorkspace as renderBottomWorkspaceContent } from './BottomWorkspace';
import { createSystemStringsPanelContent } from './SystemStringsPanel';
import { createXmlPreviewContent } from './XmlPreview';
import { createValidationWorkspaceContent } from './ValidationBar';
import { openStoryWizard } from './StoryWizard';
import { mountMotivationTicker } from './MotivationTicker';
import { shouldShowFirstRunExperience, renderFirstRunExperience } from './Onboarding';
import { exportProjectJson, exportXml, importFromJson, importFromXml, normalizeProjectData } from '../lib/project-io';
import { setButtonContent, createIcon } from './icons';
import { getFactionThemeVariables } from '../lib/faction-colors';
import { getConversationFaction } from '../lib/types';
import { setBeginnerTooltip } from '../lib/beginner-tooltips';
import { openSharePanel } from './SharePanel';
import { openHelpModal } from './HelpModal';
import { openSupportPanel } from './SupportPanel';
import { openBugReportsPanel } from './BugReportsPanel';
import { clearDraft } from '../lib/draft-storage';
import { createEmptyProject } from '../lib/xml-export';

const PANEL_MIN_WIDTH = 220;
const PANEL_MAX_WIDTH = 520;
const PANEL_COLLAPSED_WIDTH = 52;
const TABLET_BREAKPOINT = 1180;
const MOBILE_BREAKPOINT = 760;

type ResponsiveLayoutMode = 'desktop' | 'tablet' | 'mobile';
type DrawerSide = 'left' | 'right' | null;
type MobileSheetId = 'stories' | 'inspector' | 'issues' | 'strings' | 'xml' | 'more';
type ActiveMobileSheet = MobileSheetId | null;

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
  activeMobileSheet: null as ActiveMobileSheet,
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
  mobileSheetScrim: HTMLButtonElement;
  mobileSheet: HTMLElement;
  modalHost: HTMLDivElement;
};

let appShell: AppShell | null = null;
let resizeListenerAttached = false;
let mobileSheetKeyboardAttached = false;

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
  shell.rightSplitter.hidden = firstRun || !store.get().advancedMode;
  renderConversationList(container);
  renderFlowEditor(container);
  renderPropertiesPanel(container);
  renderBottomWorkspace(container);
  renderUtilityRail(shell, firstRun);
  renderMobileSheet(shell, firstRun);
  renderToolbarToggle(shell);
  updateOverlayState(shell);
}

export function renderToolbar(container: HTMLElement): void {
  const { shell } = getRenderContext(container);
  shell.toolbarRegion.replaceChildren(renderToolbarContent(layoutState.responsiveMode, {
    onOpenMobileSheet: () => openMobileSheet('more'),
  }));
  shell.toolbarRegion.hidden = layoutState.toolbarHidden;
}

export function renderConversationList(container: HTMLElement): void {
  const { shell, firstRun } = getRenderContext(container);
  renderLeftPanel(shell, firstRun);
  renderMobileSheet(shell, firstRun);
}

export function renderFlowEditor(container: HTMLElement): void {
  const { shell, conv, firstRun } = getRenderContext(container);
  renderCenterPanel(shell, conv, firstRun);
}

/**
 * Attempt a fast selection-only update of the flow editor.
 * Returns true if the fast path was taken, false if a full render is needed.
 */
export function tryFastFlowUpdate(): boolean {
  return updateFlowSelection();
}

export function trySyncFlowEditor(change: StateChange): boolean {
  return syncFlowEditor(change);
}

export function renderPropertiesPanel(container: HTMLElement): void {
  const { shell, firstRun } = getRenderContext(container);
  renderRightPanel(shell, firstRun);
  renderMobileSheet(shell, firstRun);
}

export function renderBottomWorkspace(container: HTMLElement): void {
  const { shell, firstRun } = getRenderContext(container);
  renderBottomRegion(shell, firstRun);
  renderMobileSheet(shell, firstRun);
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
  leftTitle.textContent = 'Stories';
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

  const mobileSheetScrim = document.createElement('button');
  mobileSheetScrim.type = 'button';
  mobileSheetScrim.className = 'mobile-sheet-scrim';
  mobileSheetScrim.title = 'Close mobile panel';
  mobileSheetScrim.setAttribute('aria-label', 'Close mobile panel');
  mobileSheetScrim.hidden = true;
  mobileSheetScrim.onclick = () => closeMobileSheet();

  const mobileSheet = document.createElement('section');
  mobileSheet.className = 'mobile-sheet';
  mobileSheet.setAttribute('aria-modal', 'true');
  mobileSheet.setAttribute('role', 'dialog');
  mobileSheet.hidden = true;

  const modalHost = document.createElement('div');
  modalHost.className = 'app-modal-host';
  modalHost.id = 'app-modal-host';
  modalHost.setAttribute('aria-hidden', 'true');

  container.replaceChildren(toolbarRegion, mainLayout, bottomRegion, mobileSheetScrim, mobileSheet, modalHost);

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
    mobileSheetScrim,
    mobileSheet,
    modalHost,
  };

  return appShell;
}

function renderLeftPanel(shell: AppShell, firstRun = false): void {
  if (layoutState.responsiveMode === 'mobile') {
    shell.leftPanel.hidden = true;
    shell.leftPanel.setAttribute('aria-hidden', 'true');
    shell.leftActions.replaceChildren();
    shell.leftBody.replaceChildren();
    return;
  }

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

  if (!firstRun && layoutState.responsiveMode === 'tablet') {
    shell.centerActions.append(createPanelLauncherButton('left', 'Stories'));
    if (store.get().advancedMode) {
      shell.centerActions.append(createPanelLauncherButton('right', 'Inspector'));
    }
  }

  if (conv) {
    const autoLayoutBtn = document.createElement('button');
    autoLayoutBtn.className = 'btn-sm';
    setButtonContent(autoLayoutBtn, 'locate', 'Auto Layout');
    setBeginnerTooltip(autoLayoutBtn, 'flow-auto-layout');
    autoLayoutBtn.onclick = () => store.autoLayoutConversation(conv.id);

    const addTurnBtn = document.createElement('button');
    addTurnBtn.className = 'btn-sm btn-primary flow-add-turn-button';
    setButtonContent(addTurnBtn, 'add', '+ Turn');
    addTurnBtn.title = 'Add a new turn to create another branch';
    addTurnBtn.setAttribute('aria-label', addTurnBtn.title);
    setBeginnerTooltip(addTurnBtn, 'flow-add-turn');
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
  const state = store.get();
  if (!state.advancedMode || layoutState.responsiveMode === 'mobile') {
    shell.rightPanel.hidden = true;
    shell.rightPanel.setAttribute('aria-hidden', 'true');
    shell.rightActions.replaceChildren();
    shell.rightBody.replaceChildren();
    return;
  }

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
  if (layoutState.responsiveMode === 'mobile') {
    shell.bottomRegion.hidden = true;
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
  if (layoutState.responsiveMode === 'mobile') {
    const navItems: Array<{ sheet: MobileSheetId; label: string; badge?: string }> = [
      { sheet: 'stories', label: 'Stories' },
      { sheet: 'issues', label: 'Issues', badge: issueCount > 0 ? `${issueCount}` : undefined },
    ];
    if (state.advancedMode) {
      navItems.push(
        { sheet: 'inspector', label: 'Inspect' },
        { sheet: 'strings', label: 'Strings' },
        { sheet: 'xml', label: 'XML' },
      );
    }
    shell.utilityRail.append(
      ...navItems.map(item => createMobileNavButton(item.sheet, item.label, item.badge)),
    );
    return;
  }

  const issueButton = createUtilityRailButton(
    'Issues',
    issueCount > 0 ? `${issueCount}` : undefined,
    issueCount === 0,
    () => toggleConversationIssues(state),
  );
  issueButton.title = issueCount > 0 ? `Open issues (${issueCount})` : 'No project issues';

  const utilityButtons = [
    createUtilityRailButton('Stories', undefined, false, () => toggleDrawer('left')),
    issueButton,
  ];
  if (state.advancedMode) {
    utilityButtons.splice(1, 0, createUtilityRailButton('Inspector', undefined, false, () => toggleDrawer('right')));

    const stringsButton = createUtilityRailButton('Strings', undefined, false, () => activateWorkspaceTab('strings'));
    stringsButton.title = state.showSystemStringsPanel ? 'Focus system strings workspace' : 'Open system strings workspace';

    const xmlButton = createUtilityRailButton('XML', undefined, false, () => activateWorkspaceTab('xml'));
    xmlButton.title = state.showXmlPreview ? 'Focus XML preview workspace' : 'Open XML preview workspace';
    utilityButtons.push(stringsButton, xmlButton);
  }

  shell.utilityRail.append(...utilityButtons);
}

function updateOverlayState(shell: AppShell): void {
  const isOverlay = layoutState.responsiveMode !== 'desktop';
  const drawerOpen = isOverlay
    && layoutState.responsiveMode !== 'mobile'
    && layoutState.activeDrawer !== null
    && (layoutState.activeDrawer !== 'right' || store.get().advancedMode);
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
  addBtn.title = 'New story';
  addBtn.setAttribute('aria-label', 'New story');
  setBeginnerTooltip(addBtn, 'story-new');
  addBtn.onclick = () => openStoryWizard();
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
  if (title.startsWith('Center')) {
    setBeginnerTooltip(button, 'story-center');
  } else if (title.startsWith('Duplicate')) {
    setBeginnerTooltip(button, 'story-duplicate');
  } else if (title.startsWith('Delete')) {
    setBeginnerTooltip(button, 'story-delete');
  }
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
  setBeginnerTooltip(button, 'panel-toggle');
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
    button.title = `${open ? 'Close' : 'Open'} ${side === 'left' ? 'story list' : 'properties panel'}`;
  } else {
    const collapsed = side === 'left' ? layoutState.leftCollapsed : layoutState.rightCollapsed;
    button.textContent = collapsed ? (side === 'left' ? '⟩' : '⟨') : (side === 'left' ? '⟨' : '⟩');
    button.title = `${collapsed ? 'Expand' : 'Collapse'} ${side === 'left' ? 'story list' : 'properties panel'}`;
  }

  button.setAttribute('aria-label', button.title);
  setBeginnerTooltip(button, 'panel-toggle');
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
  splitter.title = `Drag to resize the ${side === 'left' ? 'story list' : 'properties panel'}`;
  setBeginnerTooltip(splitter, 'panel-resize');
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
    const widthChanged = side === 'left'
      ? layoutState.leftWidth !== startWidth
      : layoutState.rightWidth !== startWidth;
    if (widthChanged) {
      const container = document.getElementById('app')!;
      renderFlowEditor(container);
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
  layoutState.activeMobileSheet = null;
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
  if (layoutState.responsiveMode === 'mobile') {
    openMobileSheet('issues');
    return;
  }

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
      const nextMode = getResponsiveMode(window.innerWidth);
      if (nextMode !== layoutState.responsiveMode) {
        renderApp(container);
      } else if (appShell) {
        applyPanelLayout(appShell.mainLayout);
      }
    });
  });
}

function activateWorkspaceTab(tab: BottomWorkspaceTab): void {
  if (layoutState.responsiveMode === 'mobile') {
    openMobileSheet(tab);
    return;
  }

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

function renderMobileSheet(shell: AppShell, firstRun = false): void {
  ensureMobileSheetKeyboardListener();
  const isMobile = layoutState.responsiveMode === 'mobile';
  if (!store.get().advancedMode && layoutState.activeMobileSheet === 'inspector') {
    layoutState.activeMobileSheet = null;
  }
  const activeSheet = isMobile && !firstRun ? layoutState.activeMobileSheet : null;
  const sheetOpen = activeSheet != null;

  shell.mobileSheet.hidden = !sheetOpen;
  shell.mobileSheetScrim.hidden = !sheetOpen;
  shell.mobileSheet.dataset.sheet = activeSheet ?? '';
  shell.mobileSheetScrim.dataset.sheetOpen = String(sheetOpen);
  shell.mainLayout.dataset.mobileSheetOpen = String(sheetOpen);
  document.body.classList.toggle('mobile-sheet-open', sheetOpen);

  if (!sheetOpen) {
    shell.mobileSheet.replaceChildren();
    return;
  }

  const header = document.createElement('div');
  header.className = 'mobile-sheet-header';

  const grip = document.createElement('span');
  grip.className = 'mobile-sheet-grip';
  grip.setAttribute('aria-hidden', 'true');

  const title = document.createElement('strong');
  title.className = 'mobile-sheet-title';
  title.textContent = getMobileSheetTitle(activeSheet);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-sm mobile-sheet-close';
  setButtonContent(closeBtn, 'close', 'Close');
  closeBtn.onclick = () => closeMobileSheet();

  header.append(grip, title, closeBtn);

  const body = document.createElement('div');
  body.className = 'mobile-sheet-body';
  renderMobileSheetBody(activeSheet, body);

  shell.mobileSheet.replaceChildren(header, body);
}

function renderMobileSheetBody(sheet: MobileSheetId, body: HTMLElement): void {
  switch (sheet) {
    case 'stories':
      renderConversationListContent(body);
      return;
    case 'inspector':
      renderPropertiesPanelContent(body);
      return;
    case 'issues': {
      const messages = store.get().validationMessages;
      if (messages.length === 0) {
        body.appendChild(createMobileEmptyState('No issues', 'Current project passes validation.'));
        return;
      }
      body.appendChild(createValidationWorkspaceContent(messages));
      return;
    }
    case 'strings':
      body.appendChild(createSystemStringsPanelContent());
      return;
    case 'xml':
      body.appendChild(createXmlPreviewContent());
      return;
    case 'more':
      renderMobileMoreActions(body);
      return;
  }
}

function renderMobileMoreActions(body: HTMLElement): void {
  const state = store.get();
  const actions = document.createElement('div');
  actions.className = 'mobile-more-actions';

  const resetIntro = (): void => {
    if (state.dirty && !window.confirm('You have unsaved changes. Clear workspace and return to the intro?')) return;
    clearDraft();
    store.loadProject(createEmptyProject('stalker'), new Map());
    closeMobileSheet();
  };

  actions.append(
    createMobileSheetAction('open', 'Open Project', () => { closeMobileSheet(); importFromJson(); }),
    createMobileSheetAction('save', 'Save Project', () => { closeMobileSheet(); exportProjectJson(); }),
    createMobileSheetAction('import', 'Import XML', () => { closeMobileSheet(); importFromXml(); }),
    createMobileSheetAction('export', 'Export XML', () => { closeMobileSheet(); exportXml(); }),
    createMobileSheetAction('undo', 'Undo', () => store.undo(), state.undoStack.length === 0),
    createMobileSheetAction('redo', 'Redo', () => store.redo(), state.redoStack.length === 0),
    createMobileSheetAction('share', 'Community', () => { closeMobileSheet(); openSharePanel(); }),
    createMobileSheetAction('bug', 'Reports', () => { closeMobileSheet(); openBugReportsPanel(); }),
    createMobileSheetAction('support', 'Support', () => { closeMobileSheet(); openSupportPanel(); }),
    createMobileSheetAction('help', 'Help', () => { closeMobileSheet(); openHelpModal(); }),
    createMobileSheetAction('eye', `Occlusion: ${state.flowOcclusionEnabled ? 'On' : 'Off'}`, () => store.toggleFlowOcclusion()),
    createMobileSheetAction('eye', state.advancedMode ? 'Advanced On' : 'Advanced mode', () => store.toggleAdvancedMode()),
    createMobileSheetAction('locate', `Density: ${state.flowDensity}`, () => store.setFlowDensity(nextDensity(state.flowDensity))),
    createMobileSheetAction('brand', 'Reset Intro', resetIntro),
  );

  body.appendChild(actions);
}

function createMobileSheetAction(
  icon: Parameters<typeof setButtonContent>[1],
  label: string,
  onClick: () => void,
  disabled = false,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mobile-sheet-action';
  button.disabled = disabled;
  setButtonContent(button, icon, label);
  button.onclick = onClick;
  return button;
}

function createMobileEmptyState(title: string, body: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'mobile-sheet-empty';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = body;
  empty.append(heading, copy);
  return empty;
}

function getMobileSheetTitle(sheet: MobileSheetId): string {
  switch (sheet) {
    case 'stories':
      return 'Stories';
    case 'inspector':
      return 'Inspector';
    case 'issues':
      return 'Issues';
    case 'strings':
      return 'Strings';
    case 'xml':
      return 'XML';
    case 'more':
      return 'More';
  }
}

function createMobileNavButton(sheet: MobileSheetId, label: string, badge?: string): HTMLButtonElement {
  const button = createUtilityRailButton(label, badge, false, () => openMobileSheet(sheet));
  button.classList.toggle('is-active', layoutState.activeMobileSheet === sheet);
  button.setAttribute('aria-pressed', String(layoutState.activeMobileSheet === sheet));
  return button;
}

function openMobileSheet(sheet: MobileSheetId): void {
  if (layoutState.responsiveMode !== 'mobile') return;
  layoutState.activeDrawer = null;
  layoutState.activeMobileSheet = layoutState.activeMobileSheet === sheet ? null : sheet;
  renderApp(document.getElementById('app')!);
}

function closeMobileSheet(): void {
  if (layoutState.activeMobileSheet == null) return;
  layoutState.activeMobileSheet = null;
  renderApp(document.getElementById('app')!);
}

function ensureMobileSheetKeyboardListener(): void {
  if (mobileSheetKeyboardAttached) return;
  mobileSheetKeyboardAttached = true;
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || layoutState.activeMobileSheet == null) return;
    event.preventDefault();
    closeMobileSheet();
  }, true);
}

function nextDensity(current: FlowDensity): FlowDensity {
  const densityOptions: FlowDensity[] = ['compact', 'standard', 'detailed'];
  const index = densityOptions.indexOf(current);
  return densityOptions[(index + 1) % densityOptions.length];
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
  setBeginnerTooltip(button, label === 'Issues' ? 'story-issues' : label === 'XML' || label === 'Strings' ? 'workspace-tab' : 'panel-toggle');
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

  if (layoutState.responsiveMode === 'mobile') return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'toolbar-visibility-toggle';
  toggle.title = layoutState.toolbarHidden ? 'Show toolbar' : 'Hide toolbar';
  toggle.setAttribute('aria-label', toggle.title);
  toggle.textContent = layoutState.toolbarHidden ? '▼' : '▲';
  setBeginnerTooltip(toggle, 'panel-toggle');
  toggle.onclick = () => {
    layoutState.toolbarHidden = !layoutState.toolbarHidden;
    renderApp(shell.container);
  };
  shell.mainLayout.appendChild(toggle);
}

function toggleDrawer(side: 'left' | 'right'): void {
  if (side === 'right' && !store.get().advancedMode) return;
  if (layoutState.responsiveMode === 'desktop') return;
  if (layoutState.responsiveMode === 'mobile') {
    openMobileSheet(side === 'left' ? 'stories' : 'inspector');
    return;
  }
  layoutState.activeDrawer = layoutState.activeDrawer === side ? null : side;
  renderApp(document.getElementById('app')!);
}

function clampWidth(value: number): number {
  return Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, value));
}

/** Merge conversations from the community library into the current project,
 *  auto-selecting the first imported conversation afterward. */
export function importConversations(
  conversations: import('../lib/types').Conversation[],
  faction?: import('../lib/types').FactionId,
  sourceMetadata?: ConversationSourceMetadata,
): number | null {
  const currentProject = store.get().project;
  const normalizedProject = normalizeProjectData({
    version: currentProject.version || '2.0.0',
    faction: faction ?? currentProject.faction,
    conversations,
  });
  const normalizedConversations = normalizedProject.conversations.map((conversation) => ({
    ...conversation,
    faction: getConversationFaction(conversation, faction ?? currentProject.faction),
  }));
  let importedIds: number[] = [];
  store.batch(() => {
    importedIds = store.mergeConversations(normalizedConversations);
    if (importedIds.length > 0) {
      for (const importedId of importedIds) {
        resetFlowViewState(importedId);
        store.autoLayoutConversation(importedId, { spacious: true, centerRoot: true });
        if (sourceMetadata) {
          store.setConversationSourceMetadata(importedId, sourceMetadata);
        }
      }
      store.selectConversation(importedIds[0]!);
    }
  });
  return importedIds[0] ?? null;
}
