import type { Conversation } from '../lib/types';
import type { CollabParticipant } from '../lib/collab-protocol';
import { inviteCollabUser, subscribeCollabLobby } from '../lib/collab-session';
import { createIcon } from './icons';
import { createUiText } from '../lib/ui-language';
import { store } from '../lib/state';

function ui(en: string, ru: string): string {
  return createUiText(store.get().uiLanguage)(en, ru);
}

export function openCollabSessionModal(conversation: Conversation): void {
  const existing = document.querySelector('.collab-session-overlay');
  existing?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'username-modal-overlay collab-session-overlay';

  const card = document.createElement('section');
  card.className = 'username-modal-card collab-session-card';

  const header = document.createElement('div');
  header.className = 'collab-session-header';
  const title = document.createElement('h2');
  title.textContent = ui('Pair Collab', 'Совместная работа');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'icon-btn';
  close.title = ui('Close', 'Закрыть');
  close.appendChild(createIcon('close'));
  close.onclick = () => overlay.remove();
  header.append(title, close);

  const subtitle = document.createElement('p');
  subtitle.className = 'collab-session-subtitle';
  subtitle.textContent = conversation.label;

  const list = document.createElement('div');
  list.className = 'collab-user-list';

  const renderUsers = (users: CollabParticipant[]) => {
    list.replaceChildren();
    if (!users.length) {
      const empty = document.createElement('p');
      empty.className = 'collab-empty';
      empty.textContent = ui('No online writers.', 'Нет авторов онлайн.');
      list.appendChild(empty);
      return;
    }
    for (const user of users) {
      const row = document.createElement('div');
      row.className = 'collab-user-row';
      const name = document.createElement('span');
      name.textContent = user.username || user.publisherId;
      const status = document.createElement('span');
      status.className = 'collab-invite-status';
      const invite = document.createElement('button');
      invite.type = 'button';
      invite.className = 'primary-btn';
      invite.append(createIcon('users'), document.createTextNode(ui('Invite', 'Пригласить')));
      invite.onclick = async () => {
        invite.disabled = true;
        status.textContent = ui('Pending', 'Ожидание');
        try {
          await inviteCollabUser(user, conversation);
          status.textContent = ui('Sent', 'Отправлено');
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : ui('Failed', 'Ошибка');
          invite.disabled = false;
        }
      };
      row.append(name, status, invite);
      list.appendChild(row);
    }
  };

  const unsubscribe = subscribeCollabLobby(renderUsers);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });
  overlay.addEventListener('remove', unsubscribe, { once: true });

  card.append(header, subtitle, list);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  const observer = new MutationObserver(() => {
    if (!document.body.contains(overlay)) {
      unsubscribe();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
}
