// P.A.N.D.A. — Leaderboard overlay.
//
// Standalone overlay triggered from the toolbar's Leaders button. Replaces
// the leaderboard snapshot that used to live inside the profile popover.
// Shows top stalkers by XP, highlights the viewer, and opens a public
// profile when a row is clicked.

import { fetchLeaderboard, getLocalPublisherId, type LeaderboardEntry } from '../lib/api-client';
import { openPublicProfile } from './ProfileBadge';
import { createIcon } from './icons';

type LeaderboardScope = 'top10' | 'all' | 'nearMe';
type LeaderboardSort = 'xp' | 'level' | 'name';

type RankedEntry = {
  entry: LeaderboardEntry;
  rank: number;
};

type OverlayRefs = {
  backdrop: HTMLDivElement;
  dialog: HTMLDivElement;
  podium: HTMLDivElement;
  list: HTMLDivElement;
  status: HTMLDivElement;
  count: HTMLSpanElement;
  search: HTMLInputElement;
  sort: HTMLSelectElement;
  scopeButtons: HTMLButtonElement[];
  refresh: HTMLButtonElement;
  jumpSelf: HTMLButtonElement;
  trigger: HTMLButtonElement | null;
  entries: RankedEntry[];
  viewerId: string;
  scope: LeaderboardScope;
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

function formatTitle(entry: LeaderboardEntry): string {
  return entry.title || `Level ${entry.level} operative`;
}

function buildRow(ranked: RankedEntry, viewerId: string): HTMLButtonElement {
  const { entry, rank } = ranked;
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'panda-leaderboard-row';
  row.dataset.rank = String(rank);
  const isViewer = entry.publisher_id === viewerId;
  if (isViewer) row.classList.add('is-viewer');

  const rankEl = document.createElement('span');
  rankEl.className = 'panda-leaderboard-rank';
  rankEl.textContent = rank === 1 ? 'I' : rank === 2 ? 'II' : rank === 3 ? 'III' : `#${rank}`;

  const avatar = document.createElement('span');
  avatar.className = 'panda-leaderboard-avatar';
  avatar.textContent = (entry.username || '?').trim().charAt(0).toUpperCase() || '?';

  const nameEl = document.createElement('span');
  nameEl.className = 'panda-leaderboard-name';
  nameEl.textContent = entry.username || 'Unknown Stalker';

  const titleEl = document.createElement('span');
  titleEl.className = 'panda-leaderboard-title';
  titleEl.textContent = formatTitle(entry);

  const identity = document.createElement('span');
  identity.className = 'panda-leaderboard-identity';
  identity.append(nameEl, titleEl);

  const xpEl = document.createElement('span');
  xpEl.className = 'panda-leaderboard-xp';
  xpEl.textContent = `${entry.xp.toLocaleString()} XP`;

  const levelEl = document.createElement('span');
  levelEl.className = 'panda-leaderboard-level';
  levelEl.textContent = `Lv ${entry.level}`;

  row.append(rankEl, avatar, identity, xpEl, levelEl);

  row.addEventListener('click', () => {
    const restoreTarget = activeOverlay?.trigger ?? row;
    closeOverlay();
    // openPublicProfile focuses the trigger on close, so pass this row.
    void openPublicProfile(entry.publisher_id, restoreTarget, rank);
  });

  return row;
}

function buildEmpty(): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'panda-leaderboard-empty';
  empty.textContent = 'The leaderboard is quiet right now. Publish something and climb the ranks.';
  return empty;
}

function rankEntries(entries: LeaderboardEntry[]): RankedEntry[] {
  return entries.map((entry, index) => ({ entry, rank: index + 1 }));
}

function sortRankedEntries(entries: RankedEntry[], sort: LeaderboardSort): RankedEntry[] {
  const sorted = [...entries];
  sorted.sort((a, b) => {
    if (sort === 'level') return b.entry.level - a.entry.level || b.entry.xp - a.entry.xp || a.rank - b.rank;
    if (sort === 'name') return a.entry.username.localeCompare(b.entry.username) || a.rank - b.rank;
    return a.rank - b.rank;
  });
  return sorted;
}

function getScopedEntries(refs: OverlayRefs): RankedEntry[] {
  const query = refs.search.value.trim().toLowerCase();
  let rows = refs.entries;

  if (refs.scope === 'top10') {
    rows = rows.slice(0, 10);
  } else if (refs.scope === 'nearMe') {
    const viewerIndex = rows.findIndex(row => row.entry.publisher_id === refs.viewerId);
    rows = viewerIndex >= 0
      ? rows.slice(Math.max(0, viewerIndex - 4), viewerIndex + 5)
      : rows.slice(0, 10);
  }

  if (query) {
    rows = rows.filter(({ entry }) => (
      entry.username.toLowerCase().includes(query)
      || formatTitle(entry).toLowerCase().includes(query)
      || String(entry.level).includes(query)
    ));
  }

  return sortRankedEntries(rows, refs.sort.value as LeaderboardSort);
}

function updateScopeButtons(refs: OverlayRefs): void {
  refs.scopeButtons.forEach((button) => {
    const active = button.dataset.scope === refs.scope;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderPodium(refs: OverlayRefs): void {
  refs.podium.textContent = '';
  const podium = refs.entries.slice(0, 3);
  if (podium.length === 0) return;

  for (const ranked of podium) {
    const { entry, rank } = ranked;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `panda-leaderboard-podium-card panda-leaderboard-podium-card-${rank}`;
    if (entry.publisher_id === refs.viewerId) card.classList.add('is-viewer');
    card.addEventListener('click', () => {
      const restoreTarget = activeOverlay?.trigger ?? card;
      closeOverlay();
      void openPublicProfile(entry.publisher_id, restoreTarget, rank);
    });

    const medal = document.createElement('span');
    medal.className = 'panda-leaderboard-podium-rank';
    medal.textContent = rank === 1 ? 'I' : rank === 2 ? 'II' : 'III';

    const name = document.createElement('span');
    name.className = 'panda-leaderboard-podium-name';
    name.textContent = entry.username || 'Unknown Stalker';

    const xp = document.createElement('span');
    xp.className = 'panda-leaderboard-podium-xp';
    xp.textContent = `${entry.xp.toLocaleString()} XP`;

    card.append(medal, name, xp);
    refs.podium.appendChild(card);
  }
}

function updateLeaderboardView(refs: OverlayRefs): void {
  updateScopeButtons(refs);
  refs.list.textContent = '';

  if (refs.entries.length === 0) {
    refs.count.textContent = '0 shown';
    refs.status.textContent = '';
    refs.jumpSelf.disabled = true;
    refs.list.appendChild(buildEmpty());
    return;
  }

  renderPodium(refs);
  const rows = getScopedEntries(refs);
  refs.count.textContent = `${rows.length} shown`;

  const viewer = refs.entries.find(row => row.entry.publisher_id === refs.viewerId);
  refs.jumpSelf.disabled = !viewer;
  refs.status.textContent = viewer
    ? `Your rank: #${viewer.rank} with ${viewer.entry.xp.toLocaleString()} XP`
    : `${refs.entries.length} ranked stalkers loaded`;

  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'panda-leaderboard-empty';
    empty.textContent = 'No stalkers match current filters.';
    refs.list.appendChild(empty);
    return;
  }

  let viewerRow: HTMLButtonElement | null = null;
  for (const row of rows) {
    const node = buildRow(row, refs.viewerId);
    if (row.entry.publisher_id === refs.viewerId) viewerRow = node;
    refs.list.appendChild(node);
  }

  if (refs.scope === 'nearMe' && viewerRow) {
    queueMicrotask(() => {
      try { viewerRow?.scrollIntoView({ block: 'nearest' }); } catch { /* noop */ }
    });
  }
}

async function populateList(container: HTMLDivElement) {
  const activeRefs = activeOverlay;
  if (!activeRefs || activeRefs.list !== container) return;

  activeRefs.refresh.disabled = true;
  activeRefs.podium.textContent = '';
  activeRefs.count.textContent = 'Loading';
  activeRefs.status.textContent = 'Loading ranks...';
  container.textContent = '';

  const loading = document.createElement('div');
  loading.className = 'panda-leaderboard-skeleton';
  loading.textContent = 'Loading stalker ranks...';
  container.appendChild(loading);

  let loadedEntries: LeaderboardEntry[] = [];
  try {
    loadedEntries = await fetchLeaderboard(50);
  } catch {
    loadedEntries = [];
  }

  if (activeOverlay !== activeRefs || activeRefs.list !== container) return;
  activeRefs.refresh.disabled = false;
  activeRefs.entries = rankEntries(loadedEntries);
  activeRefs.podium.textContent = '';
  updateLeaderboardView(activeRefs);
  return;

  container.innerHTML = '';
  const skeleton = document.createElement('div');
  skeleton.className = 'panda-leaderboard-skeleton';
  skeleton.textContent = 'Loading stalker ranks…';
  container.appendChild(skeleton);

  let entries: LeaderboardEntry[] = [];
  try {
    entries = await fetchLeaderboard(50);
  } catch {
    entries = [];
  }

  const refs = activeOverlay!;
  if (!refs || refs.list !== container) return;
  refs.refresh.disabled = false;
  refs.entries = rankEntries(entries);
  refs.podium.textContent = '';
  updateLeaderboardView(refs);
  return;

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
    const row = buildRow({ entry, rank }, viewerId);
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

  const titleWrap = document.createElement('div');
  titleWrap.className = 'panda-leaderboard-title-wrap';
  const titleIcon = createIcon('trophy');
  titleIcon.classList.add('panda-leaderboard-title-icon');
  const titleCopy = document.createElement('div');
  titleCopy.append(title, subtitle);
  titleWrap.append(titleIcon, titleCopy);

  header.append(titleWrap, close);

  const controls = document.createElement('div');
  controls.className = 'panda-leaderboard-controls';

  const search = document.createElement('input');
  search.className = 'panda-leaderboard-search';
  search.type = 'search';
  search.placeholder = 'Search name, title, level';
  search.setAttribute('aria-label', 'Search leaderboard');

  const scopeGroup = document.createElement('div');
  scopeGroup.className = 'panda-leaderboard-scope';
  const scopeButtons: HTMLButtonElement[] = [
    ['top10', 'Top 10'],
    ['all', 'All'],
    ['nearMe', 'Near me'],
  ].map(([scope, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'panda-leaderboard-scope-button';
    button.dataset.scope = scope;
    button.textContent = label;
    return button;
  });
  scopeGroup.append(...scopeButtons);

  const sort = document.createElement('select');
  sort.className = 'panda-leaderboard-sort';
  sort.setAttribute('aria-label', 'Sort leaderboard');
  [
    ['xp', 'XP rank'],
    ['level', 'Level'],
    ['name', 'Name'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    sort.appendChild(option);
  });

  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.className = 'panda-leaderboard-action';
  refresh.append(createIcon('restart'), document.createTextNode('Refresh'));

  const jumpSelf = document.createElement('button');
  jumpSelf.type = 'button';
  jumpSelf.className = 'panda-leaderboard-action';
  jumpSelf.append(createIcon('locate'), document.createTextNode('Find me'));
  jumpSelf.disabled = true;

  controls.append(search, scopeGroup, sort, refresh, jumpSelf);

  const stats = document.createElement('div');
  stats.className = 'panda-leaderboard-stats';

  const count = document.createElement('span');
  count.className = 'panda-leaderboard-count';
  count.textContent = 'Loading';

  const status = document.createElement('div');
  status.className = 'panda-leaderboard-status';
  status.textContent = 'Loading ranks...';

  stats.append(count, status);

  const podium = document.createElement('div');
  podium.className = 'panda-leaderboard-podium';

  const list = document.createElement('div');
  list.className = 'panda-leaderboard-list';

  dialog.append(header, controls, stats, podium, list);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  const viewerId = getLocalPublisherId() ?? '';
  activeOverlay = {
    backdrop,
    dialog,
    podium,
    list,
    status,
    count,
    search,
    sort,
    scopeButtons,
    refresh,
    jumpSelf,
    trigger: trigger ?? null,
    entries: [],
    viewerId,
    scope: 'top10',
  };

  const refs = activeOverlay;
  scopeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      refs.scope = (button.dataset.scope as LeaderboardScope) ?? 'top10';
      updateLeaderboardView(refs);
    });
  });
  search.addEventListener('input', () => updateLeaderboardView(refs));
  sort.addEventListener('change', () => updateLeaderboardView(refs));
  refresh.addEventListener('click', () => {
    refresh.disabled = true;
    status.textContent = 'Refreshing ranks...';
    void populateList(list);
  });
  jumpSelf.addEventListener('click', () => {
    refs.scope = 'nearMe';
    updateLeaderboardView(refs);
  });
  updateScopeButtons(refs);
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
