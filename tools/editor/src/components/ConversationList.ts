// P.A.N.D.A. Conversation Editor — Conversation List (Left Panel)

import { requestFlowCenter } from '../lib/flow-navigation';
import { store } from '../lib/state';
import { setButtonContent } from './icons';
import { createOnboardingNudge } from './Onboarding';

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
    item.onclick = (e) => {
      // Don't select if clicking action buttons
      if ((e.target as HTMLElement).closest('.conv-actions')) return;
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
        if (confirm(`Delete conversation ${conv.id}: "${conversationLabel}"?`)) {
          store.deleteConversation(conv.id);
        }
      }
    };

    const id = document.createElement('span');
    id.className = 'conv-id';
    id.textContent = String(conv.id);

    const label = document.createElement('span');
    label.className = 'conv-label';
    label.textContent = conversationLabel;

    const actions = document.createElement('div');
    actions.className = 'conv-actions';

    const locateBtn = document.createElement('button');
    locateBtn.className = 'btn-icon btn-icon-labeled';
    setButtonContent(locateBtn, 'locate', 'Center');
    locateBtn.title = 'Center selection in flow editor';
    locateBtn.setAttribute('aria-label', `Center ${conversationLabel} in the flow editor`);
    locateBtn.onclick = (e) => {
      e.stopPropagation();
      store.selectConversation(conv.id);
      const selectedTurn = state.selectedConversationId === conv.id ? state.selectedTurnNumber : null;
      requestFlowCenter({
        conversationId: conv.id,
        turnNumber: selectedTurn,
        fit: selectedTurn == null,
      });
    };

    const dupBtn = document.createElement('button');
    dupBtn.className = 'btn-icon btn-icon-labeled';
    setButtonContent(dupBtn, 'duplicate', 'Duplicate');
    dupBtn.title = 'Duplicate';
    dupBtn.setAttribute('aria-label', `Duplicate ${conversationLabel}`);
    dupBtn.onclick = (e) => { e.stopPropagation(); store.duplicateConversation(conv.id); };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-icon-labeled btn-danger';
    setButtonContent(delBtn, 'delete', 'Delete');
    delBtn.title = 'Delete';
    delBtn.setAttribute('aria-label', `Delete ${conversationLabel}`);
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete conversation ${conv.id}: "${conversationLabel}"?`)) {
        store.deleteConversation(conv.id);
      }
    };

    actions.appendChild(locateBtn);
    actions.appendChild(dupBtn);
    actions.appendChild(delBtn);

    // Metadata line
    const meta = document.createElement('div');
    meta.className = 'conv-meta';
    const totalChoices = conv.turns.reduce((sum, t) => sum + t.choices.length, 0);
    meta.textContent = `${conv.turns.length} turn${conv.turns.length !== 1 ? 's' : ''} · ${totalChoices} choice${totalChoices !== 1 ? 's' : ''}`;
    if (conv.preconditions.length > 0) {
      meta.textContent += ` · ${conv.preconditions.length} cond`;
    }

    item.appendChild(id);
    const textWrap = document.createElement('div');
    textWrap.style.cssText = 'flex:1; overflow:hidden; min-width:0;';
    textWrap.appendChild(label);
    textWrap.appendChild(meta);
    item.appendChild(textWrap);
    item.appendChild(actions);
    list.appendChild(item);
  }

  container.appendChild(list);
}
