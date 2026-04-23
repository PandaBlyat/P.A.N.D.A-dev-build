import { store } from '../lib/state';
import { requestFlowCenter } from '../lib/flow-navigation';
import {
  buildStoryFromDraft,
  createDefaultStoryDraft,
  STORY_RECIPES,
  STORY_TARGET_OPTIONS,
  type StoryRecipeId,
  type StorySpeakerTarget,
  type StoryWizardDraft,
} from '../lib/story-recipes';
import type { FactionId } from '../lib/types';
import { FACTION_DISPLAY_NAMES } from '../lib/types';
import { FACTION_IDS } from '../lib/constants';
import { getFactionThemeVariables } from '../lib/faction-colors';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { STORY_NPC_OPTIONS } from '../lib/generated/story-npc-catalog';
import { createCatalogPickerPanelEditor, createSmartTerrainPickerEditor } from './CatalogPickerPanel';
import { createCustomNpcBuilderEditor } from './NpcTemplatePanel';
import { createIcon, setButtonContent } from './icons';

let overlayEl: HTMLElement | null = null;
let focusTrap: FocusTrapController | null = null;
let autoOpenSpeakerPicker = false;

export function openStoryWizard(): void {
  if (overlayEl) return;

  let draft: StoryWizardDraft = createDefaultStoryDraft(store.get().project);

  const overlay = document.createElement('div');
  overlay.className = 'story-wizard-overlay story-forge-overlay story-forge-simple-overlay';

  const panel = document.createElement('div');
  panel.className = 'story-wizard-panel story-forge-panel story-forge-simple-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'story-wizard-title');

  const render = (): void => {
    applyTheme(panel, draft.faction);
    panel.replaceChildren(
      renderHeader(),
      renderQuickActions(),
      renderBody(draft, (patch) => {
        draft = { ...draft, ...patch };
        render();
      }),
      renderFooter(draft),
    );
    if (autoOpenSpeakerPicker) {
      autoOpenSpeakerPicker = false;
      requestAnimationFrame(() => {
        panel.querySelector<HTMLButtonElement>('.story-forge-speaker-picker .item-picker-launcher')?.click();
      });
    }
  };

  overlayEl = overlay;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  render();
  focusTrap = trapFocus(panel, {
    restoreFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
  });
}

function closeStoryWizard(): void {
  focusTrap?.release();
  focusTrap = null;
  overlayEl?.remove();
  overlayEl = null;
}

function startBlankStoryFromWizard(): void {
  store.addConversation();
  centerCreatedStory();
  closeStoryWizard();
}

function createGeneratedStory(draft: StoryWizardDraft): void {
  const result = buildStoryFromDraft(store.get().project, draft);
  store.addConversationFromTemplate(result.conversation, result.npcTemplates);
  centerCreatedStory();
  closeStoryWizard();
}

function centerCreatedStory(): void {
  const conversationId = store.get().selectedConversationId;
  if (conversationId == null) return;
  requestFlowCenter({ conversationId, turnNumber: 1 });
}

function applyTheme(panel: HTMLElement, faction: FactionId): void {
  const theme = getFactionThemeVariables(faction);
  panel.style.setProperty('--accent', theme.accent);
  panel.style.setProperty('--accent-hover', theme.accentHover);
  panel.style.setProperty('--accent-dim', theme.accentDim);
  panel.style.setProperty('--accent-glow', theme.accentGlow);
  panel.style.setProperty('--accent-glow-strong', theme.accentGlowStrong);
  panel.style.setProperty('--bg-selected', theme.bgSelected);
  panel.style.setProperty('--bg-selected-border', theme.bgSelectedBorder);
  panel.style.setProperty('--focus-ring', theme.focusRing);
}

function renderHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'story-forge-header story-forge-simple-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'story-forge-title-block';

  const title = document.createElement('div');
  title.id = 'story-wizard-title';
  title.className = 'story-forge-title';
  title.append(createIcon('sparkle'), document.createTextNode('Make Story'));

  const copy = document.createElement('p');
  copy.textContent = 'Fast setup. Add detail after flow exists.';
  titleWrap.append(title, copy);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-icon story-forge-close';
  close.title = 'Close';
  close.setAttribute('aria-label', 'Close story wizard');
  close.appendChild(createIcon('close'));
  close.onclick = closeStoryWizard;

  header.append(titleWrap, close);
  return header;
}

function renderQuickActions(): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'story-forge-quick-actions';

  const blank = document.createElement('button');
  blank.type = 'button';
  blank.className = 'btn-sm story-forge-blank story-forge-blank-top';
  setButtonContent(blank, 'add', 'Start Blank');
  blank.title = 'Skip wizard and create one empty story branch';
  blank.onclick = startBlankStoryFromWizard;
  actions.appendChild(blank);
  return actions;
}

function renderBody(draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): HTMLElement {
  const body = document.createElement('div');
  body.className = 'story-forge-body story-forge-simple-body';

  const form = document.createElement('div');
  form.className = 'story-forge-simple-form';
  form.append(
    renderFactionPicker(draft.faction, (faction) => setDraft({ faction })),
    renderTextField('Title', draft.title, 'Supply run, missing courier, old debt...', (title) => setDraft({ title })),
    renderSelectField('Speaker', STORY_TARGET_OPTIONS.map(option => [option.id, option.title]), draft.speakerTarget, (speakerTarget) => {
      const nextSpeakerTarget = speakerTarget as StorySpeakerTarget;
      autoOpenSpeakerPicker = nextSpeakerTarget === 'named_npc' || nextSpeakerTarget === 'custom_npc';
      setDraft({ speakerTarget: nextSpeakerTarget });
    }),
    renderSpeakerPicker(draft, setDraft),
    renderSelectField('Story recipe', STORY_RECIPES.map(recipe => [recipe.id, recipe.title]), draft.recipeId, (recipeId) => setDraft({ recipeId: recipeId as StoryRecipeId })),
  );

  const preview = document.createElement('div');
  preview.className = 'story-forge-simple-preview';
  const recipe = STORY_RECIPES.find(item => item.id === draft.recipeId);
  const speaker = STORY_TARGET_OPTIONS.find(item => item.id === draft.speakerTarget);
  preview.append(
    renderPreviewRow('Faction', FACTION_DISPLAY_NAMES[draft.faction]),
    renderPreviewRow('Speaker', speaker?.title ?? draft.speakerTarget),
    renderPreviewRow('Flow', recipe?.description ?? recipe?.title ?? draft.recipeId),
  );

  body.append(form, preview);
  return body;
}

function renderFooter(draft: StoryWizardDraft): HTMLElement {
  const footer = document.createElement('div');
  footer.className = 'story-forge-footer story-forge-simple-footer';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn-sm';
  cancel.textContent = 'Cancel';
  cancel.onclick = closeStoryWizard;

  const create = document.createElement('button');
  create.type = 'button';
  create.className = 'btn-sm btn-primary story-forge-primary';
  setButtonContent(create, 'add', 'Create Story');
  create.onclick = () => createGeneratedStory(draft);

  footer.append(cancel, create);
  return footer;
}

function renderFactionPicker(value: FactionId, onChange: (value: FactionId) => void): HTMLElement {
  const field = document.createElement('section');
  field.className = 'story-forge-simple-field story-forge-simple-field-wide';
  const label = document.createElement('span');
  label.className = 'story-forge-simple-label';
  label.textContent = 'Faction';
  const grid = document.createElement('div');
  grid.className = 'story-forge-faction-grid story-forge-simple-factions';

  for (const faction of FACTION_IDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `story-forge-faction${value === faction ? ' is-selected' : ''}`;
    button.textContent = FACTION_DISPLAY_NAMES[faction];
    button.style.setProperty('--faction-tile-color', getFactionThemeVariables(faction).accent);
    button.onclick = () => onChange(faction);
    grid.appendChild(button);
  }

  field.append(label, grid);
  return field;
}

function renderTextField(labelText: string, value: string, placeholder: string, onChange: (value: string) => void): HTMLElement {
  const label = document.createElement('label');
  label.className = 'story-forge-simple-field';
  const span = document.createElement('span');
  span.className = 'story-forge-simple-label';
  span.textContent = labelText;
  const input = document.createElement('input');
  input.value = value;
  input.placeholder = placeholder;
  input.onchange = () => onChange(input.value.trim());
  label.append(span, input);
  return label;
}

function renderSelectField(labelText: string, options: Array<[string, string]>, value: string, onChange: (value: string) => void): HTMLElement {
  const label = document.createElement('label');
  label.className = 'story-forge-simple-field';
  const span = document.createElement('span');
  span.className = 'story-forge-simple-label';
  span.textContent = labelText;
  const select = document.createElement('select');
  for (const [id, title] of options) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = title;
    option.selected = id === value;
    select.appendChild(option);
  }
  select.onchange = () => onChange(select.value);
  label.append(span, select);
  return label;
}

function renderSpeakerPicker(draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): HTMLElement {
  const field = document.createElement('section');
  field.className = 'story-forge-simple-field story-forge-simple-field-wide story-forge-speaker-picker';

  if (draft.speakerTarget === 'named_npc') {
    const label = document.createElement('span');
    label.className = 'story-forge-simple-label';
    label.textContent = 'Story NPC';
    const picker = createCatalogPickerPanelEditor(
      draft.storyNpcId,
      (storyNpcId) => setDraft({ storyNpcId: storyNpcId.trim() || 'bar_visitors_barman_stalker_trader' }),
      'story-forge-story-npc',
      {
        title: 'Story NPC',
        subtitle: 'Pick existing story NPC who starts this storyline.',
        searchPlaceholder: 'Search NPC id, faction, level, or role...',
        emptyLabel: 'Pick story NPC',
        browseLabel: 'Browse NPC catalog',
        options: STORY_NPC_OPTIONS,
        facets: [
          { label: 'Faction', allLabel: 'All factions', field: 'faction', keywordIndex: 0 },
          { label: 'Level', allLabel: 'All levels', field: 'level', keywordIndex: 1 },
          { label: 'Role', allLabel: 'All roles', field: 'role', keywordIndex: 2 },
        ],
        richRows: true,
      },
    );
    field.append(label, picker);
    return field;
  }

  if (draft.speakerTarget === 'custom_npc') {
    const npcLabel = document.createElement('span');
    npcLabel.className = 'story-forge-simple-label';
    npcLabel.textContent = 'Custom NPC';
    const npcPicker = createCustomNpcBuilderEditor(
      draft.customNpcTemplateId,
      (customNpcTemplateId) => setDraft({ customNpcTemplateId }),
      'story-forge-custom-npc',
      { showSpawnDistance: false },
    );
    const terrainLabel = document.createElement('span');
    terrainLabel.className = 'story-forge-simple-label';
    terrainLabel.textContent = 'Spawn smart terrain';
    const terrainPicker = createSmartTerrainPickerEditor(
      draft.customNpcSmartTerrain,
      (customNpcSmartTerrain) => setDraft({ customNpcSmartTerrain }),
      'story-forge-custom-npc-location',
      { allowPlaceholder: true },
    );
    field.append(npcLabel, npcPicker, terrainLabel, terrainPicker);
    return field;
  }

  field.hidden = true;
  return field;
}

function renderPreviewRow(label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'story-forge-simple-preview-row';
  const key = document.createElement('strong');
  key.textContent = label;
  const text = document.createElement('span');
  text.textContent = value;
  row.append(key, text);
  return row;
}
