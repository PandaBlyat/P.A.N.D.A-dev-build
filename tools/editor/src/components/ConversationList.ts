// P.A.N.D.A. Conversation Editor — Conversation List (Left Panel)

import { requestFlowCenter } from '../lib/flow-navigation';
import { store } from '../lib/state';
import { FACTION_IDS } from '../lib/constants';
import { FACTION_COLORS } from '../lib/faction-colors';
import { FACTION_DISPLAY_NAMES, getConversationFaction } from '../lib/types';
import { createValidationWorkspaceContent } from './ValidationBar';
import { createOnboardingNudge } from './Onboarding';
import { setButtonContent } from './icons';

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
  const conversationLabel = conversation.label || `Conversation ${conversation.id}`;
  if (confirm(`Delete conversation ${conversation.id}: "${conversationLabel}"?`)) {
    store.deleteConversation(conversationId);
  }
}

export function renderConversationList(container: HTMLElement): void {
  const state = store.get();
  const convs = state.project.conversations;

  if (convs.length === 0) {
    container.replaceChildren(createOnboardingNudge({
      title: 'No conversations yet',
      body: 'Kick off the onboarding flow with a blank project, import existing XML, or publish and import shared conversations from the Community Library.',
    }));
    return;
  }

  const shell = document.createElement('div');
  shell.className = 'conversation-list-shell';

  const listRegion = document.createElement('div');
  listRegion.className = 'conversation-list-region';

  const list = document.createElement('ul');
  list.className = 'conv-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Conversations');

  for (const conv of convs) {
    const conversationLabel = conv.label || `Conversation ${conv.id}`;
    const item = document.createElement('li');
    item.className = 'conv-item' + (conv.id === state.selectedConversationId ? ' selected' : '');
    item.tabIndex = 0;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', conv.id === state.selectedConversationId ? 'true' : 'false');
    const conversationFaction = getConversationFaction(conv, state.project.faction);
    item.setAttribute('aria-label', `${conversationLabel}, ${FACTION_DISPLAY_NAMES[conversationFaction]}, ${conv.turns.length} turns`);
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

    const id = document.createElement('span');
    id.className = 'conv-id';
    id.textContent = String(conv.id);

    const label = document.createElement('span');
    label.className = 'conv-label';
    label.textContent = conversationLabel;

    const meta = document.createElement('div');
    meta.className = 'conv-meta';
    const totalChoices = conv.turns.reduce((sum, t) => sum + t.choices.length, 0);
    meta.textContent = `${conv.turns.length} turn${conv.turns.length !== 1 ? 's' : ''} · ${totalChoices} choice${totalChoices !== 1 ? 's' : ''}`;
    if (conv.preconditions.length > 0) {
      meta.textContent += ` · ${conv.preconditions.length} cond`;
    }

    const textWrap = document.createElement('div');
    textWrap.className = 'conv-text';
    textWrap.append(label, meta);

    const controls = document.createElement('div');
    controls.className = 'conv-controls';

    const factionSelect = document.createElement('select');
    factionSelect.className = 'conv-faction-select toolbar-select-quiet';
    factionSelect.title = "Set this conversation's faction";
    factionSelect.setAttribute('aria-label', `Set faction for ${conversationLabel}`);
    for (const factionId of FACTION_IDS) {
      const option = document.createElement('option');
      option.value = factionId;
      option.textContent = FACTION_DISPLAY_NAMES[factionId];
      option.selected = factionId === conversationFaction;
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

    item.append(id, textWrap, controls);
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
  setButtonContent(toggle, state.showValidationPanel ? 'close' : 'warning', `Errors x${issueCount}`);
  toggle.title = issueCount > 0
    ? (state.showValidationPanel ? 'Hide current issues' : `Show current issues (${issueCount})`)
    : 'No current issues';
  toggle.disabled = issueCount === 0;
  toggle.onclick = () => store.toggleValidationPanel();
  issuesFooter.appendChild(toggle);

  if (state.showValidationPanel && issueCount > 0) {
    const issuesPanel = document.createElement('section');
    issuesPanel.className = 'conversation-issues-panel validation-drawer';
    issuesPanel.setAttribute('aria-label', 'Current issues');
    issuesPanel.appendChild(createValidationWorkspaceContent(state.validationMessages));
    issuesFooter.appendChild(issuesPanel);
  }

  shell.appendChild(issuesFooter);
  container.appendChild(shell);
}
