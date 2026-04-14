// P.A.N.D.A. Conversation Editor — Toolbar

import { requestFlowCenter } from '../lib/flow-navigation';
import { store, type FlowDensity } from '../lib/state';
import { createTurnDisplayLabeler } from '../lib/turn-labels';
import { exportProjectJson, exportXml, importFromXml, importFromJson } from '../lib/project-io';
import { openSharePanel } from './SharePanel';
import { openHelpModal } from './HelpModal';
import { openSupportPanel } from './SupportPanel';
import { createIcon, setButtonContent, type IconName } from './icons';
import { clearDraft } from '../lib/draft-storage';
import { createEmptyProject } from '../lib/xml-export';
import { renderProfileBadge } from './ProfileBadge';
import { setBeginnerTooltip } from '../lib/beginner-tooltips';
import { fetchActiveEditorUsers, type ActiveEditorUser } from '../lib/api-client';

type SearchResult = {
  label: string;
  meta: string;
  onSelect: () => void;
};

type ToolbarButtonOptions = {
  classes?: string[];
  tooltip?: string;
  ariaLabel?: string;
  icon?: IconName | null;
};

type ToolbarLayoutMode = 'desktop' | 'tablet' | 'mobile';
type ToolbarRenderOptions = {
  onOpenMobileSheet?: (sheet: 'more') => void;
};

type OverflowAction = {
  icon: IconName;
  label: string;
  title?: string;
  onclick: () => void;
  disabled?: boolean;
};

function getLoginAction(): (() => void) | null {
  const candidate = (globalThis as typeof globalThis & { __pandaOpenLoginModal?: unknown }).__pandaOpenLoginModal;
  return typeof candidate === 'function' ? candidate as () => void : null;
}

function accent(value: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'toolbar-title-accent';
  span.textContent = value;
  return span;
}

export function renderToolbar(layoutMode: ToolbarLayoutMode = 'desktop', options: ToolbarRenderOptions = {}): HTMLElement {
  const state = store.get();
  const isCompact = layoutMode !== 'desktop';
  const isMobile = layoutMode === 'mobile';
  const toolbar = document.createElement('div');
  toolbar.className = `toolbar toolbar-${layoutMode}`;

  const branding = document.createElement('div');
  branding.className = 'toolbar-branding';

  const brandIcon = createIcon('brand');
  brandIcon.setAttribute('aria-hidden', 'true');

  const brandCopy = document.createElement('div');
  brandCopy.className = 'toolbar-brand-copy';

  const title = document.createElement('div');
  title.className = 'toolbar-title';

  const titleText = document.createElement('div');
  titleText.className = 'toolbar-title-text';

  const titlePrimary = document.createElement('span');
  titlePrimary.className = 'toolbar-title-primary';
  titlePrimary.append(
    document.createTextNode('P'),
    accent('.'),
    document.createTextNode('A'),
    accent('.'),
    document.createTextNode('N'),
    accent('.'),
    document.createTextNode('D'),
    accent('.'),
    document.createTextNode('A'),
  );

  const subtitle = document.createElement('span');
  subtitle.className = 'toolbar-subtitle';
  subtitle.textContent = 'Editor';

  titleText.append(titlePrimary, subtitle);
  title.append(brandIcon, titleText);
  brandCopy.append(title);
  branding.appendChild(brandCopy);

  const openBtn = btn('open', 'Open', importFromJson, 'Open a saved .panda/.json project or import a PANDA XML file');
  setBeginnerTooltip(openBtn, 'toolbar-open');
  const saveBtn = btn('save', 'Save', exportProjectJson, 'Save as .panda project file (preserves editor data)');
  setBeginnerTooltip(saveBtn, 'toolbar-save');
  const importBtn = btn('import', 'Import', importFromXml, 'Import stories from an existing game XML file');
  setBeginnerTooltip(importBtn, 'toolbar-import');
  const exportXmlBtn = btn('export', 'Export XML', exportXml, 'Export as game-ready XML file for S.T.A.L.K.E.R. Anomaly', {
    classes: ['btn-subtle'],
  });
  setBeginnerTooltip(exportXmlBtn, 'toolbar-export-xml');
  const communityBtn = btn('share', 'Community', openSharePanel, 'Browse, import, and publish community stories', {
    classes: ['btn-community', 'toolbar-button-primary'],
  });
  setBeginnerTooltip(communityBtn, 'toolbar-community');
  const supportBtn = btn('support', 'Support', openSupportPanel, 'Support the Creator', {
    classes: ['toolbar-support-trigger'],
  });
  const helpBtn = btn('help', '?', openHelpModal, 'New here? Open the quick-start guide to preconditions, dynamic references, outcomes, and story design.', {
    classes: ['toolbar-help-trigger'],
    ariaLabel: 'Open P.A.N.D.A. quick-start guide',
    icon: null,
  });
  setBeginnerTooltip(helpBtn, 'toolbar-help');
  const loginAction = getLoginAction();
  const loginBtn = loginAction
    ? btn('user', 'Log In', loginAction, 'Log in or create a callsign to track your XP and level in the Zone.', {
      classes: ['btn-community', 'toolbar-button-primary'],
    })
    : null;
  const handleReset = (): void => {
    if (state.dirty && !window.confirm('You have unsaved changes. Clear workspace and return to the intro?')) return;
    clearDraft();
    store.loadProject(createEmptyProject('stalker'), new Map());
  };

  if (!isCompact) {
    const leftZone = document.createElement('div');
    leftZone.className = 'toolbar-zone toolbar-zone-left';
    leftZone.appendChild(branding);


    const centerZone = document.createElement('div');
    centerZone.className = 'toolbar-zone toolbar-zone-center';

    const projectGroup = document.createElement('div');
    projectGroup.className = 'toolbar-group toolbar-group-project';
    projectGroup.append(openBtn, importBtn, saveBtn, exportXmlBtn, communityBtn, helpBtn);
    centerZone.appendChild(projectGroup);

    const rightZone = document.createElement('div');
    rightZone.className = 'toolbar-zone toolbar-zone-right';

    const search = renderQuickSearch();
    rightZone.appendChild(search);

    const editorGroup = document.createElement('div');
    editorGroup.className = 'toolbar-group toolbar-group-edit';
    const advancedBtn = toggleBtn(
      'eye',
      state.advancedMode ? 'Advanced On' : 'Author Mode',
      state.advancedMode,
      () => store.toggleAdvancedMode(),
      state.advancedMode
        ? 'Show full technical controls'
        : 'Author Mode hides technical controls until needed',
    );
    const densitySelect = document.createElement('select');
    densitySelect.className = 'toolbar-density-select toolbar-select-quiet';
    densitySelect.title = 'Adjust how much information each turn card shows in the flow editor.';
    setBeginnerTooltip(densitySelect, 'toolbar-density');
    const densityOptions: FlowDensity[] = ['compact', 'standard', 'detailed'];
    for (const density of densityOptions) {
      const option = document.createElement('option');
      option.value = density;
      option.textContent = density[0].toUpperCase() + density.slice(1);
      option.selected = density === state.flowDensity;
      densitySelect.appendChild(option);
    }
    densitySelect.onchange = () => store.setFlowDensity(densitySelect.value as FlowDensity);
    const undoBtn = iconBtn('undo', () => store.undo(), 'Undo', 'Undo last change (Ctrl+Z)');
    const redoBtn = iconBtn('redo', () => store.redo(), 'Redo', 'Redo last undone change (Ctrl+Y)');
    setBeginnerTooltip(undoBtn, 'toolbar-undo');
    setBeginnerTooltip(redoBtn, 'toolbar-redo');
    undoBtn.disabled = state.undoStack.length === 0;
    redoBtn.disabled = state.redoStack.length === 0;
    const historyGroup = document.createElement('div');
    historyGroup.className = 'toolbar-group toolbar-group-compact toolbar-group-history';
    historyGroup.append(undoBtn, redoBtn);
    editorGroup.append(advancedBtn, densitySelect, sep(), historyGroup);
    rightZone.appendChild(editorGroup);

    if (state.advancedMode) {
      const viewGroup = document.createElement('div');
      viewGroup.className = 'toolbar-group toolbar-group-segmented';
      viewGroup.appendChild(toggleBtn(
        'xml',
        'XML',
        state.showXmlPreview,
        () => store.toggleXmlPreview(),
        state.showXmlPreview ? 'Hide the live XML preview panel' : 'Show the live XML preview panel',
      ));
      viewGroup.appendChild(toggleBtn(
        'strings',
        'Strings',
        state.showSystemStringsPanel,
        () => store.toggleSystemStringsPanel(),
        state.showSystemStringsPanel ? 'Hide the shared system strings manager' : 'Show the shared system strings manager',
      ));
      rightZone.appendChild(viewGroup);
    }

    const status = document.createElement('span');
    status.className = 'toolbar-status';
    const convCount = state.project.conversations.length;
    const stringCount = state.systemStrings.size;
    if (state.dirty) {
      status.innerHTML = `<span class="unsaved-dot"></span> ${formatStatus(convCount, stringCount, false, true)}`;
      status.style.color = 'var(--warning)';
    } else {
      status.textContent = formatStatus(convCount, stringCount, false, false);
    }
    rightZone.append(status, supportBtn);

    rightZone.appendChild(createOverflowMenu('More', [
      { icon: 'help', label: 'Help', title: helpBtn.title, onclick: openHelpModal },
      { icon: 'brand', label: 'Reset Intro', title: 'Clear workspace and show the intro sequence', onclick: handleReset },
    ]));

    const profileBadge = renderProfileBadge();
    if (profileBadge) {
      rightZone.appendChild(profileBadge);
    } else if (loginBtn) {
      rightZone.appendChild(loginBtn);
    }

    const visitorCounter = renderVisitorCounter();
    if (visitorCounter) rightZone.appendChild(visitorCounter);
    const activeUserCounter = renderActiveUserCounter();
    if (activeUserCounter) rightZone.appendChild(activeUserCounter);

    toolbar.append(leftZone, centerZone, rightZone);
    return toolbar;
  }

  const projectTier = document.createElement('div');
  projectTier.className = 'toolbar-tier toolbar-tier-project';
  projectTier.appendChild(branding);

  const fileGroup = document.createElement('div');
  fileGroup.className = 'toolbar-group toolbar-group-project';
  if (isMobile) {
    const moreBtn = btn('help', 'More', () => options.onOpenMobileSheet?.('more'), 'Open file, export, and editor actions', {
      icon: null,
    });
    moreBtn.classList.add('toolbar-mobile-more-button');
    setBeginnerTooltip(moreBtn, 'toolbar-more');
    fileGroup.append(
      communityBtn,
      moreBtn,
    );
    projectTier.appendChild(fileGroup);
    toolbar.appendChild(projectTier);
    return toolbar;
  }

  if (isCompact) {
    const projectOverflowActions: OverflowAction[] = [];
    projectOverflowActions.push(
      { icon: 'import', label: 'Import XML', title: importBtn.title, onclick: importFromXml },
      { icon: 'share', label: 'Community', title: communityBtn.title, onclick: openSharePanel },
    );

    fileGroup.appendChild(openBtn);
    fileGroup.appendChild(saveBtn);
    fileGroup.appendChild(exportXmlBtn);
    fileGroup.appendChild(helpBtn);
    fileGroup.appendChild(createOverflowMenu('More', projectOverflowActions));
  } else {
    fileGroup.appendChild(openBtn);
    fileGroup.appendChild(importBtn);
    fileGroup.appendChild(sep());
    fileGroup.appendChild(saveBtn);
    fileGroup.appendChild(exportXmlBtn);
    fileGroup.appendChild(sep());
    fileGroup.appendChild(communityBtn);
    fileGroup.appendChild(helpBtn);
  }

  projectTier.appendChild(fileGroup);
  toolbar.appendChild(projectTier);

  const editTier = document.createElement('div');
  editTier.className = 'toolbar-tier toolbar-tier-edit';

  const search = renderQuickSearch();
  editTier.appendChild(search);

    const editGroup = document.createElement('div');
    editGroup.className = 'toolbar-group toolbar-group-edit';
  const advancedBtn = toggleBtn(
    'eye',
    state.advancedMode ? 'Advanced On' : 'Author Mode',
    state.advancedMode,
    () => store.toggleAdvancedMode(),
    state.advancedMode
      ? 'Show full technical controls'
      : 'Author Mode hides technical controls until needed',
  );
  const densitySelect = document.createElement('select');
  densitySelect.className = 'toolbar-density-select toolbar-select-quiet';
  densitySelect.title = 'Adjust how much information each turn card shows in the flow editor.';
  setBeginnerTooltip(densitySelect, 'toolbar-density');
  const densityOptions: FlowDensity[] = ['compact', 'standard', 'detailed'];
  for (const density of densityOptions) {
    const option = document.createElement('option');
    option.value = density;
    option.textContent = density[0].toUpperCase() + density.slice(1);
    option.selected = density === state.flowDensity;
    densitySelect.appendChild(option);
  }
  densitySelect.onchange = () => store.setFlowDensity(densitySelect.value as FlowDensity);

  const undoBtn = iconBtn('undo', () => store.undo(), 'Undo', 'Undo last change (Ctrl+Z)');
  const redoBtn = iconBtn('redo', () => store.redo(), 'Redo', 'Redo last undone change (Ctrl+Y)');
  setBeginnerTooltip(undoBtn, 'toolbar-undo');
  setBeginnerTooltip(redoBtn, 'toolbar-redo');
  undoBtn.disabled = state.undoStack.length === 0;
  redoBtn.disabled = state.redoStack.length === 0;

  if (isCompact) {
    const quickActions = document.createElement('div');
    quickActions.className = 'toolbar-group toolbar-group-compact toolbar-group-history';
    quickActions.append(undoBtn, redoBtn);
    editTier.appendChild(quickActions);
    editTier.appendChild(createOverflowMenu('Editor', [
      {
        icon: 'eye',
        label: state.advancedMode ? 'Advanced On' : 'Author Mode',
        title: 'Toggle technical controls',
        onclick: () => store.toggleAdvancedMode(),
      },
      {
        icon: 'locate',
        label: `Density: ${state.flowDensity}`,
        title: 'Cycle the amount of information shown on flow nodes',
        onclick: () => store.setFlowDensity(nextDensity(state.flowDensity)),
      },
    ]));
  } else {
    editGroup.appendChild(advancedBtn);
    editGroup.appendChild(densitySelect);
    editGroup.appendChild(sep());

    const histGroup = document.createElement('div');
    histGroup.className = 'toolbar-group toolbar-group-compact';
    histGroup.appendChild(undoBtn);
    histGroup.appendChild(redoBtn);
    editGroup.appendChild(histGroup);
    editTier.appendChild(editGroup);
  }

  toolbar.appendChild(editTier);

  const utilityTier = document.createElement('div');
  utilityTier.className = 'toolbar-tier toolbar-tier-utility';

  if (!isCompact && state.advancedMode) {
    const utilityGroup = document.createElement('div');
    utilityGroup.className = 'toolbar-group toolbar-group-segmented';
    utilityGroup.appendChild(toggleBtn(
      'xml',
      'XML',
      state.showXmlPreview,
      () => store.toggleXmlPreview(),
      state.showXmlPreview ? 'Hide the live XML preview panel' : 'Show the live XML preview panel',
    ));
    utilityGroup.appendChild(toggleBtn(
      'strings',
      'Strings',
      state.showSystemStringsPanel,
      () => store.toggleSystemStringsPanel(),
      state.showSystemStringsPanel ? 'Hide the shared system strings manager' : 'Show the shared system strings manager',
    ));
    utilityTier.appendChild(utilityGroup);
  }

  const status = document.createElement('span');
  status.className = 'toolbar-status';
  const convCount = state.project.conversations.length;
  const stringCount = state.systemStrings.size;
  if (state.dirty) {
    status.innerHTML = `<span class="unsaved-dot"></span> ${formatStatus(convCount, stringCount, isMobile, true)}`;
    status.style.color = 'var(--warning)';
  } else {
    status.textContent = formatStatus(convCount, stringCount, isMobile, false);
  }
  utilityTier.append(status, supportBtn);
  utilityTier.appendChild(createOverflowMenu('More', [
    { icon: 'help', label: 'Help', title: helpBtn.title, onclick: openHelpModal },
    { icon: 'brand', label: 'Reset Intro', title: 'Clear workspace and show the intro sequence', onclick: handleReset },
  ]));

  const profileBadgeCompact = renderProfileBadge();
  if (profileBadgeCompact) {
    utilityTier.appendChild(profileBadgeCompact);
  } else if (loginBtn) {
    utilityTier.appendChild(loginBtn);
  }

  const visitorCounter = renderVisitorCounter(isMobile);
  if (visitorCounter) utilityTier.appendChild(visitorCounter);
  const activeUserCounter = renderActiveUserCounter(isMobile);
  if (activeUserCounter) utilityTier.appendChild(activeUserCounter);

  toolbar.appendChild(utilityTier);

  return toolbar;
}

function renderQuickSearch(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'toolbar-search';

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'toolbar-search-input';
  input.placeholder = 'Jump to convo, turn, string…';
  input.title = 'Quick navigation across stories, choices, commands, and system strings (Ctrl/Cmd+P)';
  input.setAttribute('data-global-search', 'true');
  setBeginnerTooltip(input, 'toolbar-search');

  const results = document.createElement('div');
  results.className = 'toolbar-search-results';
  results.hidden = true;

  let currentResults: SearchResult[] = [];

  const activateResult = (result: SearchResult): void => {
    input.value = '';
    results.hidden = true;
    result.onSelect();
  };

  const renderResults = (query: string): void => {
    currentResults = buildSearchResults(query);
    results.replaceChildren();

    if (query.trim() === '' || currentResults.length === 0) {
      results.hidden = true;
      return;
    }

    currentResults.slice(0, 14).forEach((result) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'toolbar-search-result';
      item.innerHTML = `<strong>${escapeHtml(result.label)}</strong><span>${escapeHtml(result.meta)}</span>`;
      item.onclick = () => activateResult(result);
      results.appendChild(item);
    });

    results.hidden = false;
  };

  input.oninput = () => renderResults(input.value);
  input.onfocus = () => renderResults(input.value);
  input.onkeydown = (event) => {
    if (event.key === 'Escape') {
      results.hidden = true;
      input.blur();
      return;
    }

    if (event.key === 'Enter' && currentResults.length > 0) {
      event.preventDefault();
      activateResult(currentResults[0]);
    }
  };
  input.onblur = () => {
    window.setTimeout(() => {
      results.hidden = true;
    }, 120);
  };

  wrapper.append(input, results);
  return wrapper;
}

function buildSearchResults(query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return [];

  const { project, systemStrings } = store.get();
  const results: SearchResult[] = [];

  for (const conv of project.conversations) {
    const turnLabels = createTurnDisplayLabeler(conv);
    const conversationText = `${conv.id} ${conv.label}`.toLowerCase();
    if (conversationText.includes(normalized)) {
      results.push({
        label: `Story ${conv.id}`,
        meta: conv.label || 'Untitled story',
        onSelect: () => {
          store.selectConversation(conv.id);
          requestFlowCenter({ conversationId: conv.id, fit: true });
        },
      });
    }

    for (const turn of conv.turns) {
      const turnText = `turn ${turn.turnNumber} ${turn.openingMessage || ''}`.toLowerCase();
      if (turnText.includes(normalized)) {
        results.push({
          label: `C${conv.id} · ${turnLabels.getLongLabel(turn.turnNumber)}`,
          meta: truncate(turn.openingMessage || 'Select turn in flow editor', 72),
          onSelect: () => {
            store.selectConversation(conv.id);
            store.selectTurn(turn.turnNumber);
            requestFlowCenter({ conversationId: conv.id, turnNumber: turn.turnNumber });
          },
        });
      }

      for (const choice of turn.choices) {
        const commandList = choice.outcomes.map((outcome) => outcome.command).join(' ');
        const haystack = `${choice.text} ${choice.reply} ${commandList} ${choice.continueTo ?? ''}`.toLowerCase();
        if (!haystack.includes(normalized)) continue;
        results.push({
          label: `C${conv.id} · ${turnLabels.getCompactLabel(turn.turnNumber)} · Choice ${choice.index}`,
          meta: truncate(choice.text || choice.reply || commandList || '(empty choice)', 72),
          onSelect: () => {
            store.selectConversation(conv.id);
            store.selectTurn(turn.turnNumber);
            store.selectChoice(choice.index);
            requestFlowCenter({ conversationId: conv.id, turnNumber: turn.turnNumber });
          },
        });
      }
    }
  }

  for (const [key, value] of [...systemStrings.entries()]) {
    const haystack = `${key} ${value}`.toLowerCase();
    if (!haystack.includes(normalized)) continue;
    results.push({
      label: `String · ${key}`,
      meta: truncate(value || '(empty system string)', 72),
      onSelect: () => {
        if (!store.get().showSystemStringsPanel) store.toggleSystemStringsPanel();
      },
    });
  }

  return results;
}

function createOverflowMenu(label: string, actions: OverflowAction[]): HTMLElement {
  const details = document.createElement('details');
  details.className = 'toolbar-overflow';

  const summary = document.createElement('summary');
  summary.className = 'toolbar-button toolbar-overflow-toggle';
  summary.textContent = label;
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-label', `${label} menu`);
  setBeginnerTooltip(summary, 'toolbar-more');
  details.appendChild(summary);

  const menu = document.createElement('div');
  menu.className = 'toolbar-overflow-menu';

  for (const action of actions) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'toolbar-overflow-item';
    setButtonContent(item, action.icon, action.label);
    item.title = action.title ?? action.label;
    item.disabled = Boolean(action.disabled);
    setBeginnerTooltip(item, action.label === 'Reset Intro' ? 'toolbar-reset-intro' : action.label === 'Help' ? 'toolbar-help' : 'toolbar-more');
    item.onclick = () => {
      details.open = false;
      action.onclick();
    };
    menu.appendChild(item);
  }

  details.appendChild(menu);
  return details;
}

function formatStatus(convCount: number, stringCount: number, compact: boolean, dirty: boolean): string {
  if (compact) {
    return `${convCount} conv • ${stringCount} strings${dirty ? ' • unsaved' : ''}`;
  }
  return `${convCount} stor${convCount !== 1 ? 'ies' : 'y'} • ${stringCount} strings${dirty ? ' • unsaved' : ''}`;
}

function renderVisitorCounter(compact?: boolean): HTMLElement | null {
  const count = (globalThis as any).__pandaVisitorCount ?? 0;
  if (count <= 0) return null;

  const el = document.createElement('span');
  el.className = 'toolbar-visitor-counter';
  el.title = 'Total unique visitors to the P.A.N.D.A. editor';

  const icon = createIcon('eye');
  const label = document.createElement('span');
  label.textContent = compact
    ? new Intl.NumberFormat().format(count)
    : `${new Intl.NumberFormat().format(count)} visitor${count !== 1 ? 's' : ''}`;

  el.append(icon, label);
  return el;
}

function renderActiveUserCounter(compact?: boolean): HTMLElement | null {
  const count = (globalThis as any).__pandaActiveUserCount ?? 0;
  if (count <= 0) return null;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toolbar-visitor-counter toolbar-active-user-counter';
  btn.title = 'Current active users in the P.A.N.D.A. editor — click to see who\u2019s online';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');

  const icon = createIcon('user');
  const label = document.createElement('span');
  label.textContent = compact
    ? new Intl.NumberFormat().format(count)
    : `${new Intl.NumberFormat().format(count)} active`;

  btn.append(icon, label);
  btn.onclick = (e) => {
    e.stopPropagation();
    toggleActiveUsersPopover(btn);
  };
  return btn;
}

// ─── Active Users Popover ─────────────────────────────────────────────────

let activeUsersPopover: HTMLElement | null = null;
let activeUsersAnchor: HTMLElement | null = null;
let activeUsersPopoverCleanup: (() => void) | null = null;

function toggleActiveUsersPopover(anchor: HTMLElement): void {
  if (activeUsersPopover) {
    closeActiveUsersPopover();
    return;
  }
  openActiveUsersPopover(anchor);
}

function openActiveUsersPopover(anchor: HTMLElement): void {
  closeActiveUsersPopover();
  activeUsersAnchor = anchor;
  anchor.setAttribute('aria-expanded', 'true');

  const popover = document.createElement('div');
  popover.className = 'toolbar-active-users-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Active users in the P.A.N.D.A. editor');

  const header = document.createElement('div');
  header.className = 'toolbar-active-users-header';
  const title = document.createElement('span');
  title.className = 'toolbar-active-users-title';
  title.textContent = 'Active users';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toolbar-active-users-close';
  closeBtn.setAttribute('aria-label', 'Close active users list');
  closeBtn.textContent = '\u00d7';
  closeBtn.onclick = () => closeActiveUsersPopover();
  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'toolbar-active-users-body';
  const loading = document.createElement('div');
  loading.className = 'toolbar-active-users-loading';
  loading.textContent = 'Loading\u2026';
  body.appendChild(loading);

  popover.append(header, body);
  document.body.appendChild(popover);
  activeUsersPopover = popover;
  positionActiveUsersPopover(popover, anchor);

  const onDocClick = (ev: MouseEvent): void => {
    const target = ev.target as Node | null;
    if (!target) return;
    if (popover.contains(target)) return;
    if (anchor.contains(target)) return;
    closeActiveUsersPopover();
  };
  const onEsc = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      closeActiveUsersPopover();
      anchor.focus();
    }
  };
  const onResize = (): void => {
    if (activeUsersPopover && activeUsersAnchor) {
      positionActiveUsersPopover(activeUsersPopover, activeUsersAnchor);
    }
  };
  document.addEventListener('mousedown', onDocClick);
  document.addEventListener('keydown', onEsc);
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onResize, true);
  activeUsersPopoverCleanup = () => {
    document.removeEventListener('mousedown', onDocClick);
    document.removeEventListener('keydown', onEsc);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onResize, true);
  };

  void fetchActiveEditorUsers().then(users => {
    if (activeUsersPopover !== popover) return;
    renderActiveUsersList(body, users);
  });
}

function closeActiveUsersPopover(): void {
  if (!activeUsersPopover) return;
  activeUsersPopover.remove();
  activeUsersPopover = null;
  if (activeUsersAnchor) {
    activeUsersAnchor.setAttribute('aria-expanded', 'false');
    activeUsersAnchor = null;
  }
  if (activeUsersPopoverCleanup) {
    activeUsersPopoverCleanup();
    activeUsersPopoverCleanup = null;
  }
}

function positionActiveUsersPopover(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const margin = 8;
  popover.style.position = 'fixed';
  popover.style.visibility = 'hidden';
  popover.style.top = '0px';
  popover.style.left = '0px';
  // Ensure measurements reflect actual size
  const width = popover.offsetWidth || 240;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = rect.right - width;
  if (left + width + margin > viewportWidth) left = viewportWidth - width - margin;
  if (left < margin) left = margin;

  let top = rect.bottom + 6;
  const height = popover.offsetHeight || 200;
  if (top + height + margin > viewportHeight) {
    // Flip above anchor if there's more room
    const above = rect.top - height - 6;
    if (above >= margin) top = above;
  }

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
  popover.style.visibility = 'visible';
}

function renderActiveUsersList(container: HTMLElement, users: ActiveEditorUser[]): void {
  container.innerHTML = '';

  if (users.length === 0) {
    // Fall back to the known count if the list fetch returned nothing (e.g. RPC
    // hasn't been migrated yet). Show a graceful notice.
    const fallbackCount = (globalThis as any).__pandaActiveUserCount ?? 0;
    const empty = document.createElement('div');
    empty.className = 'toolbar-active-users-empty';
    empty.textContent = fallbackCount > 0
      ? `${fallbackCount} active — usernames unavailable`
      : 'No one else is here right now.';
    container.appendChild(empty);
    return;
  }

  const named = users.filter(u => !!u.username);
  const guests = users.filter(u => !u.username);

  const list = document.createElement('ul');
  list.className = 'toolbar-active-users-list';

  for (const user of named) {
    list.appendChild(createActiveUserItem(user.username as string, false));
  }
  if (guests.length > 0) {
    const label = guests.length === 1 ? 'Guest' : `Guest \u00d7 ${guests.length}`;
    list.appendChild(createActiveUserItem(label, true));
  }

  container.appendChild(list);
}

function createActiveUserItem(label: string, isGuest: boolean): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'toolbar-active-users-item' + (isGuest ? ' toolbar-active-users-item-guest' : '');

  const dot = document.createElement('span');
  dot.className = 'toolbar-active-users-dot';
  dot.setAttribute('aria-hidden', 'true');

  const name = document.createElement('span');
  name.className = 'toolbar-active-users-name';
  name.textContent = label;

  li.append(dot, name);
  return li;
}

function nextDensity(current: FlowDensity): FlowDensity {
  const densityOptions: FlowDensity[] = ['compact', 'standard', 'detailed'];
  const index = densityOptions.indexOf(current);
  return densityOptions[(index + 1) % densityOptions.length];
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function escapeHtml(value: string): string {
  return value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

function btn(
  icon: IconName,
  label: string,
  onclick: () => void,
  tooltip?: string,
  options: ToolbarButtonOptions = {},
): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = ['toolbar-button', ...(options.classes ?? [])].join(' ');
  if (options.icon === null) {
    b.textContent = label;
  } else {
    setButtonContent(b, options.icon ?? icon, label);
  }
  b.onclick = onclick;
  b.title = options.tooltip ?? tooltip ?? label;
  if (options.ariaLabel) b.setAttribute('aria-label', options.ariaLabel);
  return b;
}

function iconBtn(icon: IconName, onclick: () => void, ariaLabel: string, tooltip?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'toolbar-button toolbar-icon-button btn-icon';
  b.appendChild(createIcon(icon));
  b.onclick = onclick;
  b.title = tooltip ?? ariaLabel;
  b.setAttribute('aria-label', ariaLabel);
  return b;
}

function toggleBtn(
  icon: IconName,
  label: string,
  active: boolean,
  onclick: () => void,
  tooltip?: string,
): HTMLButtonElement {
  const b = btn(icon, label, onclick, tooltip, { classes: ['toolbar-toggle-button'] });
  if (icon === 'xml') {
    setBeginnerTooltip(b, 'toolbar-toggle-xml');
  } else if (icon === 'strings') {
    setBeginnerTooltip(b, 'toolbar-toggle-strings');
  }
  if (active) {
    b.classList.add('is-active');
    b.setAttribute('aria-pressed', 'true');
  } else {
    b.setAttribute('aria-pressed', 'false');
  }
  return b;
}

function sep(): HTMLElement {
  const s = document.createElement('div');
  s.className = 'toolbar-separator';
  return s;
}
