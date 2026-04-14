import { store } from '../lib/state';
import {
  buildStoryFromDraft,
  createDefaultStoryDraft,
  STORY_BRANCH_OPTIONS,
  STORY_ACCESS_RULE_OPTIONS,
  STORY_CONSEQUENCE_OPTIONS,
  STORY_LEVEL_OPTIONS,
  STORY_RECIPES,
  STORY_RANK_OPTIONS,
  STORY_REWARD_OPTIONS,
  STORY_START_OPTIONS,
  STORY_STRUCTURE_OPTIONS,
  STORY_TONE_OPTIONS,
  STORY_TARGET_OPTIONS,
  STORY_TIMEOUT_OPTIONS,
  type StoryAccessRuleId,
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
    body.replaceChildren(createForgeDraftSummary(draft), createForgeContent(stepIndex, draft, setDraft));
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
  copy.textContent = 'Build dossier first. Write final dialogue after generated flow exists.';
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
  button.textContent = 'Back';
  button.disabled = stepIndex === 0;
  button.onclick = onBack;
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
  if (stepIndex !== 5) wrap.appendChild(createForgeImpactPanel(draft));
  return wrap;
}

function renderForgePremise(wrap: HTMLElement, draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): void {
  wrap.appendChild(createForgeSectionIntro('Faction & Premise', 'Pick faction, title, and tone. Blank premise uses generated hook.'));
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
    createForgeFieldGroup('Details', 'Author-facing hook fields.', [
      createForgeTextField('Story title', draft.title, 'e.g. Echoes at the Garbage Depot', (title) => setDraft({ title })),
      createForgeTextArea('Premise', draft.premise, 'One sentence hook. Blank uses generated placeholder.', (premise) => setDraft({ premise })),
      createForgeTextField('Stakes', draft.stakes, 'What happens if player ignores this?', (stakes) => setDraft({ stakes })),
    ]),
    createForgeOptionGrid('Tone', STORY_TONE_OPTIONS, draft.tone, (tone) => setDraft({ tone: tone as StoryToneId }), 'Pick one'),
  );
}

function renderForgeCast(wrap: HTMLElement, draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): void {
  wrap.appendChild(createForgeSectionIntro('Cast', 'Choose story speaker. Exact catalogs appear only when needed.'));
  wrap.appendChild(createForgeOptionGrid('Starter', STORY_TARGET_OPTIONS, draft.speakerTarget, (speakerTarget) => setDraft({ speakerTarget: speakerTarget as StorySpeakerTarget }), 'Pick one'));
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
  wrap.appendChild(createForgeSectionIntro('Structure', 'Pick flow, branch flavor, and optional start gate.'));
  wrap.append(
    createForgeOptionGrid('Start pattern', STORY_START_OPTIONS, draft.startPattern, (startPattern) => setDraft({ startPattern: startPattern as StoryStartPattern }), 'Pick one'),
    createForgeOptionGrid('Structure', STORY_STRUCTURE_OPTIONS, draft.structureId, (structureId) => setDraft({ structureId: structureId as StoryStructureId }), 'Flow shape'),
    createForgeOptionGrid('Branch style', STORY_BRANCH_OPTIONS, draft.branchStyle, (branchStyle) => setDraft({ branchStyle: branchStyle as StoryBranchStyle }), 'Roleplay path'),
    createForgeOptionGrid('Start gate', STORY_ACCESS_RULE_OPTIONS, draft.accessRuleId, (accessRuleId) => setDraft({ accessRuleId: accessRuleId as StoryAccessRuleId }), 'Optional rule'),
  );
  wrap.appendChild(createForgeAccessRuleFields(draft, setDraft));
}

function renderForgeGameplay(wrap: HTMLElement, draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): void {
  wrap.appendChild(createForgeSectionIntro('Gameplay', 'Pick goal. Needed catalogs appear after recipe selection.'));
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
  if (draft.recipeId === 'custom_npc_encounter') {
    wrap.append(
      createForgeFieldGroup('Custom NPC', 'NPC generated for this encounter.', [
        createForgeTextField('Custom NPC name', draft.customNpcName, 'Informant', (customNpcName) => setDraft({ customNpcName, customNpcTemplateId: slugForge(customNpcName || draft.customNpcTemplateId) })),
        createForgePickerShell('Custom NPC template', createCustomNpcBuilderEditor(draft.customNpcTemplateId, (customNpcTemplateId) => setDraft({ customNpcTemplateId }), 'story-forge-encounter-npc', { showSpawnDistance: false })),
      ]),
    );
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
  wrap.appendChild(createForgeSectionIntro('Rewards & Consequences', 'Set player payout and follow-up effects.'));
  wrap.append(
    createForgeFieldGroup('Payout', 'Money, item, and stash reward options.', [
      createForgeSelectField('Money reward', STORY_REWARD_OPTIONS, draft.rewardMoney, (rewardMoney) => setDraft({ rewardMoney })),
      createForgePickerShell('Item reward', createItemPickerPanelEditor(draft.rewardItemId, (rewardItemId) => setDraft({ rewardItemId }), 'story-forge-reward-item', { allowEmpty: true, placeholder: 'Optional item reward' })),
      createForgePickerShell('Stash items', createItemChainPickerPanelEditor(draft.stashItems, (stashItems) => setDraft({ stashItems }), 'story-forge-stash-items', { placeholder: 'Optional stash items', chainSeparator: '+' })),
    ]),
    createForgeFieldGroup('Advanced effects', 'Used by paid info, goodwill, reputation, and follow-up info hooks.', [
      createForgeTextField('Price', draft.priceMoney, '750', (priceMoney) => setDraft({ priceMoney })),
      createForgeTextField('Info portion', draft.infoId, 'panda_story_info', (infoId) => setDraft({ infoId })),
      createForgeSelectField('Consequence', STORY_CONSEQUENCE_OPTIONS, draft.consequenceId, (consequenceId) => setDraft({ consequenceId: consequenceId as StoryConsequenceId })),
      createForgeTextField('Goodwill amount', draft.goodwillAmount, '25', (goodwillAmount) => setDraft({ goodwillAmount })),
      createForgeTextField('Reputation amount', draft.reputationAmount, '15', (reputationAmount) => setDraft({ reputationAmount })),
    ]),
  );
}

function renderForgeReview(wrap: HTMLElement, draft: StoryWizardDraft): void {
  const result = buildStoryFromDraft(store.get().project, draft);
  wrap.appendChild(createForgeSectionIntro('Review', 'Check generated flow, effects, and author follow-up.'));
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
  wrap.append(preview, checklist, createForgeEffectSummary(result.conversation), createForgeFollowupPanel());
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

function createForgeDraftSummary(draft: StoryWizardDraft): HTMLElement {
  const summary = document.createElement('aside');
  summary.className = 'story-forge-summary';
  [
    ['Faction', FACTION_DISPLAY_NAMES[draft.faction]],
    ['Starter', findOptionTitle(STORY_TARGET_OPTIONS, draft.speakerTarget)],
    ['Recipe', findOptionTitle(STORY_RECIPES, draft.recipeId)],
    ['Flow', findOptionTitle(STORY_STRUCTURE_OPTIONS, draft.structureId)],
    ['Reward', findOptionTitle(STORY_REWARD_OPTIONS, draft.rewardMoney)],
    ['Effect', findOptionTitle(STORY_CONSEQUENCE_OPTIONS, draft.consequenceId)],
  ].forEach(([label, value]) => {
    const item = document.createElement('span');
    item.innerHTML = `<strong>${escapeForge(label)}</strong>${escapeForge(value)}`;
    summary.appendChild(item);
  });
  return summary;
}

function createForgeFieldGroup(title: string, copy: string, children: HTMLElement[]): HTMLElement {
  const group = document.createElement('section');
  group.className = 'story-forge-field-block story-forge-field-group';
  const heading = document.createElement('h4');
  heading.textContent = title;
  const text = document.createElement('p');
  text.className = 'story-forge-field-copy';
  text.textContent = copy;
  const grid = document.createElement('div');
  grid.className = 'story-forge-field-grid';
  grid.append(...children);
  group.append(heading, text, grid);
  return group;
}

function createForgeAccessRuleFields(draft: StoryWizardDraft, setDraft: (patch: Partial<StoryWizardDraft>) => void): HTMLElement {
  const fields: HTMLElement[] = [];
  if (draft.accessRuleId === 'player_faction' || draft.accessRuleId === 'not_player_faction') {
    fields.push(createForgeFactionSelect('Player faction', draft.accessFaction, (accessFaction) => setDraft({ accessFaction })));
  }
  if (draft.accessRuleId === 'rank_min') {
    fields.push(createForgeSelectField('Minimum rank', STORY_RANK_OPTIONS, draft.accessRank, (accessRank) => setDraft({ accessRank })));
  }
  if (draft.accessRuleId === 'goodwill_min') {
    fields.push(createForgeTextField('Goodwill minimum', draft.accessGoodwill, '0', (accessGoodwill) => setDraft({ accessGoodwill })));
  }
  if (draft.accessRuleId === 'level' || draft.accessRuleId === 'not_level') {
    fields.push(createForgeSelectField('Level', STORY_LEVEL_OPTIONS, draft.accessLevel, (accessLevel) => setDraft({ accessLevel })));
  }
  if (draft.accessRuleId === 'has_item' || draft.accessRuleId === 'lacks_item') {
    fields.push(createForgePickerShell('Gate item', createItemPickerPanelEditor(draft.accessItemId, (accessItemId) => setDraft({ accessItemId }), 'story-forge-access-item', { allowEmpty: false, placeholder: 'Required item' })));
  }
  if (fields.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'story-forge-empty-note';
    empty.textContent = 'No extra start gate selected.';
    fields.push(empty);
  }
  return createForgeFieldGroup('Gate details', 'Optional conditions added to conversation preconditions.', fields);
}

function createForgeImpactPanel(draft: StoryWizardDraft): HTMLElement {
  const result = buildStoryFromDraft(store.get().project, draft);
  const panel = document.createElement('section');
  panel.className = 'story-forge-field-block story-forge-impact';
  const heading = document.createElement('h4');
  heading.textContent = 'Generated impact';
  const chips = document.createElement('div');
  chips.className = 'story-forge-chip-row';
  [
    `${result.conversation.preconditions.length} starter rule(s)`,
    `${result.conversation.turns.length} turn(s)`,
    `${collectForgeOutcomes(result.conversation).length} effect(s)`,
    isForgeTaskRecipe(draft.recipeId) ? 'success/fail task turns' : 'dialogue flow',
  ].forEach((text) => chips.appendChild(createForgeChip(text)));
  panel.append(heading, chips);
  return panel;
}

function createForgeEffectSummary(conversation: ReturnType<typeof buildStoryFromDraft>['conversation']): HTMLElement {
  const section = document.createElement('section');
  section.className = 'story-forge-field-block story-forge-effect-summary';
  const heading = document.createElement('h4');
  heading.textContent = 'Effect summary';
  const chips = document.createElement('div');
  chips.className = 'story-forge-chip-row';
  const outcomes = collectForgeOutcomes(conversation);
  if (outcomes.length === 0) {
    chips.appendChild(createForgeChip('No direct effects'));
  } else {
    outcomes.slice(0, 18).forEach((outcome) => chips.appendChild(createForgeChip(outcome)));
    if (outcomes.length > 18) chips.appendChild(createForgeChip(`+${outcomes.length - 18} more`));
  }
  section.append(heading, chips);
  return section;
}

function createForgeFollowupPanel(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'story-forge-field-block story-forge-followup';
  const heading = document.createElement('h4');
  heading.textContent = 'Author follow-up';
  const list = document.createElement('div');
  list.className = 'story-forge-followup-list';
  ['Write final dialogue', 'Check generated branches', 'Adjust rewards if needed'].forEach((text) => {
    const item = document.createElement('span');
    item.textContent = text;
    list.appendChild(item);
  });
  section.append(heading, list);
  return section;
}

function createForgeChip(text: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'story-forge-chip';
  chip.textContent = text;
  return chip;
}

function collectForgeOutcomes(conversation: ReturnType<typeof buildStoryFromDraft>['conversation']): string[] {
  return conversation.turns.flatMap((turn) => turn.choices.flatMap((choice) => (
    choice.outcomes.map((outcome) => outcome.params.length > 0 ? `${outcome.command}:${outcome.params.join(':')}` : outcome.command)
  )));
}

function findOptionTitle(options: Array<{ id: string; title: string }>, id: string): string {
  return options.find((option) => option.id === id)?.title ?? id;
}

function createForgeOptionGrid<T extends { id: string; title: string; description: string }>(title: string, options: T[], selectedId: string, onSelect: (id: string) => void, eyebrow = 'Pick one'): HTMLElement {
  const section = document.createElement('section');
  section.className = 'story-forge-field-block';
  const heading = document.createElement('h4');
  heading.innerHTML = `<span>${escapeForge(eyebrow)}</span>${escapeForge(title)}`;
  const grid = document.createElement('div');
  grid.className = 'story-forge-card-grid';
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `story-forge-card${option.id === selectedId ? ' is-selected' : ''}`;
    const badges = getForgeOptionBadges(title, option.id);
    button.innerHTML = `<strong>${escapeForge(option.title)}</strong><span>${escapeForge(option.description)}</span>${badges.length > 0 ? `<em>${badges.map(escapeForge).join('</em><em>')}</em>` : ''}`;
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
  heading.innerHTML = '<span>Pick one</span>Story recipe';
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
      const badges = getForgeRecipeBadges(recipe.id);
      button.innerHTML = `<strong>${escapeForge(recipe.title)}</strong><span>${escapeForge(recipe.description)}</span><em>${badges.map(escapeForge).join('</em><em>')}</em>`;
      button.onclick = () => onSelect(recipe.id);
      cards.appendChild(button);
    }
    groupEl.append(label, cards);
    grid.appendChild(groupEl);
  }
  section.append(heading, grid);
  return section;
}

function getForgeOptionBadges(title: string, id: string): string[] {
  if (title === 'Start gate') {
    if (id === 'none') return ['optional'];
    if (id === 'has_item' || id === 'lacks_item') return ['needs item'];
    if (id === 'player_faction' || id === 'not_player_faction') return ['faction rule'];
    return ['precondition'];
  }
  if (title === 'Branch style') {
    if (id === 'bribe') return ['needs money'];
    if (id === 'double_cross' || id === 'betrayal') return ['ambush'];
    if (id === 'lie') return ['info flag'];
    return ['choice'];
  }
  if (title === 'Tone') return ['opening text'];
  if (title === 'Start pattern') return id.includes('f2f') ? ['face-to-face'] : ['PDA'];
  if (title === 'Structure') return id === 'task' ? ['task turns'] : ['turns'];
  return [];
}

function getForgeRecipeBadges(id: StoryRecipeId): string[] {
  if (isForgeTaskRecipe(id)) return ['task', 'timer'];
  if (id === 'paid_info' || id === 'paid_stash_lead') return ['needs money', 'effect'];
  if (id === 'item_request') return ['needs item', 'handoff'];
  if (id === 'spawn_ambush' || id === 'ambush_warning' || id === 'betrayal') return ['trigger', 'squad'];
  if (id === 'custom_npc_encounter') return ['custom NPC', 'spawn'];
  if (id === 'marked_threat' || id === 'go_to_location') return ['map marker'];
  if (id === 'artifact_lead') return ['info flag'];
  return ['dialogue'];
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
  return recipeId === 'faction_warning' || recipeId === 'marked_threat' || recipeId === 'ambush_warning' || recipeId === 'artifact_lead' || recipeId === 'go_to_location' || recipeId === 'spawn_ambush' || recipeId === 'delivery_task' || recipeId === 'dead_drop' || recipeId === 'bounty_hunt' || recipeId === 'eliminate_squad' || recipeId === 'artifact_hunt' || recipeId === 'escort_npc' || recipeId === 'rescue' || recipeId === 'betrayal' || recipeId === 'custom_npc_encounter';
}

function forgeUsesSquad(recipeId: StoryRecipeId): boolean {
  return recipeId === 'spawn_ambush' || recipeId === 'ambush_warning' || recipeId === 'eliminate_squad' || recipeId === 'rescue' || recipeId === 'betrayal';
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
