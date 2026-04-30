// P.A.N.D.A. Conversation Editor — Conversation List (Left Panel)

import { requestFlowCenter } from '../lib/flow-navigation';
import { store } from '../lib/state';
import { FACTION_IDS } from '../lib/constants';
import { FACTION_COLORS } from '../lib/faction-colors';
import { FACTION_DISPLAY_NAMES, getConversationFaction } from '../lib/types';
import { createValidationWorkspaceContent } from './ValidationBar';
import { createOnboardingNudge } from './Onboarding';
import { createIcon, setButtonContent } from './icons';
import { openPlayPanel } from './PlayPanel';
import { setBeginnerTooltip } from '../lib/beginner-tooltips';
import { getStoredUsername } from '../lib/api-client';
import { openCollabSessionModal } from './CollabSessionModal';
import { createUiText } from '../lib/ui-language';

type ConversationListTab = 'local' | 'collabs';

let activeConversationListTab: ConversationListTab = 'local';

export function centerConversationSelection(conversationId: number): void {
  const currentState = store.get();
  const selectedTurnNumber = currentState.selectedConversationId === conversationId
    ? currentState.selectedTurnNumber
    : null;

  store.selectConversation(conversationId);
  requestFlowCenter({
    conversationId,
    turnNumber: selectedTurnNumber,
    fit: selectedTurnNumber == null,
  });
}

export function duplicateConversationSelection(conversationId: number): void {
  store.duplicateConversation(conversationId);
}

export function deleteConversationSelection(conversationId: number): void {
  const conversation = store.get().project.conversations.find((entry) => entry.id === conversationId);
  if (!conversation) return;
  const ui = createUiText(store.get().uiLanguage);
  const conversationLabel = conversation.label || `Story ${conversation.id}`;
  if (confirm(ui(
    `Delete story ${conversation.id}: "${conversationLabel}"?`,
    `Удалить историю ${conversation.id}: "${conversationLabel}"?`,
  ))) {
    store.deleteConversation(conversationId);
  }
}

export function renderConversationList(container: HTMLElement): void {
  const state = store.get();
  const ui = createUiText(state.uiLanguage);
  const convs = state.project.conversations;
  const collabIds = new Set<number>();
  if (state.collab.conversationId != null) {
    collabIds.add(state.collab.conversationId);
  }
  const hasCollabTab = collabIds.size > 0;
  const selectedIsCollab = state.selectedConversationId != null && collabIds.has(state.selectedConversationId);
  activeConversationListTab = hasCollabTab && selectedIsCollab ? 'collabs' : activeConversationListTab;
  if (!hasCollabTab) activeConversationListTab = 'local';

  if (convs.length === 0) {
    container.replaceChildren(createOnboardingNudge({
      title: ui('No stories yet', 'Пока нет историй'),
      body: ui(
        'Kick off the onboarding flow with a blank project, import existing XML, or publish and import shared stories from the Community Library.',
        'Запусти обучение с пустого проекта, импортируй существующий XML, или публикуй и импортируй истории из Community Library.',
      ),
    }));
    return;
  }

  const shell = document.createElement('div');
  shell.className = 'conversation-list-shell';

  if (hasCollabTab) {
    const tabs = document.createElement('div');
    tabs.className = 'conversation-list-tabs';
    const localCount = convs.filter(conv => !collabIds.has(conv.id)).length;
    const collabCount = convs.filter(conv => collabIds.has(conv.id)).length;
    const createTab = (tab: ConversationListTab, label: string, count: number): HTMLButtonElement => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `conversation-list-tab${activeConversationListTab === tab ? ' is-active' : ''}`;
      button.textContent = `${label} ${count}`;
      button.setAttribute('aria-pressed', activeConversationListTab === tab ? 'true' : 'false');
      button.onclick = () => {
        activeConversationListTab = tab;
        container.replaceChildren();
        renderConversationList(container);
      };
      return button;
    };
    tabs.append(
      createTab('local', ui('Local', 'Локальные'), localCount),
      createTab('collabs', ui('Collabs', 'Совместные'), collabCount),
    );
    shell.appendChild(tabs);
  }

  const listRegion = document.createElement('div');
  listRegion.className = 'conversation-list-region';

  const list = document.createElement('ul');
  list.className = 'conv-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', ui('Stories', 'Истории'));

  const visibleConvs = hasCollabTab
    ? convs.filter(conv => activeConversationListTab === 'collabs' ? collabIds.has(conv.id) : !collabIds.has(conv.id))
    : convs;

  if (visibleConvs.length === 0) {
    const empty = createOnboardingNudge(activeConversationListTab === 'collabs'
      ? {
        title: ui('No collabs yet', 'Пока нет совместных'),
        body: ui(
          'Start or join a multi-user session to keep shared stories separate from local work.',
          'Запусти или присоединись к мультипользовательской сессии, чтобы держать общие истории отдельно от локальной работы.',
        ),
      }
      : {
        title: ui('No local stories', 'Нет локальных историй'),
        body: ui(
          'Current active story is in Collabs. Add or import another story to keep local work separate.',
          'Текущая активная история в "Совместные". Добавь или импортируй другую историю, чтобы держать локальную работу отдельно.',
        ),
      });
    listRegion.appendChild(empty);
    shell.appendChild(listRegion);
    container.appendChild(shell);
    return;
  }

  for (const conv of visibleConvs) {
    const conversationLabel = conv.label || `Story ${conv.id}`;
    const item = document.createElement('li');
    item.className = 'conv-item' + (conv.id === state.selectedConversationId ? ' selected' : '');
    item.tabIndex = 0;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', conv.id === state.selectedConversationId ? 'true' : 'false');
    const conversationFaction = getConversationFaction(conv, state.project.faction);
    item.style.setProperty('--conversation-faction-color', FACTION_COLORS[conversationFaction]);
    item.setAttribute('aria-label', `${conversationLabel}, ${FACTION_DISPLAY_NAMES[conversationFaction]}, ${conv.turns.length} turns`);
    setBeginnerTooltip(item, 'story-select');
    item.onclick = () => {
      store.selectConversation(conv.id);
    };
    item.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        store.selectConversation(conv.id);
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && conv.id === store.get().selectedConversationId) {
        event.preventDefault();
        deleteConversationSelection(conv.id);
      }
    };

    const label = document.createElement('span');
    label.className = 'conv-label';
    label.textContent = conversationLabel;

    const meta = document.createElement('div');
    meta.className = 'conv-meta';
    const totalChoices = conv.turns.reduce((sum, t) => sum + t.choices.length, 0);
    meta.textContent = `${conv.turns.length} turn${conv.turns.length !== 1 ? 's' : ''} · ${totalChoices} choice${totalChoices !== 1 ? 's' : ''} · ${FACTION_DISPLAY_NAMES[conversationFaction]}`;
    if (conv.preconditions.length > 0) {
      meta.textContent += ` · ${conv.preconditions.length} cond`;
    }

    const badges = document.createElement('div');
    badges.className = 'conv-badges';

    const factionBadge = document.createElement('span');
    factionBadge.className = 'conv-faction-pill';
    factionBadge.textContent = FACTION_DISPLAY_NAMES[conversationFaction];
    factionBadge.style.setProperty('--conversation-faction-color', FACTION_COLORS[conversationFaction]);
    badges.appendChild(factionBadge);

    if (conv.turns.length > 0) {
      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'conv-play-btn';
      playBtn.title = ui('Preview story', 'Предпросмотр истории');
      playBtn.append(createIcon('play'), document.createTextNode(ui('Play', 'Играть')));
      playBtn.onpointerdown = (e) => e.stopPropagation();
      playBtn.onclick = (e) => {
        e.stopPropagation();
        openPlayPanel(conv);
      };
      badges.appendChild(playBtn);
    }

    if (getStoredUsername()) {
      const collabBtn = document.createElement('button');
      collabBtn.type = 'button';
      collabBtn.className = 'conv-collab-btn';
      collabBtn.title = ui('Start multi-user session', 'Начать совместную сессию');
      collabBtn.append(createIcon('users'), document.createTextNode(ui('Collab', 'Совместно')));
      collabBtn.onpointerdown = (e) => e.stopPropagation();
      collabBtn.onclick = (e) => {
        e.stopPropagation();
        openCollabSessionModal(conv);
      };
      badges.appendChild(collabBtn);
    }

    const textWrap = document.createElement('div');
    textWrap.className = 'conv-text';
    textWrap.append(label, meta, badges);

    const controls = document.createElement('div');
    controls.className = 'conv-controls';

    const factionSelect = document.createElement('select');
    factionSelect.className = 'conv-faction-select toolbar-select-quiet';
    factionSelect.title = ui("Set this story's faction", 'Выбрать фракцию истории');
    factionSelect.setAttribute('aria-label', ui(`Set faction for ${conversationLabel}`, `Выбрать фракцию для ${conversationLabel}`));
    for (const factionId of FACTION_IDS) {
      const option = document.createElement('option');
      option.value = factionId;
      option.textContent = FACTION_DISPLAY_NAMES[factionId];
      option.selected = factionId === conversationFaction;
      option.style.color = FACTION_COLORS[factionId];
      option.style.backgroundColor = 'var(--bg-darkest)';
      factionSelect.appendChild(option);
    }
    factionSelect.style.color = FACTION_COLORS[conversationFaction];
    factionSelect.onpointerdown = (event) => event.stopPropagation();
    factionSelect.onclick = (event) => event.stopPropagation();
    factionSelect.onchange = (event) => {
      event.stopPropagation();
      const nextFaction = factionSelect.value as typeof FACTION_IDS[number];
      factionSelect.style.color = FACTION_COLORS[nextFaction];
      store.setConversationFaction(conv.id, nextFaction);
    };
    controls.appendChild(factionSelect);

    item.append(textWrap, controls);
    list.appendChild(item);
  }

  listRegion.appendChild(list);
  shell.appendChild(listRegion);

  const issuesFooter = document.createElement('div');
  issuesFooter.className = 'conversation-issues-footer';

  const issueCount = state.validationMessages.length;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn-sm conversation-issues-toggle';
  setButtonContent(toggle, state.showValidationPanel ? 'close' : 'warning', ui(`Errors x${issueCount}`, `Ошибки x${issueCount}`));
  toggle.title = issueCount > 0
    ? (state.showValidationPanel ? ui('Hide current issues', 'Скрыть текущие проблемы') : ui(`Show current issues (${issueCount})`, `Показать текущие проблемы (${issueCount})`))
    : ui('No current issues', 'Нет проблем');
  toggle.disabled = issueCount === 0;
  setBeginnerTooltip(toggle, 'story-issues');
  toggle.onclick = () => store.toggleValidationPanel();
  issuesFooter.appendChild(toggle);

  if (state.showValidationPanel && issueCount > 0) {
    const issuesPanel = document.createElement('section');
    issuesPanel.className = 'conversation-issues-panel validation-drawer';
    issuesPanel.setAttribute('aria-label', ui('Current issues', 'Текущие проблемы'));
    issuesPanel.appendChild(createValidationWorkspaceContent(state.validationMessages));
    issuesFooter.appendChild(issuesPanel);
  }

  shell.appendChild(issuesFooter);
  container.appendChild(shell);
}
