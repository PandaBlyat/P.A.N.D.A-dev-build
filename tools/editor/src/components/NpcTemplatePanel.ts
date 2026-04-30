// P.A.N.D.A. Conversation Editor — NPC Template Panel
// Modal panel for authoring custom NPC templates inline.
// Opened from custom NPC outcome params and custom-NPC precondition params.

import { store } from '../lib/state';
import type { NpcTemplate } from '../lib/types';
import { FACTION_DISPLAY_NAMES } from '../lib/types';
import { FACTION_IDS, RANKS } from '../lib/constants';
import { trapFocus } from '../lib/focus-trap';
import { createItemPickerPanelEditor } from './ItemPickerPanel';
import { createUiText } from '../lib/ui-language';

function ui(en: string, ru: string): string {
  return createUiText(store.get().uiLanguage)(en, ru);
}

// ── Constants ──────────────────────────────────────────────────────────────

const RELATION_OPTIONS = [
  { value: 'default', label: 'Default (faction-based)' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'hostile', label: 'Hostile' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'companion', label: 'Companion (follows player)' },
];

const STATIONARY_JOB_OPTIONS = [
  { value: 'auto', label: 'Auto (best smart job)' },
  { value: 'guard', label: 'Guard' },
  { value: 'animpoint', label: 'Animpoint / Smartcover' },
  { value: 'walker', label: 'Walker' },
  { value: 'patrol', label: 'Patrol' },
  { value: 'camper', label: 'Camper' },
  { value: 'sniper', label: 'Sniper' },
  { value: 'sleeper', label: 'Sleeper' },
  { value: 'beh', label: 'Beh / Point Job' },
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
  if (t.trader) parts.push(`trader=1`);
  if (t.allowRoam === false) parts.push('roam=0');
  if (t.allowRoam === false && t.stationaryJob && t.stationaryJob !== 'auto') parts.push(`smart_job=${t.stationaryJob}`);
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
  return parts.join(' · ');
}

// ── Modal state ────────────────────────────────────────────────────────────

let activeCleanup: (() => void) | null = null;
let activeTrigger: HTMLElement | null = null;

// ── Modal builder ──────────────────────────────────────────────────────────

function openNpcBuilderPanel(options: {
  trigger: HTMLElement;
  existingTemplateId: string;
  showSpawnDistance: boolean;
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
  const showMovementLock = !options.showSpawnDistance;

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
    trader: existing?.trader ?? false,
    allowRoam: existing?.allowRoam ?? true,
    stationaryJob: existing?.stationaryJob ?? 'auto',
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
  titleEl.textContent = existing ? ui('Edit NPC Template', 'Редактировать шаблон NPC') : ui('Create NPC Template', 'Создать шаблон NPC');

  const subtitleEl = document.createElement('div');
  subtitleEl.className = 'item-picker-subtitle';
  subtitleEl.textContent = options.showSpawnDistance
    ? ui('Configure name, faction, weapons, outfit, inventory, and near-player spawn distance. Near-player spawns always roam. Saved to your conversations XML.', 'Настройте имя, группировку, оружие, костюм, инвентарь и дистанцию спавна рядом с игроком. Такие NPC всегда свободно перемещаются. Сохраняется в XML диалогов.')
    : ui('Configure name, faction, weapons, outfit, inventory, and optional smart-terrain locking. Fixed NPCs can bind to vanilla smart-job behaviors on the chosen smart terrain. Placement comes from the command or precondition.', 'Настройте имя, группировку, оружие, костюм, инвентарь и привязку к smart terrain. Фиксированные NPC могут использовать vanilla smart-job на выбранном smart terrain. Размещение задается командой или предусловием.');

  titleWrap.append(titleEl, subtitleEl);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-icon btn-sm';
  closeBtn.textContent = '\u00d7';
  closeBtn.title = ui('Close', 'Закрыть');
  closeBtn.setAttribute('aria-label', ui('Close NPC builder', 'Закрыть конструктор NPC'));
  closeBtn.onclick = cleanup;

  header.append(titleWrap, closeBtn);
  panel.appendChild(header);

  // ── Body ─────────────────────────────────────────────────────────────────

  const body = document.createElement('div');
  body.className = 'npc-builder-body';

  const hero = document.createElement('div');
  hero.className = 'npc-builder-hero';

  const heroEyebrow = document.createElement('div');
  heroEyebrow.className = 'npc-builder-hero-eyebrow';
  heroEyebrow.textContent = existing ? ui('Project NPC template', 'Шаблон NPC проекта') : ui('Reusable story cast template', 'Многоразовый шаблон персонажа');

  const heroTitle = document.createElement('div');
  heroTitle.className = 'npc-builder-hero-title';
  heroTitle.textContent = existing
    ? ui(`Editing ${existing.name || existing.id}`, `Редактирование: ${existing.name || existing.id}`)
    : ui('Build a custom NPC once, reuse it anywhere.', 'Создайте custom NPC один раз и используйте где угодно.');

  const heroCopy = document.createElement('div');
  heroCopy.className = 'npc-builder-hero-copy';
  heroCopy.textContent = ui('Templates can drive spawn outcomes, custom story targets, and follow-up preconditions without duplicating setup.', 'Шаблоны работают для результатов спавна, custom story целей и последующих предусловий без повторной настройки.');

  const heroChips = document.createElement('div');
  heroChips.className = 'npc-builder-hero-chips';
  [
    ui('Saved into XML', 'Сохраняется в XML'),
    ui('Reusable in outcomes', 'Для результатов'),
    ui('Reusable in story targets', 'Для story целей'),
  ].forEach((text) => {
    const chip = document.createElement('span');
    chip.className = 'npc-builder-hero-chip';
    chip.textContent = text;
    heroChips.appendChild(chip);
  });

  hero.append(heroEyebrow, heroTitle, heroCopy, heroChips);
  body.appendChild(hero);

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
      placeholder: ui('None', 'Нет'),
    });
    picker.classList.add('npc-builder-weapon-picker');

    const metaWrap = document.createElement('div');
    metaWrap.className = 'npc-builder-weapon-meta';
    metaWrap.appendChild(makeMetaSelect(ui('Attachment', 'Обвес'), ATTACHMENT_OPTIONS, attachVal, onAttach));
    metaWrap.appendChild(makeMetaSelect(ui('Ammo', 'Патроны'), AMMO_OPTIONS, ammoVal, onAmmo));

    weaponRow.append(picker, metaWrap);
    group.appendChild(weaponRow);
    return group;
  }

  // ── § 1 — Identity ───────────────────────────────────────────────────────

  {
    const sec = makeSection(ui('Identity', 'Личность'));
    const row = document.createElement('div');
    row.className = 'npc-builder-row';

    // Display name
    {
      const { wrap, content } = makeField(ui('Display Name', 'Имя'), true);
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'npc-builder-input';
      input.value = form.name;
      input.placeholder = ui('e.g. Informant, Boris the Broker', 'например: Информатор, Борис Брокер');
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
    const { wrap: idWrap, content: idContent } = makeField(ui('Template ID', 'ID шаблона'), true);
    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.className = 'npc-builder-input';
    idInput.value = form.id;
    idInput.placeholder = ui('auto (slugified from name)', 'авто из имени');
    idInput.autocomplete = 'off';
    idInput.oninput = () => {
      form.id = idInput.value;
      form.idManual = true;
    };
    const idHint = document.createElement('div');
    idHint.className = 'command-description';
    idHint.textContent = ui('Unique ID used in st_panda_npc_template_<id>. Auto-filled from name.', 'Уникальный ID для st_panda_npc_template_<id>. Заполняется из имени.');
    idContent.append(idInput, idHint);
    row.appendChild(idWrap);

    sec.appendChild(row);
    body.appendChild(sec);
  }

  // ── § 2 — Faction & Status ───────────────────────────────────────────────

  {
    const sec = makeSection(ui('Faction & Status', 'Группировка и статус'));
    const row = document.createElement('div');
    row.className = 'npc-builder-row';

    // Faction
    {
      const { wrap, content } = makeField(ui('Faction', 'Группировка'), true);
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
      const { wrap, content } = makeField(ui('Rank', 'Ранг'));
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
      const { wrap, content } = makeField(ui('Relation', 'Отношение'));
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

    if (showMovementLock) {
      const behaviorRow = document.createElement('div');
      behaviorRow.className = 'npc-builder-row';

      const { wrap, content } = makeField(ui('Movement', 'Передвижение'));
      const checkRow = document.createElement('div');
      checkRow.className = 'npc-builder-checkbox-row';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `npc-b-roam-${fieldKeyFromTrigger(options.trigger)}`;
      cb.checked = form.allowRoam;
      cb.onchange = () => { form.allowRoam = cb.checked; };

      const cbLabel = document.createElement('label');
      cbLabel.htmlFor = cb.id;
      cbLabel.textContent = ui('Allow roaming after spawn', 'Разрешить движение после спавна');

      const hint = document.createElement('div');
      hint.className = 'command-description';
      hint.textContent = ui('Turn this off to lock the NPC to a vanilla smart-terrain job on the chosen smart. When possible, PANDA will reserve an authored job or create a dedicated story slot from an existing vanilla job path/animpoint.', 'Отключите, чтобы привязать NPC к vanilla smart-terrain job на выбранном smart. Если возможно, PANDA зарезервирует authored job или создаст story slot из существующего vanilla job path/animpoint.');

      checkRow.append(cb, cbLabel);
      content.append(checkRow, hint);
      behaviorRow.appendChild(wrap);
      sec.appendChild(behaviorRow);

      const jobRow = document.createElement('div');
      jobRow.className = 'npc-builder-row';

      const jobField = makeField(ui('Fixed Job', 'Фиксированная работа'));
      const jobSelect = document.createElement('select');
      jobSelect.className = 'npc-builder-select';
      for (const { value, label } of STATIONARY_JOB_OPTIONS) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        opt.selected = form.stationaryJob === value;
        jobSelect.appendChild(opt);
      }
      jobSelect.disabled = form.allowRoam;
      jobSelect.onchange = () => { form.stationaryJob = jobSelect.value; };

      const jobHint = document.createElement('div');
      jobHint.className = 'command-description';
      jobHint.textContent = ui('Choose which vanilla smart-job family to use when roaming is disabled. Auto prefers the strongest available fit on that smart terrain.', 'Выберите vanilla smart-job, когда движение отключено. Auto выбирает лучший вариант на выбранном smart terrain.');

      cb.onchange = () => {
        form.allowRoam = cb.checked;
        jobSelect.disabled = form.allowRoam;
      };

      jobField.content.append(jobSelect, jobHint);
      jobRow.appendChild(jobField.wrap);
      sec.appendChild(jobRow);
    }

    body.appendChild(sec);
  }

  // ── § 3 — Weapons ────────────────────────────────────────────────────────

  {
    const sec = makeSection(ui('Weapons', 'Оружие'));
    const triggerId = options.trigger.id || fieldKeyFromTrigger(options.trigger);

    sec.appendChild(makeWeaponSection(
      ui('Primary Weapon', 'Основное оружие'),
      form.primarySection,
      form.primaryAttachment,
      form.primaryAmmo,
      `npc-b-primary-${triggerId}`,
      (v) => { form.primarySection = v; },
      (v) => { form.primaryAttachment = v; },
      (v) => { form.primaryAmmo = v; },
    ));

    sec.appendChild(makeWeaponSection(
      ui('Secondary Weapon', 'Вторичное оружие'),
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
    const sec = makeSection(ui('Equipment', 'Экипировка'));
    const row = document.createElement('div');
    row.className = 'npc-builder-row';
    const triggerId = options.trigger.id || fieldKeyFromTrigger(options.trigger);

    // Outfit
    {
      const { wrap, content } = makeField(ui('Outfit / Armour', 'Костюм / броня'));
      const picker = createItemPickerPanelEditor(form.outfit, (v) => { form.outfit = v; }, `npc-b-outfit-${triggerId}`, {
        allowEmpty: true,
        placeholder: ui('None (default stalker look)', 'Нет (вид сталкера по умолчанию)'),
      });
      content.appendChild(picker);
      row.appendChild(wrap);
    }

    // Trader flag
    {
      const { wrap, content } = makeField(ui('Trader', 'Торговец'));
      const checkRow = document.createElement('div');
      checkRow.className = 'npc-builder-checkbox-row';
      
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `npc-b-trader-${triggerId}`;
      cb.checked = form.trader;
      cb.onchange = () => { form.trader = cb.checked; };
      
      const cbLabel = document.createElement('label');
      cbLabel.htmlFor = cb.id;
      cbLabel.textContent = ui('Mark as a trader NPC (can buy/sell items)', 'Сделать NPC торговцем (покупка/продажа предметов)');
      
      checkRow.append(cb, cbLabel);
      content.appendChild(checkRow);
      row.appendChild(wrap);
    }

    sec.appendChild(row);
    body.appendChild(sec);
  }

  // ── § 5 — Inventory ──────────────────────────────────────────────────────

  {
    const sec = makeSection(ui('Inventory (Extra Items)', 'Инвентарь (доп. предметы)'));
    const triggerId = options.trigger.id || fieldKeyFromTrigger(options.trigger);

    const hint = document.createElement('div');
    hint.className = 'command-description';
    hint.textContent = ui('Items placed in the NPC\u2019s inventory on spawn. Format: item section + quantity.', 'Предметы в инвентаре NPC при спавне. Формат: section предмета + количество.');
    sec.appendChild(hint);

    const listEl = document.createElement('div');
    listEl.className = 'npc-builder-item-list';
    sec.appendChild(listEl);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn-sm npc-builder-add-btn';
    addBtn.textContent = ui('+ Add Item', '+ Добавить предмет');
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

        const itemPicker = createItemPickerPanelEditor(
          item.section,
          (value) => { form.items[idx].section = value; },
          `npc-b-extra-item-${triggerId}-${idx}`,
          {
            allowEmpty: true,
            placeholder: ui('Search or type an item section id...', 'Найдите или введите section id предмета...'),
          },
        );
        itemPicker.classList.add('npc-builder-item-picker');

        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.className = 'npc-builder-count';
        countInput.value = item.count;
        countInput.min = '1';
        countInput.max = '99';
        countInput.placeholder = ui('Qty', 'Кол-во');
        countInput.title = ui('Quantity', 'Количество');
        countInput.oninput = () => { form.items[idx].count = countInput.value; };

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-icon btn-sm';
        removeBtn.textContent = '\u00d7';
        removeBtn.title = ui('Remove item', 'Удалить предмет');
        removeBtn.onclick = () => {
          form.items.splice(idx, 1);
          rebuildItems();
        };

        row.append(itemPicker, countInput, removeBtn);
        listEl.appendChild(row);
      });
    }

    rebuildItems();
    body.appendChild(sec);
  }

  // ── § 6 — Spawn Config ───────────────────────────────────────────────────

  if (options.showSpawnDistance) {
    const sec = makeSection(ui('Spawn Configuration', 'Настройка спавна'));
    const row = document.createElement('div');
    row.className = 'npc-builder-row';

    // Spawn distance
    {
      const { wrap, content } = makeField(ui('Spawn Distance (m)', 'Дистанция спавна (м)'));
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'npc-builder-input';
      input.value = form.spawnDist;
      input.min = '10';
      input.placeholder = '50';
      input.oninput = () => { form.spawnDist = input.value; };
      const hint = document.createElement('div');
      hint.className = 'command-description';
      hint.textContent = ui('Distance from player in meters. Min\u00a010, default\u00a050. Near-player spawns always roam after spawning.', 'Дистанция от игрока в метрах. Мин. 10, по умолчанию 50. Спавн рядом с игроком всегда свободно перемещается.');
      content.append(input, hint);
      row.appendChild(wrap);
    }

    sec.appendChild(row);
    body.appendChild(sec);
  }

  // ── Shared datalist for item autocomplete ─────────────────────────────────

  // ── Footer ────────────────────────────────────────────────────────────────

  const footer = document.createElement('div');
  footer.className = 'npc-builder-footer';

  if (existing) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-sm btn-danger';
    deleteBtn.textContent = ui('Delete Template', 'Удалить шаблон');
    deleteBtn.title = ui(`Remove template "${existing.id}" from this project`, `Удалить шаблон "${existing.id}" из проекта`);
    deleteBtn.onclick = () => {
      if (confirm(ui(
        `Delete template "${existing.id}"?\n\nOutcomes that reference it will still be in the conversation but the NPC won\u2019t spawn until a template with this ID is defined again.`,
        `Удалить шаблон "${existing.id}"?\n\nРезультаты, которые ссылаются на него, останутся в диалоге, но NPC не появится, пока шаблон с этим ID не будет создан снова.`,
      ))) {
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
  cancelBtn.textContent = ui('Cancel', 'Отмена');
  cancelBtn.onclick = cleanup;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-sm btn-primary';
  saveBtn.textContent = ui('Save Template', 'Сохранить шаблон');
  saveBtn.onclick = () => {
    const id = form.id.trim();
    const name = form.name.trim();
    if (!id) {
      alert(ui('Template ID is required.\nSet a display name (it will be auto-slugified) or type an ID directly.', 'Требуется ID шаблона.\nВведите имя (ID создастся автоматически) или задайте ID вручную.'));
      return;
    }
    if (!name) {
      alert(ui('Display Name is required.\nThis is the name shown on the NPC in-game.', 'Требуется имя.\nЭто имя NPC в игре.'));
      return;
    }

    const spawnDist = parseInt(form.spawnDist, 10);

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
      ...(options.showSpawnDistance
        ? (!isNaN(spawnDist) && spawnDist !== 50 ? { spawnDist } : {})
        : (existing?.spawnDist != null && existing.spawnDist !== 50 ? { spawnDist: existing.spawnDist } : {})),
      ...(form.trader ? { trader: true } : {}),
      ...(form.allowRoam === false ? { allowRoam: false } : {}),
      ...(form.allowRoam === false && form.stationaryJob && form.stationaryJob !== 'auto' ? { stationaryJob: form.stationaryJob } : {}),
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
  options: {
    showSpawnDistance: boolean;
  },
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
      launchBtn.title = ui('Edit this NPC template', 'Редактировать этот шаблон NPC');
    } else if (liveId) {
      labelSpan.textContent = ui(`${liveId}  (template not in project \u2014 click to create)`, `${liveId}  (шаблона нет в проекте — нажмите, чтобы создать)`);
      labelSpan.style.color = 'var(--warning, #e0a030)';
      chevron.textContent = '+';
      launchBtn.title = ui('Create this NPC template', 'Создать этот шаблон NPC');
    } else {
      labelSpan.textContent = ui('No NPC template \u2014 click to configure', 'Нет шаблона NPC — нажмите для настройки');
      labelSpan.style.color = 'var(--text-dim)';
      chevron.textContent = '+';
      launchBtn.title = ui('Create a new NPC template', 'Создать новый шаблон NPC');
    }

    launchBtn.append(labelSpan, chevron);

    launchBtn.onclick = () => {
      openNpcBuilderPanel({
        trigger: launchBtn,
        existingTemplateId: liveId,
        showSpawnDistance: options.showSpawnDistance,
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
      clearBtn.textContent = ui('Clear', 'Очистить');
      clearBtn.title = ui('Clear this NPC template reference', 'Очистить ссылку на шаблон NPC');
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
    rawInput.placeholder = ui('template_id  (or use the button above to configure)', 'template_id  (или настройте кнопкой выше)');
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
