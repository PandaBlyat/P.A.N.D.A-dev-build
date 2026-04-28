import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import {
  CACHED_GAME_ITEM_CATALOG,
  GAME_ITEM_CATALOG,
  findGameItem,
  formatGameItemLabel,
  formatGameItemMeta,
  type CachedGameItemCatalogEntry,
  type GameItemCatalogEntry,
  type GameItemCategoryGroup,
  type GameItemPickerSubgroupId,
} from '../lib/item-catalog';

const CATEGORY_GROUP_ORDER: GameItemCategoryGroup[] = [
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

type CategorySubgroup = {
  id: GameItemPickerSubgroupId;
  label: string;
};

type CategorySubgroupConfig = {
  allLabel: string;
  groups: CategorySubgroup[];
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

const CATEGORY_SUBGROUPS: Partial<Record<GameItemCategoryGroup, CategorySubgroupConfig>> = {
  'Weapons & Attachments': {
    allLabel: 'All weapon items',
    groups: WEAPON_SUBGROUPS,
  },
  'Outfits & Gear': {
    allLabel: 'All outfits & gear',
    groups: OUTFIT_SUBGROUPS,
  },
};

function getSubgroupConfig(group: GameItemCategoryGroup | null): CategorySubgroupConfig | null {
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

type ItemPickerRow =
  | {
    type: 'header';
    key: string;
    label: string;
    count: number;
  }
  | {
    type: 'item';
    key: string;
    index: number;
    item: GameItemCatalogEntry;
  };

const ITEM_PICKER_OVERSCAN_ROWS = 6;
const ITEM_PICKER_HEADER_ROW_HEIGHT = 32;
const ITEM_PICKER_OPTION_ROW_HEIGHT = 58;

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
  const filterRail = document.createElement('div');
  filterRail.className = 'item-picker-filter-rail';

  const groupControl = document.createElement('label');
  groupControl.className = 'item-picker-filter-group';
  const groupLabel = document.createElement('span');
  groupLabel.className = 'item-picker-filter-label';
  groupLabel.textContent = 'Category';
  const groupSelect = document.createElement('select');
  groupSelect.className = 'item-picker-filter-select';
  groupControl.append(groupLabel, groupSelect);

  const subgroupControl = document.createElement('label');
  subgroupControl.className = 'item-picker-filter-group';
  const subgroupLabel = document.createElement('span');
  subgroupLabel.className = 'item-picker-filter-label';
  subgroupLabel.textContent = 'Subcategory';
  const subgroupSelect = document.createElement('select');
  subgroupSelect.className = 'item-picker-filter-select';
  subgroupControl.append(subgroupLabel, subgroupSelect);

  filterRail.append(groupControl, subgroupControl);
  panel.appendChild(filterRail);

  let activeGroup: GameItemCategoryGroup | null = null;
  let activeSubgroup: GameItemPickerSubgroupId | null = null;

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
  const listContent = document.createElement('div');
  listContent.className = 'item-picker-list-content';
  const emptyState = document.createElement('div');
  emptyState.className = 'item-picker-empty';
  emptyState.hidden = true;
  emptyState.textContent = 'No matching vanilla items. Keep typing the section id inline to target custom or modded content.';
  list.append(listContent, emptyState);
  panel.appendChild(list);

  overlay.appendChild(panel);
  getMount().appendChild(overlay);

  let isClosed = false;
  let focusTrapController: FocusTrapController | null = null;
  let filteredItems: GameItemCatalogEntry[] = [];
  let activeIndex = 0;
  let activeOptionEl: HTMLButtonElement | null = null;
  let optionElementsByIndex = new Map<number, HTMLButtonElement>();
  let rowModel: ItemPickerRow[] = [];
  let rowOffsets: number[] = [];
  let totalRowHeight = 0;
  let itemRowIndices: number[] = [];
  let renderedRowRange = { start: -1, end: -1 };

  const setActiveIndexFromValue = (value: string): void => {
    const matchIndex = filteredItems.findIndex((item) => item.section === value);
    activeIndex = matchIndex >= 0 ? matchIndex : 0;
  };

  const selectItem = (value: string) => {
    options.onSelect(value);
    cleanup();
  };

  const setOptionActiveState = (option: HTMLButtonElement | null, isActive: boolean): void => {
    if (!option) return;
    option.classList.toggle('is-active', isActive);
    option.setAttribute('aria-selected', isActive ? 'true' : 'false');
  };

  const isOptionOutsideViewport = (option: HTMLElement): boolean => {
    const listRect = list.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    return optionRect.top < listRect.top || optionRect.bottom > listRect.bottom;
  };

  const getRowHeight = (row: ItemPickerRow): number => (
    row.type === 'header' ? ITEM_PICKER_HEADER_ROW_HEIGHT : ITEM_PICKER_OPTION_ROW_HEIGHT
  );

  const getRowIndexForOffset = (offset: number): number => {
    if (rowOffsets.length === 0) return 0;

    let low = 0;
    let high = rowOffsets.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const rowTop = rowOffsets[mid]!;
      const rowBottom = rowTop + getRowHeight(rowModel[mid]!);
      if (offset < rowTop) {
        high = mid - 1;
      } else if (offset >= rowBottom) {
        low = mid + 1;
      } else {
        return mid;
      }
    }

    return Math.max(0, Math.min(rowOffsets.length - 1, low));
  };

  const renderVisibleRows = (): void => {
    if (rowModel.length === 0) {
      renderedRowRange = { start: -1, end: -1 };
      listContent.replaceChildren();
      return;
    }

    const viewportHeight = list.clientHeight || 1;
    const visibleStart = Math.max(0, list.scrollTop);
    const visibleEnd = visibleStart + viewportHeight;
    const startRow = Math.max(0, getRowIndexForOffset(visibleStart) - ITEM_PICKER_OVERSCAN_ROWS);
    const endRow = Math.min(
      rowModel.length - 1,
      getRowIndexForOffset(Math.max(0, visibleEnd - 1)) + ITEM_PICKER_OVERSCAN_ROWS,
    );

    if (renderedRowRange.start === startRow && renderedRowRange.end === endRow) {
      const nextActiveOption = optionElementsByIndex.get(activeIndex) ?? null;
      if (activeOptionEl !== nextActiveOption) {
        setOptionActiveState(activeOptionEl, false);
        setOptionActiveState(nextActiveOption, true);
        activeOptionEl = nextActiveOption;
      }
      return;
    }

    renderedRowRange = { start: startRow, end: endRow };
    optionElementsByIndex = new Map();
    activeOptionEl = null;

    const fragment = document.createDocumentFragment();
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
      const row = rowModel[rowIndex]!;
      if (row.type === 'header') {
        const headerEl = document.createElement('div');
        headerEl.className = 'item-picker-group-header';
        headerEl.textContent = `${row.label} (${row.count})`;
        headerEl.style.top = `${rowOffsets[rowIndex]}px`;
        fragment.appendChild(headerEl);
        continue;
      }

      const option = document.createElement('button');
      option.type = 'button';
      let cls = 'item-picker-option';
      if (row.index === activeIndex) cls += ' is-active';
      if (row.item.section === options.currentValue) cls += ' is-selected';
      option.className = cls;
      option.setAttribute('aria-selected', row.index === activeIndex ? 'true' : 'false');
      option.dataset.index = String(row.index);
      option.style.top = `${rowOffsets[rowIndex]}px`;
      optionElementsByIndex.set(row.index, option);
      if (row.index === activeIndex) activeOptionEl = option;

      const primary = document.createElement('span');
      primary.className = 'item-picker-option-title';
      primary.textContent = row.item.displayName || row.item.section;
      option.appendChild(primary);

      const secondary = document.createElement('span');
      secondary.className = 'item-picker-option-meta';
      secondary.textContent = formatGameItemMeta(row.item);
      option.appendChild(secondary);

      option.onclick = () => selectItem(row.item.section);
      option.onmouseenter = () => {
        if (activeIndex === row.index) return;
        activeIndex = row.index;
        updateActiveOption({ source: 'pointer' });
      };
      fragment.appendChild(option);
    }

    listContent.replaceChildren(fragment);
  };

  /* ── Chip state management ── */
  const updateChipStates = (): void => {
    groupSelect.value = activeGroup ?? '';
  };

  const rebuildSubchips = (): void => {
    const subgroupConfig = getSubgroupConfig(activeGroup);
    subgroupSelect.replaceChildren();
    if (!subgroupConfig) return;

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = subgroupConfig.allLabel;
    subgroupSelect.appendChild(allOption);

    for (const subgroup of subgroupConfig.groups) {
      const optionEl = document.createElement('option');
      optionEl.value = subgroup.id;
      optionEl.textContent = subgroup.label;
      subgroupSelect.appendChild(optionEl);
    }
  };

  const updateSubchipVisibility = (): void => {
    const subgroupConfig = getSubgroupConfig(activeGroup);
    subgroupControl.hidden = !subgroupConfig;
    if (!subgroupConfig && activeSubgroup !== null) {
      activeSubgroup = null;
    }
  };

  const updateSubchipStates = (): void => {
    subgroupSelect.value = activeSubgroup ?? '';
  };

  const updateChipCounts = (textFilteredEntries: CachedGameItemCatalogEntry[]): void => {
    const groupCounts = new Map<GameItemCategoryGroup, number>();
    const subgroupCountsByGroup = new Map<
      GameItemCategoryGroup,
      Map<GameItemPickerSubgroupId, number>
    >();

    for (const entry of textFilteredEntries) {
      groupCounts.set(entry.categoryGroup, (groupCounts.get(entry.categoryGroup) ?? 0) + 1);

      if (entry.subgroupId) {
        const subgroupCounts = subgroupCountsByGroup.get(entry.categoryGroup)
          ?? new Map<GameItemPickerSubgroupId, number>();
        subgroupCounts.set(entry.subgroupId, (subgroupCounts.get(entry.subgroupId) ?? 0) + 1);
        subgroupCountsByGroup.set(entry.categoryGroup, subgroupCounts);
      }
    }

    const currentGroup = activeGroup ?? '';
    groupSelect.replaceChildren();

    const allGroupOption = document.createElement('option');
    allGroupOption.value = '';
    allGroupOption.textContent = `All (${textFilteredEntries.length})`;
    groupSelect.appendChild(allGroupOption);

    for (const group of CATEGORY_GROUP_ORDER) {
      const optionEl = document.createElement('option');
      optionEl.value = group;
      optionEl.textContent = `${group} (${groupCounts.get(group) ?? 0})`;
      groupSelect.appendChild(optionEl);
    }
    groupSelect.value = currentGroup;

    const subgroupConfig = getSubgroupConfig(activeGroup);
    if (!subgroupConfig) return;

    const subgroupCounts = activeGroup ? subgroupCountsByGroup.get(activeGroup) : null;
    const currentSubgroup = activeSubgroup ?? '';
    subgroupSelect.replaceChildren();

    const allSubgroupOption = document.createElement('option');
    allSubgroupOption.value = '';
    allSubgroupOption.textContent = `${subgroupConfig.allLabel} (${activeGroup ? (groupCounts.get(activeGroup) ?? 0) : 0})`;
    subgroupSelect.appendChild(allSubgroupOption);

    for (const subgroup of subgroupConfig.groups) {
      const optionEl = document.createElement('option');
      optionEl.value = subgroup.id;
      optionEl.textContent = `${subgroup.label} (${subgroupCounts?.get(subgroup.id) ?? 0})`;
      subgroupSelect.appendChild(optionEl);
    }
    subgroupSelect.value = currentSubgroup;
  };

  /* ── Render the item list ── */
  const renderList = (filterValue: string, options: { resetScroll?: boolean } = {}): void => {
    const filter = normalizeFilter(filterValue);

    const textFilteredEntries = filter
      ? CACHED_GAME_ITEM_CATALOG.filter((entry) => entry.normalizedSearchText.includes(filter))
      : CACHED_GAME_ITEM_CATALOG;
    updateChipCounts(textFilteredEntries);

    const groupFilteredEntries = activeGroup
      ? textFilteredEntries.filter((entry) => entry.categoryGroup === activeGroup)
      : textFilteredEntries;

    const subgroupConfig = getSubgroupConfig(activeGroup);
    const subgroupFilteredEntries = subgroupConfig && activeSubgroup
      ? groupFilteredEntries.filter((entry) => entry.subgroupId === activeSubgroup)
      : groupFilteredEntries;

    const orderedEntries: CachedGameItemCatalogEntry[] = [];
    filteredItems = [];
    const orderedGroups: { name: string; entries: CachedGameItemCatalogEntry[] }[] = [];
    if (subgroupConfig && !activeSubgroup) {
      for (const subgroup of subgroupConfig.groups) {
        const entries = subgroupFilteredEntries.filter((entry) => entry.subgroupId === subgroup.id);
        if (entries.length > 0) {
          orderedGroups.push({ name: subgroup.label, entries });
          orderedEntries.push(...entries);
        }
      }
    } else if (subgroupConfig && activeSubgroup) {
      const subgroupLabel = subgroupConfig.groups.find((subgroup) => subgroup.id === activeSubgroup)?.label ?? activeGroup ?? 'Items';
      orderedGroups.push({ name: subgroupLabel, entries: subgroupFilteredEntries });
      orderedEntries.push(...subgroupFilteredEntries);
    } else {
      const grouped = new Map<GameItemCategoryGroup, CachedGameItemCatalogEntry[]>();
      for (const entry of subgroupFilteredEntries) {
        if (!grouped.has(entry.categoryGroup)) grouped.set(entry.categoryGroup, []);
        grouped.get(entry.categoryGroup)!.push(entry);
      }

      for (const group of CATEGORY_GROUP_ORDER) {
        const entries = grouped.get(group);
        if (entries && entries.length > 0) {
          orderedGroups.push({ name: group, entries });
          orderedEntries.push(...entries);
        }
      }
    }

    filteredItems = orderedEntries.map((entry) => entry.item);

    if (options.resetScroll) {
      activeIndex = 0;
      list.scrollTop = 0;
    }
    if (filteredItems.length === 0) activeIndex = 0;

    totalLabel.textContent = `${filteredItems.length} / ${GAME_ITEM_CATALOG.length} items`;
    rowModel = [];
    rowOffsets = [];
    itemRowIndices = [];
    totalRowHeight = 0;
    renderedRowRange = { start: -1, end: -1 };

    if (filteredItems.length === 0) {
      listContent.style.height = '0px';
      listContent.replaceChildren();
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    if (activeIndex >= filteredItems.length) {
      activeIndex = filteredItems.length - 1;
    }

    let flatIndex = 0;
    const showHeaders = (!activeGroup || (subgroupConfig && !activeSubgroup)) && orderedGroups.length > 1;

    for (const group of orderedGroups) {
      if (showHeaders) {
        rowOffsets.push(totalRowHeight);
        rowModel.push({
          type: 'header',
          key: `header:${group.name}`,
          label: group.name,
          count: group.entries.length,
        });
        totalRowHeight += ITEM_PICKER_HEADER_ROW_HEIGHT;
      }

      for (const { item } of group.entries) {
        const index = flatIndex++;
        rowOffsets.push(totalRowHeight);
        rowModel.push({
          type: 'item',
          key: `item:${item.section}`,
          index,
          item,
        });
        itemRowIndices[index] = rowModel.length - 1;
        totalRowHeight += ITEM_PICKER_OPTION_ROW_HEIGHT;
      }
    }

    listContent.style.height = `${totalRowHeight}px`;
    renderVisibleRows();
    updateActiveOption();
  };

  const updateActiveOption = (
    { source = 'render' }: { source?: 'keyboard' | 'pointer' | 'render' } = {},
  ): void => {
    const activeRowIndex = itemRowIndices[activeIndex];
    if (activeRowIndex != null) {
      const rowTop = rowOffsets[activeRowIndex] ?? 0;
      const rowBottom = rowTop + ITEM_PICKER_OPTION_ROW_HEIGHT;
      const viewportTop = list.scrollTop;
      const viewportBottom = viewportTop + list.clientHeight;

      if (source === 'keyboard' || rowTop < viewportTop || rowBottom > viewportBottom) {
        const nextScrollTop = rowTop < viewportTop
          ? rowTop
          : Math.max(0, rowBottom - list.clientHeight);
        if (nextScrollTop !== list.scrollTop) {
          list.scrollTop = nextScrollTop;
        }
      }
    }

    renderVisibleRows();
    const nextActiveOption = optionElementsByIndex.get(activeIndex) ?? null;
    if (activeOptionEl !== nextActiveOption) {
      setOptionActiveState(activeOptionEl, false);
      setOptionActiveState(nextActiveOption, true);
      activeOptionEl = nextActiveOption;
    } else {
      setOptionActiveState(activeOptionEl, true);
    }

    if (!activeOptionEl) return;
    if (source === 'keyboard' || isOptionOutsideViewport(activeOptionEl)) {
      activeOptionEl.scrollIntoView({ block: 'nearest' });
    }
  };

  const moveActive = (delta: number): void => {
    if (filteredItems.length === 0) return;
    activeIndex = (activeIndex + delta + filteredItems.length) % filteredItems.length;
    updateActiveOption({ source: 'keyboard' });
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
    list.removeEventListener('scroll', renderVisibleRows);
    options.onClose?.();
    focusTrapController?.release();
    overlay.remove();
    if (activeCleanup === cleanup) {
      activeCleanup = null;
      activeTrigger = null;
    }
  };

  /* ── Wire up chip clicks ── */
  groupSelect.onchange = () => {
    activeGroup = groupSelect.value ? groupSelect.value as GameItemCategoryGroup : null;
    activeSubgroup = null;
    rebuildSubchips();
    updateChipStates();
    updateSubchipVisibility();
    updateSubchipStates();
    renderList(searchInput.value, { resetScroll: true });
    if (!options.currentValue) setActiveIndexFromValue(options.currentValue);
    updateActiveOption();
  };
  subgroupSelect.onchange = () => {
    activeSubgroup = subgroupSelect.value ? subgroupSelect.value as GameItemPickerSubgroupId : null;
    updateSubchipStates();
    renderList(searchInput.value, { resetScroll: true });
    if (!options.currentValue) setActiveIndexFromValue(options.currentValue);
    updateActiveOption();
  };

  /* ── Wire up search input ── */
  searchInput.addEventListener('input', () => {
    renderList(searchInput.value, { resetScroll: true });
    if (!options.currentValue) setActiveIndexFromValue(options.currentValue);
    updateActiveOption();
  });
  searchInput.addEventListener('keydown', handleKeyDown);
  list.addEventListener('scroll', renderVisibleRows, { passive: true });

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

function parseItemChain(value: string, separator: string): string[] {
  return value
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function formatItemChainSummary(items: string[]): string {
  if (items.length === 0) {
    return 'No stash bonus items selected yet. Use Browse/Add to pick vanilla items, or type raw section ids for modded content.';
  }

  const labels = items.slice(0, 3).map((item) => formatGameItemLabel(item));
  const suffix = items.length > 3 ? ` +${items.length - 3} more` : '';
  return `Stash will include ${labels.join(', ')}${suffix}.`;
}

export function createItemChainPickerPanelEditor(
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  options: {
    placeholder: string;
    chainSeparator: string;
  },
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-item-picker';

  const controls = document.createElement('div');
  controls.className = 'rich-editor-toolbar item-picker-toolbar';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'item-picker-launcher';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'btn-sm';
  clearButton.textContent = 'Clear';

  const rawInput = document.createElement('input');
  rawInput.type = 'text';
  rawInput.className = 'rich-editor-input';
  rawInput.value = currentValue;
  rawInput.placeholder = options.placeholder;
  rawInput.setAttribute('data-field-key', fieldKey);

  const chipList = document.createElement('div');
  chipList.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;';

  const summary = document.createElement('div');
  summary.className = 'command-description';

  const syncUi = (value: string): void => {
    const items = parseItemChain(value, options.chainSeparator);
    rawInput.value = items.join(options.chainSeparator);

    addButton.textContent = '';
    const label = document.createElement('span');
    label.className = 'item-picker-launcher-label';
    label.textContent = items.length > 0
      ? `Browse/Add items (${items.length})`
      : 'Browse items…';
    const icon = document.createElement('span');
    icon.className = 'item-picker-launcher-icon';
    icon.textContent = '\u25be';
    addButton.append(label, icon);

    chipList.replaceChildren();
    items.forEach((item, index) => {
      const chip = document.createElement('span');
      chip.style.cssText = 'display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; background:var(--bg-elev-2); border:1px solid var(--border); font-size:11px;';

      const chipLabel = document.createElement('span');
      chipLabel.textContent = formatGameItemLabel(item);
      chip.appendChild(chipLabel);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-icon btn-sm';
      removeBtn.textContent = '×';
      removeBtn.title = `Remove ${item}`;
      removeBtn.onclick = () => {
        const nextItems = [...items];
        nextItems.splice(index, 1);
        const nextValue = nextItems.join(options.chainSeparator);
        syncUi(nextValue);
        onChange(nextValue);
      };
      chip.appendChild(removeBtn);

      chipList.appendChild(chip);
    });

    summary.textContent = formatItemChainSummary(items);
    clearButton.disabled = items.length === 0;
  };

  addButton.onclick = () => {
    openItemPickerPanel({
      trigger: addButton,
      currentValue: '',
      allowEmpty: false,
      onSelect: (value) => {
        const items = parseItemChain(rawInput.value, options.chainSeparator);
        const nextItems = items.includes(value) ? items : [...items, value];
        const nextValue = nextItems.join(options.chainSeparator);
        syncUi(nextValue);
        onChange(nextValue);
      },
    });
  };

  clearButton.onclick = () => {
    syncUi('');
    onChange('');
    rawInput.focus();
  };

  rawInput.oninput = () => onChange(rawInput.value);
  rawInput.onchange = () => {
    syncUi(rawInput.value);
    onChange(rawInput.value);
  };
  rawInput.addEventListener('input', () => syncUi(rawInput.value));

  controls.append(addButton, clearButton);
  wrapper.append(controls, rawInput, chipList, summary);

  syncUi(currentValue);
  return wrapper;
}

export { buildItemOptionLabel };
