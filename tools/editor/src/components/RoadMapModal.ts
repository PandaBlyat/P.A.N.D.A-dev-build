// P.A.N.D.A. Conversation Editor — RoadMap Modal

import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { createIcon } from './icons';
import { t } from '../lib/i18n';
import {
  fetchRoadmapItems,
  createRoadmapItem,
  updateRoadmapItem,
  deleteRoadmapItem,
  upvoteRoadmapItem,
  hasUpvotedRoadmapItem,
  getStoredUsername,
  type RoadmapItem,
  type RoadmapStatus,
  type RoadmapCategory,
} from '../lib/api-client';

const MODAL_MOUNT_ID = 'app-modal-host';

function isPandaAdmin(): boolean {
  const profile = (globalThis as typeof globalThis & { __pandaUserProfile?: { publisher_id?: string; username?: string } | null }).__pandaUserProfile;
  const username = profile?.username?.trim() || getStoredUsername();
  return Boolean(profile?.publisher_id) || (username ?? '').trim().toLowerCase() === 'panda';
}

function getCurrentPublisherId(): string | null {
  const profile = (globalThis as any).__pandaUserProfile;
  return typeof profile?.publisher_id === 'string' ? profile.publisher_id : null;
}

const STATUS_CONFIG: Record<RoadmapStatus, { label: string; color: string; order: number }> = {
  development: { label: 'In Development', color: 'var(--accent)', order: 0 },
  planned:     { label: 'Planned',        color: 'var(--info)',   order: 1 },
  considering: { label: 'Under Consideration', color: 'var(--warning)', order: 2 },
  completed:   { label: 'Completed',      color: 'var(--text-dim)', order: 3 },
  dropped:     { label: 'Dropped',        color: 'var(--danger)',  order: 4 },
};

const CATEGORY_CONFIG: Record<RoadmapCategory, { label: string; color: string }> = {
  feature:     { label: 'Feature',     color: 'var(--info)' },
  improvement: { label: 'Improvement', color: 'var(--accent)' },
  community:   { label: 'Community',   color: 'var(--warning)' },
  bug:         { label: 'Bug Fix',     color: 'var(--danger)' },
};

let modalEl: HTMLElement | null = null;
let focusTrapCtrl: FocusTrapController | null = null;
let restoreFocusEl: HTMLElement | null = null;

function getMount(): HTMLElement {
  return document.getElementById(MODAL_MOUNT_ID) ?? document.body;
}

export function openRoadMapModal(triggerEl?: HTMLElement | null): void {
  if (modalEl) return;
  restoreFocusEl = triggerEl ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);

  const overlay = document.createElement('div');
  overlay.className = 'roadmap-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeRoadMapModal(); };

  const modal = document.createElement('div');
  modal.className = 'roadmap-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'roadmap-modal-title');

  // ── Header ────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'roadmap-modal-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'roadmap-modal-title-wrap';
  const icon = createIcon('map');
  icon.className = 'roadmap-modal-icon ui-icon';
  const titleEl = document.createElement('h2');
  titleEl.className = 'roadmap-modal-title';
  titleEl.id = 'roadmap-modal-title';
  titleEl.textContent = t('roadmap.title');
  const subtitleEl = document.createElement('p');
  subtitleEl.className = 'roadmap-modal-subtitle';
  subtitleEl.textContent = t('roadmap.subtitle');
  titleWrap.append(icon, titleEl, subtitleEl);

  const headerActions = document.createElement('div');
  headerActions.className = 'roadmap-modal-header-actions';

  if (isPandaAdmin()) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-primary roadmap-add-btn';
    addBtn.append(createIcon('add'), document.createTextNode('Add Item'));
    addBtn.onclick = () => openItemEditor(null, body, () => reloadItems(body));
    headerActions.appendChild(addBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'roadmap-modal-close';
  closeBtn.setAttribute('aria-label', t('roadmap.close.aria'));
  closeBtn.appendChild(createIcon('close'));
  closeBtn.onclick = closeRoadMapModal;
  headerActions.append(closeBtn);

  header.append(titleWrap, headerActions);

  // ── Legend ────────────────────────────────────────────────────────
  const legend = document.createElement('div');
  legend.className = 'roadmap-legend';
  const visibleStatuses: RoadmapStatus[] = ['development', 'planned', 'considering', 'completed'];
  visibleStatuses.forEach(status => {
    const dot = document.createElement('span');
    dot.className = 'roadmap-legend-dot';
    dot.style.background = STATUS_CONFIG[status].color;
    const label = document.createElement('span');
    label.className = 'roadmap-legend-label';
    label.textContent = STATUS_CONFIG[status].label;
    const chip = document.createElement('span');
    chip.className = 'roadmap-legend-chip';
    chip.append(dot, label);
    legend.appendChild(chip);
  });

  // ── Body ──────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'roadmap-modal-body';

  const loadingEl = document.createElement('div');
  loadingEl.className = 'roadmap-loading';
  loadingEl.textContent = t('roadmap.loading');
  body.appendChild(loadingEl);

  modal.append(header, legend, body);
  overlay.appendChild(modal);
  getMount().appendChild(overlay);

  modalEl = overlay;
  focusTrapCtrl = trapFocus(overlay);
  closeBtn.focus();

  // Load items
  reloadItems(body);

  // ESC to close
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRoadMapModal();
  });
}

export function closeRoadMapModal(): void {
  if (!modalEl) return;
  focusTrapCtrl?.release();
  focusTrapCtrl = null;
  modalEl.remove();
  modalEl = null;
  restoreFocusEl?.focus();
  restoreFocusEl = null;
}

// ── Reload items from API ──────────────────────────────────────────
async function reloadItems(body: HTMLElement): Promise<void> {
  body.replaceChildren();
  const loading = document.createElement('div');
  loading.className = 'roadmap-loading';
  loading.textContent = t('roadmap.loading');
  body.appendChild(loading);

  let items: RoadmapItem[];
  try {
    items = await fetchRoadmapItems();
  } catch {
    body.replaceChildren();
    const err = document.createElement('div');
    err.className = 'roadmap-error';
    err.textContent = t('roadmap.errorLoad');
    body.appendChild(err);
    return;
  }

  body.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'roadmap-empty';
    empty.textContent = t('roadmap.empty');
    body.appendChild(empty);
    return;
  }

  const columns = document.createElement('div');
  columns.className = 'roadmap-columns';

  const visibleStatuses: RoadmapStatus[] = ['development', 'planned', 'considering', 'completed'];
  visibleStatuses.forEach(status => {
    const col = buildColumn(status, items.filter(i => i.status === status), body);
    columns.appendChild(col);
  });

  body.appendChild(columns);
}

// ── Build a status column ──────────────────────────────────────────
function buildColumn(status: RoadmapStatus, items: RoadmapItem[], body: HTMLElement): HTMLElement {
  const col = document.createElement('div');
  col.className = 'roadmap-column';

  const colHeader = document.createElement('div');
  colHeader.className = 'roadmap-column-header';
  const dot = document.createElement('span');
  dot.className = 'roadmap-column-dot';
  dot.style.background = STATUS_CONFIG[status].color;
  const colTitle = document.createElement('span');
  colTitle.className = 'roadmap-column-title';
  colTitle.textContent = STATUS_CONFIG[status].label;
  const countBadge = document.createElement('span');
  countBadge.className = 'roadmap-column-count';
  countBadge.textContent = String(items.length);
  colHeader.append(dot, colTitle, countBadge);
  col.appendChild(colHeader);

  const cards = document.createElement('div');
  cards.className = 'roadmap-cards';

  const sorted = [...items].sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0) || b.priority - a.priority);
  sorted.forEach(item => {
    cards.appendChild(buildCard(item, body));
  });

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'roadmap-card-empty';
    empty.textContent = t('roadmap.emptySection');
    cards.appendChild(empty);
  }

  col.appendChild(cards);
  return col;
}

// ── Build an item card ─────────────────────────────────────────────
function buildCard(item: RoadmapItem, body: HTMLElement): HTMLElement {
  const card = document.createElement('div');
  card.className = 'roadmap-card';
  card.dataset.itemId = item.id;

  const cardHeader = document.createElement('div');
  cardHeader.className = 'roadmap-card-header';

  const catCfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.feature;
  const catChip = document.createElement('span');
  catChip.className = 'roadmap-card-category';
  catChip.style.borderColor = catCfg.color;
  catChip.style.color = catCfg.color;
  catChip.textContent = catCfg.label;

  const title = document.createElement('h3');
  title.className = 'roadmap-card-title';
  title.textContent = item.title;

  cardHeader.append(catChip);

  if (isPandaAdmin()) {
    const adminActions = document.createElement('div');
    adminActions.className = 'roadmap-card-admin-actions';

    const statusSelect = document.createElement('select');
    statusSelect.className = 'roadmap-card-status-select';
    statusSelect.title = t('roadmap.item.status.tooltip');
    (['development', 'planned', 'considering', 'completed', 'dropped'] as RoadmapStatus[]).forEach((status) => {
      const opt = document.createElement('option');
      opt.value = status;
      opt.textContent = STATUS_CONFIG[status].label;
      opt.selected = status === item.status;
      statusSelect.appendChild(opt);
    });
    statusSelect.onpointerdown = (event) => event.stopPropagation();
    statusSelect.onclick = (event) => event.stopPropagation();
    statusSelect.onchange = async () => {
      const previous = item.status;
      const next = statusSelect.value as RoadmapStatus;
      statusSelect.disabled = true;
      try {
        await updateRoadmapItem(item.id, { status: next });
        await reloadItems(body);
      } catch {
        statusSelect.value = previous;
        statusSelect.disabled = false;
        alert('Failed to update roadmap status.');
      }
    };

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'roadmap-card-admin-btn';
    editBtn.title = t('roadmap.item.edit.tooltip');
    editBtn.appendChild(createIcon('duplicate'));
    editBtn.onclick = () => openItemEditor(item, body, () => reloadItems(body));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'roadmap-card-admin-btn roadmap-card-admin-btn-danger';
    deleteBtn.title = t('roadmap.item.delete.tooltip');
    deleteBtn.appendChild(createIcon('delete'));
    deleteBtn.onclick = async () => {
      if (!confirm(`Delete "${item.title}"?`)) return;
      try {
        await deleteRoadmapItem(item.id);
        await reloadItems(body);
      } catch {
        alert('Failed to delete item.');
      }
    };

    if (item.status !== 'completed') {
      const completeBtn = document.createElement('button');
      completeBtn.type = 'button';
      completeBtn.className = 'roadmap-card-admin-btn roadmap-card-complete-btn';
      completeBtn.title = t('roadmap.item.complete.tooltip');
      completeBtn.appendChild(createIcon('check'));
      completeBtn.onclick = async () => {
        completeBtn.disabled = true;
        try {
          await updateRoadmapItem(item.id, { status: 'completed' });
          await reloadItems(body);
        } catch {
          completeBtn.disabled = false;
          alert('Failed to mark completed.');
        }
      };
      adminActions.appendChild(completeBtn);
    }

    adminActions.append(statusSelect, editBtn, deleteBtn);
    cardHeader.appendChild(adminActions);
  }

  const description = document.createElement('p');
  description.className = 'roadmap-card-desc';
  description.textContent = item.description || '';

  const cardFooter = document.createElement('div');
  cardFooter.className = 'roadmap-card-footer';

  const publisherId = getCurrentPublisherId();
  const alreadyVoted = hasUpvotedRoadmapItem(item.id, publisherId);

  const upvoteBtn = document.createElement('button');
  upvoteBtn.type = 'button';
  upvoteBtn.className = `roadmap-upvote-btn${alreadyVoted ? ' is-voted' : ''}`;
  upvoteBtn.title = alreadyVoted ? 'You upvoted this' : 'Upvote this idea';
  upvoteBtn.disabled = alreadyVoted;

  const upvoteIcon = createIcon('upvote');
  const upvoteCount = document.createElement('span');
  upvoteCount.className = 'roadmap-upvote-count';
  upvoteCount.textContent = String(item.upvotes ?? 0);
  upvoteBtn.append(upvoteIcon, upvoteCount);

  upvoteBtn.onclick = async () => {
    if (alreadyVoted) return;
    upvoteBtn.disabled = true;
    upvoteBtn.classList.add('is-voted');
    const prev = parseInt(upvoteCount.textContent ?? '0', 10);
    upvoteCount.textContent = String(prev + 1);
    try {
      await upvoteRoadmapItem(item.id, publisherId);
    } catch {
      upvoteBtn.disabled = false;
      upvoteBtn.classList.remove('is-voted');
      upvoteCount.textContent = String(prev);
    }
  };

  cardFooter.appendChild(upvoteBtn);
  card.append(cardHeader, title, description, cardFooter);
  return card;
}

// ── Item editor form (admin only) ──────────────────────────────────
function openItemEditor(
  existing: RoadmapItem | null,
  body: HTMLElement,
  onSaved: () => void,
): void {
  const overlay = document.createElement('div');
  overlay.className = 'roadmap-editor-overlay';

  const form = document.createElement('div');
  form.className = 'roadmap-editor-form';
  form.setAttribute('role', 'dialog');
  form.setAttribute('aria-modal', 'true');
  form.setAttribute('aria-label', existing ? 'Edit roadmap item' : 'Add roadmap item');

  const formTitle = document.createElement('h3');
  formTitle.className = 'roadmap-editor-title';
  formTitle.textContent = existing ? 'Edit Item' : 'Add Roadmap Item';

  // Title field
  const titleLabel = document.createElement('label');
  titleLabel.className = 'roadmap-editor-label';
  titleLabel.textContent = t('roadmap.form.title.label');
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'roadmap-editor-input';
  titleInput.placeholder = t('roadmap.form.title.placeholder');
  titleInput.maxLength = 80;
  titleInput.value = existing?.title ?? '';
  titleLabel.appendChild(titleInput);

  // Description field
  const descLabel = document.createElement('label');
  descLabel.className = 'roadmap-editor-label';
  descLabel.textContent = t('roadmap.form.description.label');
  const descInput = document.createElement('textarea');
  descInput.className = 'roadmap-editor-textarea';
  descInput.placeholder = t('roadmap.form.description.placeholder');
  descInput.maxLength = 400;
  descInput.rows = 3;
  descInput.value = existing?.description ?? '';
  descLabel.appendChild(descInput);

  // Status field
  const statusLabel = document.createElement('label');
  statusLabel.className = 'roadmap-editor-label';
  statusLabel.textContent = t('roadmap.form.status.label');
  const statusSelect = document.createElement('select');
  statusSelect.className = 'roadmap-editor-select';
  const allStatuses: RoadmapStatus[] = ['development', 'planned', 'considering', 'completed', 'dropped'];
  allStatuses.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = STATUS_CONFIG[s].label;
    opt.selected = (existing?.status ?? 'planned') === s;
    statusSelect.appendChild(opt);
  });
  statusLabel.appendChild(statusSelect);

  // Category field
  const catLabel = document.createElement('label');
  catLabel.className = 'roadmap-editor-label';
  catLabel.textContent = t('roadmap.form.category.label');
  const catSelect = document.createElement('select');
  catSelect.className = 'roadmap-editor-select';
  const allCats: RoadmapCategory[] = ['feature', 'improvement', 'community', 'bug'];
  allCats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = CATEGORY_CONFIG[c].label;
    opt.selected = (existing?.category ?? 'feature') === c;
    catSelect.appendChild(opt);
  });
  catLabel.appendChild(catSelect);

  // Priority field
  const prioLabel = document.createElement('label');
  prioLabel.className = 'roadmap-editor-label';
  prioLabel.textContent = t('roadmap.form.priority.label');
  const prioInput = document.createElement('input');
  prioInput.type = 'number';
  prioInput.className = 'roadmap-editor-input';
  prioInput.min = '0';
  prioInput.max = '10';
  prioInput.value = String(existing?.priority ?? 0);
  prioLabel.appendChild(prioInput);

  // Error
  const errorEl = document.createElement('p');
  errorEl.className = 'roadmap-editor-error';
  errorEl.hidden = true;

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'roadmap-editor-btn-row';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-subtle';
  cancelBtn.textContent = t('roadmap.action.cancel');

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = existing ? 'Save Changes' : 'Add to Roadmap';

  btnRow.append(cancelBtn, saveBtn);
  form.append(formTitle, titleLabel, descLabel, statusLabel, catLabel, prioLabel, errorEl, btnRow);
  overlay.appendChild(form);
  document.body.appendChild(overlay);

  const editorTrap = trapFocus(form);

  function closeEditor(): void {
    editorTrap.release();
    overlay.remove();
  }

  cancelBtn.onclick = () => closeEditor();

  saveBtn.onclick = async () => {
    const title = titleInput.value.trim();
    if (!title) {
      errorEl.textContent = t('roadmap.error.titleRequired');
      errorEl.hidden = false;
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = t('roadmap.status.saving');
    errorEl.hidden = true;
    try {
      const payload = {
        title,
        description: descInput.value.trim(),
        status: statusSelect.value as RoadmapStatus,
        category: catSelect.value as RoadmapCategory,
        priority: Math.max(0, Math.min(10, parseInt(prioInput.value, 10) || 0)),
      };
      if (existing) {
        await updateRoadmapItem(existing.id, payload);
      } else {
        await createRoadmapItem(payload);
      }
      closeEditor();
      onSaved();
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : 'Failed to save.';
      errorEl.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = existing ? 'Save Changes' : 'Add to Roadmap';
    }
  };

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEditor();
  });
  overlay.onclick = (e) => { if (e.target === overlay) closeEditor(); };
}
