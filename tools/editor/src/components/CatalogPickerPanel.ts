import { LEVEL_DISPLAY_NAMES, SMART_TERRAIN_LEVELS, SMART_TERRAIN_OPTIONS_ALL, SMART_TERRAIN_OPTIONS_BY_LEVEL, type SmartTerrainOption } from '../lib/constants';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';

export type CatalogPickerOption = {
  value: string;
  label: string;
  keywords?: string[];
  /** Optional display fields consumed by the richer story-NPC row layout. */
  characterName?: string;
  faction?: string;
  level?: string;
  role?: string;
};

export type CatalogPickerFacet = {
  label: string;
  allLabel: string;
  /** Field name on the option to filter by — falls back to `keywordIndex` when omitted. */
  field?: 'faction' | 'level' | 'role';
  /** Legacy fallback: read a value from `option.keywords[keywordIndex]`. */
  keywordIndex?: number;
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
    facets?: CatalogPickerFacet[];
    /**
     * When true, renders the richer two-line row (character name + profile id + tag pills)
     * and groups results by level. Enabled automatically when the options carry any
     * rich metadata (characterName/faction/level/role).
     */
    richRows?: boolean;
  },
): HTMLElement {
  const hasRichMetadata = config.options.some(
    (option) => option.characterName || option.faction || option.level || option.role,
  );
  const useRichRows = config.richRows ?? hasRichMetadata;
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

  const describeOption = (option: CatalogPickerOption): string => {
    if (option.characterName) {
      return `${option.characterName} (${option.value})`;
    }
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
    summary.textContent = selected
      ? `Selected ${describeOption(selected)}.`
      : 'Use picker or type custom id manually.';
    clearButton.disabled = value.length === 0;
  };

  const readFacetValue = (option: CatalogPickerOption, facet: CatalogPickerFacet): string => {
    if (facet.field) {
      const value = option[facet.field];
      if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
    if (typeof facet.keywordIndex === 'number') {
      const raw = option.keywords?.[facet.keywordIndex]?.trim();
      if (raw) return raw;
    }
    return 'Unknown';
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

    const totalCountBadge = document.createElement('div');
    totalCountBadge.className = 'item-picker-total';
    panel.appendChild(totalCountBadge);

    const facets = config.facets ?? [];
    const facetValues = new Map<number, string>();
    const facetButtons: Array<Map<string, HTMLButtonElement>> = [];
    const facetBars: HTMLElement[] = [];
    for (const [facetIndex, facet] of facets.entries()) {
      const bar = document.createElement('div');
      bar.className = `item-picker-chip-bar${facetIndex > 0 ? ' item-picker-subchip-bar' : ''}`;
      const buttons = new Map<string, HTMLButtonElement>();
      const values = Array.from(
        new Set(config.options.map((option) => readFacetValue(option, facet))),
      ).sort((a, b) => a.localeCompare(b));
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
      facetBars.push(bar);
      panel.appendChild(bar);
    }

    const list = document.createElement('div');
    list.className = 'item-picker-list';
    const listContent = document.createElement('div');
    listContent.className = 'item-picker-list-content item-picker-list-content-static';
    const empty = document.createElement('div');
    empty.className = 'item-picker-empty';
    empty.textContent = 'No matches. Try clearing a filter chip or the search box.';
    empty.hidden = true;
    list.append(listContent, empty);
    panel.appendChild(list);

    const renderOptionRow = (option: CatalogPickerOption): HTMLButtonElement => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'item-picker-option item-picker-option-static';
      if (option.value === rawInput.value) row.classList.add('is-selected');

      if (useRichRows) {
        row.classList.add('item-picker-option-rich');
        const primary = document.createElement('span');
        primary.className = 'item-picker-option-primary';

        const title = document.createElement('span');
        title.className = 'item-picker-option-title';
        title.textContent = option.characterName || (option.label || option.value);
        primary.appendChild(title);

        const id = document.createElement('span');
        id.className = 'item-picker-option-meta';
        id.textContent = option.value;
        primary.appendChild(id);

        row.appendChild(primary);

        const tags = document.createElement('span');
        tags.className = 'item-picker-option-tags';
        const pushTag = (text: string | undefined, modifier: string): void => {
          if (!text) return;
          const pill = document.createElement('span');
          pill.className = `item-picker-tag item-picker-tag-${modifier}`;
          pill.textContent = text;
          tags.appendChild(pill);
        };
        pushTag(option.faction, 'faction');
        pushTag(option.role, 'role');
        pushTag(option.level, 'level');
        if (tags.childElementCount > 0) row.appendChild(tags);
      } else {
        const title = document.createElement('span');
        title.className = 'item-picker-option-title';
        title.textContent = option.label;
        const meta = document.createElement('span');
        meta.className = 'item-picker-option-meta';
        meta.textContent = option.value;
        row.append(title, meta);
      }

      row.onclick = () => {
        cleanup();
        syncUi(option.value);
        onChange(option.value);
      };
      return row;
    };

    const groupByLevel = (matches: CatalogPickerOption[]): Map<string, CatalogPickerOption[]> => {
      const groups = new Map<string, CatalogPickerOption[]>();
      for (const option of matches) {
        const key = option.level?.trim() || 'Other';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(option);
      }
      return groups;
    };

    const renderList = (): void => {
      const query = searchInput.value.trim().toLowerCase();
      const matches = config.options.filter((option) => {
        for (const [facetIndex, activeValue] of facetValues.entries()) {
          if (!activeValue) continue;
          const facet = facets[facetIndex];
          if (!facet) continue;
          if (readFacetValue(option, facet) !== activeValue) return false;
        }
        if (!query) return true;
        const haystack = [
          option.label,
          option.value,
          option.characterName,
          option.faction,
          option.level,
          option.role,
          ...(option.keywords ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });

      listContent.innerHTML = '';
      empty.hidden = matches.length !== 0;
      const MAX_RENDERED = 260;

      if (useRichRows) {
        const groups = groupByLevel(matches.slice(0, MAX_RENDERED));
        const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
          if (a === 'Other') return 1;
          if (b === 'Other') return -1;
          return a.localeCompare(b);
        });
        for (const key of sortedKeys) {
          const entries = groups.get(key) ?? [];
          const heading = document.createElement('div');
          heading.className = 'item-picker-group-heading';
          heading.textContent = `${key} · ${entries.length}`;
          listContent.appendChild(heading);
          for (const option of entries) {
            listContent.appendChild(renderOptionRow(option));
          }
        }
      } else {
        for (const option of matches.slice(0, MAX_RENDERED)) {
          listContent.appendChild(renderOptionRow(option));
        }
      }

      if (matches.length > MAX_RENDERED) {
        const overflow = document.createElement('div');
        overflow.className = 'command-description';
        overflow.textContent = `Showing ${MAX_RENDERED} of ${matches.length}. Keep typing to narrow.`;
        listContent.appendChild(overflow);
      }

      totalCountBadge.textContent = `${matches.length} of ${config.options.length} match current filters.`;

      for (const [facetIndex, buttons] of facetButtons.entries()) {
        const active = facetValues.get(facetIndex) ?? '';
        const facet = facets[facetIndex];
        const counts = new Map<string, number>();
        if (facet) {
          // Count options that satisfy every OTHER active facet + the search,
          // so users see an accurate remaining cardinality per chip.
          for (const option of config.options) {
            let keep = true;
            for (const [otherIndex, otherValue] of facetValues.entries()) {
              if (otherIndex === facetIndex) continue;
              if (!otherValue) continue;
              const otherFacet = facets[otherIndex];
              if (otherFacet && readFacetValue(option, otherFacet) !== otherValue) {
                keep = false;
                break;
              }
            }
            if (!keep) continue;
            if (query) {
              const haystack = [
                option.label,
                option.value,
                option.characterName,
                option.faction,
                option.level,
                option.role,
                ...(option.keywords ?? []),
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              if (!haystack.includes(query)) continue;
            }
            const bucket = readFacetValue(option, facet);
            counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
            counts.set('', (counts.get('') ?? 0) + 1);
          }
        }
        for (const [value, button] of buttons) {
          button.classList.toggle('is-active', value === active);
          const countEl = button.querySelector('.item-picker-chip-count');
          const count = counts.get(value);
          if (countEl) countEl.textContent = typeof count === 'number' ? String(count) : '';
        }
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

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
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
  const chipLabel = document.createElement('span');
  chipLabel.className = 'item-picker-chip-label';
  chipLabel.textContent = label;
  const chipCount = document.createElement('span');
  chipCount.className = 'item-picker-chip-count';
  chip.append(chipLabel, chipCount);
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
