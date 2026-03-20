import { store } from '../lib/state';
import type { BottomWorkspaceTab } from '../lib/state';
import { createSystemStringsPanelContent } from './SystemStringsPanel';
import { createXmlPreviewContent } from './XmlPreview';
import { createControlContent, setButtonContent } from './icons';

type WorkspaceItem = {
  key: BottomWorkspaceTab;
  label: string;
  title: string;
  subtitle: string;
  icon: 'warning' | 'strings' | 'xml';
  render: () => HTMLElement;
  primaryAction?: HTMLButtonElement;
};

export function renderBottomWorkspace(container: HTMLElement): void {
  const state = store.get();
  const items = getWorkspaceItems();
  if (items.length === 0) return;

  const activeItem = items.find((item) => item.key === state.bottomWorkspaceTab) ?? items[0];

  const workspace = document.createElement('section');
  workspace.className = 'bottom-workspace';
  workspace.style.setProperty('--bottom-workspace-height', `${state.bottomWorkspaceHeight}px`);

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'bottom-workspace-resize-handle';
  resizeHandle.title = 'Drag to resize the bottom workspace';
  resizeHandle.onmousedown = (event) => startResize(event);
  workspace.appendChild(resizeHandle);

  const header = document.createElement('div');
  header.className = 'bottom-workspace-header';

  const title = document.createElement('div');
  title.className = 'drawer-header-copy';
  const heading = document.createElement('strong');
  heading.appendChild(createControlContent(activeItem.icon, activeItem.title));
  const subtitle = document.createElement('span');
  subtitle.textContent = activeItem.subtitle;
  title.append(heading, subtitle);

  const controls = document.createElement('div');
  controls.className = 'bottom-workspace-controls';

  if (items.length > 1) {
    const tabs = document.createElement('div');
    tabs.className = 'bottom-workspace-tabs';
    for (const item of items) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `bottom-workspace-tab${item.key === activeItem.key ? ' is-active' : ''}`;
      tab.appendChild(createControlContent(item.icon, item.label));
      tab.onclick = () => store.setBottomWorkspaceTab(item.key);
      tabs.appendChild(tab);
    }
    controls.appendChild(tabs);
  }

  const actions = document.createElement('div');
  actions.className = 'bottom-workspace-actions';
  if (activeItem.primaryAction) {
    actions.appendChild(activeItem.primaryAction);
  }
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-sm';
  setButtonContent(closeBtn, 'close', `Close ${activeItem.label}`);
  closeBtn.onclick = () => store.closeBottomWorkspaceTab(activeItem.key);
  actions.appendChild(closeBtn);

  controls.appendChild(actions);
  header.append(title, controls);
  workspace.appendChild(header);

  const body = document.createElement('div');
  body.className = 'bottom-workspace-body';
  body.appendChild(activeItem.render());
  workspace.appendChild(body);

  container.appendChild(workspace);
}

function getWorkspaceItems(): WorkspaceItem[] {
  const state = store.get();
  const items: WorkspaceItem[] = [];

  if (state.showSystemStringsPanel) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-sm';
    setButtonContent(addBtn, 'add', 'Add string');
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

    items.push({
      key: 'strings',
      label: 'Strings',
      title: 'System Strings',
      subtitle: 'Edit imported and exported shared string-table entries.',
      icon: 'strings',
      render: () => createSystemStringsPanelContent(),
      primaryAction: addBtn,
    });
  }

  if (state.showXmlPreview) {
    items.push({
      key: 'xml',
      label: 'XML',
      title: 'XML Preview',
      subtitle: 'Inspect the live export output without leaving the editor.',
      icon: 'xml',
      render: () => createXmlPreviewContent(),
    });
  }

  return items;
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
