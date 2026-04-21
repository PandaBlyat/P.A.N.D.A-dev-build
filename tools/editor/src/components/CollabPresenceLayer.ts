import type { Conversation } from '../lib/types';
import { pathBelongsToTurn } from '../lib/collab-protocol';
import { store } from '../lib/state';

export function createCollabPresenceLayer(conversation: Conversation): HTMLElement | null {
  const { collab } = store.get();
  if (!collab.sessionId) {
    return null;
  }
  const layer = document.createElement('div');
  layer.className = 'collab-presence-layer';

  const localId = collab.localPublisherId;
  for (const cursor of Object.values(collab.remoteCursors)) {
    if (cursor.authorId === localId) continue;
    const dot = document.createElement('div');
    dot.className = 'collab-remote-cursor';
    dot.style.left = `${cursor.x}px`;
    dot.style.top = `${cursor.y}px`;
    dot.style.setProperty('--collab-color', colorForPublisher(cursor.authorId));
    const label = document.createElement('span');
    label.textContent = cursor.username;
    dot.appendChild(label);
    layer.appendChild(dot);
  }

  for (const turn of conversation.turns) {
    const remoteLocks = Object.values(collab.locks).filter((lock) => lock.authorId !== localId && pathBelongsToTurn(lock.path, turn.turnNumber));
    if (!remoteLocks.length) continue;
    const chip = document.createElement('div');
    chip.className = 'collab-lock-chip';
    chip.style.left = `${turn.position.x + 12}px`;
    chip.style.top = `${Math.max(0, turn.position.y - 18)}px`;
    chip.style.setProperty('--collab-color', colorForPublisher(remoteLocks[0].authorId));
    chip.textContent = remoteLocks[0].username;
    layer.appendChild(chip);
  }

  return layer;
}

export function colorForPublisher(publisherId: string): string {
  let hash = 0;
  for (let index = 0; index < publisherId.length; index += 1) {
    hash = (hash * 31 + publisherId.charCodeAt(index)) >>> 0;
  }
  return `hsl(${hash % 360} 72% 48%)`;
}
