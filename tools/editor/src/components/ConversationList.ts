// P.A.N.D.A. Conversation Editor — Conversation List (Left Panel)

import { requestFlowCenter } from '../lib/flow-navigation';
import { store } from '../lib/state';
import { createOnboardingNudge } from './Onboarding';

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
      body: 'Kick off the onboarding flow with a blank project, import existing XML, or open the bundled sample pack to explore a complete conversation.',
    }));
    return;
  }

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
    item.setAttribute('aria-label', `${conversationLabel}, ${conv.turns.length} turns`);
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

    item.append(id, textWrap);
    list.appendChild(item);
  }

  container.appendChild(list);
}
