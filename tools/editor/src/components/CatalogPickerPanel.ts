import { LEVEL_DISPLAY_NAMES, SMART_TERRAIN_LEVELS, SMART_TERRAIN_OPTIONS_ALL, SMART_TERRAIN_OPTIONS_BY_LEVEL, type SmartTerrainOption } from '../lib/constants';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';

const CATALOG_PICKER_MOUNT_ID = 'app-modal-host';
const RICH_TAG_FIELDS = ['faction', 'role', 'level', 'kind', 'source', 'size'] as const;

export type CatalogPickerOption = {
  value: string;
  label: string;
  keywords?: string[];
  characterName?: string;
  faction?: string;
  level?: string;
  role?: string;
};

export type CatalogPickerFacet = {
  label: string;
  allLabel: string;
  field?: string;
  keywordIndex?: number;
};

let activeCleanup: (() => void) | null = null;
let activeTrigger: HTMLElement | null = null;

function getMount(): HTMLElement {
  return document.getElementById(CATALOG_PICKER_MOUNT_ID) ?? document.body;
}

function closeActive(trigger: HTMLElement): boolean {
  if (!activeCleanup) return false;
  const sameTrigger = activeTrigger === trigger;
  activeCleanup();
  return sameTrigger;
}

function readFacetValue(option: CatalogPickerOption, facet: CatalogPickerFacet): string {
  if (facet.field) {
    const value = (option as Record<string, unknown>)[facet.field];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  if (typeof facet.keywordIndex === 'number') {
    const raw = option.keywords?.[facet.keywordIndex]?.trim();
    if (raw) return raw;
  }
  return 'Unknown';
}

function buildHaystack(option: CatalogPickerOption): string {
  return [
    option.label,
    option.value,
    option.characterName,
    ...RICH_TAG_FIELDS.map((field) => {
      const value = (option as Record<string, unknown>)[field];
      return typeof value === 'string' ? value : '';
    }),
    ...(option.keywords ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function hasRichCatalogMetadata(option: CatalogPickerOption): boolean {
  return ['characterName', ...RICH_TAG_FIELDS].some((field) => {
    const value = (option as Record<string, unknown>)[field];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

export function createCatalogPickerPanelEditor(
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  config: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    emptyLabel: string;
    browseLabel: string;
    options: CatalogPickerOption[];
    facets?: CatalogPickerFacet[];
    richRows?: boolean;
  },
): HTMLElement {
  const useRichRows = config.richRows ?? config.options.some((option) => hasRichCatalogMetadata(option));
  const facets = config.facets ?? [];
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-item-picker';

  const launcherRow = document.createElement('div');
  launcherRow.className = 'rich-editor-toolbar item-picker-toolbar';

  const browseButton = document.createElement('button');
  browseButton.type = 'button';
  browseButton.className = 'item-picker-launcher';

  const customToggleButton = document.createElement('button');
  customToggleButton.type = 'button';
  customToggleButton.className = 'btn-sm item-picker-inline-toggle';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'btn-sm';
  clearButton.textContent = 'Clear';

  const rawWrap = document.createElement('div');
  rawWrap.className = 'item-picker-inline-editor';

  const rawInput = document.createElement('input');
  rawInput.type = 'text';
  rawInput.className = 'rich-editor-input';
  rawInput.value = currentValue;
  rawInput.placeholder = config.emptyLabel;
  rawInput.setAttribute('data-field-key', fieldKey);
  rawWrap.appendChild(rawInput);

  const summary = document.createElement('div');
  summary.className = 'command-description';

  let customMode = currentValue.length > 0 && !config.options.some((option) => option.value === currentValue);

  const describeOption = (option: CatalogPickerOption): string => {
    if (option.characterName) return `${option.characterName} (${option.value})`;
    return option.label || option.value;
  };

  const syncUi = (value: string): void => {
    rawInput.value = value;
    const selected = config.options.find((option) => option.value === value);

    browseButton.textContent = '';
    const label = document.createElement('span');
    label.className = 'item-picker-launcher-label';
    label.textContent = selected ? describeOption(selected) : config.browseLabel;
    const icon = document.createElement('span');
    icon.className = 'item-picker-launcher-icon';
    icon.textContent = 'v';
    browseButton.append(label, icon);

    rawWrap.classList.toggle('is-visible', customMode);
    rawInput.hidden = !customMode;
    customToggleButton.textContent = customMode ? 'Hide custom' : 'Custom ID';
    clearButton.disabled = value.length === 0;

    summary.textContent = selected
      ? `Selected ${describeOption(selected)}.`
      : (value ? `Using custom id ${value}. Keep manual entry for modded content.` : 'Choose from vanilla catalog or open custom id.');
  };

  const openPicker = (): void => {
    if (closeActive(browseButton)) return;

    const overlay = document.createElement('div');
    overlay.className = 'item-picker-overlay catalog-picker-overlay';
    overlay.setAttribute('role', 'presentation');

    const panel = document.createElement('div');
    panel.className = 'item-picker-panel catalog-picker-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.onclick = (event) => event.stopPropagation();

    const header = document.createElement('div');
    header.className = 'item-picker-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'item-picker-title-wrap';
    const title = document.createElement('div');
    title.className = 'item-picker-title';
    title.textContent = config.title;
    const subtitle = document.createElement('div');
    subtitle.className = 'item-picker-subtitle';
    subtitle.textContent = config.subtitle;
    const closeButton = document.createElement('button');
    closeButton.className = 'btn-icon btn-sm';
    closeButton.textContent = 'x';
    closeButton.title = 'Close picker';
    titleWrap.append(title, subtitle);
    header.append(titleWrap, closeButton);
    panel.appendChild(header);

    const searchWrap = document.createElement('div');
    searchWrap.className = 'item-picker-search-wrap';
    const searchIcon = document.createElement('span');
    searchIcon.className = 'item-picker-search-icon';
    searchIcon.textContent = '>';
    searchIcon.setAttribute('aria-hidden', 'true');
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dropdown-search item-picker-search';
    searchInput.placeholder = config.searchPlaceholder;
    searchWrap.append(searchIcon, searchInput);
    panel.appendChild(searchWrap);

    const filterRail = document.createElement('div');
    filterRail.className = 'item-picker-filter-rail';
    const facetControls: Array<{ facet: CatalogPickerFacet; select: HTMLSelectElement }> = [];
    for (const facet of facets) {
      const control = document.createElement('label');
      control.className = 'item-picker-filter-group';
      const caption = document.createElement('span');
      caption.className = 'item-picker-filter-label';
      caption.textContent = facet.label;
      const select = document.createElement('select');
      select.className = 'item-picker-filter-select';
      control.append(caption, select);
      filterRail.appendChild(control);
      facetControls.push({ facet, select });
    }
    if (facetControls.length > 0) {
      panel.appendChild(filterRail);
    }

    const metaRow = document.createElement('div');
    metaRow.className = 'item-picker-meta-row';
    const currentSelection = document.createElement('div');
    currentSelection.className = 'item-picker-selection-summary';
    currentSelection.textContent = currentValue
      ? `Current: ${currentValue}`
      : 'Current: none';
    const totalCountBadge = document.createElement('div');
    totalCountBadge.className = 'item-picker-total';
    metaRow.append(currentSelection, totalCountBadge);
    panel.appendChild(metaRow);

    const list = document.createElement('div');
    list.className = 'item-picker-list';
    const listContent = document.createElement('div');
    listContent.className = 'item-picker-list-content item-picker-list-content-static';
    const empty = document.createElement('div');
    empty.className = 'item-picker-empty';
    empty.textContent = 'No matches. Clear filter or switch to custom id for modded content.';
    empty.hidden = true;
    list.append(listContent, empty);
    panel.appendChild(list);

    const queryMatches = (option: CatalogPickerOption, query: string): boolean => {
      if (!query) return true;
      return buildHaystack(option).includes(query);
    };

    const matchesOtherFacets = (
      option: CatalogPickerOption,
      activeFilters: string[],
      skipFacetIndex: number | null = null,
    ): boolean => {
      for (const [facetIndex, activeValue] of activeFilters.entries()) {
        if (!activeValue) continue;
        if (skipFacetIndex != null && facetIndex === skipFacetIndex) continue;
        const facet = facets[facetIndex];
        if (!facet) continue;
        if (readFacetValue(option, facet) !== activeValue) return false;
      }
      return true;
    };

    const renderTag = (parent: HTMLElement, value: string, modifier = 'meta'): void => {
      const pill = document.createElement('span');
      pill.className = `item-picker-tag item-picker-tag-${modifier}`;
      pill.textContent = value;
      parent.appendChild(pill);
    };

    let visibleButtons: HTMLButtonElement[] = [];

    const renderOptionRow = (option: CatalogPickerOption, rowIndex: number): HTMLButtonElement => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'item-picker-option item-picker-option-static';
      if (option.value === rawInput.value) row.classList.add('is-selected');

      if (useRichRows) {
        row.classList.add('item-picker-option-rich');
        const primary = document.createElement('span');
        primary.className = 'item-picker-option-primary';

        const optionTitle = document.createElement('span');
        optionTitle.className = 'item-picker-option-title';
        optionTitle.textContent = option.characterName || option.label || option.value;
        primary.appendChild(optionTitle);

        const meta = document.createElement('span');
        meta.className = 'item-picker-option-meta';
        meta.textContent = option.value;
        primary.appendChild(meta);
        row.appendChild(primary);

        const tags = document.createElement('span');
        tags.className = 'item-picker-option-tags';
        for (const field of RICH_TAG_FIELDS) {
          const raw = (option as Record<string, unknown>)[field];
          if (typeof raw !== 'string' || raw.trim().length === 0) continue;
          const modifier = field === 'faction' || field === 'role' || field === 'level' ? field : 'meta';
          renderTag(tags, raw, modifier);
        }
        if (tags.childElementCount > 0) row.appendChild(tags);
      } else {
        const optionTitle = document.createElement('span');
        optionTitle.className = 'item-picker-option-title';
        optionTitle.textContent = option.label;
        const meta = document.createElement('span');
        meta.className = 'item-picker-option-meta';
        meta.textContent = option.value;
        row.append(optionTitle, meta);
      }

      row.onclick = () => {
        customMode = false;
        syncUi(option.value);
        onChange(option.value);
        cleanup();
      };
      row.onkeydown = (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          visibleButtons[Math.min(visibleButtons.length - 1, rowIndex + 1)]?.focus();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (rowIndex === 0) searchInput.focus();
          else visibleButtons[Math.max(0, rowIndex - 1)]?.focus();
        } else if (event.key === 'Home') {
          event.preventDefault();
          visibleButtons[0]?.focus();
        } else if (event.key === 'End') {
          event.preventDefault();
          visibleButtons[visibleButtons.length - 1]?.focus();
        }
      };
      return row;
    };

    const renderList = (): void => {
      const query = searchInput.value.trim().toLowerCase();
      const activeFilters = facetControls.map(({ select }) => select.value);
      const matches = config.options.filter((option) => (
        matchesOtherFacets(option, activeFilters) && queryMatches(option, query)
      ));

      listContent.innerHTML = '';
      empty.hidden = matches.length !== 0;
      visibleButtons = [];
      const MAX_RENDERED = 260;
      const visibleMatches = matches.slice(0, MAX_RENDERED);

      const shouldGroupByLevel = useRichRows && visibleMatches.some((option) => typeof option.level === 'string' && option.level.trim().length > 0);
      if (shouldGroupByLevel) {
        const groups = new Map<string, CatalogPickerOption[]>();
        for (const option of visibleMatches) {
          const key = typeof option.level === 'string' && option.level.trim().length > 0 ? option.level.trim() : 'Other';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(option);
        }
        const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
          if (a === 'Other') return 1;
          if (b === 'Other') return -1;
          return a.localeCompare(b);
        });
        for (const key of sortedKeys) {
          const entries = groups.get(key) ?? [];
          const heading = document.createElement('div');
          heading.className = 'item-picker-group-heading';
          heading.textContent = `${key} | ${entries.length}`;
          listContent.appendChild(heading);
          for (const option of entries) {
            const row = renderOptionRow(option, visibleButtons.length);
            visibleButtons.push(row);
            listContent.appendChild(row);
          }
        }
      } else {
        for (const option of visibleMatches) {
          const row = renderOptionRow(option, visibleButtons.length);
          visibleButtons.push(row);
          listContent.appendChild(row);
        }
      }

      if (matches.length > MAX_RENDERED) {
        const overflow = document.createElement('div');
        overflow.className = 'command-description';
        overflow.textContent = `Showing ${MAX_RENDERED} of ${matches.length}. Keep typing to narrow.`;
        listContent.appendChild(overflow);
      }

      totalCountBadge.textContent = `${matches.length} / ${config.options.length} match`;

      for (const [facetIndex, control] of facetControls.entries()) {
        const counts = new Map<string, number>();
        for (const option of config.options) {
          if (!matchesOtherFacets(option, activeFilters, facetIndex) || !queryMatches(option, query)) continue;
          const bucket = readFacetValue(option, control.facet);
          counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
          counts.set('', (counts.get('') ?? 0) + 1);
        }

        const current = control.select.value;
        const values = Array.from(new Set(config.options.map((option) => readFacetValue(option, control.facet))))
          .sort((a, b) => a.localeCompare(b));
        control.select.innerHTML = '';

        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = `${control.facet.allLabel} (${counts.get('') ?? 0})`;
        control.select.appendChild(allOption);

        for (const value of values) {
          const optionEl = document.createElement('option');
          optionEl.value = value;
          optionEl.textContent = `${value} (${counts.get(value) ?? 0})`;
          control.select.appendChild(optionEl);
        }

        control.select.value = current;
      }
    };

    let closed = false;
    let focusTrapController: FocusTrapController | null = null;
    const cleanup = (): void => {
      if (closed) return;
      closed = true;
      focusTrapController?.release();
      focusTrapController = null;
      overlay.remove();
      document.removeEventListener('keydown', handleEscape, true);
      activeCleanup = null;
      activeTrigger = null;
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cleanup();
      browseButton.focus();
    };

    closeButton.onclick = () => {
      cleanup();
      browseButton.focus();
    };
    overlay.onclick = (event) => {
      if (event.target === overlay) cleanup();
    };
    searchInput.oninput = renderList;
    searchInput.onkeydown = (event) => {
      if (event.key === 'ArrowDown' && visibleButtons.length > 0) {
        event.preventDefault();
        visibleButtons[0]?.focus();
      }
    };
    for (const control of facetControls) {
      control.select.onchange = renderList;
    }

    overlay.appendChild(panel);
    getMount().appendChild(overlay);
    activeCleanup = cleanup;
    activeTrigger = browseButton;
    renderList();
    focusTrapController = trapFocus(panel, {
      restoreFocus: browseButton,
      initialFocus: searchInput,
      onEscape: () => {
        cleanup();
        browseButton.focus();
      },
    });
    requestAnimationFrame(() => searchInput.focus());
    document.addEventListener('keydown', handleEscape, true);
  };

  browseButton.onclick = openPicker;
  customToggleButton.onclick = () => {
    customMode = !customMode;
    syncUi(rawInput.value);
    if (customMode) requestAnimationFrame(() => rawInput.focus());
  };
  clearButton.onclick = () => {
    customMode = false;
    syncUi('');
    onChange('');
  };
  rawInput.oninput = () => {
    customMode = true;
    onChange(rawInput.value);
    syncUi(rawInput.value);
  };
  rawInput.onchange = () => {
    customMode = true;
    syncUi(rawInput.value);
    onChange(rawInput.value);
  };

  launcherRow.append(browseButton, customToggleButton, clearButton);
  wrapper.append(launcherRow, rawWrap, summary);
  syncUi(currentValue);
  return wrapper;
}

export function createSmartTerrainPickerEditor(
  currentValue: string,
  onChange: (value: string) => void,
  fieldKey: string,
  options: { allowPlaceholder: boolean },
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-smart-terrain';
  const parsed = parseSmartTerrainReference(currentValue);
  let selectedLevel = parsed.level || (parsed.terrain ? '__all__' : '');
  let selectedTerrain = parsed.terrain;
  let selectionMode: 'placeholder' | 'exact' | '' = parsed.usesPlaceholder ? 'placeholder' : (parsed.terrain ? 'exact' : '');

  const levelSelect = document.createElement('select');
  levelSelect.className = 'rich-editor-input';
  levelSelect.setAttribute('data-field-key', fieldKey);
  addOption(levelSelect, '', '-- Select level --');
  addOption(levelSelect, '__all__', 'All levels (vanilla catalog)');
  for (const levelKey of Object.keys(SMART_TERRAIN_LEVELS)) {
    addOption(levelSelect, levelKey, LEVEL_DISPLAY_NAMES[levelKey] || levelKey);
  }
  levelSelect.value = selectedLevel;

  const searchInput = document.createElement('input');
  searchInput.className = 'rich-editor-input';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search smart terrain id or location...';

  const quickActions = document.createElement('div');
  quickActions.className = 'smart-terrain-toolbar';
  const placeholderButton = document.createElement('button');
  placeholderButton.type = 'button';
  placeholderButton.className = 'ghost';
  placeholderButton.textContent = 'Use dynamic placeholder';
  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'ghost';
  clearButton.textContent = 'Clear';
  if (options.allowPlaceholder) quickActions.appendChild(placeholderButton);
  quickActions.appendChild(clearButton);

  const terrainList = document.createElement('div');
  terrainList.className = 'smart-terrain-results';
  const summary = document.createElement('div');
  summary.className = 'command-description';

  const commit = (): void => {
    if (!selectedLevel) {
      onChange('');
    } else if (selectionMode === 'placeholder' && selectedLevel !== '__all__') {
      onChange(`%${selectedLevel}_panda_st_key%`);
    } else {
      onChange(selectionMode === 'exact' ? selectedTerrain : '');
    }
  };

  const renderTerrainList = (): void => {
    terrainList.innerHTML = '';
    if (!selectedLevel) {
      const hint = document.createElement('div');
      hint.className = 'command-description';
      hint.textContent = 'Choose level, then select dynamic placeholder or exact smart terrain.';
      terrainList.appendChild(hint);
      updateSummary();
      return;
    }
    const query = searchInput.value.trim().toLowerCase();
    const entries = getSmartTerrainOptions(selectedLevel).filter((entry) => {
      if (!query) return true;
      return entry.id.toLowerCase().includes(query) || entry.description.toLowerCase().includes(query);
    });
    for (const entry of entries.slice(0, 160)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'smart-terrain-result';
      if (selectionMode === 'exact' && selectedTerrain === entry.id) button.classList.add('is-selected');
      button.innerHTML = `<span class="smart-terrain-result-id">${escapeHtml(entry.id)}</span><span class="smart-terrain-result-desc">${escapeHtml(entry.description)}</span>`;
      button.onclick = () => {
        selectedTerrain = entry.id;
        selectionMode = 'exact';
        commit();
        renderTerrainList();
      };
      terrainList.appendChild(button);
    }
    updateSummary();
  };

  const updateSummary = (): void => {
    placeholderButton.disabled = !selectedLevel || selectedLevel === '__all__';
    if (!selectedLevel) {
      summary.textContent = 'No location selected.';
    } else if (selectionMode === 'placeholder' && selectedLevel !== '__all__') {
      summary.textContent = `Using dynamic %${selectedLevel}_panda_st_key%.`;
    } else {
      summary.textContent = selectedTerrain ? `Using exact smart terrain ${selectedTerrain}.` : 'Choose exact terrain or dynamic placeholder.';
    }
  };

  levelSelect.onchange = () => {
    selectedLevel = levelSelect.value;
    selectedTerrain = '';
    selectionMode = options.allowPlaceholder && selectedLevel && selectedLevel !== '__all__' ? 'placeholder' : '';
    commit();
    renderTerrainList();
  };
  searchInput.oninput = renderTerrainList;
  placeholderButton.onclick = () => {
    if (!selectedLevel || selectedLevel === '__all__') return;
    selectedTerrain = '';
    selectionMode = 'placeholder';
    commit();
    renderTerrainList();
  };
  clearButton.onclick = () => {
    selectedLevel = '';
    selectedTerrain = '';
    selectionMode = '';
    levelSelect.value = '';
    commit();
    renderTerrainList();
  };

  renderTerrainList();
  wrapper.append(levelSelect, searchInput, quickActions, terrainList, summary);
  return wrapper;
}

function getSmartTerrainOptions(level: string): SmartTerrainOption[] {
  if (level === '__all__') return SMART_TERRAIN_OPTIONS_ALL;
  return SMART_TERRAIN_OPTIONS_BY_LEVEL[level] ?? [];
}

function parseSmartTerrainReference(value: string): { level: string; terrain: string; usesPlaceholder: boolean } {
  const trimmed = value.trim();
  const placeholder = /^%([a-z_]+)_panda_st(?:_key)?%$/.exec(trimmed);
  if (placeholder?.[1]) return { level: placeholder[1], terrain: '', usesPlaceholder: true };
  if (!trimmed) return { level: '', terrain: '', usesPlaceholder: false };

  for (const [levelKey, terrainKeys] of Object.entries(SMART_TERRAIN_LEVELS)) {
    if (terrainKeys.includes(trimmed)) {
      return { level: levelKey, terrain: trimmed, usesPlaceholder: false };
    }
  }

  const catalogEntry = SMART_TERRAIN_OPTIONS_ALL.find((entry) => entry.id === trimmed);
  return { level: catalogEntry?.level && catalogEntry.level !== 'other' ? catalogEntry.level : '', terrain: trimmed, usesPlaceholder: false };
}

function addOption(select: HTMLSelectElement, value: string, label: string): void {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function escapeHtml(value: string): string {
  return value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}
