// P.A.N.D.A. Conversation Editor — Community Library Panel
// Full-screen modal for browsing and importing shared conversations.
// Conversations are loaded from the static community-data.ts bundle — no external network access.

import { generateXml } from '../lib/xml-export';
import { createEmptyProject } from '../lib/xml-export';
import { type CommunityConversation } from '../lib/api-client';
import { COMMUNITY_CONVERSATIONS } from '../lib/community-data';
import { FACTION_IDS } from '../lib/constants';
import { FACTION_DISPLAY_NAMES, FACTION_XML_KEYS, type FactionId } from '../lib/types';
import { createIcon, setButtonContent } from './icons';
import { importConversations, downloadFile } from './App';

// Faction accent colors matching pda_private_tab.script
const FACTION_COLORS: Record<FactionId, string> = {
  stalker: '#ffd700',
  dolg: '#ff4040',
  freedom: '#40c840',
  csky: '#87ceeb',
  ecolog: '#ffff40',
  killer: '#8080c8',
  army: '#406440',
  bandit: '#a0a0a0',
  monolith: '#ffffff',
  zombied: '#808080',
  isg: '#6496c8',
  renegade: '#c89664',
  greh: '#c8a478',
};

// ─── Panel State ──────────────────────────────────────────────────────────────

let overlayEl: HTMLElement | null = null;
let activeFaction: FactionId | 'all' = 'all';
let searchQuery = '';

// ─── Public API ───────────────────────────────────────────────────────────────

export function openSharePanel(): void {
  if (overlayEl) return;
  activeFaction = 'all';
  searchQuery = '';

  overlayEl = buildOverlay();
  document.body.appendChild(overlayEl);
  renderContent();
}

export function closeSharePanel(): void {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
}

// ─── Filtered Results ─────────────────────────────────────────────────────────

function getFilteredResults(): CommunityConversation[] {
  let results = COMMUNITY_CONVERSATIONS;
  if (activeFaction !== 'all') {
    results = results.filter(c => c.faction === activeFaction);
  }
  const q = searchQuery.trim().toLowerCase();
  if (!q) return results;
  return results.filter(c =>
    c.label.toLowerCase().includes(q) ||
    c.description.toLowerCase().includes(q) ||
    c.author.toLowerCase().includes(q),
  );
}

// ─── DOM References ───────────────────────────────────────────────────────────

function getContentEl(): HTMLElement | null {
  return overlayEl?.querySelector('.share-grid-wrap') ?? null;
}

function getDownloadAllBtn(): HTMLButtonElement | null {
  return overlayEl?.querySelector<HTMLButtonElement>('.share-download-all-btn') ?? null;
}

// ─── Build Modal ──────────────────────────────────────────────────────────────

function buildOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'share-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeSharePanel(); };

  const modal = document.createElement('div');
  modal.className = 'share-modal';
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

  overlay.appendChild(modal);
  return overlay;
}

// ─── Header ───────────────────────────────────────────────────────────────────

function buildHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'share-modal-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'share-modal-title';
  titleWrap.append(createIcon('share'), document.createTextNode('Community Library'));
  header.appendChild(titleWrap);

  const spacer = document.createElement('div');
  spacer.style.flex = '1';
  header.appendChild(spacer);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toolbar-button toolbar-icon-button btn-icon';
  closeBtn.appendChild(createIcon('close'));
  closeBtn.title = 'Close Community Library';
  closeBtn.onclick = closeSharePanel;
  header.appendChild(closeBtn);

  return header;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

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
    searchQuery = '';
    rebuildSidebar();
    updateDownloadAllBtn();
    renderContent();
  };
  return tab;
}

function rebuildSidebar(): void {
  const sidebar = overlayEl?.querySelector('.share-sidebar');
  if (!sidebar) return;
  const newSidebar = buildSidebar();
  sidebar.replaceWith(newSidebar);
}

// ─── Toolbar Row ──────────────────────────────────────────────────────────────

function buildToolbarRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'share-toolbar-row';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'share-search';
  searchInput.placeholder = 'Search by title, author, description…';
  searchInput.value = searchQuery;
  searchInput.oninput = () => {
    searchQuery = searchInput.value;
    renderContent();
  };
  row.appendChild(searchInput);

  const downloadAllBtn = document.createElement('button');
  downloadAllBtn.type = 'button';
  downloadAllBtn.className = 'toolbar-button share-download-all-btn';
  setButtonContent(downloadAllBtn, 'download', 'Download All XML');
  downloadAllBtn.title = 'Download all conversations for this faction as a game-ready XML file';
  downloadAllBtn.hidden = activeFaction === 'all';
  downloadAllBtn.onclick = handleDownloadAll;
  row.appendChild(downloadAllBtn);

  return row;
}

function updateDownloadAllBtn(): void {
  const btn = getDownloadAllBtn();
  if (btn) btn.hidden = activeFaction === 'all';
}

// ─── Content Rendering ────────────────────────────────────────────────────────

function renderContent(): void {
  const wrap = getContentEl();
  if (!wrap) return;

  wrap.innerHTML = '';

  const results = getFilteredResults();
  if (results.length === 0) {
    wrap.appendChild(buildEmptyState());
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'share-grid';
  for (const conv of results) grid.appendChild(buildCard(conv));
  wrap.appendChild(grid);
}

// ─── State Displays ───────────────────────────────────────────────────────────

function buildEmptyState(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'share-state-message';
  el.textContent = activeFaction === 'all'
    ? 'No conversations in the library yet.'
    : `No ${FACTION_DISPLAY_NAMES[activeFaction as FactionId]} conversations yet.`;
  return el;
}

// ─── Conversation Card ────────────────────────────────────────────────────────

function buildCard(conv: CommunityConversation): HTMLElement {
  const card = document.createElement('div');
  card.className = 'share-card';

  // Header row: dot + faction badge + title
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

  // Meta: author · date
  const meta = document.createElement('div');
  meta.className = 'share-card-meta';
  const date = new Date(conv.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  meta.textContent = `${conv.author || 'Anonymous'} · ${date}`;
  if (conv.downloads > 0) {
    meta.textContent += ` · ↓ ${conv.downloads}`;
  }
  card.appendChild(meta);

  // Description
  if (conv.description) {
    const desc = document.createElement('div');
    desc.className = 'share-card-desc';
    desc.textContent = conv.description;
    card.appendChild(desc);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'share-card-actions';

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'toolbar-button btn-sm';
  setButtonContent(importBtn, 'download', 'Import');
  importBtn.title = 'Add this conversation to your current project';
  importBtn.onclick = () => handleImportCard(conv, importBtn);
  actions.appendChild(importBtn);

  card.appendChild(actions);
  return card;
}

// ─── Import Card ──────────────────────────────────────────────────────────────

function handleImportCard(conv: CommunityConversation, btn: HTMLButtonElement): void {
  const conversations = conv.data?.conversations;
  if (!conversations || conversations.length === 0) {
    alert('This entry has no conversation data.');
    return;
  }

  importConversations(conversations);

  // Visual feedback
  const original = btn.innerHTML;
  btn.disabled = true;
  setButtonContent(btn, 'success', 'Imported!');
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = original;
  }, 2000);
}

// ─── Download All XML ─────────────────────────────────────────────────────────

function handleDownloadAll(): void {
  if (activeFaction === 'all') return;
  const btn = getDownloadAllBtn();

  const results = COMMUNITY_CONVERSATIONS.filter(c => c.faction === activeFaction);
  if (results.length === 0) {
    alert(`No ${FACTION_DISPLAY_NAMES[activeFaction as FactionId]} conversations to download.`);
    return;
  }

  // Merge all conversations into a single project, re-numbering IDs
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

  if (btn) {
    btn.disabled = true;
    setTimeout(() => { btn.disabled = false; }, 1000);
  }
}
