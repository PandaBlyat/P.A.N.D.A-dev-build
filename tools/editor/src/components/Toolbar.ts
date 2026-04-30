// P.A.N.D.A. Conversation Editor — Toolbar

import { requestFlowCenter } from '../lib/flow-navigation';
import { store, type FlowGraphicsQuality } from '../lib/state';
import { createTurnDisplayLabeler } from '../lib/turn-labels';
import { exportProjectJson, exportXml, importFromXml, importFromJson } from '../lib/project-io';
import { openSharePanel } from './SharePanel';
import { openHelpModal } from './HelpModal';
import { openSupportPanel } from './SupportPanel';
import { openBugReportsPanel } from './BugReportsPanel';
import { createIcon, setButtonContent, type IconName } from './icons';
import { clearDraft } from '../lib/draft-storage';
import { createEmptyProject } from '../lib/xml-export';
import { openPublicProfile, renderProfileBadge } from './ProfileBadge';
import { openLeaderboardOverlay } from './LeaderboardOverlay';
import { openRoadMapModal } from './RoadMapModal';
import { canOpenPrivilegeModal, openPrivilegeModal } from './PrivilegeModal';
import { areBeginnerTooltipsDisabled, setBeginnerTooltip, setBeginnerTooltipsDisabled } from '../lib/beginner-tooltips';
import { getActiveEditorLocalUserId, getStoredUsername, type ActiveEditorUser, type RecentVisitor, type UserProfile } from '../lib/api-client';
import { createCollabRoster } from './CollabRoster';
import { createUiText, languageFlag, languageLabel, otherLanguage, type UiLanguage } from '../lib/ui-language';

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
  kind?: 'button';
  icon: IconName;
  label: string;
  title?: string;
  onclick: () => void;
  disabled?: boolean;
};

type OverflowCustomAction = {
  kind: 'custom';
  render: () => HTMLElement;
};

type OverflowMenuAction = OverflowAction | OverflowCustomAction;

const GRAPHICS_QUALITY_OPTIONS: FlowGraphicsQuality[] = ['low', 'medium', 'high'];

function graphicsQualityLabel(quality: FlowGraphicsQuality): string {
  if (quality === 'low') return 'Low';
  if (quality === 'medium') return 'Med';
  return 'High';
}

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
  const ui = createUiText(state.uiLanguage);
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
  subtitle.textContent = ui('Editor', 'Редактор');

  titleText.append(titlePrimary, subtitle);
  title.append(brandIcon, titleText);
  brandCopy.append(title);
  branding.appendChild(brandCopy);

  const openBtn = btn('open', ui('Open', 'Открыть'), importFromJson, ui('Open a saved .panda/.json project or import a PANDA XML file', 'Открыть сохранённый .panda/.json проект или импортировать PANDA XML файл'));
  setBeginnerTooltip(openBtn, 'toolbar-open');
  const saveBtn = btn('save', ui('Save', 'Сохранить'), exportProjectJson, ui('Save as .panda project file (preserves editor data)', 'Сохранить как .panda файл проекта (сохраняет данные редактора)'));
  setBeginnerTooltip(saveBtn, 'toolbar-save');
  const importBtn = btn('import', ui('Import', 'Импорт'), importFromXml, ui('Import stories from an existing game XML file', 'Импортировать истории из существующего XML файла игры'));
  setBeginnerTooltip(importBtn, 'toolbar-import');
  const exportXmlBtn = btn('export', ui('Export XML', 'Экспорт XML'), exportXml, ui('Export as game-ready XML file for S.T.A.L.K.E.R. Anomaly', 'Экспортировать как XML, готовый для S.T.A.L.K.E.R. Anomaly'), {
    classes: ['btn-subtle'],
  });
  setBeginnerTooltip(exportXmlBtn, 'toolbar-export-xml');
  const communityBtn = btn('share', ui('Community', 'Сообщество'), openSharePanel, ui('Browse, import, and publish community stories', 'Просматривать, импортировать и публиковать истории сообщества'), {
    classes: ['btn-community', 'toolbar-button-primary'],
  });
  setBeginnerTooltip(communityBtn, 'toolbar-community');
  const supportBtn = btn('support', ui('Support', 'Поддержка'), openSupportPanel, ui('Support the Creator', 'Поддержать автора'), {
    classes: ['toolbar-support-trigger'],
  });
  let leadersBtn: HTMLButtonElement;
  leadersBtn = btn('trophy', ui('Leaders', 'Лидеры'), () => openLeaderboardOverlay(leadersBtn), ui('Open the community leaderboard', 'Открыть таблицу лидеров сообщества'), {
    classes: ['toolbar-leaders-trigger'],
  });
  let roadmapBtn: HTMLButtonElement;
  roadmapBtn = btn('map', ui('RoadMap', 'Дорожная карта'), () => openRoadMapModal(roadmapBtn), ui('View the P.A.N.D.A. editor development roadmap and upvote features', 'Посмотреть дорожную карту развития P.A.N.D.A. и голосовать за фичи'), {
    classes: ['toolbar-roadmap-trigger'],
  });
  const helpBtn = btn('help', '?', openHelpModal, ui('New here? Open the quick-start guide to preconditions, dynamic references, outcomes, and story design.', 'Нужна помощь? Открыть быстрый старт по preconditions, dynamic references, outcomes и дизайну истории.'), {
    classes: ['toolbar-help-trigger'],
    ariaLabel: ui('Open P.A.N.D.A. quick-start guide', 'Открыть быстрый старт P.A.N.D.A.'),
    icon: null,
  });
  setBeginnerTooltip(helpBtn, 'toolbar-help');
  const reportsBtn = btn('bug', ui('Reports', 'Отчёты'), openBugReportsPanel, ui('Report editor bugs or read existing reports', 'Сообщить об ошибках или читать существующие отчёты'), {
    classes: ['toolbar-report-trigger'],
  });
  const loginAction = getLoginAction();
  const loginBtn = loginAction
    ? btn('user', ui('Log In', 'Войти'), loginAction, ui('Log in or create a callsign to track your XP and level in the Zone.', 'Войти или создать позывной для отслеживания XP и уровня в Зоне.'), {
      classes: ['btn-community', 'toolbar-button-primary'],
    })
    : null;
  const handleReset = (): void => {
    if (state.dirty && !window.confirm(ui('You have unsaved changes. Clear workspace and return to the intro?', 'Есть несохранённые изменения. Очистить рабочую область и вернуться к интро?'))) return;
    clearDraft();
    store.loadProject(createEmptyProject('stalker'), new Map());
  };
  const tooltipToggleAction: OverflowAction = {
    icon: 'help',
    label: areBeginnerTooltipsDisabled() ? ui('Enable Tooltips', 'Включить подсказки') : ui('Disable Tooltips', 'Выключить подсказки'),
    title: ui('Toggle editor tooltips', 'Переключить подсказки редактора'),
    onclick: () => setBeginnerTooltipsDisabled(!areBeginnerTooltipsDisabled()),
  };
  const occlusionToggleAction: OverflowAction = {
    icon: 'eye',
    label: state.flowOcclusionEnabled ? ui('Disable Occlusion', 'Отключить отсечение') : ui('Enable Occlusion', 'Включить отсечение'),
    title: state.flowOcclusionEnabled
      ? ui('Stop hiding offscreen branches', 'Не скрывать удалённые ветки')
      : ui('Hide far offscreen branches for faster large graphs', 'Скрывать дальние ветки для ускорения больших графов'),
    onclick: () => store.toggleFlowOcclusion(),
  };
  const graphicsQualityAction: OverflowCustomAction = {
    kind: 'custom',
    render: () => createGraphicsQualityPicker(state.flowGraphicsQuality),
  };
  const privilegeAction: OverflowAction | null = canOpenPrivilegeModal()
    ? { icon: 'user', label: ui('Privilege', 'Права'), title: ui('Set editor admins', 'Назначить админов редактора'), onclick: openPrivilegeModal }
    : null;
  const languageSwitcher = createLanguageSwitcher(state.uiLanguage);

  if (!isCompact) {
    const leftZone = document.createElement('div');
    leftZone.className = 'toolbar-zone toolbar-zone-left';
    leftZone.appendChild(branding);


    const centerZone = document.createElement('div');
    centerZone.className = 'toolbar-zone toolbar-zone-center';

    const projectGroup = document.createElement('div');
    projectGroup.className = 'toolbar-group toolbar-group-project';
    projectGroup.append(openBtn, importBtn, saveBtn, exportXmlBtn, communityBtn, languageSwitcher, reportsBtn, helpBtn);
    centerZone.appendChild(projectGroup);

    const rightZone = document.createElement('div');
    rightZone.className = 'toolbar-zone toolbar-zone-right';

    const search = renderQuickSearch();
    rightZone.appendChild(search);

    if (state.advancedMode) {
      const viewGroup = document.createElement('div');
      viewGroup.className = 'toolbar-group toolbar-group-segmented';
      viewGroup.appendChild(toggleBtn(
        'xml',
        ui('XML', 'XML'),
        state.showXmlPreview,
        () => store.toggleXmlPreview(),
        state.showXmlPreview ? ui('Hide the live XML preview panel', 'Скрыть живую XML-панель') : ui('Show the live XML preview panel', 'Показать живую XML-панель'),
      ));
      viewGroup.appendChild(toggleBtn(
        'strings',
        ui('Strings', 'Строки'),
        state.showSystemStringsPanel,
        () => store.toggleSystemStringsPanel(),
        state.showSystemStringsPanel ? ui('Hide the shared system strings manager', 'Скрыть менеджер общих строк') : ui('Show the shared system strings manager', 'Показать менеджер общих строк'),
      ));
      rightZone.appendChild(viewGroup);
    }

    rightZone.append(roadmapBtn, leadersBtn, supportBtn);

    rightZone.appendChild(createOverflowMenu(ui('More', 'Ещё'), [
      occlusionToggleAction,
      graphicsQualityAction,
      tooltipToggleAction,
      ...(privilegeAction ? [privilegeAction] : []),
      { icon: 'map', label: ui('RoadMap', 'Дорожная карта'), title: roadmapBtn.title, onclick: () => openRoadMapModal(null) },
      { icon: 'trophy', label: ui('Leaders', 'Лидеры'), title: leadersBtn.title, onclick: () => openLeaderboardOverlay(null) },
      { icon: 'bug', label: ui('Reports', 'Отчёты'), title: reportsBtn.title, onclick: openBugReportsPanel },
      { icon: 'help', label: ui('Help', 'Помощь'), title: helpBtn.title, onclick: openHelpModal },
      { icon: 'brand', label: ui('Reset Intro', 'Сбросить интро'), title: ui('Clear workspace and show the intro sequence', 'Очистить рабочую область и показать интро'), onclick: handleReset },
    ]));

    const profileBadge = renderProfileBadge();
    const collabRoster = createCollabRoster();
    if (collabRoster) {
      rightZone.appendChild(collabRoster);
    }
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
  const collabRoster = createCollabRoster();
  if (collabRoster) {
    projectTier.appendChild(collabRoster);
  }

  const fileGroup = document.createElement('div');
  fileGroup.className = 'toolbar-group toolbar-group-project';
  if (isMobile) {
    const moreBtn = btn('help', ui('More', 'Ещё'), () => options.onOpenMobileSheet?.('more'), ui('Open file, export, and editor actions', 'Открыть действия файла, экспорта и редактора'), {
      icon: null,
    });
    moreBtn.classList.add('toolbar-mobile-more-button');
    setBeginnerTooltip(moreBtn, 'toolbar-more');
    fileGroup.append(
      communityBtn,
      languageSwitcher,
      moreBtn,
    );
    projectTier.appendChild(fileGroup);
    toolbar.appendChild(projectTier);
    return toolbar;
  }

  if (isCompact) {
    const projectOverflowActions: OverflowMenuAction[] = [];
    projectOverflowActions.push(
      occlusionToggleAction,
      graphicsQualityAction,
      tooltipToggleAction,
      { icon: 'import', label: ui('Import XML', 'Импорт XML'), title: importBtn.title, onclick: importFromXml },
      { icon: 'share', label: ui('Community', 'Сообщество'), title: communityBtn.title, onclick: openSharePanel },
      { icon: 'bug', label: ui('Reports', 'Отчёты'), title: reportsBtn.title, onclick: openBugReportsPanel },
    );

    fileGroup.appendChild(openBtn);
    fileGroup.appendChild(saveBtn);
    fileGroup.appendChild(exportXmlBtn);
    fileGroup.appendChild(reportsBtn);
    fileGroup.appendChild(helpBtn);
    fileGroup.appendChild(languageSwitcher);
    fileGroup.appendChild(createOverflowMenu(ui('More', 'Ещё'), projectOverflowActions));
  } else {
    fileGroup.appendChild(openBtn);
    fileGroup.appendChild(importBtn);
    fileGroup.appendChild(sep());
    fileGroup.appendChild(saveBtn);
    fileGroup.appendChild(exportXmlBtn);
    fileGroup.appendChild(sep());
    fileGroup.appendChild(communityBtn);
    fileGroup.appendChild(languageSwitcher);
    fileGroup.appendChild(reportsBtn);
    fileGroup.appendChild(helpBtn);
  }

  projectTier.appendChild(fileGroup);
  toolbar.appendChild(projectTier);

  const editTier = document.createElement('div');
  editTier.className = 'toolbar-tier toolbar-tier-edit';

  const search = renderQuickSearch();
  editTier.appendChild(search);

  toolbar.appendChild(editTier);

  const utilityTier = document.createElement('div');
  utilityTier.className = 'toolbar-tier toolbar-tier-utility';

  if (!isCompact && state.advancedMode) {
    const utilityGroup = document.createElement('div');
    utilityGroup.className = 'toolbar-group toolbar-group-segmented';
    utilityGroup.appendChild(toggleBtn(
      'xml',
      ui('XML', 'XML'),
      state.showXmlPreview,
      () => store.toggleXmlPreview(),
      state.showXmlPreview ? 'Hide the live XML preview panel' : 'Show the live XML preview panel',
    ));
    utilityGroup.appendChild(toggleBtn(
      'strings',
      ui('Strings', 'Строки'),
      state.showSystemStringsPanel,
      () => store.toggleSystemStringsPanel(),
      state.showSystemStringsPanel ? 'Hide the shared system strings manager' : 'Show the shared system strings manager',
    ));
    utilityTier.appendChild(utilityGroup);
  }

    utilityTier.appendChild(createLanguageSwitcher(state.uiLanguage));
    utilityTier.appendChild(supportBtn);
    utilityTier.appendChild(createOverflowMenu(ui('More', 'Ещё'), [
      occlusionToggleAction,
      graphicsQualityAction,
      tooltipToggleAction,
      ...(privilegeAction ? [privilegeAction] : []),
      { icon: 'map', label: ui('RoadMap', 'Дорожная карта'), title: roadmapBtn.title, onclick: () => openRoadMapModal(null) },
    { icon: 'help', label: ui('Help', 'Помощь'), title: helpBtn.title, onclick: openHelpModal },
    { icon: 'brand', label: ui('Reset Intro', 'Сбросить интро'), title: ui('Clear workspace and show the intro sequence', 'Очистить рабочую область и показать интро'), onclick: handleReset },
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
  const ui = createUiText(store.get().uiLanguage);
  const wrapper = document.createElement('div');
  wrapper.className = 'toolbar-search';

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'toolbar-search-input';
  input.placeholder = ui('Jump to convo, turn, string…', 'Перейти к диалогу, ходу, строке…');
  input.title = ui('Quick navigation across stories, choices, commands, and system strings (Ctrl/Cmd+P)', 'Быстрая навигация по историям, выборам, командам и системным строкам (Ctrl/Cmd+P)');
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

function createGraphicsQualityPicker(currentQuality: FlowGraphicsQuality): HTMLElement {
  const row = document.createElement('label');
  row.className = 'toolbar-overflow-select-row';
  const ui = createUiText(store.get().uiLanguage);

  const text = document.createElement('span');
  text.className = 'toolbar-overflow-select-label';
  text.textContent = ui('Graphics', 'Графика');

  const select = document.createElement('select');
  select.className = 'toolbar-overflow-select';
  select.title = ui('Editor graphics quality', 'Качество графики редактора');
  select.setAttribute('aria-label', ui('Editor graphics quality', 'Качество графики редактора'));
  for (const quality of GRAPHICS_QUALITY_OPTIONS) {
    const option = document.createElement('option');
    option.value = quality;
    option.textContent = graphicsQualityLabel(quality);
    option.selected = quality === currentQuality;
    select.appendChild(option);
  }
  select.onchange = () => {
    store.setFlowGraphicsQuality(select.value as FlowGraphicsQuality);
  };

  row.append(text, select);
  return row;
}

function createOverflowMenu(label: string, actions: OverflowMenuAction[]): HTMLElement {
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
    if (action.kind === 'custom') {
      menu.appendChild(action.render());
      continue;
    }

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'toolbar-overflow-item';
    setButtonContent(item, action.icon, action.label);
    item.title = action.title ?? action.label;
    item.disabled = Boolean(action.disabled);
    setBeginnerTooltip(item, action.label === 'Reset Intro' || action.label === 'Сбросить интро' ? 'toolbar-reset-intro' : action.label === 'Help' || action.label === 'Помощь' ? 'toolbar-help' : 'toolbar-more');
    item.onclick = () => {
      details.open = false;
      action.onclick();
    };
    menu.appendChild(item);
  }

  details.appendChild(menu);
  return details;
}

function createLanguageSwitcher(currentLanguage: UiLanguage): HTMLElement {
  const details = document.createElement('details');
  details.className = 'toolbar-overflow toolbar-language-switcher';

  const summary = document.createElement('summary');
  summary.className = 'toolbar-button toolbar-overflow-toggle';
  summary.textContent = `${languageFlag(currentLanguage)} ${languageLabel(currentLanguage)}`;
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-label', languageLabel(currentLanguage));
  summary.title = languageLabel(currentLanguage);
  details.appendChild(summary);

  const menu = document.createElement('div');
  menu.className = 'toolbar-overflow-menu';

  const targetLanguage = otherLanguage(currentLanguage);
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'toolbar-overflow-item';
  item.textContent = `${languageFlag(targetLanguage)} ${languageLabel(targetLanguage)}`;
  item.title = languageLabel(targetLanguage);
  item.onclick = () => {
    details.open = false;
    store.setUiLanguage(targetLanguage);
  };
  menu.appendChild(item);

  details.appendChild(menu);
  return details;
}

function formatStatus(convCount: number, stringCount: number, compact: boolean, dirty: boolean): string {
  const ui = createUiText(store.get().uiLanguage);
  if (compact) {
    return ui(
      `${convCount} conv • ${stringCount} strings${dirty ? ' • unsaved' : ''}`,
      `${convCount} диал • ${stringCount} строк${dirty ? ' • не сохранено' : ''}`,
    );
  }
  return ui(
    `${convCount} stor${convCount !== 1 ? 'ies' : 'y'} • ${stringCount} strings${dirty ? ' • unsaved' : ''}`,
    `${convCount} ${convCount === 1 ? 'история' : convCount < 5 ? 'истории' : 'историй'} • ${stringCount} строк${dirty ? ' • не сохранено' : ''}`,
  );
}

function renderVisitorCounter(compact?: boolean): HTMLElement | null {
  const count = (globalThis as any).__pandaVisitorCount ?? 0;
  const recentVisitors = ((globalThis as any).__pandaRecentVisitors as RecentVisitor[] | undefined) ?? [];
  if (count <= 0) return null;
  const ui = createUiText(store.get().uiLanguage);

  const details = document.createElement('details');
  details.className = 'toolbar-overflow toolbar-visitors';

  const summary = document.createElement('summary');
  summary.className = 'toolbar-visitor-counter';
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-label', ui('Show recent visitors', 'Показать последних посетителей'));
  summary.title = ui('Total unique visitors to the P.A.N.D.A. editor', 'Всего уникальных посетителей редактора P.A.N.D.A.');

  const icon = createIcon('eye');
  const label = document.createElement('span');
  label.textContent = compact
    ? new Intl.NumberFormat().format(count)
    : ui(`${new Intl.NumberFormat().format(count)} visitor${count !== 1 ? 's' : ''}`, `${new Intl.NumberFormat().format(count)} посетител${count === 1 ? 'ь' : count < 5 ? 'я' : 'ей'}`);

  summary.append(icon, label);

  const menu = document.createElement('div');
  menu.className = 'toolbar-overflow-menu toolbar-visitors-menu';

  const title = document.createElement('div');
  title.className = 'toolbar-active-users-title';
  title.textContent = ui('Last 10 Visitors', 'Последние 10 посетителей');
  menu.appendChild(title);

  if (recentVisitors.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'toolbar-active-users-empty';
    empty.textContent = ui('No visitor history yet.', 'История посещений пуста.');
    menu.appendChild(empty);
  } else {
    const uniqueVisitors: RecentVisitor[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    for (const visitor of recentVisitors) {
      const idKey = visitor.userId;
      const nameKey = visitor.username?.toLowerCase() ?? '';
      if (seenIds.has(idKey)) continue;
      if (nameKey && seenNames.has(nameKey)) continue;
      seenIds.add(idKey);
      if (nameKey) seenNames.add(nameKey);
      uniqueVisitors.push(visitor);
      if (uniqueVisitors.length >= 10) break;
    }

    const list = document.createElement('div');
    list.className = 'toolbar-active-users-list toolbar-visitors-list';
    uniqueVisitors.forEach((visitor, index) => {
      list.appendChild(createVisitorListItem(visitor, index, details));
    });
    menu.appendChild(list);
  }

  const note = document.createElement('div');
  note.className = 'toolbar-visitors-note';
  note.textContent = ui('Unique visitors with last visit date.', 'Уникальные посетители с датой последнего визита.');
  menu.appendChild(note);

  details.append(summary, menu);
  return details;
}

function renderActiveUserCounter(compact?: boolean): HTMLElement | null {
  const rawCount = (globalThis as any).__pandaActiveUserCount ?? 0;
  const rawUsernames = ((globalThis as any).__pandaActiveUsernames as string[] | undefined) ?? [];
  const rawUsers = ((globalThis as any).__pandaActiveUsers as ActiveEditorUser[] | undefined) ?? [];
  const localUsername = getStoredUsername();
  const localUserId = getActiveEditorLocalUserId();
  const localProfile = (globalThis as any).__pandaUserProfile as UserProfile | null | undefined;
  const remoteUsers = normalizeToolbarActiveUsers(rawUsers, rawUsernames);
  if (localUsername && !remoteUsers.some(user => user.username === localUsername || user.userId === localUserId)) {
    remoteUsers.unshift({ userId: localUserId, username: localUsername, lastSeenAt: '', publisherId: localProfile?.publisher_id ?? null });
  }
  const count = Math.max(rawCount, remoteUsers.length);
  const ui = createUiText(store.get().uiLanguage);

  const details = document.createElement('details');
  details.className = 'toolbar-overflow toolbar-active-users';

  const summary = document.createElement('summary');
  summary.className = 'toolbar-visitor-counter toolbar-active-user-counter';
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-label', ui('Show active users', 'Показать активных пользователей'));
  summary.title = ui('Current active users in the P.A.N.D.A. editor', 'Текущие активные пользователи редактора P.A.N.D.A.');

  const icon = createIcon('user');
  const label = document.createElement('span');
  label.textContent = compact
    ? new Intl.NumberFormat().format(count)
    : ui(`${new Intl.NumberFormat().format(count)} active`, `${new Intl.NumberFormat().format(count)} активных`);
  summary.append(icon, label);

  const menu = document.createElement('div');
  menu.className = 'toolbar-overflow-menu toolbar-active-users-menu';

  const title = document.createElement('div');
  title.className = 'toolbar-active-users-title';
  title.textContent = ui('Active Users', 'Активные пользователи');
  menu.appendChild(title);

  const users = remoteUsers;

  if (users.length === 0 && count === 0) {
    const empty = document.createElement('div');
    empty.className = 'toolbar-active-users-empty';
    empty.textContent = ui('No active users.', 'Нет активных пользователей.');
    menu.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'toolbar-active-users-list';
    const visibleUsers = users.slice(0, 12);
    visibleUsers.forEach((user, index) => {
      const item = user.publisherId ? document.createElement('button') : document.createElement('div');
      const isGuest = !user.username;
      item.className = `toolbar-active-users-item${isGuest ? ' toolbar-active-users-item-guest' : ''}`;
      if (item instanceof HTMLButtonElement) {
        item.type = 'button';
        item.classList.add('toolbar-active-users-profile-link');
        item.title = ui(`Open ${user.username ?? 'user'} profile`, `Открыть профиль ${user.username ?? 'пользователя'}`);
        item.onclick = () => {
          details.open = false;
          void openPublicProfile(user.publisherId!, item);
        };
      }
      const dot = document.createElement('span');
      dot.className = 'toolbar-active-users-dot';
      const name = document.createElement('span');
      name.className = 'toolbar-active-users-name';
      const isLocal = user.userId === localUserId || (localUsername && user.username === localUsername);
      name.textContent = `${getActiveUserDisplayName(user, index)}${isLocal ? ui(' (you)', ' (вы)') : ''}`;
      item.append(dot, name);
      list.appendChild(item);
    });
    const hiddenKnownUsers = Math.max(0, users.length - visibleUsers.length);
    const hiddenCount = Math.max(hiddenKnownUsers, count - visibleUsers.length);
    if (hiddenCount > 0) {
      const more = document.createElement('div');
      more.className = 'toolbar-active-users-empty';
      more.textContent = ui(`+${hiddenCount} more`, `+${hiddenCount} ещё`);
      list.appendChild(more);
    }
    menu.appendChild(list);
  }

  details.append(summary, menu);
  return details;
}

function createVisitorListItem(visitor: RecentVisitor, index: number, details: HTMLDetailsElement): HTMLElement {
  const ui = createUiText(store.get().uiLanguage);
  const item = visitor.publisherId ? document.createElement('button') : document.createElement('div');
  item.className = 'toolbar-active-users-item toolbar-visitors-item';
  if (!visitor.username) item.classList.add('toolbar-active-users-item-guest');
  if (item instanceof HTMLButtonElement) {
    item.type = 'button';
    item.classList.add('toolbar-active-users-profile-link');
    item.title = ui(`Open ${visitor.username ?? 'visitor'} profile`, `Открыть профиль ${visitor.username ?? 'посетителя'}`);
    item.onclick = () => {
      details.open = false;
      void openPublicProfile(visitor.publisherId!, item);
    };
  }

  const dot = document.createElement('span');
  dot.className = 'toolbar-active-users-dot toolbar-visitors-dot';

  const copy = document.createElement('span');
  copy.className = 'toolbar-visitors-copy';

  const name = document.createElement('span');
  name.className = 'toolbar-active-users-name';
  name.textContent = visitor.username || getVisitorDisplayName(visitor, index);

  const time = document.createElement('span');
  time.className = 'toolbar-visitors-time';
  time.textContent = formatRecentVisitorTime(visitor.lastSeenAt);
  time.title = formatRecentVisitorExactTime(visitor.lastSeenAt);

  copy.append(name, time);
  item.append(dot, copy);
  return item;
}

function normalizeToolbarActiveUsers(users: ActiveEditorUser[], usernames: string[]): ActiveEditorUser[] {
  const normalized: ActiveEditorUser[] = [];
  const seen = new Set<string>();
  const seenUsernames = new Set<string>();
  for (const user of users) {
    const userId = user.userId?.trim();
    if (!userId || seen.has(userId)) continue;
    const username = user.username?.trim() || null;
    const usernameKey = username?.toLowerCase() ?? '';
    if (usernameKey && seenUsernames.has(usernameKey)) continue;
    seen.add(userId);
    if (usernameKey) seenUsernames.add(usernameKey);
    normalized.push({
      userId,
      username,
      lastSeenAt: user.lastSeenAt,
      publisherId: user.publisherId?.trim() || null,
    });
  }
  for (const username of usernames.map(name => name.trim()).filter(Boolean)) {
    const userId = `username:${username.toLowerCase()}`;
    const usernameKey = username.toLowerCase();
    if (seen.has(userId) || seenUsernames.has(usernameKey)) continue;
    seen.add(userId);
    seenUsernames.add(usernameKey);
    normalized.push({ userId, username, lastSeenAt: '' });
  }
  return normalized;
}

function getActiveUserDisplayName(user: ActiveEditorUser, index: number): string {
  if (user.username) return user.username;
  const suffix = user.userId.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
  return suffix ? `Guest ${suffix}` : `Guest ${index + 1}`;
}

function getVisitorDisplayName(visitor: RecentVisitor, index: number): string {
  const suffix = visitor.userId.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
  return suffix ? `Visitor ${suffix}` : `Visitor ${index + 1}`;
}

function formatRecentVisitorTime(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return 'Unknown date';
  const now = new Date();
  const visit = new Date(timestamp);
  const sameDay = now.toDateString() === visit.toDateString();
  if (sameDay) {
    return `Today, ${visit.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === visit.toDateString()) {
    return `Yesterday, ${visit.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  const sameYear = now.getFullYear() === visit.getFullYear();
  return visit.toLocaleDateString(undefined, sameYear
    ? { month: 'short', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatRecentVisitorExactTime(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return 'Unknown time';
  return new Date(timestamp).toLocaleString();
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

