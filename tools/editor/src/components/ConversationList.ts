// P.A.N.D.A. Conversation Editor — Conversation List (Left Panel)

import { requestFlowCenter } from '../lib/flow-navigation';
import { store } from '../lib/state';
import { createEmptyState, setButtonContent } from './icons';

export function renderConversationList(container: HTMLElement): void {
  const state = store.get();
  const convs = state.project.conversations;

  if (convs.length === 0) {
    container.replaceChildren(createEmptyState(
      'open',
      'No conversations',
      'Use New to create one, or import an XML file to populate the editor.'
    ));
    return;
  }

  const list = document.createElement('ul');
  list.className = 'conv-list';

  for (const conv of convs) {
    const item = document.createElement('li');
    item.className = 'conv-item' + (conv.id === state.selectedConversationId ? ' selected' : '');
    item.onclick = (e) => {
      // Don't select if clicking action buttons
      if ((e.target as HTMLElement).closest('.conv-actions')) return;
      store.selectConversation(conv.id);
    };

    const id = document.createElement('span');
    id.className = 'conv-id';
    id.textContent = String(conv.id);

    const label = document.createElement('span');
    label.className = 'conv-label';
    label.textContent = conv.label || `Conversation ${conv.id}`;

    const actions = document.createElement('div');
    actions.className = 'conv-actions';

    const locateBtn = document.createElement('button');
    locateBtn.className = 'btn-icon btn-icon-labeled';
    setButtonContent(locateBtn, 'locate', 'Center');
    locateBtn.title = 'Center selection in flow editor';
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
    dupBtn.onclick = (e) => { e.stopPropagation(); store.duplicateConversation(conv.id); };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-icon-labeled btn-danger';
    setButtonContent(delBtn, 'delete', 'Delete');
    delBtn.title = 'Delete';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete conversation ${conv.id}: "${conv.label}"?`)) {
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
