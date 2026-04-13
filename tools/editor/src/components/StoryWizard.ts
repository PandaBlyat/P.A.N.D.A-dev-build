import { store } from '../lib/state';
import {
  buildStoryRecipe,
  DEFAULT_STORY_DETAILS,
  STORY_ENEMY_OPTIONS,
  STORY_HANDOFF_NPC_OPTIONS,
  STORY_ITEM_OPTIONS,
  STORY_LOCATION_OPTIONS,
  STORY_RECIPES,
  STORY_REWARD_ITEM_OPTIONS,
  STORY_REWARD_OPTIONS,
  STORY_START_OPTIONS,
  STORY_TARGET_OPTIONS,
  STORY_TIMEOUT_OPTIONS,
  type StoryDetailOptions,
  type StoryRecipeId,
  type StorySpeakerTarget,
  type StoryStartPattern,
  type StoryWizardOption,
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
  let details: StoryDetailOptions = { ...DEFAULT_STORY_DETAILS };

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
      createWizardIntro(),
      createOptionGroup('How does story start?', STORY_START_OPTIONS, startPattern, (value) => {
        startPattern = value as StoryStartPattern;
        startPattern = normalizeWizardStart(recipeId, startPattern);
        render();
      }),
      createOptionGroup('Who can start it?', STORY_TARGET_OPTIONS, speakerTarget, (value) => {
        speakerTarget = value as StorySpeakerTarget;
        render();
      }),
      createOptionGroup('Story recipe', STORY_RECIPES, recipeId, (value) => {
        recipeId = value as StoryRecipeId;
        startPattern = normalizeWizardStart(recipeId, startPattern);
        render();
      }),
      createDetailsPanel(recipeId, details, (nextDetails) => {
        details = nextDetails;
        render();
      }),
      createRecipeSummary(recipeId, startPattern, details),
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
      details,
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

function createWizardIntro(): HTMLElement {
  const intro = document.createElement('div');
  intro.className = 'story-wizard-intro';
  const title = document.createElement('strong');
  title.textContent = 'Pick intent. Editor fills safe rules, branches, and effects.';
  const copy = document.createElement('span');
  copy.textContent = 'You can edit text and technical details after story is created.';
  intro.append(title, copy);
  return intro;
}

function normalizeWizardStart(recipeId: StoryRecipeId, startPattern: StoryStartPattern): StoryStartPattern {
  if ((recipeId === 'item_request' || recipeId === 'escort_npc') && startPattern === 'pda') return 'pda_to_f2f';
  if (recipeId === 'meet_in_person') return 'pda_to_f2f';
  return startPattern;
}

function createDetailsPanel(
  recipeId: StoryRecipeId,
  details: StoryDetailOptions,
  onChange: (details: StoryDetailOptions) => void,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'story-wizard-section story-wizard-details';
  const title = document.createElement('h3');
  title.textContent = 'Story details';
  section.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'story-wizard-field-grid';
  const update = (patch: Partial<StoryDetailOptions>): void => onChange({ ...details, ...patch });

  if (usesItem(recipeId)) {
    grid.appendChild(createSelectField('Item', STORY_ITEM_OPTIONS, details.itemId, (itemId) => update({ itemId })));
  }
  if (recipeId === 'fetch_task') {
    grid.appendChild(createTextField('Count', details.itemCount, (itemCount) => update({ itemCount }), '1'));
  }
  if (usesMoney(recipeId)) {
    grid.appendChild(createSelectField(recipeId === 'paid_info' ? 'Price' : 'Money reward', STORY_REWARD_OPTIONS, details.rewardMoney, (rewardMoney) => update({ rewardMoney })));
  }
  if (recipeId === 'supply_gift') {
    grid.appendChild(createSelectField('Item reward', STORY_REWARD_ITEM_OPTIONS, details.rewardItemId, (rewardItemId) => update({ rewardItemId })));
  }
  if (usesLocation(recipeId)) {
    grid.appendChild(createSelectField('Location', STORY_LOCATION_OPTIONS, details.locationId, (locationId) => update({ locationId })));
  }
  if (recipeId === 'spawn_ambush') {
    grid.appendChild(createSelectField('Enemy', STORY_ENEMY_OPTIONS.filter((option) => option.id !== 'bandit' && option.id !== 'zombied'), details.enemyId, (enemyId) => update({ enemyId })));
  }
  if (recipeId === 'bounty_hunt') {
    grid.appendChild(createSelectField('Target', STORY_ENEMY_OPTIONS.filter((option) => option.id === 'bandit' || option.id === 'zombied'), details.targetFaction, (targetFaction) => update({ targetFaction: targetFaction as StoryDetailOptions['targetFaction'] })));
    grid.appendChild(createTextField('Rank', details.targetRank, (targetRank) => update({ targetRank }), 'Any rank'));
  }
  if (recipeId === 'multi_npc_handoff') {
    grid.appendChild(createSelectField('Second NPC', STORY_HANDOFF_NPC_OPTIONS, details.handoffNpcId, (handoffNpcId) => update({ handoffNpcId })));
  }
  if (recipeId === 'paid_info') {
    grid.appendChild(createTextField('Info ID', details.infoId, (infoId) => update({ infoId }), 'panda_story_info'));
  }
  if (usesTimeout(recipeId)) {
    grid.appendChild(createSelectField('Timer', STORY_TIMEOUT_OPTIONS, details.timeoutSeconds, (timeoutSeconds) => update({ timeoutSeconds })));
  }

  if (grid.childElementCount === 0) {
    const empty = document.createElement('p');
    empty.className = 'story-wizard-empty';
    empty.textContent = 'No extra setup needed for this recipe.';
    section.appendChild(empty);
    return section;
  }

  section.appendChild(grid);
  return section;
}

function usesItem(recipeId: StoryRecipeId): boolean {
  return recipeId === 'item_request'
    || recipeId === 'fetch_task'
    || recipeId === 'dead_drop';
}

function usesMoney(recipeId: StoryRecipeId): boolean {
  return recipeId === 'job_offer'
    || recipeId === 'item_request'
    || recipeId === 'supply_gift'
    || recipeId === 'paid_info';
}

function usesLocation(recipeId: StoryRecipeId): boolean {
  return recipeId === 'faction_warning'
    || recipeId === 'go_to_location'
    || recipeId === 'spawn_ambush'
    || recipeId === 'dead_drop'
    || recipeId === 'bounty_hunt'
    || recipeId === 'escort_npc';
}

function usesTimeout(recipeId: StoryRecipeId): boolean {
  return recipeId === 'fetch_task'
    || recipeId === 'dead_drop'
    || recipeId === 'bounty_hunt'
    || recipeId === 'escort_npc';
}

function createSelectField(
  labelText: string,
  options: StoryWizardOption[],
  value: string,
  onChange: (value: string) => void,
): HTMLElement {
  const field = document.createElement('label');
  field.className = 'story-wizard-field';
  const label = document.createElement('span');
  label.textContent = labelText;
  const select = document.createElement('select');
  for (const option of options) {
    const opt = document.createElement('option');
    opt.value = option.id;
    opt.textContent = option.title;
    opt.title = option.description;
    opt.selected = option.id === value;
    select.appendChild(opt);
  }
  select.onchange = () => onChange(select.value);
  field.append(label, select);
  return field;
}

function createTextField(labelText: string, value: string, onChange: (value: string) => void, placeholder: string): HTMLElement {
  const field = document.createElement('label');
  field.className = 'story-wizard-field';
  const label = document.createElement('span');
  label.textContent = labelText;
  const input = document.createElement('input');
  input.value = value;
  input.placeholder = placeholder;
  input.onchange = () => onChange(input.value.trim());
  field.append(label, input);
  return field;
}

function createRecipeSummary(recipeId: StoryRecipeId, startPattern: StoryStartPattern, details: StoryDetailOptions): HTMLElement {
  const summary = document.createElement('div');
  summary.className = 'story-wizard-summary';
  const recipe = STORY_RECIPES.find((item) => item.id === recipeId);
  const title = document.createElement('strong');
  title.textContent = 'Will create';
  const text = document.createElement('span');
  const sceneCount = startPattern === 'pda' || startPattern === 'f2f' ? '1 scene' : '2 scenes';
  text.textContent = `${sceneCount}. ${recipe?.title ?? 'Story'} with safe starter rules. ${summaryDetail(recipeId, details)}`;
  summary.append(title, text);
  return summary;
}

function summaryDetail(recipeId: StoryRecipeId, details: StoryDetailOptions): string {
  if (recipeId === 'item_request') return `Requires ${details.itemId}; item is taken on in-person handoff.`;
  if (recipeId === 'spawn_ambush') return `Arrival at ${details.locationId} spawns ${details.enemyId}.`;
  if (usesTimeout(recipeId)) return `Task timer: ${details.timeoutSeconds}s.`;
  if (usesMoney(recipeId)) return `Money value: ${details.rewardMoney} RU.`;
  return '';
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
