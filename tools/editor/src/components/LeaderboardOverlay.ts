// P.A.N.D.A. — Leaderboard overlay.
//
// Standalone overlay triggered from the toolbar's Leaders button. Replaces
// the leaderboard snapshot that used to live inside the profile popover.
// Shows top stalkers by XP, highlights the viewer, and opens a public
// profile when a row is clicked.

import { fetchLeaderboard, fetchUserAchievements, getLevelTitle, getLocalPublisherId, type LeaderboardEntry } from '../lib/api-client';
import { ACHIEVEMENTS, isAchievementRare, type AchievementId } from '../lib/gamification';
import { createAchievementBadge } from './AchievementIcons';
import { openPublicProfile } from './ProfileBadge';
import { createIcon } from './icons';
import { renderAvatar, getBannerBackground } from './AvatarRenderer';
import { getAvatarBannerPreset, getAvatarEffectPreset } from '../lib/avatar-catalog';

function getLeaderboardAccent(level: number): string {
  if (level >= 91) return 'var(--warning, #c4a040)';
  if (level >= 71) return 'color-mix(in srgb, var(--accent, #5eaa3a) 72%, #d9e6d0 28%)';
  if (level >= 51) return 'color-mix(in srgb, var(--accent, #5eaa3a) 84%, #86c7d4 16%)';
  return 'var(--accent, #5eaa3a)';
}

type LeaderboardScope = 'top10' | 'all' | 'nearMe';
type LeaderboardSort = 'xp' | 'level' | 'name';

const LEADERBOARD_LOAD_LIMIT = 1000;
const LEADERBOARD_BADGE_LIMIT = 5;
const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map(achievement => [achievement.id, achievement]));
const leaderboardBadgeCache = new Map<string, AchievementId[]>();
const leaderboardBadgePending = new Map<string, Promise<AchievementId[]>>();

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
  return getLevelTitle(entry.level) || entry.title || `Level ${entry.level} operative`;
}

function getRankTier(rank: number): string {
  if (rank === 1) return 'champion';
  if (rank <= 3) return 'podium';
  if (rank <= 10) return 'elite';
  if (rank <= 50) return 'veteran';
  return 'field';
}

function achievementScore(id: AchievementId): number {
  const achievement = ACHIEVEMENT_BY_ID.get(id);
  if (!achievement) return 0;
  const tierScore = achievement.tier === 'gold' ? 300 : achievement.tier === 'silver' ? 200 : 100;
  return tierScore + (isAchievementRare(achievement) ? 1000 : 0) + achievement.xp;
}

function selectLeaderboardBadges(entry: LeaderboardEntry): AchievementId[] {
  // Prefer the user's manually pinned set if available.
  const pinned = entry.featured_achievements;
  if (pinned && pinned.length > 0) {
    const valid = pinned
      .filter((id): id is AchievementId => ACHIEVEMENT_BY_ID.has(id as AchievementId))
      .slice(0, LEADERBOARD_BADGE_LIMIT);
    if (valid.length > 0) return valid;
  }
  const ids = entry.achievements;
  if (!ids || ids.length === 0) return [];
  const unique = Array.from(new Set(ids))
    .filter((id): id is AchievementId => ACHIEVEMENT_BY_ID.has(id as AchievementId));
  unique.sort((a, b) => achievementScore(b) - achievementScore(a));
  return unique.slice(0, LEADERBOARD_BADGE_LIMIT);
}

function renderBadgeStrip(container: HTMLElement, ids: AchievementId[]): void {
  container.textContent = '';
  container.hidden = ids.length === 0;
  for (const id of ids) {
    const achievement = ACHIEVEMENT_BY_ID.get(id);
    if (!achievement) continue;
    const badge = document.createElement('span');
    badge.className = `panda-leaderboard-badge panda-leaderboard-badge-${achievement.tier}`;
    badge.title = achievement.name;
    badge.appendChild(createAchievementBadge(id, 'unlocked', 20));
    container.appendChild(badge);
  }
}

function hydrateLeaderboardBadges(entry: LeaderboardEntry, container: HTMLElement): void {
  const directBadges = selectLeaderboardBadges(entry);
  if (directBadges.length > 0) {
    renderBadgeStrip(container, directBadges);
    return;
  }

  const cached = leaderboardBadgeCache.get(entry.publisher_id);
  if (cached) {
    renderBadgeStrip(container, cached);
    return;
  }

  container.hidden = true;
  let pending = leaderboardBadgePending.get(entry.publisher_id);
  if (!pending) {
    pending = fetchUserAchievements(entry.publisher_id)
      .then(records => selectLeaderboardBadges({ ...entry, achievements: records.map(record => record.achievement_id) }))
      .catch(() => [])
      .then((ids) => {
        leaderboardBadgeCache.set(entry.publisher_id, ids);
        leaderboardBadgePending.delete(entry.publisher_id);
        return ids;
      });
    leaderboardBadgePending.set(entry.publisher_id, pending);
  }

  void pending.then((ids) => {
    if (document.body.contains(container)) {
      renderBadgeStrip(container, ids);
    }
  });
}

function buildRow(ranked: RankedEntry, viewerId: string, staggerIndex: number): HTMLButtonElement {
  const { entry, rank } = ranked;
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'panda-leaderboard-row';
  row.dataset.rank = String(rank);
  row.dataset.rankTier = getRankTier(rank);
  // Stagger by list position (not absolute rank) so filtered/near-me views animate cleanly.
  row.style.setProperty('--rank-delay', `${Math.min(staggerIndex, 24) * 30}ms`);
  const isViewer = entry.publisher_id === viewerId;
  if (isViewer) row.classList.add('is-viewer');

  const rankEl = document.createElement('span');
  rankEl.className = 'panda-leaderboard-rank';
  rankEl.textContent = rank === 1 ? 'I' : rank === 2 ? 'II' : rank === 3 ? 'III' : `#${rank}`;

  const avatar = renderAvatar(
    {
      username: entry.username || '?',
      level: entry.level,
      fallbackColor: getLeaderboardAccent(entry.level),
      avatar_icon: entry.avatar_icon,
      avatar_color: entry.avatar_color,
      avatar_frame: entry.avatar_frame,
      avatar_frame_color: entry.avatar_frame_color,
      avatar_frame_intensity: entry.avatar_frame_intensity,
      avatar_banner: entry.avatar_banner,
      avatar_banner_opacity: entry.avatar_banner_opacity,
      avatar_banner_speed: entry.avatar_banner_speed,
      avatar_effect: entry.avatar_effect,
      avatar_effect_color: entry.avatar_effect_color,
      avatar_effect_intensity: entry.avatar_effect_intensity,
      avatar_effect_speed: entry.avatar_effect_speed,
      avatar_effect_saturation: entry.avatar_effect_saturation,
      avatar_effect_size: entry.avatar_effect_size,
      avatar_effect_alpha: entry.avatar_effect_alpha,
    },
    {
      extraClass: 'panda-leaderboard-avatar',
      size: 'sm',
      showLevel: true,
    },
  );

  const nameEl = document.createElement('span');
  nameEl.className = 'panda-leaderboard-name';
  nameEl.textContent = entry.username || 'Unknown Stalker';

  const badges = document.createElement('span');
  badges.className = 'panda-leaderboard-badges';
  hydrateLeaderboardBadges(entry, badges);

  const nameLine = document.createElement('span');
  nameLine.className = 'panda-leaderboard-name-line';
  nameLine.append(nameEl, badges);

  const titleEl = document.createElement('span');
  titleEl.className = 'panda-leaderboard-title';
  titleEl.textContent = formatTitle(entry);

  const identity = document.createElement('span');
  identity.className = 'panda-leaderboard-identity';
  identity.append(nameLine, titleEl);

  const xpEl = document.createElement('span');
  xpEl.className = 'panda-leaderboard-xp';
  xpEl.textContent = `${entry.xp.toLocaleString()} XP`;

  const levelEl = document.createElement('span');
  levelEl.className = 'panda-leaderboard-level';
  levelEl.textContent = `Lv ${entry.level}`;

  // Banner tint — applied via CSS custom property so it sits inside the
  // background stack without z-index fighting grid children.
  const bannerBg = getBannerBackground(entry.avatar_banner);
  if (bannerBg) {
    row.style.setProperty('--row-banner', bannerBg);
    if (getAvatarBannerPreset(entry.avatar_banner)?.isAnimated) {
      row.classList.add('pa-anim-bg');
      row.style.setProperty('--pa-banner-speed', String(entry.avatar_banner_speed ?? 1.0));
    }
  }

  // VFX overlay — absolutely positioned, very low opacity so text stays legible.
  // pa-avatar-chip-effect-sample is added so the shared data-effect CSS applies.
  if (entry.avatar_effect && entry.avatar_effect !== 'none') {
    const rowEffect = document.createElement('span');
    rowEffect.className = 'panda-leaderboard-row-effect pa-avatar-chip-effect-sample';
    rowEffect.setAttribute('aria-hidden', 'true');
    rowEffect.dataset.effect = String(entry.avatar_effect);
    const effectPreset = getAvatarEffectPreset(entry.avatar_effect);
    if (effectPreset) {
      rowEffect.style.setProperty('--pa-effect-color', entry.avatar_effect_color || effectPreset.defaultColor || 'var(--accent)');
      rowEffect.style.setProperty('--pa-effect-intensity', String((entry.avatar_effect_intensity ?? effectPreset.defaultIntensity ?? 75) / 100));
      rowEffect.style.setProperty('--pa-effect-speed', String(entry.avatar_effect_speed ?? effectPreset.defaultSpeed ?? 1.0));
      rowEffect.style.setProperty('--pa-effect-saturation', String((entry.avatar_effect_saturation ?? 100) / 100));
      rowEffect.style.setProperty('--pa-effect-size', String((entry.avatar_effect_size ?? 100) / 100));
      rowEffect.style.setProperty('--pa-effect-alpha', String((entry.avatar_effect_alpha ?? 100) / 100));
    }
    row.appendChild(rowEffect);
  }

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

  // Visual order: 2nd (left) — 1st (centre, tallest) — 3rd (right).
  // Cards are inserted in rank order (1,2,3); CSS `order` repositions them
  // in the 3-column grid without DOM reordering.
  const podiumOrder: Record<number, number> = { 1: 2, 2: 1, 3: 3 };
  for (const ranked of podium) {
    const { entry, rank } = ranked;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `panda-leaderboard-podium-card panda-leaderboard-podium-card-${rank}`;
    card.dataset.rankTier = getRankTier(rank);
    card.style.order = String(podiumOrder[rank] ?? rank);
    // Stagger entrance, reveal 2nd + 3rd slightly before the champion.
    const delayMs = rank === 1 ? 180 : rank === 2 ? 60 : 120;
    card.style.setProperty('--podium-delay', `${delayMs}ms`);

    if (entry.publisher_id === refs.viewerId) card.classList.add('is-viewer');
    card.addEventListener('click', () => {
      const restoreTarget = activeOverlay?.trigger ?? card;
      closeOverlay();
      void openPublicProfile(entry.publisher_id, restoreTarget, rank);
    });

    // Banner + effect backdrop — mirrors the customized profile dossier hero.
    const banner = document.createElement('span');
    banner.className = 'panda-leaderboard-podium-banner';
    banner.setAttribute('aria-hidden', 'true');
    const bannerBg = getBannerBackground(entry.avatar_banner);
    if (bannerBg) {
      banner.style.background = bannerBg;
      banner.dataset.banner = String(entry.avatar_banner);
      if (getAvatarBannerPreset(entry.avatar_banner)?.isAnimated) {
        banner.classList.add('pa-anim-bg');
        banner.style.backgroundSize = '200% 200%';
        banner.style.setProperty('--pa-banner-speed', String(entry.avatar_banner_speed ?? 1.0));
      }
    }
    card.appendChild(banner);

    if (entry.avatar_effect && entry.avatar_effect !== 'none') {
      const effect = document.createElement('span');
      effect.className = 'panda-leaderboard-podium-effect pa-avatar-chip-effect-sample';
      effect.setAttribute('aria-hidden', 'true');
      effect.dataset.effect = String(entry.avatar_effect);
      const podiumEffectPreset = getAvatarEffectPreset(entry.avatar_effect);
      if (podiumEffectPreset) {
        effect.style.setProperty('--pa-effect-color', entry.avatar_effect_color || podiumEffectPreset.defaultColor || 'var(--accent)');
        effect.style.setProperty('--pa-effect-intensity', String((entry.avatar_effect_intensity ?? podiumEffectPreset.defaultIntensity ?? 75) / 100));
        effect.style.setProperty('--pa-effect-speed', String(entry.avatar_effect_speed ?? podiumEffectPreset.defaultSpeed ?? 1.0));
        effect.style.setProperty('--pa-effect-saturation', String((entry.avatar_effect_saturation ?? 100) / 100));
        effect.style.setProperty('--pa-effect-size', String((entry.avatar_effect_size ?? 100) / 100));
        effect.style.setProperty('--pa-effect-alpha', String((entry.avatar_effect_alpha ?? 100) / 100));
      }
      card.appendChild(effect);
    }

    const medal = document.createElement('span');
    medal.className = 'panda-leaderboard-podium-rank';
    medal.textContent = rank === 1 ? 'I' : rank === 2 ? 'II' : 'III';

    if (rank === 1) {
      const crown = document.createElement('span');
      crown.className = 'panda-leaderboard-podium-crown';
      crown.setAttribute('aria-hidden', 'true');
      crown.textContent = '\u265B'; // ornate queen/crown glyph
      card.appendChild(crown);
    }

    const podiumAvatar = renderAvatar(
      {
        username: entry.username || '?',
        level: entry.level,
        fallbackColor: getLeaderboardAccent(entry.level),
        avatar_icon: entry.avatar_icon,
        avatar_color: entry.avatar_color,
        avatar_frame: entry.avatar_frame,
        avatar_frame_color: entry.avatar_frame_color,
        avatar_frame_intensity: entry.avatar_frame_intensity,
        avatar_banner: entry.avatar_banner,
        avatar_banner_opacity: entry.avatar_banner_opacity,
        avatar_banner_speed: entry.avatar_banner_speed,
        avatar_effect: entry.avatar_effect,
        avatar_effect_color: entry.avatar_effect_color,
        avatar_effect_intensity: entry.avatar_effect_intensity,
        avatar_effect_speed: entry.avatar_effect_speed,
        avatar_effect_saturation: entry.avatar_effect_saturation,
        avatar_effect_size: entry.avatar_effect_size,
        avatar_effect_alpha: entry.avatar_effect_alpha,
      },
      {
        extraClass: 'panda-leaderboard-podium-avatar',
        size: 'lg',
        showLevel: true,
      },
    );

    const name = document.createElement('span');
    name.className = 'panda-leaderboard-podium-name';
    name.textContent = entry.username || 'Unknown Stalker';

    const badges = document.createElement('span');
    badges.className = 'panda-leaderboard-badges panda-leaderboard-podium-badges';
    hydrateLeaderboardBadges(entry, badges);

    const xp = document.createElement('span');
    xp.className = 'panda-leaderboard-podium-xp';
    xp.textContent = `${entry.xp.toLocaleString()} XP`;

    const level = document.createElement('span');
    level.className = 'panda-leaderboard-podium-level';
    level.textContent = `Lv ${entry.level} · ${getLevelTitle(entry.level) || entry.title || 'Stalker'}`;

    card.append(medal, podiumAvatar, name, level, badges, xp);
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
    refs.podium.textContent = '';
    refs.list.appendChild(buildEmpty());
    return;
  }

  renderPodium(refs);
  const searchActive = refs.search.value.trim().length > 0;
  const rows = getScopedEntries(refs);

  // When the podium is visible AND no active search/sort override is in play,
  // drop ranks 1-3 from the scrollable list so they aren't duplicated underneath.
  const sortValue = (refs.sort.value as LeaderboardSort);
  const podiumShowing = refs.entries.length >= 1 && !searchActive && sortValue === 'xp';
  const listRows = podiumShowing
    ? rows.filter(r => r.rank > 3)
    : rows;

  refs.count.textContent = refs.scope === 'all'
    ? `${rows.length}/${refs.entries.length} shown`
    : `${rows.length} shown`;

  const viewer = refs.entries.find(row => row.entry.publisher_id === refs.viewerId);
  refs.jumpSelf.disabled = !viewer;
  refs.status.textContent = viewer
    ? `Your rank: #${viewer.rank} with ${viewer.entry.xp.toLocaleString()} XP`
    : `${refs.entries.length} ranked stalkers loaded`;

  if (listRows.length === 0) {
    // Avoid a confusing empty-state when only the podium is present.
    if (!podiumShowing) {
      const empty = document.createElement('div');
      empty.className = 'panda-leaderboard-empty';
      empty.textContent = 'No stalkers match current filters.';
      refs.list.appendChild(empty);
    }
    return;
  }

  let viewerRow: HTMLButtonElement | null = null;
  listRows.forEach((row, index) => {
    const node = buildRow(row, refs.viewerId, index);
    if (row.entry.publisher_id === refs.viewerId) viewerRow = node;
    refs.list.appendChild(node);
  });

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
  activeRefs.status.textContent = 'Loading all ranks...';
  container.textContent = '';

  const loading = document.createElement('div');
  loading.className = 'panda-leaderboard-skeleton';
  loading.textContent = 'Loading stalker ranks...';
  container.appendChild(loading);

  let loadedEntries: LeaderboardEntry[] = [];
  try {
    loadedEntries = await fetchLeaderboard(LEADERBOARD_LOAD_LIMIT);
  } catch {
    loadedEntries = [];
  }

  if (activeOverlay !== activeRefs || activeRefs.list !== container) return;
  activeRefs.refresh.disabled = false;
  activeRefs.entries = rankEntries(loadedEntries);
  activeRefs.podium.textContent = '';
  updateLeaderboardView(activeRefs);
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
