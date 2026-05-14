import { requestFlowCenter } from '../lib/flow-navigation';
import { store, type FocusedCharacterRef } from '../lib/state';
import { collectConversationCharacters, type CharacterFocusEntry } from '../lib/character-focus';
import { createUiText } from '../lib/ui-language';
import { setBeginnerTooltip } from '../lib/beginner-tooltips';
import { createControlContent, createIcon, setButtonContent } from './icons';
import { openNpcTemplateEditor } from './NpcTemplatePanel';

export function createCharactersMenu(): HTMLElement {
  const state = store.get();
  const ui = createUiText(state.uiLanguage);
  const conv = store.getSelectedConversation();
  const characters = conv ? collectConversationCharacters(conv, state.project.npcTemplates ?? []) : [];

  const details = document.createElement('details');
  details.className = 'toolbar-overflow toolbar-characters flow-characters';

  const summary = document.createElement('summary');
  summary.className = 'btn-sm flow-character-button toolbar-overflow-toggle';
  summary.appendChild(createControlContent('users', characters.length > 0 ? ui(`Characters ${characters.length}`, `NPC ${characters.length}`) : ui('Characters', 'NPC')));
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-label', ui('Characters menu', 'Characters menu'));
  summary.title = ui('Focus or remove NPCs used by this storyline', 'Focus or remove NPCs used by this storyline');
  setBeginnerTooltip(summary, 'toolbar-more');
  details.appendChild(summary);

  const menu = document.createElement('div');
  menu.className = 'toolbar-overflow-menu toolbar-characters-menu';

  if (!conv) {
    menu.appendChild(createCharactersEmptyState(ui('No story selected', 'No story selected')));
    details.appendChild(menu);
    return details;
  }

  menu.appendChild(createCharactersSummary(characters, ui));

  if (state.focusedCharacterRef) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'toolbar-overflow-item toolbar-character-clear';
    setButtonContent(clear, 'eye', ui('Clear Highlight', 'Clear Highlight'));
    clear.onclick = () => {
      details.open = false;
      store.setFocusedCharacterRef(null);
    };
    menu.appendChild(clear);
  }

  if (characters.length === 0) {
    menu.appendChild(createCharactersEmptyState(ui('No NPCs in this story', 'No NPCs in this story')));
    details.appendChild(menu);
    return details;
  }

  for (const character of characters) {
    menu.appendChild(createCharacterMenuItem(details, conv.id, character, state.focusedCharacterRef));
  }

  details.appendChild(menu);
  return details;
}

function createCharactersSummary(characters: CharacterFocusEntry[], ui: ReturnType<typeof createUiText>): HTMLElement {
  const customCount = characters.filter((character) => character.kind === 'custom').length;
  const storyCount = characters.length - customCount;
  const usageCount = characters.reduce((total, character) => total + character.usageCount, 0);
  const summary = document.createElement('div');
  summary.className = 'toolbar-characters-header';
  summary.textContent = ui(
    `${characters.length} unique NPCs - ${storyCount} story - ${customCount} custom - ${usageCount} refs`,
    `${characters.length} unique NPCs - ${storyCount} story - ${customCount} custom - ${usageCount} refs`,
  );
  return summary;
}

function createCharactersEmptyState(label: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'toolbar-characters-empty';
  empty.textContent = label;
  return empty;
}

function createCharacterMenuItem(
  details: HTMLDetailsElement,
  conversationId: number,
  character: CharacterFocusEntry,
  focusedCharacterRef: FocusedCharacterRef | null,
): HTMLElement {
  const ui = createUiText(store.get().uiLanguage);
  const row = document.createElement('div');
  row.className = 'toolbar-character-row';

  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'toolbar-character-item';
  if (focusedCharacterRef === character.ref) item.classList.add('is-active');
  item.title = character.kind === 'custom'
    ? ui('Focus branches and edit custom NPC', 'Focus branches and edit custom NPC')
    : ui('Focus branches for this story NPC', 'Focus branches for this story NPC');

  const title = document.createElement('span');
  title.className = 'toolbar-character-title';
  title.textContent = character.label;

  const meta = document.createElement('span');
  meta.className = 'toolbar-character-meta';
  meta.textContent = character.meta;

  const count = document.createElement('span');
  count.className = 'toolbar-character-count';
  count.textContent = `${character.branchCount} branch${character.branchCount === 1 ? '' : 'es'} / ${character.usageCount} ref${character.usageCount === 1 ? '' : 's'}`;

  item.append(title, meta, count);
  item.onclick = () => {
    details.open = false;
    store.setFocusedCharacterRef(character.ref);
    if (character.firstTurnNumber != null) {
      store.selectTurn(character.firstTurnNumber);
      requestFlowCenter({ conversationId, turnNumber: character.firstTurnNumber });
    }
    if (character.kind === 'custom') {
      openNpcTemplateEditor(character.id, item);
    }
  };

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'toolbar-character-delete';
  remove.appendChild(createIcon('delete'));
  remove.title = ui(
    `Remove ${character.label} from this story`,
    `Remove ${character.label} from this story`,
  );
  remove.setAttribute('aria-label', remove.title);
  remove.onclick = (event) => {
    event.stopPropagation();
    if (!window.confirm(ui(
      `Remove ${character.label} from this story? This clears ${character.usageCount} NPC reference${character.usageCount === 1 ? '' : 's'}.`,
      `Remove ${character.label} from this story? This clears ${character.usageCount} NPC reference${character.usageCount === 1 ? '' : 's'}.`,
    ))) return;
    details.open = false;
    store.removeCharacterFromConversation(conversationId, character.ref);
  };

  row.append(item, remove);
  return row;
}
