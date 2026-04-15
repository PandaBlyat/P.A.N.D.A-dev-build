// P.A.N.D.A. — Leaderboard overlay.
//
// Standalone overlay triggered from the toolbar's Leaders button. Replaces
// the leaderboard snapshot that used to live inside the profile popover.
// Shows top stalkers by XP, highlights the viewer, and opens a public
// profile when a row is clicked.

import { fetchLeaderboard, getLocalPublisherId, type LeaderboardEntry } from '../lib/api-client';
import { openPublicProfile } from './ProfileBadge';

type OverlayRefs = {
  backdrop: HTMLDivElement;
  dialog: HTMLDivElement;
  list: HTMLDivElement;
  trigger: HTMLButtonElement | null;
};

let activeOverlay: OverlayRefs | null = null;

function closeOverlay() {
  if (!activeOverlay) return;
  const { backdrop, trigger } = activeOverlay;
  backdrop.remove();
  if (trigger && document.body.contains(trigger)) {
    try { trigger.focus(); } catch { /* noop */ }
  }
  activeOverlay = null;
  document.removeEventListener('keydown', handleKeydown);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeOverlay();
  }
}

function buildRow(entry: LeaderboardEntry, rank: number, viewerId: string): HTMLButtonElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'panda-leaderboard-row';
  row.dataset.rank = String(rank);
  const isViewer = entry.publisher_id === viewerId;
  if (isViewer) row.classList.add('is-viewer');

  const rankEl = document.createElement('span');
  rankEl.className = 'panda-leaderboard-rank';
  rankEl.textContent = `#${rank}`;

  const nameEl = document.createElement('span');
  nameEl.className = 'panda-leaderboard-name';
  nameEl.textContent = entry.username || 'Unknown Stalker';

  const titleEl = document.createElement('span');
  titleEl.className = 'panda-leaderboard-title';
  titleEl.textContent = entry.title || '';

  const xpEl = document.createElement('span');
  xpEl.className = 'panda-leaderboard-xp';
  xpEl.textContent = `${entry.xp.toLocaleString()} XP · Lv ${entry.level}`;

  row.append(rankEl, nameEl, titleEl, xpEl);

  row.addEventListener('click', () => {
    closeOverlay();
    // openPublicProfile focuses the trigger on close, so pass this row.
    void openPublicProfile(entry.publisher_id, row, rank);
  });

  return row;
}

function buildEmpty(): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'panda-leaderboard-empty';
  empty.textContent = 'The leaderboard is quiet right now. Publish something and climb the ranks.';
  return empty;
}

async function populateList(container: HTMLDivElement) {
  container.innerHTML = '';
  const skeleton = document.createElement('div');
  skeleton.className = 'panda-leaderboard-skeleton';
  skeleton.textContent = 'Loading stalker ranks…';
  container.appendChild(skeleton);

  let entries: LeaderboardEntry[] = [];
  try {
    entries = await fetchLeaderboard(25);
  } catch {
    entries = [];
  }

  container.innerHTML = '';
  if (entries.length === 0) {
    container.appendChild(buildEmpty());
    return;
  }

  const viewerId = getLocalPublisherId() ?? '';
  let rank = 0;
  let viewerRow: HTMLButtonElement | null = null;
  for (const entry of entries) {
    rank += 1;
    const row = buildRow(entry, rank, viewerId);
    if (entry.publisher_id === viewerId) viewerRow = row;
    container.appendChild(row);
  }

  if (viewerRow) {
    // Scroll the viewer's row into view for quick orientation.
    queueMicrotask(() => {
      try { viewerRow?.scrollIntoView({ block: 'nearest' }); } catch { /* noop */ }
    });
  } else if (viewerId) {
    // Viewer not in top N; show a note + a "Jump to my profile" shortcut.
    const note = document.createElement('div');
    note.className = 'panda-leaderboard-viewer-note';
    note.textContent = 'You are not in the top yet — keep publishing to climb.';
    container.appendChild(note);
  }
}

/**
 * Show the leaderboard overlay. Safe to call while another overlay is open
 * (existing overlay is replaced). Returns once the overlay is mounted.
 */
export function openLeaderboardOverlay(trigger?: HTMLButtonElement | null): void {
  closeOverlay();

  const backdrop = document.createElement('div');
  backdrop.className = 'panda-leaderboard-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Leaderboard');
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeOverlay();
  });

  const dialog = document.createElement('div');
  dialog.className = 'panda-leaderboard-dialog';

  const header = document.createElement('div');
  header.className = 'panda-leaderboard-header';

  const title = document.createElement('h2');
  title.className = 'panda-leaderboard-title-heading';
  title.textContent = 'Leaderboard';

  const subtitle = document.createElement('p');
  subtitle.className = 'panda-leaderboard-subtitle';
  subtitle.textContent = 'Top stalkers by total XP';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'panda-leaderboard-close';
  close.setAttribute('aria-label', 'Close leaderboard');
  close.textContent = '\u2715';
  close.addEventListener('click', closeOverlay);

  header.append(title, subtitle, close);

  const list = document.createElement('div');
  list.className = 'panda-leaderboard-list';

  dialog.append(header, list);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  activeOverlay = { backdrop, dialog, list, trigger: trigger ?? null };
  document.addEventListener('keydown', handleKeydown);

  void populateList(list);
}

/**
 * Public helper to close the overlay from outside (e.g. if routing
 * navigates away). Safe to call when no overlay is open.
 */
export function closeLeaderboardOverlay(): void {
  closeOverlay();
}
