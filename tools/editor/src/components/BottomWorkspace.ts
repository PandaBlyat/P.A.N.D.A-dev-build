import { store } from '../lib/state';
import type { BottomWorkspaceTab } from '../lib/state';
import { createSystemStringsPanelContent } from './SystemStringsPanel';
import { createXmlPreviewContent, updateXmlPreviewContent } from './XmlPreview';
import { createControlContent, setButtonContent } from './icons';
import { setBeginnerTooltip } from '../lib/beginner-tooltips';

type WorkspaceItem = {
  key: BottomWorkspaceTab;
  label: string;
  title: string;
  subtitle: string;
  icon: 'warning' | 'strings' | 'xml';
  getPrimaryAction?: () => HTMLButtonElement | null;
};

type WorkspaceShell = {
  root: HTMLElement;
  resizeHandle: HTMLDivElement;
  titleHeading: HTMLElement;
  titleSubtitle: HTMLSpanElement;
  tabs: HTMLDivElement;
  actions: HTMLDivElement;
  body: HTMLDivElement;
  panes: Map<BottomWorkspaceTab, HTMLElement>;
};

let workspaceShell: WorkspaceShell | null = null;

export function renderBottomWorkspace(container: HTMLElement): void {
  const state = store.get();
  const items = getWorkspaceItems();

  if (items.length === 0) {
    if (workspaceShell?.root.parentElement === container) {
      container.replaceChildren();
    }
    return;
  }

  const shell = getWorkspaceShell(container);
  const activeItem = items.find((item) => item.key === state.bottomWorkspaceTab) ?? items[0];

  shell.root.style.setProperty('--bottom-workspace-height', `${state.bottomWorkspaceHeight}px`);
  updateWorkspaceHeader(shell, items, activeItem);
  updateWorkspacePanes(shell, items, activeItem.key);
}

function getWorkspaceShell(container: HTMLElement): WorkspaceShell {
  if (workspaceShell?.root.parentElement === container) {
    return workspaceShell;
  }

  const root = document.createElement('section');
  root.className = 'bottom-workspace';

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'bottom-workspace-resize-handle';
  resizeHandle.title = 'Drag to resize the bottom workspace';
  setBeginnerTooltip(resizeHandle, 'workspace-resize');
  resizeHandle.onmousedown = (event) => startResize(event);
  root.appendChild(resizeHandle);

  const header = document.createElement('div');
  header.className = 'bottom-workspace-header';

  const title = document.createElement('div');
  title.className = 'drawer-header-copy';
  const heading = document.createElement('strong');
  const subtitle = document.createElement('span');
  title.append(heading, subtitle);

  const controls = document.createElement('div');
  controls.className = 'bottom-workspace-controls';

  const tabs = document.createElement('div');
  tabs.className = 'bottom-workspace-tabs';
  controls.appendChild(tabs);

  const actions = document.createElement('div');
  actions.className = 'bottom-workspace-actions';
  controls.appendChild(actions);

  header.append(title, controls);
  root.appendChild(header);

  const body = document.createElement('div');
  body.className = 'bottom-workspace-body';
  root.appendChild(body);

  container.replaceChildren(root);

  workspaceShell = {
    root,
    resizeHandle,
    titleHeading: heading,
    titleSubtitle: subtitle,
    tabs,
    actions,
    body,
    panes: new Map(),
  };

  return workspaceShell;
}

function updateWorkspaceHeader(shell: WorkspaceShell, items: WorkspaceItem[], activeItem: WorkspaceItem): void {
  shell.titleHeading.replaceChildren(createControlContent(activeItem.icon, activeItem.title));
  shell.titleSubtitle.textContent = activeItem.subtitle;

  shell.tabs.replaceChildren();
  shell.tabs.hidden = items.length <= 1;
  if (items.length > 1) {
    for (const item of items) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `bottom-workspace-tab${item.key === activeItem.key ? ' is-active' : ''}`;
      tab.appendChild(createControlContent(item.icon, item.label));
      setBeginnerTooltip(tab, 'workspace-tab');
      tab.onclick = () => store.setBottomWorkspaceTab(item.key);
      shell.tabs.appendChild(tab);
    }
  }

  shell.actions.replaceChildren();
  const primaryAction = activeItem.getPrimaryAction?.() ?? null;
  if (primaryAction) {
    shell.actions.appendChild(primaryAction);
  }
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-sm';
  setButtonContent(closeBtn, 'close', `Close ${activeItem.label}`);
  setBeginnerTooltip(closeBtn, 'workspace-close');
  closeBtn.onclick = () => store.closeBottomWorkspaceTab(activeItem.key);
  shell.actions.appendChild(closeBtn);
}

function updateWorkspacePanes(shell: WorkspaceShell, items: WorkspaceItem[], activeKey: BottomWorkspaceTab): void {
  const openKeys = new Set(items.map(item => item.key));

  for (const item of items) {
    const pane = getOrCreatePane(shell, item.key);
    pane.hidden = item.key !== activeKey;
    pane.dataset.active = String(item.key === activeKey);
    if (item.key === 'xml') {
      updateXmlPreviewContent(pane);
    }
  }

  for (const [key, pane] of shell.panes) {
    if (openKeys.has(key)) continue;
    pane.remove();
    shell.panes.delete(key);
  }
}

function getOrCreatePane(shell: WorkspaceShell, key: BottomWorkspaceTab): HTMLElement {
  const existing = shell.panes.get(key);
  if (existing) return existing;

  const pane = key === 'strings'
    ? createSystemStringsPanelContent()
    : createXmlPreviewContent();
  pane.dataset.workspaceTab = key;
  shell.body.appendChild(pane);
  shell.panes.set(key, pane);
  return pane;
}

function getWorkspaceItems(): WorkspaceItem[] {
  const state = store.get();
  const items: WorkspaceItem[] = [];

  if (state.showSystemStringsPanel) {
    items.push({
      key: 'strings',
      label: 'Strings',
      title: 'System Strings',
      subtitle: 'Edit imported and exported shared string-table entries.',
      icon: 'strings',
      getPrimaryAction: () => createAddStringButton(),
    });
  }

  if (state.showXmlPreview) {
    items.push({
      key: 'xml',
      label: 'XML',
      title: 'XML Editor',
      subtitle: 'Edit XML directly — changes apply to the workspace in real time via the Apply button.',
      icon: 'xml',
    });
  }

  return items;
}

function createAddStringButton(): HTMLButtonElement {
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-sm';
  setButtonContent(addBtn, 'add', 'Add string');
  setBeginnerTooltip(addBtn, 'workspace-add-string');
  addBtn.onclick = () => {
    const currentState = store.get();
    let nextIndex = currentState.systemStrings.size + 1;
    let nextKey = `ui_custom_${nextIndex}`;
    while (currentState.systemStrings.has(nextKey)) {
      nextIndex += 1;
      nextKey = `ui_custom_${nextIndex}`;
    }
    store.setSystemString(nextKey, '');
  };
  return addBtn;
}

function startResize(event: MouseEvent): void {
  event.preventDefault();
  const startY = event.clientY;
  const startHeight = store.get().bottomWorkspaceHeight;

  const onMove = (moveEvent: MouseEvent): void => {
    const delta = startY - moveEvent.clientY;
    store.setBottomWorkspaceHeight(startHeight + delta);
  };

  const onUp = (): void => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    document.body.classList.remove('is-resizing-bottom-workspace');
  };

  document.body.classList.add('is-resizing-bottom-workspace');
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp, { once: true });
}
