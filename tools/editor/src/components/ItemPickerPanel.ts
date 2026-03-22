import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import {
  GAME_ITEM_CATALOG,
  findGameItem,
  formatGameItemLabel,
  formatGameItemMeta,
  getGameItemSearchText,
  type GameItemCatalogEntry,
} from '../lib/item-catalog';

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
  subtitle.textContent = 'Search by display name, raw section id, kind, or category/path hints. Pick a vanilla item, or keep typing a custom section id inline.';
  titleWrap.appendChild(subtitle);

  const closeButton = document.createElement('button');
  closeButton.className = 'btn-icon btn-sm';
  closeButton.textContent = '×';
  closeButton.title = 'Close item picker';
  closeButton.onclick = () => cleanup();

  header.append(titleWrap, closeButton);
  panel.appendChild(header);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'dropdown-search item-picker-search';
  searchInput.placeholder = 'Search item name, section id, kind, or category...';
  searchInput.autocomplete = 'off';
  panel.appendChild(searchInput);

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

  const renderList = (filterValue: string): void => {
    const filter = normalizeFilter(filterValue);
    filteredItems = GAME_ITEM_CATALOG.filter((item) => matchesFilter(item, filter));
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

    filteredItems.forEach((item, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = `item-picker-option${index === activeIndex ? ' is-active' : ''}`;
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
    });

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

  searchInput.addEventListener('input', () => {
    renderList(searchInput.value);
    setActiveIndexFromValue(options.currentValue);
    updateActiveOption();
  });
  searchInput.addEventListener('keydown', handleKeyDown);

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
  let suppressNextLauncherFocus = false;

  const launcherRow = document.createElement('div');
  launcherRow.className = 'rich-editor-toolbar item-picker-toolbar';

  const selectedButton = document.createElement('button');
  selectedButton.type = 'button';
  selectedButton.className = 'item-picker-launcher';

  const browseButton = document.createElement('button');
  browseButton.type = 'button';
  browseButton.className = 'btn-sm';
  browseButton.textContent = 'Browse items';

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
    selectedButton.textContent = value ? formatGameItemLabel(value) : 'Choose an item section…';
    summary.textContent = getItemSummary(value, options.allowEmpty);
    if (maybeClearButton) maybeClearButton.disabled = value.length === 0;
  };

  const openPanel = (): void => {
    openItemPickerPanel({
      trigger: selectedButton,
      currentValue: rawInput.value,
      allowEmpty: options.allowEmpty,
      onClose: () => {
        suppressNextLauncherFocus = true;
      },
      onSelect: (value) => {
        syncUi(value);
        onChange(value);
      },
    });
  };

  selectedButton.onclick = openPanel;
  selectedButton.onfocus = () => {
    if (suppressNextLauncherFocus) {
      suppressNextLauncherFocus = false;
      return;
    }
    if (document.activeElement === selectedButton) openPanel();
  };
  browseButton.onclick = openPanel;

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

  launcherRow.append(selectedButton, browseButton);
  if (maybeClearButton) launcherRow.appendChild(maybeClearButton);
  wrapper.append(launcherRow, rawInput, summary);

  syncUi(currentValue);
  return wrapper;
}

export { buildItemOptionLabel };
