import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import {
  GAME_ITEM_CATALOG,
  findGameItem,
  formatGameItemLabel,
  formatGameItemMeta,
  getGameItemSearchText,
  type GameItemCatalogEntry,
} from '../lib/item-catalog';

/* ── Category group mapping ──────────────────────────────── */

const CATEGORY_GROUPS: Record<string, string> = {
  weapons: 'Weapons & Attachments',
  attachments: 'Weapons & Attachments',

  medical: 'Medical & Drugs',
  drugs: 'Medical & Drugs',

  artefacts: 'Artefacts',
  'artefacts junk': 'Artefacts',
  'artefacts soc': 'Artefacts',

  food: 'Food & Drink',
  drink: 'Food & Drink',
  cooking: 'Food & Drink',

  outfits: 'Outfits & Gear',
  patches: 'Outfits & Gear',

  tools: 'Tools & Repair',
  repair: 'Tools & Repair',
  parts: 'Tools & Repair',
  upgrades: 'Tools & Repair',

  'container aac': 'Containers',
  'container aam': 'Containers',
  'container iam': 'Containers',
  'container llmc': 'Containers',

  quest: 'Quest & Letters',
  letters: 'Quest & Letters',

  explosives: 'Explosives',
  'explosives new mines': 'Explosives',

  devices: 'Other',
  money: 'Other',
  monster: 'Other',
  trash: 'Other',
  anim: 'Other',
};

const CATEGORY_GROUP_ORDER = [
  'Weapons & Attachments',
  'Medical & Drugs',
  'Artefacts',
  'Food & Drink',
  'Outfits & Gear',
  'Tools & Repair',
  'Containers',
  'Quest & Letters',
  'Explosives',
  'Other',
];

function getCategoryGroup(category: string): string {
  return CATEGORY_GROUPS[category] ?? 'Other';
}

type CategorySubgroup = {
  id: string;
  label: string;
};

type CategorySubgroupConfig = {
  allLabel: string;
  groups: CategorySubgroup[];
  getItemSubgroup: (item: GameItemCatalogEntry) => string | null;
};

const WEAPON_SUBGROUPS: CategorySubgroup[] = [
  { id: 'attachments', label: 'Attachments' },
  { id: 'rifles', label: 'Rifles' },
  { id: 'smgs', label: 'SMGs' },
  { id: 'pistols', label: 'Pistols' },
  { id: 'shotguns', label: 'Shotguns' },
  { id: 'snipers', label: 'Snipers' },
  { id: 'ammo', label: 'Ammo' },
  { id: 'explosives', label: 'Explosives' },
  { id: 'melee', label: 'Melee' },
  { id: 'misc', label: 'Misc' },
];

function getWeaponSubgroup(item: GameItemCatalogEntry): string | null {
  if (getCategoryGroup(item.category) !== 'Weapons & Attachments') return null;
  if (item.category === 'attachments') return 'attachments';

  switch (item.kind) {
    case 'w_rifle':
      return 'rifles';
    case 'w_smg':
      return 'smgs';
    case 'w_pistol':
      return 'pistols';
    case 'w_shotgun':
      return 'shotguns';
    case 'w_sniper':
      return 'snipers';
    case 'w_ammo':
      return 'ammo';
    case 'w_explosive':
      return 'explosives';
    case 'w_melee':
      return 'melee';
    case 'w_misc':
      return 'misc';
    default:
      return 'misc';
  }
}

const OUTFIT_SUBGROUPS: CategorySubgroup[] = [
  { id: 'general', label: 'General Gear' },
  { id: 'loners', label: 'Loners' },
  { id: 'bandits', label: 'Bandits' },
  { id: 'clear-sky', label: 'Clear Sky' },
  { id: 'duty', label: 'Duty' },
  { id: 'ecologists', label: 'Ecologists' },
  { id: 'freedom', label: 'Freedom' },
  { id: 'military', label: 'Military' },
  { id: 'mercenaries', label: 'Mercenaries' },
  { id: 'monolith', label: 'Monolith' },
  { id: 'renegades', label: 'Renegades' },
  { id: 'sin', label: 'Sin' },
  { id: 'unisg', label: 'UNISG' },
];

function getOutfitFactionSubgroup(item: GameItemCatalogEntry): string | null {
  if (getCategoryGroup(item.category) !== 'Outfits & Gear') return null;

  const searchText = [
    item.section,
    item.displayName ?? '',
    item.invName ?? '',
    item.description ?? '',
  ].join(' ').toLowerCase();

  if (
    searchText.includes('unisg')
    || item.section.startsWith('isg_')
    || item.section === 'isg_patch'
  ) {
    return 'unisg';
  }
  if (
    searchText.includes('clear sky')
    || item.section.startsWith('cs_')
    || item.section === 'csky_patch'
  ) {
    return 'clear-sky';
  }
  if (
    searchText.includes('mercenary')
    || item.section.startsWith('merc_')
    || item.section.includes('_merc_')
    || item.section.startsWith('killer_')
    || item.section.startsWith('banditmerc_')
    || item.section.startsWith('renegademerc_')
    || item.section.startsWith('exo_merc_')
    || item.section === 'killer_patch'
  ) {
    return 'mercenaries';
  }
  if (
    searchText.includes('ecologist')
    || item.section.startsWith('ecolog_')
    || item.section === 'ecolog_patch'
  ) {
    return 'ecologists';
  }
  if (
    searchText.includes('freedom')
    || item.section.startsWith('svoboda_')
    || item.section.startsWith('freedom_')
    || item.section.includes('_freedom_')
    || item.section === 'freedom_patch'
  ) {
    return 'freedom';
  }
  if (
    searchText.includes('military')
    || item.section.startsWith('military_')
    || item.section.startsWith('army_')
    || item.section.includes('_voen_')
    || item.section === 'army_patch'
  ) {
    return 'military';
  }
  if (
    searchText.includes('monolith')
    || item.section.startsWith('monolith_')
    || item.section.includes('_monolit_')
    || item.section.startsWith('light_monolit_')
    || item.section === 'monolith_patch'
  ) {
    return 'monolith';
  }
  if (
    searchText.includes('renegade')
    || item.section.startsWith('renegade_')
    || item.section.startsWith('renegademerc_')
    || item.section === 'renegade_patch'
  ) {
    return 'renegades';
  }
  if (
    searchText.includes('sin ')
    || searchText.includes('sin faction')
    || item.section.startsWith('greh_')
    || item.section === 'greh_patch'
  ) {
    return 'sin';
  }
  if (
    searchText.includes('bandit')
    || item.section.startsWith('bandit_')
    || item.section.startsWith('banditmerc_')
    || item.section === 'bandit_patch'
  ) {
    return 'bandits';
  }
  if (
    searchText.includes('duty')
    || item.section.startsWith('dolg_')
    || item.section.startsWith('exo_dolg_')
    || item.section.startsWith('light_dolg_')
    || item.section.startsWith('nbc_dolg_')
    || item.section.startsWith('specops_dolg_')
    || item.section.startsWith('trenchcoat_dolg_')
    || item.section.startsWith('redline_')
    || item.section === 'dolg_patch'
  ) {
    return 'duty';
  }
  if (
    searchText.includes('loner')
    || searchText.includes('stalker')
    || item.section.startsWith('stalker_')
    || item.section.startsWith('novice_')
    || item.section === 'stalker_patch'
  ) {
    return 'loners';
  }

  return 'general';
}

const CATEGORY_SUBGROUPS: Partial<Record<string, CategorySubgroupConfig>> = {
  'Weapons & Attachments': {
    allLabel: 'All weapon items',
    groups: WEAPON_SUBGROUPS,
    getItemSubgroup: getWeaponSubgroup,
  },
  'Outfits & Gear': {
    allLabel: 'All outfits & gear',
    groups: OUTFIT_SUBGROUPS,
    getItemSubgroup: getOutfitFactionSubgroup,
  },
};

function getSubgroupConfig(group: string | null): CategorySubgroupConfig | null {
  return group ? CATEGORY_SUBGROUPS[group] ?? null : null;
}

/* ── Shared helpers ──────────────────────────────────────── */

const ITEM_PICKER_MOUNT_ID = 'app-modal-host';

let activeCleanup: (() => void) | null = null;
let activeTrigger: HTMLElement | null = null;

function getMount(): HTMLElement {
  return document.getElementById(ITEM_PICKER_MOUNT_ID) ?? document.body;
}

function normalizeFilter(value: string): string {
  return value.trim().toLowerCase();
}

function matchesFilter(item: GameItemCatalogEntry, filter: string): boolean {
  if (!filter) return true;
  return getGameItemSearchText(item).includes(filter);
}

function getItemSummary(value: string, allowEmpty: boolean): string {
  if (!value) {
    return allowEmpty
      ? 'No item selected. Leave it empty to let the command use its built-in default behavior.'
      : 'Choose a vanilla item section or type a custom section id for modded content.';
  }

  const item = findGameItem(value);
  if (!item) {
    return `Using custom item section ${value}. Manual typing stays available for modded or otherwise unknown items.`;
  }

  return item.displayName
    ? `Selected ${item.displayName} (${item.section}). The raw section id remains editable below.`
    : `Selected ${item.section}. This vanilla item has no separate display string in the bundled catalog.`;
}

function buildItemOptionLabel(item: GameItemCatalogEntry): string {
  return item.displayName ? `${item.displayName} (${item.section})` : item.section;
}

/* ── Modal picker panel ──────────────────────────────────── */

function openItemPickerPanel(options: {
  trigger: HTMLElement;
  currentValue: string;
  allowEmpty: boolean;
  onSelect: (value: string) => void;
  onClose?: () => void;
}): void {
  if (activeCleanup) {
    const shouldToggleClosed = activeTrigger === options.trigger;
    activeCleanup();
    if (shouldToggleClosed) return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'item-picker-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.onclick = (event) => {
    if (event.target === overlay) cleanup();
  };

  const panel = document.createElement('div');
  panel.className = 'item-picker-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'item-picker-title');
  panel.onclick = (event) => event.stopPropagation();

  /* ── Header ── */
  const header = document.createElement('div');
  header.className = 'item-picker-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'item-picker-title-wrap';

  const title = document.createElement('div');
  title.className = 'item-picker-title';
  title.id = 'item-picker-title';
  title.textContent = 'Browse game items';
  titleWrap.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'item-picker-subtitle';
  subtitle.textContent = 'Search by display name, raw section id, kind, or category. Pick a vanilla item, or type a custom section id inline.';
  titleWrap.appendChild(subtitle);

  const closeButton = document.createElement('button');
  closeButton.className = 'btn-icon btn-sm';
  closeButton.textContent = '\u00d7';
  closeButton.title = 'Close item picker';
  closeButton.onclick = () => cleanup();

  header.append(titleWrap, closeButton);
  panel.appendChild(header);

  /* ── Search input with icon ── */
  const searchWrap = document.createElement('div');
  searchWrap.className = 'item-picker-search-wrap';

  const searchIcon = document.createElement('span');
  searchIcon.className = 'item-picker-search-icon';
  searchIcon.textContent = '\u2315';
  searchIcon.setAttribute('aria-hidden', 'true');

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'dropdown-search item-picker-search';
  searchInput.placeholder = 'Search item name, section id, kind, or category...';
  searchInput.autocomplete = 'off';

  searchWrap.append(searchIcon, searchInput);
  panel.appendChild(searchWrap);

  /* ── Category chip bar ── */
  const chipBar = document.createElement('div');
  chipBar.className = 'item-picker-chip-bar';

  const subchipBar = document.createElement('div');
  subchipBar.className = 'item-picker-chip-bar item-picker-subchip-bar';
  subchipBar.style.display = 'none';

  let activeGroup: string | null = null;
  let activeSubgroup: string | null = null;
  const chipElements = new Map<string | null, HTMLButtonElement>();
  const subchipElements = new Map<string | null, HTMLButtonElement>();

  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = 'item-picker-chip is-active';
  allChip.innerHTML = 'All <span class="item-picker-chip-count"></span>';
  chipElements.set(null, allChip);
  chipBar.appendChild(allChip);

  for (const group of CATEGORY_GROUP_ORDER) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'item-picker-chip';
    chip.innerHTML = `${group} <span class="item-picker-chip-count"></span>`;
    chipElements.set(group, chip);
    chipBar.appendChild(chip);
  }

  panel.appendChild(chipBar);
  panel.appendChild(subchipBar);

  /* ── Selection summary + actions ── */
  const selectedSummary = document.createElement('div');
  selectedSummary.className = 'item-picker-selection-summary';
  selectedSummary.textContent = options.currentValue
    ? `Current selection: ${formatGameItemLabel(options.currentValue)}`
    : (options.allowEmpty ? 'Current selection: none' : 'No item selected yet');
  panel.appendChild(selectedSummary);

  const actions = document.createElement('div');
  actions.className = 'item-picker-actions';

  if (options.allowEmpty) {
    const clearButton = document.createElement('button');
    clearButton.className = 'btn-sm';
    clearButton.textContent = 'Clear selection';
    clearButton.onclick = () => {
      options.onSelect('');
      cleanup();
    };
    actions.appendChild(clearButton);
  }

  const totalLabel = document.createElement('div');
  totalLabel.className = 'item-picker-total';
  actions.appendChild(totalLabel);
  panel.appendChild(actions);

  /* ── Results list ── */
  const list = document.createElement('div');
  list.className = 'item-picker-list';
  panel.appendChild(list);

  overlay.appendChild(panel);
  getMount().appendChild(overlay);

  let isClosed = false;
  let focusTrapController: FocusTrapController | null = null;
  let filteredItems: GameItemCatalogEntry[] = [];
  let activeIndex = 0;

  const setActiveIndexFromValue = (value: string): void => {
    const matchIndex = filteredItems.findIndex((item) => item.section === value);
    activeIndex = matchIndex >= 0 ? matchIndex : 0;
  };

  const selectItem = (value: string) => {
    options.onSelect(value);
    cleanup();
  };

  /* ── Chip state management ── */
  const updateChipStates = (): void => {
    chipElements.forEach((chip, group) => {
      chip.classList.toggle('is-active', group === activeGroup);
    });
  };

  const rebuildSubchips = (): void => {
    subchipBar.replaceChildren();
    subchipElements.clear();

    const subgroupConfig = getSubgroupConfig(activeGroup);
    if (!subgroupConfig) return;

    const allSubchip = document.createElement('button');
    allSubchip.type = 'button';
    allSubchip.className = 'item-picker-chip item-picker-subchip';
    allSubchip.innerHTML = `${subgroupConfig.allLabel} <span class="item-picker-chip-count"></span>`;
    allSubchip.onclick = () => {
      if (activeSubgroup === null) return;
      activeSubgroup = null;
      updateSubchipStates();
      renderList(searchInput.value);
      setActiveIndexFromValue(options.currentValue);
      updateActiveOption();
    };
    subchipElements.set(null, allSubchip);
    subchipBar.appendChild(allSubchip);

    for (const subgroup of subgroupConfig.groups) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'item-picker-chip item-picker-subchip';
      chip.innerHTML = `${subgroup.label} <span class="item-picker-chip-count"></span>`;
      chip.onclick = () => {
        if (activeSubgroup === subgroup.id) return;
        activeSubgroup = subgroup.id;
        updateSubchipStates();
        renderList(searchInput.value);
        setActiveIndexFromValue(options.currentValue);
        updateActiveOption();
      };
      subchipElements.set(subgroup.id, chip);
      subchipBar.appendChild(chip);
    }
  };

  const updateSubchipVisibility = (): void => {
    const subgroupConfig = getSubgroupConfig(activeGroup);
    subchipBar.style.display = subgroupConfig ? '' : 'none';
    if (!subgroupConfig && activeSubgroup !== null) {
      activeSubgroup = null;
    }
  };

  const updateSubchipStates = (): void => {
    subchipElements.forEach((chip, subgroup) => {
      chip.classList.toggle('is-active', subgroup === activeSubgroup);
    });
  };

  const updateChipCounts = (textFilteredItems: GameItemCatalogEntry[]): void => {
    const groupCounts = new Map<string, number>();
    const subgroupCountsByGroup = new Map<string, Map<string, number>>();
    for (const item of textFilteredItems) {
      const g = getCategoryGroup(item.category);
      groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);

      const subgroupConfig = getSubgroupConfig(g);
      const subgroup = subgroupConfig?.getItemSubgroup(item);
      if (subgroupConfig && subgroup) {
        const subgroupCounts = subgroupCountsByGroup.get(g) ?? new Map<string, number>();
        subgroupCounts.set(subgroup, (subgroupCounts.get(subgroup) ?? 0) + 1);
        subgroupCountsByGroup.set(g, subgroupCounts);
      }
    }

    chipElements.forEach((chip, group) => {
      const countEl = chip.querySelector('.item-picker-chip-count');
      if (!countEl) return;
      if (group === null) {
        countEl.textContent = String(textFilteredItems.length);
      } else {
        const count = groupCounts.get(group) ?? 0;
        countEl.textContent = String(count);
        chip.style.display = count === 0 ? 'none' : '';
      }
    });

    subchipElements.forEach((chip, subgroup) => {
      const countEl = chip.querySelector('.item-picker-chip-count');
      if (!countEl) return;
      const subgroupCounts = activeGroup ? subgroupCountsByGroup.get(activeGroup) : null;
      if (subgroup === null) {
        countEl.textContent = String(activeGroup ? (groupCounts.get(activeGroup) ?? 0) : 0);
        return;
      }

      const count = subgroupCounts?.get(subgroup) ?? 0;
      countEl.textContent = String(count);
      chip.style.display = count === 0 ? 'none' : '';
    });
  };

  /* ── Render the item list ── */
  const renderList = (filterValue: string): void => {
    const filter = normalizeFilter(filterValue);

    // First pass: filter by text only (for chip counts)
    const textFiltered = GAME_ITEM_CATALOG.filter((item) => matchesFilter(item, filter));
    updateChipCounts(textFiltered);

    // Second pass: also filter by active group
    const groupFiltered = activeGroup
      ? textFiltered.filter((item) => getCategoryGroup(item.category) === activeGroup)
      : textFiltered;

    const subgroupConfig = getSubgroupConfig(activeGroup);
    const subgroupFiltered = subgroupConfig && activeSubgroup
      ? groupFiltered.filter((item) => subgroupConfig.getItemSubgroup(item) === activeSubgroup)
      : groupFiltered;

    // Build filteredItems in grouped order so indices match DOM
    filteredItems = [];
    const orderedGroups: { name: string; items: GameItemCatalogEntry[] }[] = [];
    if (subgroupConfig && !activeSubgroup) {
      for (const subgroup of subgroupConfig.groups) {
        const items = subgroupFiltered.filter((item) => subgroupConfig.getItemSubgroup(item) === subgroup.id);
        if (items.length > 0) {
          orderedGroups.push({ name: subgroup.label, items });
          filteredItems.push(...items);
        }
      }
    } else if (subgroupConfig && activeSubgroup) {
      const subgroupLabel = subgroupConfig.groups.find((subgroup) => subgroup.id === activeSubgroup)?.label ?? activeGroup ?? 'Items';
      orderedGroups.push({ name: subgroupLabel, items: subgroupFiltered });
      filteredItems.push(...subgroupFiltered);
    } else {
      const grouped = new Map<string, GameItemCatalogEntry[]>();
      for (const item of subgroupFiltered) {
        const g = getCategoryGroup(item.category);
        if (!grouped.has(g)) grouped.set(g, []);
        grouped.get(g)!.push(item);
      }

      for (const g of CATEGORY_GROUP_ORDER) {
        const items = grouped.get(g);
        if (items && items.length > 0) {
          orderedGroups.push({ name: g, items });
          filteredItems.push(...items);
        }
      }
    }

    if (filteredItems.length === 0) activeIndex = 0;

    totalLabel.textContent = `${filteredItems.length} / ${GAME_ITEM_CATALOG.length} items`;
    list.replaceChildren();

    if (filteredItems.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'item-picker-empty';
      empty.textContent = 'No matching vanilla items. Keep typing the section id inline to target custom or modded content.';
      list.appendChild(empty);
      return;
    }

    let flatIndex = 0;
    const showHeaders = (!activeGroup || (subgroupConfig && !activeSubgroup)) && orderedGroups.length > 1;

    for (const group of orderedGroups) {
      if (showHeaders) {
        const headerEl = document.createElement('div');
        headerEl.className = 'item-picker-group-header';
        headerEl.textContent = `${group.name} (${group.items.length})`;
        list.appendChild(headerEl);
      }

      for (const item of group.items) {
        const index = flatIndex++;
        const option = document.createElement('button');
        option.type = 'button';
        let cls = 'item-picker-option';
        if (index === activeIndex) cls += ' is-active';
        if (item.section === options.currentValue) cls += ' is-selected';
        option.className = cls;
        option.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');
        option.dataset.index = String(index);

        const primary = document.createElement('span');
        primary.className = 'item-picker-option-title';
        primary.textContent = item.displayName || item.section;
        option.appendChild(primary);

        const secondary = document.createElement('span');
        secondary.className = 'item-picker-option-meta';
        secondary.textContent = formatGameItemMeta(item);
        option.appendChild(secondary);

        option.onclick = () => selectItem(item.section);
        option.onmouseenter = () => {
          activeIndex = index;
          updateActiveOption();
        };
        list.appendChild(option);
      }
    }

    updateActiveOption();
  };

  const updateActiveOption = (): void => {
    const optionEls = [...list.querySelectorAll<HTMLElement>('.item-picker-option')];
    optionEls.forEach((option, index) => {
      const isActive = index === activeIndex;
      option.classList.toggle('is-active', isActive);
      option.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const activeOption = optionEls[activeIndex];
    activeOption?.scrollIntoView({ block: 'nearest' });
  };

  const moveActive = (delta: number): void => {
    if (filteredItems.length === 0) return;
    activeIndex = (activeIndex + delta + filteredItems.length) % filteredItems.length;
    updateActiveOption();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === 'Enter' && filteredItems[activeIndex]) {
      event.preventDefault();
      selectItem(filteredItems[activeIndex].section);
    }
  };

  const cleanup = (): void => {
    if (isClosed) return;
    isClosed = true;
    searchInput.removeEventListener('keydown', handleKeyDown);
    options.onClose?.();
    focusTrapController?.release();
    overlay.remove();
    if (activeCleanup === cleanup) {
      activeCleanup = null;
      activeTrigger = null;
    }
  };

  /* ── Wire up chip clicks ── */
  chipElements.forEach((chip, group) => {
    chip.onclick = () => {
      if (activeGroup === group) return;
      activeGroup = group;
      activeSubgroup = null;
      rebuildSubchips();
      updateChipStates();
      updateSubchipVisibility();
      updateSubchipStates();
      renderList(searchInput.value);
      setActiveIndexFromValue(options.currentValue);
      updateActiveOption();
    };
  });

  /* ── Wire up search input ── */
  searchInput.addEventListener('input', () => {
    renderList(searchInput.value);
    setActiveIndexFromValue(options.currentValue);
    updateActiveOption();
  });
  searchInput.addEventListener('keydown', handleKeyDown);

  /* ── Initial render ── */
  rebuildSubchips();
  updateSubchipVisibility();
  updateSubchipStates();
  renderList('');
  setActiveIndexFromValue(options.currentValue);
  updateActiveOption();
  focusTrapController = trapFocus(panel, {
    restoreFocus: options.trigger,
    initialFocus: searchInput,
    onEscape: cleanup,
  });

  activeCleanup = cleanup;
  activeTrigger = options.trigger;
}

/* ── Launcher widget (inline editor) ─────────────────────── */

export function createItemPickerPanelEditor(
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  options: {
    allowEmpty: boolean;
    placeholder: string;
  },
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-item-picker';

  const launcherRow = document.createElement('div');
  launcherRow.className = 'rich-editor-toolbar item-picker-toolbar';

  const selectedButton = document.createElement('button');
  selectedButton.type = 'button';
  selectedButton.className = 'item-picker-launcher';

  const maybeClearButton = options.allowEmpty ? document.createElement('button') : null;
  if (maybeClearButton) {
    maybeClearButton.type = 'button';
    maybeClearButton.className = 'btn-sm';
    maybeClearButton.textContent = 'Clear';
  }

  const rawInput = document.createElement('input');
  rawInput.type = 'text';
  rawInput.className = 'rich-editor-input';
  rawInput.value = currentValue;
  rawInput.placeholder = options.placeholder;
  rawInput.setAttribute('data-field-key', fieldKey);

  const summary = document.createElement('div');
  summary.className = 'command-description';

  const syncUi = (value: string): void => {
    rawInput.value = value;

    selectedButton.textContent = '';
    const label = document.createElement('span');
    label.className = 'item-picker-launcher-label';
    label.textContent = value ? formatGameItemLabel(value) : 'Browse items\u2026';
    const icon = document.createElement('span');
    icon.className = 'item-picker-launcher-icon';
    icon.textContent = '\u25be';
    selectedButton.append(label, icon);

    summary.textContent = getItemSummary(value, options.allowEmpty);
    if (maybeClearButton) maybeClearButton.disabled = value.length === 0;
  };

  const openPanel = (): void => {
    openItemPickerPanel({
      trigger: selectedButton,
      currentValue: rawInput.value,
      allowEmpty: options.allowEmpty,
      onSelect: (value) => {
        syncUi(value);
        onChange(value);
      },
    });
  };

  selectedButton.onclick = openPanel;

  if (maybeClearButton) {
    maybeClearButton.onclick = () => {
      syncUi('');
      onChange('');
      rawInput.focus();
    };
  }

  rawInput.oninput = () => onChange(rawInput.value);
  rawInput.onchange = () => {
    syncUi(rawInput.value);
    onChange(rawInput.value);
  };
  rawInput.addEventListener('input', () => syncUi(rawInput.value));

  launcherRow.append(selectedButton);
  if (maybeClearButton) launcherRow.appendChild(maybeClearButton);
  wrapper.append(launcherRow, rawInput, summary);

  syncUi(currentValue);
  return wrapper;
}

export { buildItemOptionLabel };
