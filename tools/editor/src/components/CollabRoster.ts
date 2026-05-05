import { leaveCollabSession } from '../lib/collab-session';
import { store } from '../lib/state';
import { t } from '../lib/i18n';

export function createCollabRoster(): HTMLElement | null {
  const { collab } = store.get();
  if (!collab.sessionId) {
    return null;
  }
  const roster = document.createElement('div');
  roster.className = 'collab-roster';
  roster.title = collab.statusMessage ?? t('collab.roster.activeTitle');

  for (const participant of collab.participants) {
    const chip = document.createElement('span');
    chip.className = `collab-roster-chip${participant.online ? '' : ' is-offline'}${participant.isHost ? ' is-host' : ''}`;
    chip.textContent = `${participant.isHost ? t('collab.roster.hostPrefix') : ''}${participant.username}`;
    roster.appendChild(chip);
  }

  if (collab.statusMessage) {
    const status = document.createElement('span');
    status.className = 'collab-roster-status';
    status.textContent = collab.statusMessage;
    roster.appendChild(status);
  }

  const leave = document.createElement('button');
  leave.type = 'button';
  leave.className = 'collab-leave-btn';
  leave.textContent = t('collab.leave');
  leave.onclick = () => {
    void leaveCollabSession();
  };
  roster.appendChild(leave);
  return roster;
}
