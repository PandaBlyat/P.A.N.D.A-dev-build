// P.A.N.D.A. Conversation Editor — NPC Template Panel
// Modal panel for authoring custom NPC templates inline.
// Opened from spawn_custom_npc / spawn_custom_npc_at outcome params.

import { store } from '../lib/state';
import type { NpcTemplate } from '../lib/types';
import { FACTION_DISPLAY_NAMES } from '../lib/types';
import { FACTION_IDS, RANKS } from '../lib/constants';
import { GAME_ITEM_CATALOG } from '../lib/item-catalog';
import { trapFocus } from '../lib/focus-trap';
import { createItemPickerPanelEditor } from './ItemPickerPanel';

// ── Constants ──────────────────────────────────────────────────────────────

const RELATION_OPTIONS = [
  { value: 'default', label: 'Default (faction-based)' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'hostile', label: 'Hostile' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'companion', label: 'Companion (follows player)' },
];

const ATTACHMENT_OPTIONS = [
  { value: '0', label: 'None' },
  { value: 'r', label: 'Random' },
];

const AMMO_OPTIONS = [
  { value: '0', label: 'First type' },
  { value: 'r', label: 'Random type' },
];

const MOUNT_ID = 'app-modal-host';

// ── Template encode / decode ──────────────────────────────────────────────

export function encodeNpcTemplate(t: NpcTemplate): string {
  const parts: string[] = [];
  parts.push(`name=${t.name}`);
  parts.push(`faction=${t.faction}`);
  if (t.rank) parts.push(`rank=${t.rank}`);
  if (t.primary) parts.push(`primary=${t.primary}`);
  if (t.secondary) parts.push(`secondary=${t.secondary}`);
  if (t.outfit) parts.push(`outfit=${t.outfit}`);
  if (t.items) parts.push(`items=${t.items}`);
  if (t.relation && t.relation !== 'default') parts.push(`relation=${t.relation}`);
  if (t.spawnDist != null && t.spawnDist !== 50) parts.push(`spawn_dist=${t.spawnDist}`);
  if (t.count != null && t.count > 1) parts.push(`count=${t.count}`);
  if (t.trader) parts.push(`trader=1`);
  return parts.join('|');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getMount(): HTMLElement {
  return document.getElementById(MOUNT_ID) ?? document.body;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
}

function parseWeaponStr(str: string): { section: string; attachment: string; ammo: string } {
  const parts = str.split(':');
  return { section: parts[0] ?? '', attachment: parts[1] ?? '0', ammo: parts[2] ?? '0' };
}

function buildWeaponStr(section: string, attachment: string, ammo: string): string {
  if (!section) return '';
  const needAmmo = ammo !== '0';
  const needAttach = attachment !== '0' || needAmmo;
  if (!needAttach) return section;
  if (!needAmmo) return `${section}:${attachment}`;
  return `${section}:${attachment}:${ammo}`;
}

function parseItemsList(raw: string): Array<{ section: string; count: string }> {
  if (!raw) return [];
  return raw.split(',').map(entry => {
    const i = entry.lastIndexOf(':');
    return i >= 0
      ? { section: entry.slice(0, i).trim(), count: entry.slice(i + 1).trim() }
      : { section: entry.trim(), count: '1' };
  }).filter(e => e.section);
}

function buildItemsList(rows: Array<{ section: string; count: string }>): string {
  return rows.filter(r => r.section.trim()).map(r => `${r.section.trim()}:${r.count || '1'}`).join(',');
}

function getTemplateSummary(t: NpcTemplate): string {
  const parts: string[] = [];
  const factionLabel = FACTION_DISPLAY_NAMES[t.faction as keyof typeof FACTION_DISPLAY_NAMES] ?? t.faction;
  parts.push(factionLabel);
  if (t.rank) parts.push(t.rank);
  if (t.relation && t.relation !== 'default') parts.push(t.relation);
  if (t.count && t.count > 1) parts.push(`×${t.count}`);
  return parts.join(' · ');
}

// ── Modal state ────────────────────────────────────────────────────────────

let activeCleanup: (() => void) | null = null;
let activeTrigger: HTMLElement | null = null;

// ── Modal builder ──────────────────────────────────────────────────────────

function openNpcBuilderPanel(options: {
  trigger: HTMLElement;
  existingTemplateId: string;
  onSave: (template: NpcTemplate) => void;
  onDelete: (id: string) => void;
}): void {
  if (activeCleanup) {
    const shouldClose = activeTrigger === options.trigger;
    activeCleanup();
    if (shouldClose) return;
  }

  const existing = options.existingTemplateId
    ? (store.get().project.npcTemplates ?? []).find(t => t.id === options.existingTemplateId) ?? null
    : null;

  // Mutable local form state
  const form = {
    id: existing?.id ?? '',
    name: existing?.name ?? '',
    faction: existing?.faction ?? store.get().project.faction ?? 'stalker',
    rank: existing?.rank ?? 'veteran',
    relation: existing?.relation ?? 'default',
    primarySection: '',
    primaryAttachment: '0',
    primaryAmmo: '0',
    secondarySection: '',
    secondaryAttachment: '0',
    secondaryAmmo: '0',
    outfit: existing?.outfit ?? '',
    items: parseItemsList(existing?.items ?? ''),
    spawnDist: String(existing?.spawnDist ?? 50),
    count: String(existing?.count ?? 1),
    trader: existing?.trader ?? false,
    idManual: !!existing,
  };

  if (existing?.primary) {
    const p = parseWeaponStr(existing.primary);
    form.primarySection = p.section;
    form.primaryAttachment = p.attachment;
    form.primaryAmmo = p.ammo;
  }
  if (existing?.secondary) {
    const s = parseWeaponStr(existing.secondary);
    form.secondarySection = s.section;
    form.secondaryAttachment = s.attachment;
    form.secondaryAmmo = s.ammo;
  }

  // ── Overlay ──────────────────────────────────────────────────────────────

  const overlay = document.createElement('div');
  overlay.className = 'npc-builder-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.onclick = (e) => { if (e.target === overlay) cleanup(); };

  const panel = document.createElement('div');
  panel.className = 'npc-builder-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'npc-builder-title');
  panel.onclick = (e) => e.stopPropagation();

  // ── Header ───────────────────────────────────────────────────────────────

  const header = document.createElement('div');
  header.className = 'npc-builder-header item-picker-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'item-picker-title-wrap';

  const titleEl = document.createElement('div');
  titleEl.className = 'item-picker-title';
  titleEl.id = 'npc-builder-title';
  titleEl.textContent = existing ? `Edit NPC Template` : 'Create NPC Template';

  const subtitleEl = document.createElement('div');
  subtitleEl.className = 'item-picker-subtitle';
  subtitleEl.textContent = 'Configure name, faction, weapons, outfit, items, and spawn settings. Saved to your conversations XML.';

  titleWrap.append(titleEl, subtitleEl);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-icon btn-sm';
  closeBtn.textContent = '\u00d7';
  closeBtn.title = 'Close';
  closeBtn.setAttribute('aria-label', 'Close NPC builder');
  closeBtn.onclick = cleanup;

  header.append(titleWrap, closeBtn);
  panel.appendChild(header);

  // ── Body ─────────────────────────────────────────────────────────────────

  const body = document.createElement('div');
  body.className = 'npc-builder-body';

  // Helper: make a section card
  function makeSection(sectionTitle: string): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'npc-builder-section';
    const h = document.createElement('div');
    h.className = 'npc-builder-section-title';
    h.textContent = sectionTitle;
    sec.appendChild(h);
    return sec;
  }

  // Helper: label + container field
  function makeField(labelText: string, required = false): { wrap: HTMLElement; content: HTMLElement } {
    const wrap = document.createElement('div');
    wrap.className = 'npc-builder-field';
    const lbl = document.createElement('label');
    lbl.className = 'npc-builder-field-label';
    lbl.textContent = labelText + (required ? ' *' : '');
    wrap.appendChild(lbl);
    const content = document.createElement('div');
    content.className = 'npc-builder-field-content';
    wrap.appendChild(content);
    return { wrap, content };
  }

  // Helper: small inline select with label above
  function makeMetaSelect(
    labelText: string,
    opts: Array<{ value: string; label: string }>,
    current: string,
    onChange: (v: string) => void,
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'npc-builder-meta-field';
    const lbl = document.createElement('div');
    lbl.className = 'npc-builder-meta-label';
    lbl.textContent = labelText;
    const sel = document.createElement('select');
    sel.className = 'npc-builder-select-sm';
    for (const { value, label } of opts) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      opt.selected = current === value;
      sel.appendChild(opt);
    }
    sel.onchange = () => onChange(sel.value);
    wrap.append(lbl, sel);
    return wrap;
  }

  // Helper: build a weapon section with picker + meta selects
  function makeWeaponSection(
    title: string,
    sectionVal: string,
    attachVal: string,
    ammoVal: string,
    pickerKey: string,
    onSection: (v: string) => void,
    onAttach: (v: string) => void,
    onAmmo: (v: string) => void,
  ): HTMLElement {
    const group = document.createElement('div');
    group.className = 'npc-builder-weapon-group';

    const lbl = document.createElement('div');
    lbl.className = 'npc-builder-field-label';
    lbl.textContent = title;
    group.appendChild(lbl);

    const weaponRow = document.createElement('div');
    weaponRow.className = 'npc-builder-weapon-row';

    const picker = createItemPickerPanelEditor(sectionVal, onSection, pickerKey, {
      allowEmpty: true,
      placeholder: 'None',
    });
    picker.classList.add('npc-builder-weapon-picker');

    const metaWrap = document.createElement('div');
    metaWrap.className = 'npc-builder-weapon-meta';
    metaWrap.appendChild(makeMetaSelect('Attachment', ATTACHMENT_OPTIONS, attachVal, onAttach));
    metaWrap.appendChild(makeMetaSelect('Ammo', AMMO_OPTIONS, ammoVal, onAmmo));

    weaponRow.append(picker, metaWrap);
    group.appendChild(weaponRow);
    return group;
  }

  // ── § 1 — Identity ───────────────────────────────────────────────────────

  {
    const sec = makeSection('Identity');
    const row = document.createElement('div');
    row.className = 'npc-builder-row';

    // Display name
    {
      const { wrap, content } = makeField('Display Name', true);
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'npc-builder-input';
      input.value = form.name;
      input.placeholder = 'e.g. Informant, Boris the Broker';
      input.autocomplete = 'off';
      input.oninput = () => {
        form.name = input.value;
        if (!form.idManual) {
          const slug = slugify(form.name);
          form.id = slug;
          idInput.value = slug;
        }
      };
      content.appendChild(input);
      row.appendChild(wrap);
    }

    // Template ID — declared early so display-name input can reference it
    const { wrap: idWrap, content: idContent } = makeField('Template ID', true);
    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.className = 'npc-builder-input';
    idInput.value = form.id;
    idInput.placeholder = 'auto (slugified from name)';
    idInput.autocomplete = 'off';
    idInput.oninput = () => {
      form.id = idInput.value;
      form.idManual = true;
    };
    const idHint = document.createElement('div');
    idHint.className = 'command-description';
    idHint.textContent = 'Unique ID used in st_panda_npc_template_<id>. Auto-filled from name.';
    idContent.append(idInput, idHint);
    row.appendChild(idWrap);

    sec.appendChild(row);
    body.appendChild(sec);
  }

  // ── § 2 — Faction & Status ───────────────────────────────────────────────

  {
    const sec = makeSection('Faction & Status');
    const row = document.createElement('div');
    row.className = 'npc-builder-row';

    // Faction
    {
      const { wrap, content } = makeField('Faction', true);
      const sel = document.createElement('select');
      sel.className = 'npc-builder-select';
      for (const fid of FACTION_IDS) {
        const opt = document.createElement('option');
        opt.value = fid;
        opt.textContent = FACTION_DISPLAY_NAMES[fid];
        opt.selected = form.faction === fid;
        sel.appendChild(opt);
      }
      sel.onchange = () => { form.faction = sel.value; };
      content.appendChild(sel);
      row.appendChild(wrap);
    }

    // Rank
    {
      const { wrap, content } = makeField('Rank');
      const sel = document.createElement('select');
      sel.className = 'npc-builder-select';
      for (const rank of RANKS) {
        const opt = document.createElement('option');
        opt.value = rank;
        opt.textContent = rank.charAt(0).toUpperCase() + rank.slice(1);
        opt.selected = form.rank === rank;
        sel.appendChild(opt);
      }
      sel.onchange = () => { form.rank = sel.value; };
      content.appendChild(sel);
      row.appendChild(wrap);
    }

    // Relation
    {
      const { wrap, content } = makeField('Relation');
      const sel = document.createElement('select');
      sel.className = 'npc-builder-select';
      for (const { value, label } of RELATION_OPTIONS) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        opt.selected = form.relation === value;
        sel.appendChild(opt);
      }
      sel.onchange = () => { form.relation = sel.value; };
      content.appendChild(sel);
      row.appendChild(wrap);
    }

    sec.appendChild(row);
    body.appendChild(sec);
  }

  // ── § 3 — Weapons ────────────────────────────────────────────────────────

  {
    const sec = makeSection('Weapons');
    const triggerId = options.trigger.id || fieldKeyFromTrigger(options.trigger);

    sec.appendChild(makeWeaponSection(
      'Primary Weapon',
      form.primarySection,
      form.primaryAttachment,
      form.primaryAmmo,
      `npc-b-primary-${triggerId}`,
      (v) => { form.primarySection = v; },
      (v) => { form.primaryAttachment = v; },
      (v) => { form.primaryAmmo = v; },
    ));

    sec.appendChild(makeWeaponSection(
      'Secondary Weapon',
      form.secondarySection,
      form.secondaryAttachment,
      form.secondaryAmmo,
      `npc-b-secondary-${triggerId}`,
      (v) => { form.secondarySection = v; },
      (v) => { form.secondaryAttachment = v; },
      (v) => { form.secondaryAmmo = v; },
    ));

    body.appendChild(sec);
  }

  // ── § 4 — Equipment ──────────────────────────────────────────────────────

  {
    const sec = makeSection('Equipment');
    const row = document.createElement('div');
    row.className = 'npc-builder-row';
    const triggerId = options.trigger.id || fieldKeyFromTrigger(options.trigger);

    // Outfit
    {
      const { wrap, content } = makeField('Outfit / Armour');
      const picker = createItemPickerPanelEditor(form.outfit, (v) => { form.outfit = v; }, `npc-b-outfit-${triggerId}`, {
        allowEmpty: true,
        placeholder: 'None (default stalker look)',
      });
      content.appendChild(picker);
      row.appendChild(wrap);
    }

    // Trader flag
    {
      const { wrap, content } = makeField('Trader');
      const checkRow = document.createElement('div');
      checkRow.className = 'npc-builder-checkbox-row'; // <-- Changed here
      
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `npc-b-trader-${triggerId}`;
      cb.checked = form.trader;
      cb.onchange = () => { form.trader = cb.checked; };
      
      const cbLabel = document.createElement('label');
      cbLabel.htmlFor = cb.id;
      cbLabel.textContent = 'Mark as a trader NPC (can buy/sell items)';
      
      checkRow.append(cb, cbLabel);
      content.appendChild(checkRow);
      row.appendChild(wrap);
    }

    sec.appendChild(row);
    body.appendChild(sec);
  }

  // ── § 5 — Inventory ──────────────────────────────────────────────────────

  {
    const sec = makeSection('Inventory (Extra Items)');

    const hint = document.createElement('div');
    hint.className = 'command-description';
    hint.style.margin = '10px 16px 0'; // <-- Adjust margins for the hint
    hint.textContent = 'Items placed in the NPC\u2019s inventory on spawn. Format: item section + quantity.';
    sec.appendChild(hint);

    const listEl = document.createElement('div');
    listEl.className = 'npc-builder-item-list';
    sec.appendChild(listEl);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-sm npc-builder-add-btn'; // <-- Added custom class
    addBtn.textContent = '+ Add Item';
    addBtn.onclick = () => {
      form.items.push({ section: '', count: '1' });
      rebuildItems();
    };
    sec.appendChild(addBtn);

    function rebuildItems(): void {
      listEl.innerHTML = '';
      form.items.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'npc-builder-item-row';

        const sectionInput = document.createElement('input');
        sectionInput.type = 'text';
        sectionInput.className = 'npc-builder-input';
        sectionInput.value = item.section;
        sectionInput.placeholder = 'item section id…';
        sectionInput.setAttribute('list', 'npc-b-items-dl');
        sectionInput.oninput = () => { form.items[idx].section = sectionInput.value; };

        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.className = 'npc-builder-count';
        countInput.value = item.count;
        countInput.min = '1';
        countInput.max = '99';
        countInput.title = 'Quantity';
        countInput.oninput = () => { form.items[idx].count = countInput.value; };

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-icon btn-sm';
        removeBtn.textContent = '\u00d7';
        removeBtn.title = 'Remove item';
        removeBtn.onclick = () => {
          form.items.splice(idx, 1);
          rebuildItems();
        };

        row.append(sectionInput, countInput, removeBtn);
        listEl.appendChild(row);
      });
    }

    rebuildItems();
    body.appendChild(sec);
  }

  // ── § 6 — Spawn Config ───────────────────────────────────────────────────

  {
    const sec = makeSection('Spawn Configuration');
    const row = document.createElement('div');
    row.className = 'npc-builder-row';

    // Squad count
    {
      const { wrap, content } = makeField('Squad Size');
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'npc-builder-input';
      input.value = form.count;
      input.min = '1';
      input.max = '5';
      input.placeholder = '1';
      input.oninput = () => { form.count = input.value; };
      const hint = document.createElement('div');
      hint.className = 'command-description';
      hint.textContent = '1\u20135 NPCs per squad. Default: 1.';
      content.append(input, hint);
      row.appendChild(wrap);
    }

    // Spawn distance
    {
      const { wrap, content } = makeField('Spawn Distance (m)');
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'npc-builder-input';
      input.value = form.spawnDist;
      input.min = '10';
      input.placeholder = '50';
      input.oninput = () => { form.spawnDist = input.value; };
      const hint = document.createElement('div');
      hint.className = 'command-description';
      hint.textContent = 'Distance from player in meters. Min\u00a010, default\u00a050.';
      content.append(input, hint);
      row.appendChild(wrap);
    }

    sec.appendChild(row);
    body.appendChild(sec);
  }

  // ── Shared datalist for item autocomplete ─────────────────────────────────

  const datalist = document.createElement('datalist');
  datalist.id = 'npc-b-items-dl';
  for (const entry of GAME_ITEM_CATALOG) {
    const opt = document.createElement('option');
    opt.value = entry.section;
    if (entry.displayName) opt.label = entry.displayName;
    datalist.appendChild(opt);
  }
  panel.appendChild(datalist);

  // ── Footer ────────────────────────────────────────────────────────────────

  const footer = document.createElement('div');
  footer.className = 'npc-builder-footer';

  if (existing) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-sm btn-danger';
    deleteBtn.textContent = 'Delete Template';
    deleteBtn.title = `Remove template "${existing.id}" from this project`;
    deleteBtn.onclick = () => {
      if (confirm(`Delete template "${existing.id}"?\n\nOutcomes that reference it will still be in the conversation but the NPC won\u2019t spawn until a template with this ID is defined again.`)) {
        options.onDelete(existing.id);
        cleanup();
      }
    };
    footer.appendChild(deleteBtn);
  }

  const footerActions = document.createElement('div');
  footerActions.className = 'npc-builder-footer-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = cleanup;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-sm btn-primary';
  saveBtn.textContent = 'Save Template';
  saveBtn.onclick = () => {
    const id = form.id.trim();
    const name = form.name.trim();
    if (!id) {
      alert('Template ID is required.\nSet a display name (it will be auto-slugified) or type an ID directly.');
      return;
    }
    if (!name) {
      alert('Display Name is required.\nThis is the name shown on the NPC in-game.');
      return;
    }

    const spawnDist = parseInt(form.spawnDist, 10);
    const count = parseInt(form.count, 10);

    const template: NpcTemplate = {
      id,
      name,
      faction: form.faction,
      ...(form.rank ? { rank: form.rank } : {}),
      ...(form.relation && form.relation !== 'default' ? { relation: form.relation } : {}),
      ...(buildWeaponStr(form.primarySection, form.primaryAttachment, form.primaryAmmo)
        ? { primary: buildWeaponStr(form.primarySection, form.primaryAttachment, form.primaryAmmo) }
        : {}),
      ...(buildWeaponStr(form.secondarySection, form.secondaryAttachment, form.secondaryAmmo)
        ? { secondary: buildWeaponStr(form.secondarySection, form.secondaryAttachment, form.secondaryAmmo) }
        : {}),
      ...(form.outfit ? { outfit: form.outfit } : {}),
      ...(buildItemsList(form.items) ? { items: buildItemsList(form.items) } : {}),
      ...(!isNaN(spawnDist) && spawnDist !== 50 ? { spawnDist } : {}),
      ...(!isNaN(count) && count > 1 ? { count } : {}),
      ...(form.trader ? { trader: true } : {}),
    };

    options.onSave(template);
    cleanup();
  };

  footerActions.append(cancelBtn, saveBtn);
  footer.appendChild(footerActions);

  // ── Assemble & mount ──────────────────────────────────────────────────────

  panel.append(header, body, footer);
  overlay.appendChild(panel);
  getMount().appendChild(overlay);

  const focusTrap = trapFocus(panel, { onEscape: cleanup });

  function cleanup(): void {
    focusTrap.release();
    overlay.remove();
    activeCleanup = null;
    activeTrigger = null;
  }

  activeCleanup = cleanup;
  activeTrigger = options.trigger;
}

// Generate a short stable key from a DOM element reference
let _triggerCounter = 0;
const _triggerKeys = new WeakMap<HTMLElement, string>();
function fieldKeyFromTrigger(el: HTMLElement): string {
  if (!_triggerKeys.has(el)) _triggerKeys.set(el, `t${++_triggerCounter}`);
  return _triggerKeys.get(el)!;
}

// ── Exported launcher widget ──────────────────────────────────────────────

/**
 * Creates the inline NPC template launcher widget for use inside a
 * renderParamEditors field.  The widget shows the current template summary
 * and a button that opens the NPC builder modal.
 */
export function createCustomNpcBuilderEditor(
  currentTemplateId: string,
  onChange: (templateId: string) => void,
  fieldKey: string,
): HTMLElement {
  // Track the live ID so re-build closures see the latest value
  let liveId = currentTemplateId;

  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor npc-builder-launcher';

  function rebuild(): void {
    wrapper.innerHTML = '';

    const template = liveId
      ? (store.get().project.npcTemplates ?? []).find(t => t.id === liveId) ?? null
      : null;

    // ── Launch button row ───────────────────────────────────────────────

    const toolbar = document.createElement('div');
    toolbar.className = 'rich-editor-toolbar item-picker-toolbar';

    const launchBtn = document.createElement('button');
    launchBtn.type = 'button';
    launchBtn.className = 'item-picker-launcher';
    launchBtn.id = `${fieldKey}-trigger`;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'item-picker-launcher-label';

    const chevron = document.createElement('span');
    chevron.className = 'item-picker-launcher-icon';

    if (template) {
      labelSpan.textContent = `${template.id}  \u2014  ${template.name}  ·  ${getTemplateSummary(template)}`;
      chevron.textContent = '\u270e';
      launchBtn.title = 'Edit this NPC template';
    } else if (liveId) {
      labelSpan.textContent = `${liveId}  (template not in project \u2014 click to create)`;
      labelSpan.style.color = 'var(--warning, #e0a030)';
      chevron.textContent = '+';
      launchBtn.title = 'Create this NPC template';
    } else {
      labelSpan.textContent = 'No NPC template \u2014 click to configure';
      labelSpan.style.color = 'var(--text-dim)';
      chevron.textContent = '+';
      launchBtn.title = 'Create a new NPC template';
    }

    launchBtn.append(labelSpan, chevron);

    launchBtn.onclick = () => {
      openNpcBuilderPanel({
        trigger: launchBtn,
        existingTemplateId: liveId,
        onSave: (saved) => {
          store.upsertNpcTemplate(saved);
          liveId = saved.id;
          onChange(saved.id);
          rebuild();
        },
        onDelete: (id) => {
          store.removeNpcTemplate(id);
          liveId = '';
          onChange('');
          rebuild();
        },
      });
    };

    toolbar.appendChild(launchBtn);

    if (liveId) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'btn-sm';
      clearBtn.textContent = 'Clear';
      clearBtn.title = 'Unlink this outcome from its NPC template';
      clearBtn.onclick = () => {
        liveId = '';
        onChange('');
        rebuild();
      };
      toolbar.appendChild(clearBtn);
    }

    wrapper.appendChild(toolbar);

    // ── Raw ID fallback input ───────────────────────────────────────────

    const rawInput = document.createElement('input');
    rawInput.type = 'text';
    rawInput.className = 'rich-editor-input';
    rawInput.value = liveId;
    rawInput.placeholder = 'template_id  (or use the button above to configure)';
    rawInput.setAttribute('data-field-key', fieldKey);
    rawInput.oninput = () => {
      liveId = rawInput.value;
      onChange(rawInput.value);
    };
    rawInput.onblur = () => {
      // Refresh the summary label after manual typing
      rebuild();
    };
    wrapper.appendChild(rawInput);
  }

  rebuild();
  return wrapper;
}
