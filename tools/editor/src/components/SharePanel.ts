// P.A.N.D.A. Conversation Editor — Community Library Panel
// Full-screen modal for browsing, publishing, and importing shared conversations.
// All data goes through the local API server — no Supabase URLs or keys in the browser.

import { store } from '../lib/state';
import { generateXml } from '../lib/xml-export';
import { createEmptyProject } from '../lib/xml-export';
import {
  fetchConversations,
  publishConversation,
  incrementDownload,
  type CommunityConversation,
} from '../lib/api-client';
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
let allResults: CommunityConversation[] = [];
let searchQuery = '';
let isLoading = false;
let loadError = '';

// ─── Public API ───────────────────────────────────────────────────────────────

export function openSharePanel(): void {
  if (overlayEl) return;
  activeFaction = 'all';
  allResults = [];
  searchQuery = '';
  isLoading = false;
  loadError = '';

  overlayEl = buildOverlay();
  document.body.appendChild(overlayEl);
  loadConversations();
}

export function closeSharePanel(): void {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadConversations(): Promise<void> {
  isLoading = true;
  loadError = '';
  renderContent();

  try {
    allResults = await fetchConversations(activeFaction === 'all' ? undefined : activeFaction);
    loadError = '';
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Failed to load conversations.';
  } finally {
    isLoading = false;
    renderContent();
  }
}

// ─── Filtered Results ─────────────────────────────────────────────────────────

function getFilteredResults(): CommunityConversation[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return allResults;
  return allResults.filter(c =>
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

  // Publish form (absolute overlay inside modal body)
  const publishForm = buildPublishForm();
  modal.appendChild(publishForm);

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

  const publishBtn = document.createElement('button');
  publishBtn.type = 'button';
  publishBtn.className = 'toolbar-button btn-primary';
  setButtonContent(publishBtn, 'export', 'Publish');
  publishBtn.title = 'Publish the currently selected conversation to the Community Library';
  publishBtn.onclick = () => showPublishForm();
  header.appendChild(publishBtn);

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
    allResults = [];
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

  if (isLoading) {
    wrap.appendChild(buildLoadingState());
    return;
  }

  if (loadError) {
    wrap.appendChild(buildErrorState(loadError));
    return;
  }

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
    ? 'No conversations in the library yet. Be the first to publish!'
    : `No ${FACTION_DISPLAY_NAMES[activeFaction as FactionId]} conversations yet. Publish one!`;
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

// ─── Conversation Card ────────────────────────────────────────────────────────

function buildCard(conv: CommunityConversation): HTMLElement {
  const card = document.createElement('div');
  card.className = 'share-card';

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
  const date = new Date(conv.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  meta.textContent = `${conv.author || 'Anonymous'} · ${date}`;
  if (conv.downloads > 0) meta.textContent += ` · ↓ ${conv.downloads}`;
  card.appendChild(meta);

  if (conv.description) {
    const desc = document.createElement('div');
    desc.className = 'share-card-desc';
    desc.textContent = conv.description;
    card.appendChild(desc);
  }

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

async function handleImportCard(conv: CommunityConversation, btn: HTMLButtonElement): Promise<void> {
  const conversations = conv.data?.conversations;
  if (!conversations || conversations.length === 0) {
    alert('This entry has no conversation data.');
    return;
  }

  importConversations(conversations);
  incrementDownload(conv.id);

  const original = btn.innerHTML;
  btn.disabled = true;
  setButtonContent(btn, 'success', 'Imported!');
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = original;
  }, 2000);
}

// ─── Download All XML ─────────────────────────────────────────────────────────

async function handleDownloadAll(): Promise<void> {
  if (activeFaction === 'all') return;
  const btn = getDownloadAllBtn();
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

  try {
    const results = await fetchConversations(activeFaction);
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

    results.forEach(r => incrementDownload(r.id));
  } catch (err) {
    alert(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      setButtonContent(btn, 'download', 'Download All XML');
    }
  }
}

// ─── Publish Form ─────────────────────────────────────────────────────────────

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
  subtitle.textContent = 'Publishing the currently selected conversation.';
  form.appendChild(subtitle);

  const titleInput = makeFormField(form, 'Title', 'text', 'Conversation title (e.g. "Friendly Loner Job Offer")');
  const authorInput = makeFormField(form, 'Author', 'text', 'Your name or handle (optional)');
  const descInput = makeFormField(form, 'Description', 'textarea', 'Brief description of what this conversation does…');

  const factionRow = document.createElement('div');
  factionRow.className = 'share-form-field';
  const factionLabel = document.createElement('label');
  factionLabel.className = 'share-form-label';
  factionLabel.textContent = 'Faction';
  const factionValue = document.createElement('div');
  factionValue.className = 'share-form-faction-display';
  factionRow.append(factionLabel, factionValue);
  form.appendChild(factionRow);

  const btnRow = document.createElement('div');
  btnRow.className = 'share-publish-btn-row';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'toolbar-button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => { form.hidden = true; };

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'toolbar-button btn-primary';
  setButtonContent(submitBtn, 'export', 'Publish →');

  btnRow.append(cancelBtn, submitBtn);
  form.appendChild(btnRow);

  const statusMsg = document.createElement('div');
  statusMsg.className = 'share-publish-status';
  form.appendChild(statusMsg);

  submitBtn.onclick = async () => {
    const conv = store.getSelectedConversation();
    if (!conv) {
      statusMsg.textContent = 'No conversation selected. Select a conversation in the left panel first.';
      statusMsg.style.color = 'var(--danger)';
      return;
    }

    const label = (titleInput as HTMLInputElement).value.trim() || conv.label || 'Untitled';
    const author = (authorInput as HTMLInputElement).value.trim() || 'Anonymous';
    const description = (descInput as HTMLTextAreaElement).value.trim();
    const faction = store.get().project.faction;

    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    statusMsg.textContent = 'Publishing…';
    statusMsg.style.color = 'var(--text-dim)';

    try {
      await publishConversation({
        faction,
        label,
        description,
        author,
        data: {
          version: store.get().project.version,
          faction,
          conversations: [conv],
        },
      });
      statusMsg.textContent = 'Published successfully!';
      statusMsg.style.color = 'var(--accent)';
      setTimeout(() => {
        form.hidden = true;
        statusMsg.textContent = '';
        if (activeFaction === 'all' || activeFaction === faction) {
          loadConversations();
        }
      }, 1500);
    } catch (err) {
      statusMsg.textContent = err instanceof Error ? err.message : 'Publish failed.';
      statusMsg.style.color = 'var(--danger)';
    } finally {
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  };

  (form as HTMLElement & { prefill?: () => void }).prefill = () => {
    const conv = store.getSelectedConversation();
    const faction = store.get().project.faction;
    (titleInput as HTMLInputElement).value = conv?.label || '';
    (authorInput as HTMLInputElement).value = '';
    (descInput as HTMLTextAreaElement).value = '';
    factionValue.textContent = FACTION_DISPLAY_NAMES[faction];
    factionValue.style.color = FACTION_COLORS[faction];
    statusMsg.textContent = '';
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
}
