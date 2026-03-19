import { store } from '../lib/state';
import { createEmptyState, setButtonContent } from './icons';

export function renderSystemStringsPanel(container: HTMLElement): void {
  container.appendChild(createSystemStringsPanelContent());
}

export function createSystemStringsPanelContent(): HTMLElement {
  const state = store.get();
  const entries = [...state.systemStrings.entries()].sort(([a], [b]) => a.localeCompare(b));

  const panel = document.createElement('section');
  panel.className = 'system-strings-panel';

  const toolbar = document.createElement('div');
  toolbar.className = 'system-strings-toolbar';

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Filter by string id or text…';
  search.className = 'system-strings-search';
  toolbar.appendChild(search);
  panel.appendChild(toolbar);

  const list = document.createElement('div');
  list.className = 'system-strings-list';
  panel.appendChild(list);

  const renderList = (filter: string): void => {
    list.replaceChildren();
    const normalized = filter.trim().toLowerCase();
    const filtered = entries.filter(([key, value]) => normalized === ''
      || key.toLowerCase().includes(normalized)
      || value.toLowerCase().includes(normalized));

    if (filtered.length === 0) {
      if (normalized === '') {
        list.appendChild(createEmptyState(
          'strings',
          'No system strings',
          'Add entries here to manage shared XML strings without leaving the editor.'
        ));
      } else {
        const empty = document.createElement('div');
        empty.className = 'empty-hint';
        empty.textContent = 'No string entries match the current filter.';
        list.appendChild(empty);
      }
      return;
    }

    for (const [key, value] of filtered) {
      const card = document.createElement('article');
      card.className = 'system-string-card';

      const keyRow = document.createElement('div');
      keyRow.className = 'system-string-key-row';

      const keyInput = document.createElement('input');
      keyInput.type = 'text';
      keyInput.value = key;
      keyInput.className = 'system-string-key';
      keyInput.setAttribute('data-field-key', `system-string-key:${key}`);
      keyInput.title = 'String-table id';
      keyInput.onchange = () => store.renameSystemString(key, keyInput.value);

      const usage = document.createElement('span');
      usage.className = 'system-string-meta';
      usage.textContent = value.trim() === '' ? 'Empty value' : `${value.length} chars`;

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-icon';
      setButtonContent(deleteBtn, 'delete', 'Delete');
      deleteBtn.title = 'Delete string entry';
      deleteBtn.style.color = 'var(--danger)';
      deleteBtn.onclick = () => {
        if (confirm(`Delete string entry "${key}"?`)) {
          store.deleteSystemString(key);
        }
      };

      keyRow.append(keyInput, usage, deleteBtn);

      const valueInput = document.createElement('textarea');
      valueInput.value = value;
      valueInput.className = 'system-string-value';
      valueInput.rows = 3;
      valueInput.setAttribute('data-field-key', `system-string-value:${key}`);
      valueInput.placeholder = 'String-table text…';
      valueInput.onchange = () => store.setSystemString(keyInput.value || key, valueInput.value);

      card.append(keyRow, valueInput);
      list.appendChild(card);
    }
  };

  search.oninput = () => renderList(search.value);
  renderList('');
  return panel;
}
