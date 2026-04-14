import { LEVEL_DISPLAY_NAMES, SMART_TERRAIN_LEVELS, SMART_TERRAIN_OPTIONS_ALL, SMART_TERRAIN_OPTIONS_BY_LEVEL, type SmartTerrainOption } from '../lib/constants';

export type CatalogPickerOption = {
  value: string;
  label: string;
  keywords?: string[];
};

let activeCleanup: (() => void) | null = null;
let activeTrigger: HTMLElement | null = null;

function closeActive(trigger: HTMLElement): boolean {
  if (!activeCleanup) return false;
  const sameTrigger = activeTrigger === trigger;
  activeCleanup();
  return sameTrigger;
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
    facets?: Array<{ label: string; keywordIndex: number; allLabel: string }>;
  },
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'rich-editor rich-editor-item-picker';

  const launcherRow = document.createElement('div');
  launcherRow.className = 'rich-editor-toolbar item-picker-toolbar';

  const browseButton = document.createElement('button');
  browseButton.type = 'button';
  browseButton.className = 'item-picker-launcher';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'btn-sm';
  clearButton.textContent = 'Clear';

  const rawInput = document.createElement('input');
  rawInput.type = 'text';
  rawInput.className = 'rich-editor-input';
  rawInput.value = currentValue;
  rawInput.placeholder = config.emptyLabel;
  rawInput.setAttribute('data-field-key', fieldKey);

  const summary = document.createElement('div');
  summary.className = 'command-description';

  const syncUi = (value: string): void => {
    rawInput.value = value;
    const selected = config.options.find((option) => option.value === value);
    browseButton.textContent = '';
    const label = document.createElement('span');
    label.className = 'item-picker-launcher-label';
    label.textContent = selected ? selected.label : config.browseLabel;
    const icon = document.createElement('span');
    icon.className = 'item-picker-launcher-icon';
    icon.textContent = 'v';
    browseButton.append(label, icon);
    summary.textContent = selected
      ? `Selected ${selected.label} (${selected.value}).`
      : 'Use picker or type custom id manually.';
    clearButton.disabled = value.length === 0;
  };

  const openPicker = (): void => {
    if (closeActive(browseButton)) return;

    const overlay = document.createElement('div');
    overlay.className = 'item-picker-overlay';
    overlay.setAttribute('role', 'presentation');

    const panel = document.createElement('div');
    panel.className = 'item-picker-panel';
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

    const facetValues = new Map<number, string>();
    const facetButtons: Array<Map<string, HTMLButtonElement>> = [];
    for (const [facetIndex, facet] of (config.facets ?? []).entries()) {
      const bar = document.createElement('div');
      bar.className = `item-picker-chip-bar${facetIndex > 0 ? ' item-picker-subchip-bar' : ''}`;
      const buttons = new Map<string, HTMLButtonElement>();
      const values = Array.from(new Set(config.options.map((option) => option.keywords?.[facet.keywordIndex]?.trim() || 'Unknown'))).sort();
      addFacetChip(bar, buttons, facet.allLabel, '', () => {
        facetValues.set(facetIndex, '');
        renderList();
      });
      for (const value of values) {
        addFacetChip(bar, buttons, value, value, () => {
          facetValues.set(facetIndex, value);
          renderList();
        });
      }
      facetButtons.push(buttons);
      panel.appendChild(bar);
    }

    const list = document.createElement('div');
    list.className = 'item-picker-list';
    const listContent = document.createElement('div');
    listContent.className = 'item-picker-list-content item-picker-list-content-static';
    const empty = document.createElement('div');
    empty.className = 'item-picker-empty';
    empty.textContent = 'No matches.';
    empty.hidden = true;
    list.append(listContent, empty);
    panel.appendChild(list);

    const renderList = (): void => {
      const query = searchInput.value.trim().toLowerCase();
      const matches = config.options.filter((option) => {
        for (const [facetIndex, activeValue] of facetValues.entries()) {
          if (!activeValue) continue;
          const facet = config.facets?.[facetIndex];
          const actual = facet ? option.keywords?.[facet.keywordIndex]?.trim() || 'Unknown' : '';
          if (actual !== activeValue) return false;
        }
        if (!query) return true;
        return [option.label, option.value, ...(option.keywords ?? [])].join(' ').toLowerCase().includes(query);
      });

      listContent.innerHTML = '';
      empty.hidden = matches.length !== 0;
      for (const option of matches.slice(0, 260)) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'item-picker-option item-picker-option-static';
        if (option.value === rawInput.value) row.classList.add('is-selected');
        row.innerHTML = `<span class="item-picker-option-title">${escapeHtml(option.label)}</span><span class="item-picker-option-meta">${escapeHtml(option.value)}</span>`;
        row.onclick = () => {
          cleanup();
          syncUi(option.value);
          onChange(option.value);
        };
        listContent.appendChild(row);
      }
      if (matches.length > 260) {
        const overflow = document.createElement('div');
        overflow.className = 'command-description';
        overflow.textContent = `Showing 260 of ${matches.length}. Keep typing to narrow.`;
        listContent.appendChild(overflow);
      }

      for (const [facetIndex, buttons] of facetButtons.entries()) {
        const active = facetValues.get(facetIndex) ?? '';
        for (const [value, button] of buttons) {
          button.classList.toggle('is-active', value === active);
        }
      }
    };

    let closed = false;
    const cleanup = (): void => {
      if (closed) return;
      closed = true;
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

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    activeCleanup = cleanup;
    activeTrigger = browseButton;
    renderList();
    requestAnimationFrame(() => searchInput.focus());
    document.addEventListener('keydown', handleEscape, true);
  };

  browseButton.onclick = openPicker;
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

  launcherRow.append(browseButton, clearButton);
  wrapper.append(launcherRow, rawInput, summary);
  syncUi(currentValue);
  return wrapper;
}

function addFacetChip(parent: HTMLElement, buttons: Map<string, HTMLButtonElement>, label: string, value: string, onClick: () => void): void {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'item-picker-chip';
  chip.textContent = label;
  chip.onclick = onClick;
  buttons.set(value, chip);
  parent.appendChild(chip);
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
  const placeholder = /^%([a-z_]+)_panda_st_key%$/.exec(value.trim());
  if (placeholder?.[1]) return { level: placeholder[1], terrain: '', usesPlaceholder: true };
  return { level: '', terrain: value.trim(), usesPlaceholder: false };
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
