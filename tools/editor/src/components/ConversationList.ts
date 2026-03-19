// P.A.N.D.A. Conversation Editor — Conversation List (Left Panel)

import { requestFlowCenter } from '../lib/flow-navigation';
import { store } from '../lib/state';

export function renderConversationList(container: HTMLElement): void {
  const state = store.get();
  const convs = state.project.conversations;

  if (convs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text">No conversations</div>
        <div class="empty-state-hint">Click "+ New" to create one, or import an XML file.</div>
      </div>
    `;
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
    locateBtn.className = 'btn-icon';
    locateBtn.textContent = '\u2316';
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
    dupBtn.className = 'btn-icon';
    dupBtn.textContent = '\u2398'; // copy icon
    dupBtn.title = 'Duplicate';
    dupBtn.onclick = (e) => { e.stopPropagation(); store.duplicateConversation(conv.id); };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon';
    delBtn.textContent = '\u00d7'; // x icon
    delBtn.title = 'Delete';
    delBtn.style.color = 'var(--danger)';
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
    meta.textContent = `${conv.turns.length} turn${conv.turns.length !== 1 ? 's' : ''} \u00b7 ${totalChoices} choice${totalChoices !== 1 ? 's' : ''}`;
    if (conv.preconditions.length > 0) {
      meta.textContent += ` \u00b7 ${conv.preconditions.length} cond`;
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
