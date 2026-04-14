import { store } from '../lib/state';
import {
  buildStoryFromDraft,
  createDefaultStoryDraft,
  STORY_BRANCH_OPTIONS,
  STORY_CONSEQUENCE_OPTIONS,
  STORY_RECIPES,
  STORY_REWARD_OPTIONS,
  STORY_START_OPTIONS,
  STORY_STRUCTURE_OPTIONS,
  STORY_TONE_OPTIONS,
  STORY_TARGET_OPTIONS,
  STORY_TIMEOUT_OPTIONS,
  type StoryBranchStyle,
  type StoryConsequenceId,
  type StoryRecipeId,
  type StoryStructureId,
  type StorySpeakerTarget,
  type StoryStartPattern,
  type StoryToneId,
  type StoryWizardDraft,
  type StoryWizardOption,
} from '../lib/story-recipes';
import type { FactionId } from '../lib/types';
import { FACTION_DISPLAY_NAMES } from '../lib/types';
import { FACTION_IDS } from '../lib/constants';
import { getFactionThemeVariables } from '../lib/faction-colors';
import { createCatalogPickerPanelEditor, createSmartTerrainPickerEditor } from './CatalogPickerPanel';
import { createItemChainPickerPanelEditor, createItemPickerPanelEditor } from './ItemPickerPanel';
import { createCustomNpcBuilderEditor } from './NpcTemplatePanel';
import { STORY_NPC_OPTIONS } from '../lib/generated/story-npc-catalog';
import { ALL_SQUAD_OPTIONS } from '../lib/generated/squad-catalog';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { createIcon, setButtonContent } from './icons';

let overlayEl: HTMLElement | null = null;
let focusTrap: FocusTrapController | null = null;

export function openStoryWizard(): void {
  openStoryForgeWizard();
}

function closeStoryWizard(): void {
  focusTrap?.release();
  focusTrap = null;
  overlayEl?.remove();
  overlayEl = null;
}

const FORGE_STEPS = [
  'Faction & Premise',
  'Cast',
  'Structure',
  'Gameplay',
  'Rewards',
  'Review',
] as const;

function openStoryForgeWizard(): void {
  if (overlayEl) return;

  let stepIndex = 0;
  let draft: StoryWizardDraft = createDefaultStoryDraft(store.get().project);

  const overlay = document.createElement('div');
  overlay.className = 'story-wizard-overlay story-forge-overlay';
  overlay.onclick = (event) => {
    if (event.target === overlay) closeStoryWizard();
  };

  const panel = document.createElement('div');
  panel.className = 'story-wizard-panel story-forge-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'story-wizard-title');

  const header = document.createElement('div');
  header.className = 'story-forge-header';

  const body = document.createElement('div');
  body.className = 'story-forge-body';

  const footer = document.createElement('div');
  footer.className = 'story-forge-footer';

  const setDraft = (patch: Partial<StoryWizardDraft>): void => {
    draft = { ...draft, ...patch };
    render();
  };

  const applyTheme = (): void => {
    const theme = getFactionThemeVariables(draft.faction);
    panel.style.setProperty('--accent', theme.accent);
    panel.style.setProperty('--accent-hover', theme.accentHover);
    panel.style.setProperty('--accent-dim', theme.accentDim);
    panel.style.setProperty('--accent-glow', theme.accentGlow);
    panel.style.setProperty('--accent-glow-strong', theme.accentGlowStrong);
    panel.style.setProperty('--bg-selected', theme.bgSelected);
    panel.style.setProperty('--bg-selected-border', theme.bgSelectedBorder);
    panel.style.setProperty('--focus-ring', theme.focusRing);
  };

  const render = (): void => {
    applyTheme();
    header.replaceChildren(createForgeTitle(draft), createForgeStepRail(stepIndex), createForgeCloseButton());
    body.replaceChildren(createForgeContent(stepIndex, draft, setDraft));
    footer.replaceChildren(
      createForgeBackButton(stepIndex, () => {
        stepIndex = Math.max(0, stepIndex - 1);
        render();
      }),
      createForgeCreateButton(stepIndex, draft, () => {
        const result = buildStoryFromDraft(store.get().project, draft);
        store.addConversationFromTemplate(result.conversation, result.npcTemplates);
        closeStoryWizard();
      }, () => {
        stepIndex = Math.min(FORGE_STEPS.length - 1, stepIndex + 1);
        render();
      }),
    );
  };

  overlayEl = overlay;
  panel.append(header, body, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  render();
  focusTrap = trapFocus(panel, {
    restoreFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    onEscape: closeStoryWizard,
  });
}

function createForgeTitle(draft: StoryWizardDraft): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'story-forge-title-block';
  const kicker = document.createElement('span');
  kicker.className = 'story-forge-kicker';
  kicker.textContent = FACTION_DISPLAY_NAMES[draft.faction];
  const title = document.createElement('div');
  title.id = 'story-wizard-title';
  title.className = 'story-forge-title';
  title.append(createIcon('sparkle'), document.createTextNode('Make Story'));
  const copy = document.createElement('p');
  copy.textContent = 'Build branches, rules, rewards, task logic, and cast before writing final dialogue.';
  wrap.append(kicker, title, copy);
  return wrap;
}

function createForgeCloseButton(): HTMLButtonElement {
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-icon story-forge-close';
  closeBtn.appendChild(createIcon('close'));
  closeBtn.title = 'Close';
  closeBtn.onclick = closeStoryWizard;
  return closeBtn;
}

function createForgeStepRail(activeIndex: number): HTMLElement {
  const rail = document.createElement('div');
  rail.className = 'story-forge-step-rail';
  FORGE_STEPS.forEach((label, index) => {
    const item = document.createElement('span');
    item.className = `story-forge-step${index === activeIndex ? ' is-active' : ''}${index < activeIndex ? ' is-done' : ''}`;
    item.textContent = `${index + 1}. ${label}`;
    rail.appendChild(item);
  });
  return rail;
}

function createForgeBackButton(stepIndex: number, onBack: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-sm';
  button.textContent = stepIndex === 0 ? 'Cancel' : 'Back';
  button.onclick = stepIndex === 0 ? closeStoryWizard : onBack;
  return button;
}

function createForgeCreateButton(stepIndex: number, draft: StoryWizardDraft, onCreate: () => void, onNext: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-sm btn-primary story-forge-primary';
  setButtonContent(button, stepIndex === FORGE_STEPS.length - 1 ? 'add' : 'play', stepIndex === FORGE_STEPS.length - 1 ? 'Create story' : 'Next');
  button.onclick = stepIndex === FORGE_STEPS.length - 1 ? onCreate : onNext;
  button.disabled = !isForgeStepReady(stepIndex, draft);
  return button;
}

function isForgeStepReady(stepIndex: number, draft: StoryWizardDraft): boolean {
  if (stepIndex === 1 && draft.speakerTarget === 'named_npc') return draft.storyNpcId.trim().length > 0;
  if (stepIndex === 1 && draft.speakerTarget === 'custom_npc') return draft.customNpcTemplateId.trim().length > 0 && draft.customNpcSmartTerrain.trim().length > 0;
  return true;
}

function createForgeContent(stepIndex: number, draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'story-forge-content';
  if (stepIndex === 0) renderForgePremise(wrap, draft, setDraft);
  if (stepIndex === 1) renderForgeCast(wrap, draft, setDraft);
  if (stepIndex === 2) renderForgeStructure(wrap, draft, setDraft);
  if (stepIndex === 3) renderForgeGameplay(wrap, draft, setDraft);
  if (stepIndex === 4) renderForgeRewards(wrap, draft, setDraft);
  if (stepIndex === 5) renderForgeReview(wrap, draft);
  return wrap;
}

function renderForgePremise(wrap: HTMLElement, draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): void {
  wrap.appendChild(createForgeSectionIntro('Faction & Premise', 'Pick faction first. Wizard theme and generated story faction follow it.'));
  const factionGrid = document.createElement('div');
  factionGrid.className = 'story-forge-faction-grid';
  for (const faction of FACTION_IDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `story-forge-faction${draft.faction === faction ? ' is-selected' : ''}`;
    button.textContent = FACTION_DISPLAY_NAMES[faction];
    button.style.setProperty('--faction-tile-color', getFactionThemeVariables(faction).accent);
    button.onclick = () => setDraft({ faction });
    factionGrid.appendChild(button);
  }
  wrap.appendChild(factionGrid);
  wrap.append(
    createForgeTextField('Story title', draft.title, 'e.g. Echoes at the Garbage Depot', (title) => setDraft({ title })),
    createForgeTextArea('Premise', draft.premise, 'One sentence author-facing hook. Leave blank for generated placeholder.', (premise) => setDraft({ premise })),
    createForgeOptionGrid('Tone', STORY_TONE_OPTIONS, draft.tone, (tone) => setDraft({ tone: tone as StoryToneId })),
    createForgeTextField('Stakes', draft.stakes, 'What happens if player ignores this?', (stakes) => setDraft({ stakes })),
  );
}

function renderForgeCast(wrap: HTMLElement, draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): void {
  wrap.appendChild(createForgeSectionIntro('Cast', 'Choose who can start story. Use exact catalogs when story belongs to named or custom character.'));
  wrap.appendChild(createForgeOptionGrid('Starter', STORY_TARGET_OPTIONS, draft.speakerTarget, (speakerTarget) => setDraft({ speakerTarget: speakerTarget as StorySpeakerTarget })));
  if (draft.speakerTarget === 'named_npc') {
    wrap.appendChild(createForgePickerShell('Story NPC', createCatalogPickerPanelEditor(draft.storyNpcId, (storyNpcId) => setDraft({ storyNpcId }), 'story-forge-story-npc', {
      title: 'Browse story NPCs',
      subtitle: 'Search vanilla story NPC ids by faction, level, or role.',
      searchPlaceholder: 'Search story NPC...',
      emptyLabel: '-- Story NPC --',
      browseLabel: 'Browse story NPCs...',
      options: STORY_NPC_OPTIONS,
      facets: [
        { label: 'Faction', keywordIndex: 1, allLabel: 'All factions' },
        { label: 'Role', keywordIndex: 3, allLabel: 'All roles' },
      ],
    })));
  }
  if (draft.speakerTarget === 'custom_npc') {
    wrap.append(
      createForgeTextField('Custom NPC name', draft.customNpcName, 'Informant', (customNpcName) => setDraft({ customNpcName, customNpcTemplateId: slugForge(customNpcName || draft.customNpcTemplateId) })),
      createForgePickerShell('Custom NPC template', createCustomNpcBuilderEditor(draft.customNpcTemplateId, (customNpcTemplateId) => setDraft({ customNpcTemplateId }), 'story-forge-custom-npc', { showSpawnDistance: false })),
      createForgePickerShell('Spawn smart terrain', createSmartTerrainPickerEditor(draft.customNpcSmartTerrain, (customNpcSmartTerrain) => setDraft({ customNpcSmartTerrain }), 'story-forge-custom-npc-location', { allowPlaceholder: true })),
    );
  }
  if (draft.recipeId === 'multi_npc_handoff' || draft.structureId === 'two_step') {
    wrap.appendChild(createForgePickerShell('Handoff NPC', createCatalogPickerPanelEditor(draft.handoffNpcId, (handoffNpcId) => setDraft({ handoffNpcId }), 'story-forge-handoff-npc', {
      title: 'Browse handoff NPCs',
      subtitle: 'Pick second speaker for continuation.',
      searchPlaceholder: 'Search story NPC...',
      emptyLabel: '-- Handoff NPC --',
      browseLabel: 'Browse handoff NPCs...',
      options: STORY_NPC_OPTIONS,
      facets: [{ label: 'Role', keywordIndex: 3, allLabel: 'All roles' }],
    })));
  }
}

function renderForgeStructure(wrap: HTMLElement, draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): void {
  wrap.appendChild(createForgeSectionIntro('Structure', 'Pick flow shape and start channel. Generator adds branch links and entry flags.'));
  wrap.append(
    createForgeOptionGrid('Start pattern', STORY_START_OPTIONS, draft.startPattern, (startPattern) => setDraft({ startPattern: startPattern as StoryStartPattern })),
    createForgeOptionGrid('Structure', STORY_STRUCTURE_OPTIONS, draft.structureId, (structureId) => setDraft({ structureId: structureId as StoryStructureId })),
    createForgeOptionGrid('Branch style', STORY_BRANCH_OPTIONS, draft.branchStyle, (branchStyle) => setDraft({ branchStyle: branchStyle as StoryBranchStyle })),
  );
}

function renderForgeGameplay(wrap: HTMLElement, draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): void {
  wrap.appendChild(createForgeSectionIntro('Gameplay', 'Pick author goal. Fields below use real item, smart terrain, NPC, and squad catalogs.'));
  wrap.appendChild(createForgeRecipeGrid(draft.recipeId, (recipeId) => setDraft({ recipeId })));
  if (forgeUsesItem(draft.recipeId)) {
    wrap.appendChild(createForgePickerShell('Item', createItemPickerPanelEditor(draft.itemId, (itemId) => setDraft({ itemId }), 'story-forge-item', { allowEmpty: false, placeholder: 'Item section' })));
  }
  if (draft.recipeId === 'fetch_task') {
    wrap.appendChild(createForgeTextField('Item count', draft.itemCount, '1', (itemCount) => setDraft({ itemCount })));
  }
  if (forgeUsesLocation(draft.recipeId)) {
    wrap.appendChild(createForgePickerShell('Location', createSmartTerrainPickerEditor(draft.locationId, (locationId) => setDraft({ locationId }), 'story-forge-location', { allowPlaceholder: true })));
  }
  if (forgeUsesSquad(draft.recipeId)) {
    wrap.appendChild(createForgePickerShell('Enemy squad', createCatalogPickerPanelEditor(draft.enemySquadId, (enemySquadId) => setDraft({ enemySquadId }), 'story-forge-squad', {
      title: 'Browse squads',
      subtitle: 'Pick exact NPC or mutant squad section.',
      searchPlaceholder: 'Search squad, faction, level...',
      emptyLabel: '-- Squad --',
      browseLabel: 'Browse squads...',
      options: ALL_SQUAD_OPTIONS,
      facets: [{ label: 'Faction', keywordIndex: 1, allLabel: 'All factions' }],
    })));
  }
  if (draft.recipeId === 'bounty_hunt') {
    wrap.append(
      createForgeFactionSelect('Target faction', draft.targetFaction, (targetFaction) => setDraft({ targetFaction })),
      createForgeTextField('Target rank', draft.targetRank, 'Any rank', (targetRank) => setDraft({ targetRank })),
    );
  }
  if (forgeUsesTimeout(draft.recipeId)) {
    wrap.appendChild(createForgeSelectField('Timer', STORY_TIMEOUT_OPTIONS, draft.timeoutSeconds, (timeoutSeconds) => setDraft({ timeoutSeconds })));
  }
}

function renderForgeRewards(wrap: HTMLElement, draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): void {
  wrap.appendChild(createForgeSectionIntro('Rewards & Consequences', 'Set technical effects now, so author mostly writes dialogue later.'));
  wrap.append(
    createForgeSelectField('Money reward', STORY_REWARD_OPTIONS, draft.rewardMoney, (rewardMoney) => setDraft({ rewardMoney })),
    createForgeTextField('Price', draft.priceMoney, '750', (priceMoney) => setDraft({ priceMoney })),
    createForgePickerShell('Item reward', createItemPickerPanelEditor(draft.rewardItemId, (rewardItemId) => setDraft({ rewardItemId }), 'story-forge-reward-item', { allowEmpty: true, placeholder: 'Optional item reward' })),
    createForgePickerShell('Stash items', createItemChainPickerPanelEditor(draft.stashItems, (stashItems) => setDraft({ stashItems }), 'story-forge-stash-items', { placeholder: 'Optional stash items', chainSeparator: '+' })),
    createForgeTextField('Info portion', draft.infoId, 'panda_story_info', (infoId) => setDraft({ infoId })),
    createForgeSelectField('Consequence', STORY_CONSEQUENCE_OPTIONS, draft.consequenceId, (consequenceId) => setDraft({ consequenceId: consequenceId as StoryConsequenceId })),
    createForgeTextField('Goodwill amount', draft.goodwillAmount, '25', (goodwillAmount) => setDraft({ goodwillAmount })),
    createForgeTextField('Reputation amount', draft.reputationAmount, '15', (reputationAmount) => setDraft({ reputationAmount })),
  );
}

function renderForgeReview(wrap: HTMLElement, draft: StoryWizardDraft): void {
  const result = buildStoryFromDraft(store.get().project, draft);
  wrap.appendChild(createForgeSectionIntro('Review', 'Generated story below. Create, then write final dialogue in flow editor.'));
  const preview = document.createElement('div');
  preview.className = 'story-forge-preview';
  for (const beat of result.beats) {
    const node = document.createElement('div');
    node.className = 'story-forge-preview-node';
    node.innerHTML = `<strong>${beat.turnNumber}. ${escapeForge(beat.title)}</strong><span>${beat.channel.toUpperCase()} - ${beat.choices.length} choice(s)</span>`;
    preview.appendChild(node);
  }
  const checklist = document.createElement('div');
  checklist.className = 'story-forge-checklist';
  [
    `Faction: ${FACTION_DISPLAY_NAMES[draft.faction]}`,
    `Starter rules: ${result.conversation.preconditions.length}`,
    `Turns: ${result.conversation.turns.length}`,
    `Task success/fail: ${isForgeTaskRecipe(draft.recipeId) ? 'yes' : 'not needed'}`,
    `Custom NPC templates: ${result.npcTemplates?.length ?? 0}`,
  ].forEach((text) => {
    const item = document.createElement('span');
    item.textContent = text;
    checklist.appendChild(item);
  });
  wrap.append(preview, checklist);
}

function createForgeSectionIntro(title: string, copy: string): HTMLElement {
  const intro = document.createElement('div');
  intro.className = 'story-forge-section-intro';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const text = document.createElement('p');
  text.textContent = copy;
  intro.append(heading, text);
  return intro;
}

function createForgeOptionGrid<T extends { id: string; title: string; description: string }>(title: string, options: T[], selectedId: string, onSelect: (id: string) => void): HTMLElement {
  const section = document.createElement('section');
  section.className = 'story-forge-field-block';
  const heading = document.createElement('h4');
  heading.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'story-forge-card-grid';
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `story-forge-card${option.id === selectedId ? ' is-selected' : ''}`;
    button.innerHTML = `<strong>${escapeForge(option.title)}</strong><span>${escapeForge(option.description)}</span>`;
    button.onclick = () => onSelect(option.id);
    grid.appendChild(button);
  }
  section.append(heading, grid);
  return section;
}

function createForgeRecipeGrid(selectedId: StoryRecipeId, onSelect: (id: StoryRecipeId) => void): HTMLElement {
  const section = document.createElement('section');
  section.className = 'story-forge-field-block';
  const heading = document.createElement('h4');
  heading.textContent = 'Story recipe';
  const groups = new Map<string, typeof STORY_RECIPES>();
  for (const recipe of STORY_RECIPES) {
    const list = groups.get(recipe.group) ?? [];
    list.push(recipe);
    groups.set(recipe.group, list);
  }
  const grid = document.createElement('div');
  grid.className = 'story-forge-recipe-groups';
  for (const [group, recipes] of groups) {
    const groupEl = document.createElement('div');
    groupEl.className = 'story-forge-recipe-group';
    const label = document.createElement('strong');
    label.textContent = group;
    const cards = document.createElement('div');
    cards.className = 'story-forge-card-grid';
    for (const recipe of recipes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `story-forge-card${recipe.id === selectedId ? ' is-selected' : ''}`;
      button.innerHTML = `<strong>${escapeForge(recipe.title)}</strong><span>${escapeForge(recipe.description)}</span>`;
      button.onclick = () => onSelect(recipe.id);
      cards.appendChild(button);
    }
    groupEl.append(label, cards);
    grid.appendChild(groupEl);
  }
  section.append(heading, grid);
  return section;
}

function createForgeTextField(labelText: string, value: string, placeholder: string, onChange: (value: string) => void): HTMLElement {
  const label = document.createElement('label');
  label.className = 'story-forge-field';
  const span = document.createElement('span');
  span.textContent = labelText;
  const input = document.createElement('input');
  input.value = value;
  input.placeholder = placeholder;
  input.onchange = () => onChange(input.value.trim());
  label.append(span, input);
  return label;
}

function createForgeTextArea(labelText: string, value: string, placeholder: string, onChange: (value: string) => void): HTMLElement {
  const label = document.createElement('label');
  label.className = 'story-forge-field story-forge-field-wide';
  const span = document.createElement('span');
  span.textContent = labelText;
  const input = document.createElement('textarea');
  input.rows = 3;
  input.value = value;
  input.placeholder = placeholder;
  input.onchange = () => onChange(input.value.trim());
  label.append(span, input);
  return label;
}

function createForgeSelectField(labelText: string, options: StoryWizardOption[], value: string, onChange: (value: string) => void): HTMLElement {
  const label = document.createElement('label');
  label.className = 'story-forge-field';
  const span = document.createElement('span');
  span.textContent = labelText;
  const select = document.createElement('select');
  for (const option of options) {
    const opt = document.createElement('option');
    opt.value = option.id;
    opt.textContent = option.title;
    opt.selected = option.id === value;
    select.appendChild(opt);
  }
  select.onchange = () => onChange(select.value);
  label.append(span, select);
  return label;
}

function createForgeFactionSelect(labelText: string, value: FactionId, onChange: (value: FactionId) => void): HTMLElement {
  const label = document.createElement('label');
  label.className = 'story-forge-field';
  const span = document.createElement('span');
  span.textContent = labelText;
  const select = document.createElement('select');
  for (const faction of FACTION_IDS) {
    const opt = document.createElement('option');
    opt.value = faction;
    opt.textContent = FACTION_DISPLAY_NAMES[faction];
    opt.selected = faction === value;
    select.appendChild(opt);
  }
  select.onchange = () => onChange(select.value as FactionId);
  label.append(span, select);
  return label;
}

function createForgePickerShell(labelText: string, picker: HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'story-forge-field story-forge-picker-field';
  const label = document.createElement('span');
  label.textContent = labelText;
  wrap.append(label, picker);
  return wrap;
}

function forgeUsesItem(recipeId: StoryRecipeId): boolean {
  return recipeId === 'item_request' || recipeId === 'fetch_task' || recipeId === 'delivery_task' || recipeId === 'dead_drop' || recipeId === 'artifact_hunt';
}

function forgeUsesLocation(recipeId: StoryRecipeId): boolean {
  return recipeId === 'faction_warning' || recipeId === 'go_to_location' || recipeId === 'spawn_ambush' || recipeId === 'delivery_task' || recipeId === 'dead_drop' || recipeId === 'bounty_hunt' || recipeId === 'eliminate_squad' || recipeId === 'artifact_hunt' || recipeId === 'escort_npc' || recipeId === 'rescue' || recipeId === 'betrayal';
}

function forgeUsesSquad(recipeId: StoryRecipeId): boolean {
  return recipeId === 'spawn_ambush' || recipeId === 'eliminate_squad' || recipeId === 'rescue' || recipeId === 'betrayal';
}

function forgeUsesTimeout(recipeId: StoryRecipeId): boolean {
  return isForgeTaskRecipe(recipeId);
}

function isForgeTaskRecipe(recipeId: StoryRecipeId): boolean {
  return recipeId === 'fetch_task' || recipeId === 'delivery_task' || recipeId === 'dead_drop' || recipeId === 'bounty_hunt' || recipeId === 'eliminate_squad' || recipeId === 'artifact_hunt' || recipeId === 'escort_npc' || recipeId === 'rescue';
}

function slugForge(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'informant';
}

function escapeForge(value: string): string {
  return value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}
