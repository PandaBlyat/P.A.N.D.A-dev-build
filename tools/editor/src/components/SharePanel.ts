// P.A.N.D.A. Conversation Editor — Community Library Panel
// Full-screen modal for browsing, publishing, and importing shared conversations.

import { store } from '../lib/state';
import { generateXml } from '../lib/xml-export';
import { createEmptyProject } from '../lib/xml-export';
import {
  createSummaryFromConversation,
  deriveConversationComplexity,
  fetchConversations,
  fetchCommunityLibraryStats,
  incrementDownload,
  incrementUpvote,
  publishConversation,
  type CommunityConversation,
  type CommunityLibraryStats,
  type ConversationComplexity,
} from '../lib/api-client';
import { COMMUNITY_CONVERSATIONS } from '../lib/community-data';
import { FACTION_IDS } from '../lib/constants';
import { FACTION_DISPLAY_NAMES, FACTION_XML_KEYS, getConversationFaction, type Conversation, type FactionId } from '../lib/types';
import { FACTION_COLORS } from '../lib/faction-colors';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { createIcon, setButtonContent } from './icons';
import { importConversations } from './App';
import { downloadFile } from '../lib/project-io';
import { showXpToast, showLevelUpToast } from './XpToast';
import { awardXp, getPublishXp, getStoredUsername, type UserProfile } from '../lib/api-client';
import { setProfileForBadge, invalidateLeaderboardCache } from './ProfileBadge';

type SortMode = 'newest' | 'upvoted';
type LengthFilter = 'all' | 'short' | 'medium' | 'long';
type LibrarySource = 'bundled' | 'remote';
type ViewMode = 'gallery' | 'list';

type NormalizedConversation = CommunityConversation & {
  tags: string[];
  branch_count: number;
  complexity: ConversationComplexity;
  summary: string;
  upvotes: number;
  updated_at: string;
  source: LibrarySource;
};

const LOCAL_UPVOTE_KEY = 'panda-community-upvotes';
const SHARE_PANEL_MOUNT_ID = 'app-modal-host';

function getSharePanelMount(): HTMLElement {
  return document.getElementById(SHARE_PANEL_MOUNT_ID)
    ?? document.getElementById('app')
    ?? document.body;
}

let overlayEl: HTMLElement | null = null;
let focusTrap: FocusTrapController | null = null;
let restoreFocusEl: HTMLElement | null = null;
let activeFaction: FactionId | 'all' = 'all';
let allResults: NormalizedConversation[] = [];
let selectedPreviewId: string | null = null;
let searchQuery = '';
let sortMode: SortMode = 'newest';
let lengthFilter: LengthFilter = 'all';
let viewMode: ViewMode = 'gallery';
let isLoading = false;
let loadError = '';
let loadNotice = '';
let communityStats: CommunityLibraryStats | null = null;

export function openSharePanel(): void {
  if (overlayEl) return;
  restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeFaction = 'all';
  allResults = [];
  selectedPreviewId = null;
  searchQuery = '';
  sortMode = 'newest';
  lengthFilter = 'all';
  isLoading = false;
  loadError = '';
  loadNotice = '';
  communityStats = null;

  overlayEl = buildOverlay();
  getSharePanelMount().appendChild(overlayEl);
  loadConversations();
}

export function closeSharePanel(): void {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
  focusTrap?.release();
  focusTrap = null;
  restoreFocusEl = null;
}

async function loadConversations(): Promise<void> {
  isLoading = true;
  loadError = '';
  loadNotice = '';
  renderContent();

  const bundled = normalizeCollection(COMMUNITY_CONVERSATIONS, 'bundled');

  try {
    const [remoteRows, stats] = await Promise.all([
      fetchConversations(activeFaction === 'all' ? undefined : activeFaction),
      fetchCommunityLibraryStats().catch(() => null),
    ]);
    const remote = normalizeCollection(remoteRows, 'remote');
    allResults = mergeConversationLists(bundled, remote);
    communityStats = stats;
    loadNotice = bundled.length > 0
      ? 'Showing bundled picks alongside community uploads.'
      : 'Showing live community uploads.';
  } catch (err) {
    allResults = bundled;
    if (bundled.length > 0) {
      loadNotice = `Remote community sync failed, so bundled picks are shown instead. ${err instanceof Error ? err.message : String(err)}`;
      loadError = '';
    } else {
      loadError = err instanceof Error ? err.message : 'Failed to load conversations.';
    }
  } finally {
    isLoading = false;
    ensurePreviewSelection();
    renderContent();
  }
}

function normalizeCollection(entries: CommunityConversation[], source: LibrarySource): NormalizedConversation[] {
  return entries
    .map(entry => normalizeConversation(entry, source))
    .filter(entry => activeFaction === 'all' || entry.faction === activeFaction);
}

function normalizeConversation(entry: CommunityConversation, source: LibrarySource): NormalizedConversation {
  const conversation = entry.data?.conversations?.[0];
  const branchCount = entry.branch_count || getBranchCount(conversation);
  return {
    ...entry,
    label: (entry.label || conversation?.label || 'Untitled').trim(),
    description: (entry.description || '').trim(),
    summary: (entry.summary || createSummaryFromConversation(conversation ?? createFallbackConversation())).trim(),
    tags: Array.from(new Set((entry.tags ?? []).map(tag => tag.trim()).filter(Boolean))).slice(0, 6),
    branch_count: branchCount,
    complexity: entry.complexity ?? deriveConversationComplexity(branchCount),
    upvotes: entry.upvotes ?? 0,
    updated_at: entry.updated_at ?? entry.created_at,
    source,
  };
}

function createFallbackConversation(): Conversation {
  return {
    id: 0,
    label: 'Untitled',
    preconditions: [],
    turns: [{ turnNumber: 1, choices: [], position: { x: 0, y: 0 } }],
  };
}

function getBranchCount(conversation?: Conversation): number {
  return Math.max(1, conversation?.turns.length ?? 1);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mergeConversationLists(bundled: NormalizedConversation[], remote: NormalizedConversation[]): NormalizedConversation[] {
  const merged = new Map<string, NormalizedConversation>();
  for (const entry of bundled) {
    merged.set(`${entry.faction}::${normalizeKey(entry.label)}`, entry);
  }
  for (const entry of remote) {
    merged.set(`${entry.faction}::${normalizeKey(entry.label)}`, entry);
  }
  return Array.from(merged.values());
}

function getFilteredResults(): NormalizedConversation[] {
  const q = searchQuery.trim().toLowerCase();
  const filtered = allResults.filter(conv => {
    if (lengthFilter === 'short' && conv.branch_count > 3) return false;
    if (lengthFilter === 'medium' && (conv.branch_count < 4 || conv.branch_count > 6)) return false;
    if (lengthFilter === 'long' && conv.branch_count < 7) return false;
    if (!q) return true;
    return [
      conv.label,
      conv.description,
      conv.summary,
      conv.author,
      ...conv.tags,
    ].some(value => value.toLowerCase().includes(q));
  });

  filtered.sort((a, b) => {
    if (sortMode === 'upvoted') {
      return b.upvotes - a.upvotes || Date.parse(b.updated_at) - Date.parse(a.updated_at);
    }
    return Date.parse(b.updated_at) - Date.parse(a.updated_at) || b.upvotes - a.upvotes;
  });

  return filtered;
}

function ensurePreviewSelection(): void {
  const visible = getFilteredResults();
  if (visible.length === 0) {
    selectedPreviewId = null;
    return;
  }
  if (!selectedPreviewId || !visible.some(conv => conv.id === selectedPreviewId)) {
    selectedPreviewId = visible[0].id;
  }
}

function getSelectedPreview(): NormalizedConversation | null {
  return getFilteredResults().find(conv => conv.id === selectedPreviewId) ?? null;
}

function getContentEl(): HTMLElement | null {
  return overlayEl?.querySelector('.share-grid-wrap') ?? null;
}

function getDownloadAllBtn(): HTMLButtonElement | null {
  return overlayEl?.querySelector<HTMLButtonElement>('.share-download-all-btn') ?? null;
}

function buildOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'share-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeSharePanel(); };

  const modal = document.createElement('div');
  modal.className = 'share-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'share-modal-title');
  modal.onclick = (e) => e.stopPropagation();

  modal.appendChild(buildHeader());

  const body = document.createElement('div');
  body.className = 'share-modal-body';
  body.appendChild(buildSidebar());

  const contentArea = document.createElement('div');
  contentArea.className = 'share-content';
  contentArea.appendChild(buildToolbarRow());

  const gridWrap = document.createElement('div');
  gridWrap.className = 'share-grid-wrap';
  contentArea.appendChild(gridWrap);

  body.appendChild(contentArea);
  modal.appendChild(body);
  modal.appendChild(buildPublishForm());

  overlay.appendChild(modal);
  const closeButton = modal.querySelector<HTMLButtonElement>('[data-share-close]');
  focusTrap = trapFocus(modal, {
    restoreFocus: restoreFocusEl,
    initialFocus: closeButton,
    onEscape: closeSharePanel,
  });
  return overlay;
}

function buildHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'share-modal-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'share-modal-title';
  titleWrap.id = 'share-modal-title';
  titleWrap.append(createIcon('share'), document.createTextNode('Community Library'));
  const titleSlot = document.createElement('div');
  titleSlot.className = 'share-modal-header-slot share-modal-header-slot-start';
  titleSlot.appendChild(titleWrap);
  header.appendChild(titleSlot);

  const publishSlot = document.createElement('div');
  publishSlot.className = 'share-modal-header-slot share-modal-header-slot-center';

  const publishBtn = document.createElement('button');
  publishBtn.type = 'button';
  publishBtn.className = 'toolbar-button btn-primary';
  publishBtn.dataset.sharePublish = 'true';
  setButtonContent(publishBtn, 'export', 'Publish');
  publishBtn.title = 'Publish the currently selected conversation to the Community Library';
  publishBtn.onclick = () => showPublishForm();
  publishBtn.classList.add('share-publish-cta');
  publishSlot.appendChild(publishBtn);
  header.appendChild(publishSlot);

  const closeSlot = document.createElement('div');
  closeSlot.className = 'share-modal-header-slot share-modal-header-slot-end';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toolbar-button toolbar-icon-button btn-icon';
  closeBtn.dataset.shareClose = 'true';
  closeBtn.appendChild(createIcon('close'));
  closeBtn.title = 'Close Community Library';
  closeBtn.onclick = closeSharePanel;
  closeSlot.appendChild(closeBtn);
  header.appendChild(closeSlot);

  return header;
}

function buildSidebar(): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.className = 'share-sidebar';

  const allTab = buildSidebarTab('All Factions', null, activeFaction === 'all');
  sidebar.appendChild(allTab);

  for (const fid of FACTION_IDS) {
    const tab = buildSidebarTab(FACTION_DISPLAY_NAMES[fid], fid, activeFaction === fid);
    sidebar.appendChild(tab);
  }

  return sidebar;
}

function buildSidebarTab(label: string, faction: FactionId | null, active: boolean): HTMLElement {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = `share-sidebar-tab${active ? ' is-active' : ''}`;

  const dot = document.createElement('span');
  dot.className = 'share-faction-dot';
  dot.style.backgroundColor = faction ? FACTION_COLORS[faction] : 'var(--text-dim)';

  tab.append(dot, document.createTextNode(label));
  tab.onclick = () => {
    activeFaction = faction ?? 'all';
    allResults = [];
    selectedPreviewId = null;
    searchQuery = '';
    rebuildSidebar();
    updateDownloadAllBtn();
    loadConversations();
  };
  return tab;
}

function rebuildSidebar(): void {
  const sidebar = overlayEl?.querySelector('.share-sidebar');
  if (!sidebar) return;
  sidebar.replaceWith(buildSidebar());
}

function buildToolbarRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'share-toolbar-row';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'share-search';
  searchInput.placeholder = 'Search by title, author, description, or tag…';
  searchInput.value = searchQuery;
  searchInput.oninput = () => {
    searchQuery = searchInput.value;
    ensurePreviewSelection();
    renderContent();
  };
  row.appendChild(searchInput);

  const sortSelect = document.createElement('select');
  sortSelect.className = 'share-select';
  sortSelect.innerHTML = '<option value="newest">Newest</option><option value="upvoted">Most Upvoted</option>';
  sortSelect.value = sortMode;
  sortSelect.onchange = () => {
    sortMode = sortSelect.value as SortMode;
    ensurePreviewSelection();
    renderContent();
  };
  row.appendChild(sortSelect);

  const lengthSelect = document.createElement('select');
  lengthSelect.className = 'share-select';
  lengthSelect.innerHTML = '<option value="all">All lengths</option><option value="short">Short (1–3 branches)</option><option value="medium">Medium (4–6 branches)</option><option value="long">Long (7+ branches)</option>';
  lengthSelect.value = lengthFilter;
  lengthSelect.onchange = () => {
    lengthFilter = lengthSelect.value as LengthFilter;
    ensurePreviewSelection();
    renderContent();
  };
  row.appendChild(lengthSelect);

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'toolbar-button toolbar-icon-button btn-icon';
  refreshBtn.appendChild(createIcon('undo'));
  refreshBtn.title = 'Refresh the conversation list';
  refreshBtn.onclick = () => {
    allResults = [];
    loadConversations();
  };
  row.appendChild(refreshBtn);

  const downloadAllBtn = document.createElement('button');
  downloadAllBtn.type = 'button';
  downloadAllBtn.className = 'toolbar-button share-download-all-btn';
  setButtonContent(downloadAllBtn, 'download', 'Download All XML');
  downloadAllBtn.title = 'Download all conversations for this faction as a game-ready XML file';
  downloadAllBtn.hidden = activeFaction === 'all';
  downloadAllBtn.onclick = handleDownloadAll;
  row.appendChild(downloadAllBtn);

  // View mode toggle (gallery / list)
  const viewToggle = document.createElement('div');
  viewToggle.className = 'share-view-toggle';

  const galleryBtn = document.createElement('button');
  galleryBtn.type = 'button';
  galleryBtn.textContent = '▦';
  galleryBtn.title = 'Gallery view';
  galleryBtn.className = viewMode === 'gallery' ? 'is-active' : '';
  galleryBtn.onclick = () => { viewMode = 'gallery'; renderContent(); rebuildToolbar(); };

  const listBtn = document.createElement('button');
  listBtn.type = 'button';
  listBtn.textContent = '☰';
  listBtn.title = 'List view';
  listBtn.className = viewMode === 'list' ? 'is-active' : '';
  listBtn.onclick = () => { viewMode = 'list'; renderContent(); rebuildToolbar(); };

  viewToggle.append(galleryBtn, listBtn);
  row.appendChild(viewToggle);

  return row;
}

function updateDownloadAllBtn(): void {
  const btn = getDownloadAllBtn();
  if (btn) btn.hidden = activeFaction === 'all';
}

function rebuildToolbar(): void {
  const toolbar = overlayEl?.querySelector('.share-toolbar-row');
  if (toolbar) toolbar.replaceWith(buildToolbarRow());
}

function renderContent(): void {
  const wrap = getContentEl();
  if (!wrap) return;

  wrap.innerHTML = '';

  if (isLoading) {
    wrap.appendChild(buildLoadingState());
    return;
  }

  if (loadError) {
    wrap.appendChild(buildErrorState(loadError));
    return;
  }

  ensurePreviewSelection();
  const results = getFilteredResults();
  if (results.length === 0) {
    if (communityStats) wrap.appendChild(buildCommunitySummary(0));
    wrap.appendChild(buildEmptyState());
    return;
  }

  const layout = document.createElement('div');
  layout.className = 'share-library-layout';

  const cardsColumn = document.createElement('div');
  cardsColumn.className = 'share-cards-column';
  cardsColumn.appendChild(buildCommunitySummary(results.length));
  if (loadNotice) cardsColumn.appendChild(buildNoticeState(loadNotice));

  if (viewMode === 'list') {
    const list = document.createElement('div');
    list.className = 'share-list';
    for (const conv of results) list.appendChild(buildListRow(conv));
    cardsColumn.appendChild(list);
  } else {
    const grid = document.createElement('div');
    grid.className = 'share-grid';
    for (const conv of results) grid.appendChild(buildCard(conv));
    cardsColumn.appendChild(grid);
  }

  layout.append(cardsColumn, buildPreviewDrawer(getSelectedPreview()));
  wrap.appendChild(layout);
}

function buildLoadingState(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-state-message';
  el.textContent = 'Loading…';
  return el;
}

function buildEmptyState(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-state-message';
  el.textContent = activeFaction === 'all'
    ? 'No conversations matched your filters. Try clearing search terms or publishing a new entry.'
    : `No ${FACTION_DISPLAY_NAMES[activeFaction as FactionId]} conversations matched your filters yet.`;
  return el;
}

function buildNoticeState(msg: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-state-banner';
  el.textContent = msg;
  return el;
}

function buildCommunitySummary(visibleCount: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-state-banner';

  const factionLabel = activeFaction === 'all'
    ? 'all factions'
    : FACTION_DISPLAY_NAMES[activeFaction as FactionId];
  const visibleLabel = `${visibleCount} visible conversation${visibleCount !== 1 ? 's' : ''} in ${factionLabel}`;

  if (!communityStats) {
    el.textContent = visibleLabel;
    return el;
  }

  el.textContent = `${visibleLabel} · ${communityStats.published_conversations} total published conversation${communityStats.published_conversations !== 1 ? 's' : ''} · ${communityStats.published_publishers} total publisher${communityStats.published_publishers !== 1 ? 's' : ''}`;
  return el;
}

function buildErrorState(msg: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-state-message share-state-error';
  el.textContent = msg;

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'toolbar-button';
  retry.textContent = 'Retry';
  retry.style.marginTop = '10px';
  retry.onclick = loadConversations;
  el.appendChild(retry);

  return el;
}

function buildCard(conv: NormalizedConversation): HTMLElement {
  const card = document.createElement('div');
  card.className = `share-card${selectedPreviewId === conv.id ? ' is-selected' : ''}`;
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', `${conv.label || 'Untitled'} by ${conv.author || 'Anonymous'}`);
  card.onclick = () => {
    selectedPreviewId = conv.id;
    renderContent();
  };

  const cardHeader = document.createElement('div');
  cardHeader.className = 'share-card-header';

  const dot = document.createElement('span');
  dot.className = 'share-faction-dot';
  dot.style.backgroundColor = FACTION_COLORS[conv.faction] ?? 'var(--text-dim)';

  const badge = document.createElement('span');
  badge.className = 'share-card-faction-badge';
  badge.textContent = FACTION_DISPLAY_NAMES[conv.faction] ?? conv.faction;
  badge.style.color = FACTION_COLORS[conv.faction] ?? 'var(--text-dim)';

  const title = document.createElement('span');
  title.className = 'share-card-title';
  title.textContent = conv.label || 'Untitled';
  title.title = conv.label || 'Untitled';

  cardHeader.append(dot, badge, title);
  card.appendChild(cardHeader);

  const meta = document.createElement('div');
  meta.className = 'share-card-meta';
  meta.textContent = `${conv.author || 'Anonymous'} · ${formatRelativeDate(conv.updated_at)} · ${conv.branch_count} branches`;
  card.appendChild(meta);

  const stats = document.createElement('div');
  stats.className = 'share-card-stats';
  stats.append(
    buildChip(`${labelForComplexity(conv.complexity)} complexity`),
    buildChip(`↑ ${conv.upvotes}`),
    buildChip(`↓ ${conv.downloads}`),
  );
  card.appendChild(stats);

  if (conv.tags.length > 0) {
    const tags = document.createElement('div');
    tags.className = 'share-tag-list';
    conv.tags.forEach(tag => tags.appendChild(buildChip(`#${tag}`)));
    card.appendChild(tags);
  }

  if (conv.description) {
    const desc = document.createElement('div');
    desc.className = 'share-card-desc';
    desc.textContent = conv.description;
    card.appendChild(desc);
  }

  const actions = document.createElement('div');
  actions.className = 'share-card-actions';

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'toolbar-button btn-sm';
  previewBtn.textContent = 'Preview';
  previewBtn.onclick = (event) => {
    event.stopPropagation();
    selectedPreviewId = conv.id;
    renderContent();
  };
  actions.appendChild(previewBtn);

  const upvoteBtn = document.createElement('button');
  upvoteBtn.type = 'button';
  upvoteBtn.className = 'toolbar-button btn-sm';
  upvoteBtn.textContent = hasUpvoted(conv.id) ? `Upvoted ↑ ${conv.upvotes}` : `Upvote ↑ ${conv.upvotes}`;
  upvoteBtn.disabled = hasUpvoted(conv.id);
  upvoteBtn.onclick = async (event) => {
    event.stopPropagation();
    await handleUpvote(conv, upvoteBtn);
  };
  actions.appendChild(upvoteBtn);

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'toolbar-button btn-sm';
  setButtonContent(importBtn, 'download', 'Import');
  importBtn.title = 'Add this conversation to your current project';
  importBtn.onclick = async (event) => {
    event.stopPropagation();
    await handleImportCard(conv, importBtn);
  };
  actions.appendChild(importBtn);

  card.appendChild(actions);
  return card;
}

function buildListRow(conv: NormalizedConversation): HTMLElement {
  const row = document.createElement('div');
  row.className = `share-list-row${selectedPreviewId === conv.id ? ' is-selected' : ''}`;
  row.onclick = () => {
    selectedPreviewId = conv.id;
    renderContent();
  };

  const dot = document.createElement('span');
  dot.className = 'share-faction-dot';
  dot.style.backgroundColor = FACTION_COLORS[conv.faction] ?? 'var(--text-dim)';

  const title = document.createElement('span');
  title.className = 'share-list-row-title';
  title.textContent = conv.label || 'Untitled';
  title.title = conv.label || 'Untitled';

  const meta = document.createElement('span');
  meta.className = 'share-list-row-meta';
  meta.textContent = `${conv.author || 'Anonymous'} · ${conv.branch_count} branches · ↑${conv.upvotes} · ↓${conv.downloads}`;

  row.append(dot, title, meta);
  return row;
}

function buildPreviewDrawer(conv: NormalizedConversation | null): HTMLElement {
  const drawer = document.createElement('aside');
  drawer.className = 'share-preview-drawer';

  if (!conv) {
    const empty = document.createElement('div');
    empty.className = 'share-state-message';
    empty.textContent = 'Select a conversation to preview its summary before importing.';
    drawer.appendChild(empty);
    return drawer;
  }

  const header = document.createElement('div');
  header.className = 'share-preview-header';

  const title = document.createElement('div');
  title.className = 'share-preview-title';
  title.textContent = conv.label;

  const subtitle = document.createElement('div');
  subtitle.className = 'share-preview-subtitle';
  subtitle.textContent = `${FACTION_DISPLAY_NAMES[conv.faction]} · ${conv.author || 'Anonymous'} · Updated ${formatRelativeDate(conv.updated_at)}`;

  header.append(title, subtitle);
  drawer.appendChild(header);

  const summary = document.createElement('div');
  summary.className = 'share-preview-summary';
  summary.textContent = conv.summary;
  drawer.appendChild(summary);

  const facts = document.createElement('div');
  facts.className = 'share-preview-facts';
  facts.append(
    buildFact('Branches', String(conv.branch_count)),
    buildFact('Complexity', labelForComplexity(conv.complexity)),
    buildFact('Upvotes', String(conv.upvotes)),
    buildFact('Downloads', String(conv.downloads)),
    buildFact('Published', formatExactDate(conv.created_at)),
    buildFact('Source', conv.source === 'bundled' ? 'Bundled fallback' : 'Supabase community'),
  );
  drawer.appendChild(facts);

  if (conv.tags.length > 0) {
    const tagWrap = document.createElement('div');
    tagWrap.className = 'share-tag-list';
    conv.tags.forEach(tag => tagWrap.appendChild(buildChip(`#${tag}`)));
    drawer.appendChild(tagWrap);
  }

  if (conv.description) {
    const description = document.createElement('div');
    description.className = 'share-preview-description';
    description.textContent = conv.description;
    drawer.appendChild(description);
  }

  const actionRow = document.createElement('div');
  actionRow.className = 'share-preview-actions';

  const upvoteBtn = document.createElement('button');
  upvoteBtn.type = 'button';
  upvoteBtn.className = 'toolbar-button';
  upvoteBtn.textContent = hasUpvoted(conv.id) ? `Upvoted ↑ ${conv.upvotes}` : `Upvote ↑ ${conv.upvotes}`;
  upvoteBtn.disabled = hasUpvoted(conv.id);
  upvoteBtn.onclick = async () => handleUpvote(conv, upvoteBtn);

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'toolbar-button btn-primary';
  setButtonContent(importBtn, 'download', 'Import Conversation');
  importBtn.onclick = async () => handleImportCard(conv, importBtn);

  actionRow.append(upvoteBtn, importBtn);
  drawer.appendChild(actionRow);

  const outline = document.createElement('div');
  outline.className = 'share-preview-outline';
  outline.appendChild(buildOutlineHeading('Turn Outline'));
  (conv.data?.conversations?.[0]?.turns ?? []).forEach(turn => {
    const row = document.createElement('div');
    row.className = 'share-preview-outline-row';
    row.textContent = `Turn ${turn.turnNumber}: ${turn.openingMessage?.trim() || turn.customLabel || `${turn.choices.length} choices`}`;
    outline.appendChild(row);
  });
  drawer.appendChild(outline);

  return drawer;
}

function buildFact(label: string, value: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'share-preview-fact';
  const heading = document.createElement('span');
  heading.textContent = label;
  const body = document.createElement('strong');
  body.textContent = value;
  item.append(heading, body);
  return item;
}

function buildOutlineHeading(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-preview-outline-heading';
  el.textContent = text;
  return el;
}

function buildChip(text: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'share-chip';
  chip.textContent = text;
  return chip;
}

function labelForComplexity(value: ConversationComplexity): string {
  if (value === 'short') return 'Short';
  if (value === 'medium') return 'Medium';
  return 'Long';
}

function formatRelativeDate(value: string): string {
  const delta = Date.now() - Date.parse(value);
  const days = Math.floor(delta / 86_400_000);
  if (Number.isNaN(days)) return 'Unknown date';
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatExactDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function handleImportCard(conv: CommunityConversation, btn: HTMLButtonElement): Promise<void> {
  const conversations = conv.data?.conversations;
  if (!conversations || conversations.length === 0) {
    alert('This entry has no conversation data.');
    return;
  }

  importConversations(conversations, conv.faction);
  incrementDownload(conv.id);

  const match = allResults.find(entry => entry.id === conv.id);
  if (match) match.downloads += 1;

  const original = btn.innerHTML;
  btn.disabled = true;
  setButtonContent(btn, 'success', 'Imported!');
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = original;
    renderContent();
  }, 1500);
}

async function handleUpvote(conv: NormalizedConversation, btn: HTMLButtonElement): Promise<void> {
  if (hasUpvoted(conv.id)) return;
  btn.disabled = true;
  btn.textContent = 'Voting…';
  try {
    await incrementUpvote(conv.id);
    rememberUpvote(conv.id);
    const match = allResults.find(entry => entry.id === conv.id);
    if (match) match.upvotes += 1;
    renderContent();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = `Upvote ↑ ${conv.upvotes}`;
    alert(`Upvote failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function getUpvoteSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(LOCAL_UPVOTE_KEY);
    return new Set<string>(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    return new Set();
  }
}

function hasUpvoted(id: string): boolean {
  return getUpvoteSet().has(id);
}

function rememberUpvote(id: string): void {
  if (typeof window === 'undefined') return;
  const votes = getUpvoteSet();
  votes.add(id);
  window.localStorage.setItem(LOCAL_UPVOTE_KEY, JSON.stringify(Array.from(votes)));
}

async function handleDownloadAll(): Promise<void> {
  if (activeFaction === 'all') return;
  const btn = getDownloadAllBtn();
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

  try {
    const results = getFilteredResults().filter(entry => entry.faction === activeFaction);
    if (results.length === 0) {
      alert(`No ${FACTION_DISPLAY_NAMES[activeFaction as FactionId]} conversations to download.`);
      return;
    }

    const mergedProject = createEmptyProject(activeFaction);
    let nextId = 1;
    for (const entry of results) {
      for (const conv of (entry.data?.conversations ?? [])) {
        const c = JSON.parse(JSON.stringify(conv));
        c.id = nextId++;
        mergedProject.conversations.push(c);
      }
    }

    const factionKey = FACTION_XML_KEYS[activeFaction];
    const xml = generateXml(mergedProject);
    downloadFile(xml, `st_PANDA_${factionKey}_interactive_conversations.xml`, 'application/xml');

    results.forEach(r => {
      incrementDownload(r.id);
      const match = allResults.find(entry => entry.id === r.id);
      if (match) match.downloads += 1;
    });
  } catch (err) {
    alert(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      setButtonContent(btn, 'download', 'Download All XML');
    }
    renderContent();
  }
}

function buildPublishForm(): HTMLElement {
  const form = document.createElement('div');
  form.className = 'share-publish-form';
  form.hidden = true;

  const formHeader = document.createElement('div');
  formHeader.className = 'share-publish-form-header';
  formHeader.textContent = 'Publish to Community Library';
  form.appendChild(formHeader);

  const subtitle = document.createElement('div');
  subtitle.className = 'share-publish-form-subtitle';
  subtitle.textContent = 'Anonymous publishing is public, moderated after the fact, and limited to one publish per minute from this browser.';
  form.appendChild(subtitle);

  const titleInput = makeFormField(form, 'Title', 'text', 'Conversation title (unique community title required)') as HTMLInputElement;
  titleInput.maxLength = 70;

  const storedName = getStoredUsername();
  const authorInput = makeFormField(form, 'Author', 'text',
    storedName ? storedName : 'Anonymous (set a username via your profile)') as HTMLInputElement;
  authorInput.maxLength = 32;
  if (storedName) {
    authorInput.value = storedName;
    authorInput.readOnly = true;
    authorInput.style.opacity = '0.7';
    authorInput.title = 'Author name is your profile username. Change it in your profile.';
  }

  const descInput = makeFormField(form, 'Description', 'textarea', 'Brief description of what this conversation does…') as HTMLTextAreaElement;
  descInput.maxLength = 280;

  const summaryInput = makeFormField(form, 'Summary', 'textarea', 'Short preview text shown in the drawer before import.') as HTMLTextAreaElement;
  summaryInput.maxLength = 180;

  const tagsInput = makeFormField(form, 'Tags', 'text', 'Comma-separated tags (e.g. jobs, tutorial, campfire)') as HTMLInputElement;

  const factionRow = document.createElement('div');
  factionRow.className = 'share-form-field';
  const factionLabel = document.createElement('label');
  factionLabel.className = 'share-form-label';
  factionLabel.textContent = 'Faction';
  const factionValue = document.createElement('div');
  factionValue.className = 'share-form-faction-display';
  factionRow.append(factionLabel, factionValue);
  form.appendChild(factionRow);

  const moderationBox = document.createElement('div');
  moderationBox.className = 'share-moderation-box';
  moderationBox.innerHTML = '<strong>Before you publish:</strong> keep titles unique, avoid links or invites, and expect public visibility for anonymous uploads.';
  form.appendChild(moderationBox);

  const consentRow = document.createElement('label');
  consentRow.className = 'share-consent-row';
  const consentInput = document.createElement('input');
  consentInput.type = 'checkbox';
  const consentText = document.createElement('span');
  consentText.textContent = 'I confirm this conversation is my own work, safe for public browsing, and not a duplicate community title.';
  consentRow.append(consentInput, consentText);
  form.appendChild(consentRow);

  const btnRow = document.createElement('div');
  btnRow.className = 'share-publish-btn-row';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'toolbar-button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => { form.hidden = true; showPublishTrigger(); };

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'toolbar-button btn-primary';
  setButtonContent(submitBtn, 'export', 'Publish →');

  btnRow.append(cancelBtn, submitBtn);
  form.appendChild(btnRow);

  const statusMsg = document.createElement('div');
  statusMsg.className = 'share-publish-status';
  form.appendChild(statusMsg);

  const setStatus = (message: string, tone: 'neutral' | 'danger' | 'success' = 'neutral') => {
    statusMsg.textContent = message;
    statusMsg.dataset.tone = tone;
  };

  submitBtn.onclick = async () => {
    const conv = store.getSelectedConversation();
    if (!conv) {
      setStatus('No conversation selected. Select a conversation in the left panel first.', 'danger');
      return;
    }
    if (!consentInput.checked) {
      setStatus('Confirm the moderation checkbox before publishing.', 'danger');
      return;
    }

    const label = titleInput.value.trim() || conv.label || 'Untitled';
    const author = authorInput.value.trim() || 'Anonymous';
    const description = descInput.value.trim();
    const summary = summaryInput.value.trim() || createSummaryFromConversation(conv);
    const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean);
    const faction = getConversationFaction(conv, store.get().project.faction);
    const branchCount = getBranchCount(conv);
    const duplicateLocal = allResults.some(entry => normalizeKey(entry.label) === normalizeKey(label));
    if (duplicateLocal) {
      setStatus('That title already exists in the current library view. Choose a more specific title before publishing.', 'danger');
      return;
    }

    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    setStatus('Validating title, abuse checks, and publish payload…', 'neutral');

    try {
      await publishConversation({
        faction,
        label,
        description,
        summary,
        author,
        tags,
        branch_count: branchCount,
        complexity: deriveConversationComplexity(branchCount),
        data: {
          version: store.get().project.version,
          faction,
          conversations: [conv],
        },
      });
      setStatus('Published successfully. Refreshing the library with your new community entry…', 'success');

      // Award XP for publishing
      const publishXp = getPublishXp(deriveConversationComplexity(branchCount));
      const currentProfile = (globalThis as any).__pandaUserProfile as UserProfile | null;
      if (currentProfile) {
        const oldLevel = currentProfile.level;
        void awardXp(currentProfile.publisher_id, publishXp).then(updated => {
          if (updated) {
            (globalThis as any).__pandaUserProfile = updated;
            setProfileForBadge(updated);
            invalidateLeaderboardCache();
            showXpToast(publishXp, 'Conversation published!');
            if (updated.level > oldLevel) {
              setTimeout(() => showLevelUpToast(updated.level, updated.title), 600);
            }
          }
        });
      }

      setTimeout(() => {
        form.hidden = true;
        setStatus('');
        if (activeFaction !== 'all' && activeFaction !== faction) {
          activeFaction = faction;
          rebuildSidebar();
          updateDownloadAllBtn();
        }
        allResults = [];
        selectedPreviewId = null;
        loadConversations();
      }, 1200);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Publish failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  };

  (form as HTMLElement & { prefill?: () => void }).prefill = () => {
    const conv = store.getSelectedConversation();
    const faction = getConversationFaction(conv, store.get().project.faction);
    const branchCount = getBranchCount(conv ?? undefined);
    titleInput.value = conv?.label || '';
    const currentUsername = getStoredUsername();
    authorInput.value = currentUsername || '';
    authorInput.readOnly = !!currentUsername;
    authorInput.style.opacity = currentUsername ? '0.7' : '1';
    authorInput.placeholder = currentUsername ? currentUsername : 'Anonymous (set a username via your profile)';
    descInput.value = '';
    summaryInput.value = conv ? createSummaryFromConversation(conv) : '';
    tagsInput.value = branchCount <= 3 ? 'short, starter' : 'branching, story';
    factionValue.textContent = `${FACTION_DISPLAY_NAMES[faction]} · ${branchCount} branches · ${labelForComplexity(deriveConversationComplexity(branchCount))}`;
    factionValue.style.color = FACTION_COLORS[faction];
    consentInput.checked = false;
    setStatus(currentUsername
      ? `Publishing as ${currentUsername}. Duplicate titles are rejected.`
      : 'Anonymous publishes are visible to everyone and duplicate titles are rejected.');
  };

  return form;
}

function makeFormField(
  container: HTMLElement,
  labelText: string,
  type: 'text' | 'textarea',
  placeholder: string,
): HTMLInputElement | HTMLTextAreaElement {
  const row = document.createElement('div');
  row.className = 'share-form-field';

  const label = document.createElement('label');
  label.className = 'share-form-label';
  label.textContent = labelText;

  let input: HTMLInputElement | HTMLTextAreaElement;
  if (type === 'textarea') {
    input = document.createElement('textarea');
    input.rows = 3;
  } else {
    input = document.createElement('input');
    (input as HTMLInputElement).type = 'text';
  }
  input.className = 'share-form-input';
  input.placeholder = placeholder;

  row.append(label, input);
  container.appendChild(row);
  return input;
}

function showPublishTrigger(): void {
  overlayEl?.querySelector<HTMLButtonElement>('[data-share-publish]')?.focus();
}

function showPublishForm(): void {
  const conv = store.getSelectedConversation();
  if (!conv) {
    alert('Select a conversation in the left panel first, then click Publish.');
    return;
  }
  const form = overlayEl?.querySelector<HTMLElement & { prefill?: () => void }>('.share-publish-form');
  if (!form) return;
  form.prefill?.();
  form.hidden = false;
  const firstField = form.querySelector<HTMLElement>('.share-form-input');
  firstField?.focus();
}
