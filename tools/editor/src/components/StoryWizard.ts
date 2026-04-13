import { store } from '../lib/state';
import {
  buildStoryRecipe,
  STORY_RECIPES,
  STORY_START_OPTIONS,
  STORY_TARGET_OPTIONS,
  type StoryRecipeId,
  type StorySpeakerTarget,
  type StoryStartPattern,
} from '../lib/story-recipes';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { createIcon, setButtonContent } from './icons';

let overlayEl: HTMLElement | null = null;
let focusTrap: FocusTrapController | null = null;

export function openStoryWizard(): void {
  if (overlayEl) return;

  let startPattern: StoryStartPattern = 'pda';
  let speakerTarget: StorySpeakerTarget = 'any_friendly';
  let recipeId: StoryRecipeId = 'rumor';

  const overlay = document.createElement('div');
  overlay.className = 'story-wizard-overlay';
  overlay.onclick = (event) => {
    if (event.target === overlay) closeStoryWizard();
  };

  const panel = document.createElement('div');
  panel.className = 'story-wizard-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'story-wizard-title');

  const header = document.createElement('div');
  header.className = 'story-wizard-header';
  const title = document.createElement('div');
  title.id = 'story-wizard-title';
  title.className = 'story-wizard-title';
  title.append(createIcon('sparkle'), document.createTextNode('Make Story'));
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-icon';
  closeBtn.appendChild(createIcon('close'));
  closeBtn.title = 'Close';
  closeBtn.onclick = closeStoryWizard;
  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'story-wizard-body';

  const render = (): void => {
    body.replaceChildren(
      createOptionGroup('How does story start?', STORY_START_OPTIONS, startPattern, (value) => {
        startPattern = value as StoryStartPattern;
        if (recipeId === 'meet_in_person' && startPattern === 'f2f') startPattern = 'pda_to_f2f';
        render();
      }),
      createOptionGroup('Who can start it?', STORY_TARGET_OPTIONS, speakerTarget, (value) => {
        speakerTarget = value as StorySpeakerTarget;
        render();
      }),
      createOptionGroup('Story recipe', STORY_RECIPES, recipeId, (value) => {
        recipeId = value as StoryRecipeId;
        if (recipeId === 'meet_in_person') startPattern = 'pda_to_f2f';
        render();
      }),
    );
  };

  const footer = document.createElement('div');
  footer.className = 'story-wizard-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = closeStoryWizard;

  const createBtn = document.createElement('button');
  createBtn.type = 'button';
  createBtn.className = 'btn-sm btn-primary';
  setButtonContent(createBtn, 'add', 'Create story');
  createBtn.onclick = () => {
    const result = buildStoryRecipe(store.get().project, {
      recipeId,
      startPattern,
      speakerTarget,
    });
    store.addConversationFromTemplate(result.conversation, result.npcTemplates);
    closeStoryWizard();
  };
  footer.append(cancelBtn, createBtn);

  render();
  panel.append(header, body, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  overlayEl = overlay;
  focusTrap = trapFocus(panel, {
    restoreFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    initialFocus: createBtn,
    onEscape: closeStoryWizard,
  });
}

function closeStoryWizard(): void {
  focusTrap?.release();
  focusTrap = null;
  overlayEl?.remove();
  overlayEl = null;
}

function createOptionGroup<T extends { id: string; title: string; description: string }>(
  titleText: string,
  options: T[],
  selectedId: string,
  onSelect: (id: string) => void,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'story-wizard-section';
  const title = document.createElement('h3');
  title.textContent = titleText;
  section.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'story-wizard-option-grid';
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `story-wizard-option${option.id === selectedId ? ' is-selected' : ''}`;
    button.setAttribute('aria-pressed', String(option.id === selectedId));
    const optionTitle = document.createElement('strong');
    optionTitle.textContent = option.title;
    const description = document.createElement('span');
    description.textContent = option.description;
    button.append(optionTitle, description);
    button.onclick = () => onSelect(option.id);
    grid.appendChild(button);
  }
  section.appendChild(grid);
  return section;
}
