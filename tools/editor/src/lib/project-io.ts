import { store } from './state';
import { createEmptyProject, generateXml, type XmlExporterConfig } from './xml-export';
import { importXml } from './xml-import';
import { createSampleProjectBundle } from './sample-project';
import { fetchConversationById } from './api-client';
import type { Choice, Conversation, ConversationChannel, FactionId, Project, Turn } from './types';
import { FACTION_XML_KEYS, getConversationFaction } from './types';
import type { UiLanguage } from './ui-language';
import { migrateLegacyF2FEntryOpenings } from './f2f-entry-migration';
import { buildValidationSummary, splitValidationMessages } from './validation-gate';

export function createBlankProject(): void {
  store.addConversation();
}

export function loadSampleProject(): void {
  const sample = createSampleProjectBundle();
  store.loadProject(normalizeProjectData(sample.project), sample.systemStrings);
}

/** Export project as .panda JSON file */
export function exportProjectJson(): void {
  const state = store.get();
  const gate = splitValidationMessages(state.validationMessages);
  if (gate.errors.length > 0) {
    alert(buildValidationSummary('Save blocked: fix validation errors first.', gate.errors));
    return;
  }
  if (gate.warnings.length > 0) {
    const proceed = window.confirm(buildValidationSummary('This draft has validation warnings. Save anyway?', gate.warnings));
    if (!proceed) return;
  }

  const data = JSON.stringify({
    ...normalizeProjectData(state.project),
    systemStrings: Object.fromEntries(state.systemStrings),
  }, null, 2);
  const factions = getProjectConversationFactions(state.project);
  const filename = factions.length === 1
    ? `panda_${factions[0]}_conversations.panda`
    : 'panda_multi_faction_conversations.panda';
  downloadFile(data, filename, 'application/json');
}

/** Export as game-ready XML */
export function exportXml(): void {
  const state = store.get();
  const gate = splitValidationMessages(state.validationMessages);
  if (gate.errors.length > 0) {
    alert(buildValidationSummary('Export blocked: fix validation errors first.', gate.errors));
    return;
  }
  if (gate.warnings.length > 0) {
    const proceed = window.confirm(buildValidationSummary('Validation warnings detected. Export anyway?', gate.warnings));
    if (!proceed) return;
  }

  const factions = getProjectConversationFactions(state.project);
  const exporterConfig: XmlExporterConfig = {
    strictDialogueValidation: true,
    validateDialogueStrings: true,
    autofillMissingOpenWhenNonStrict: true,
    missingOpenPlaceholder: '[MISSING_OPEN_LINE]',
  };

  try {
    factions.forEach((faction, index) => {
      const factionKey = FACTION_XML_KEYS[faction];
      const languages: UiLanguage[] = ['en', 'ru'];
      const factionConversations = state.project.conversations
        .filter((conv) => getConversationFaction(conv, state.project.faction) === faction)
        .sort((a, b) => a.id - b.id);

      languages.forEach((language, languageIndex) => {
        // Always export full conversation list into each language pack so string
        // keys exist regardless of game language. Missing translations fall
        // back to authored text until a real translation exists.
        const mergedProject = createEmptyProject(faction);
        mergedProject.conversations = factionConversations.map((conv, convIndex) => {
          const cloned: Conversation = JSON.parse(JSON.stringify(conv));
          cloned.id = convIndex + 1;
          cloned.language = language;
          return cloned;
        });

        const xml = generateXml(mergedProject, state.systemStrings, undefined, exporterConfig, language);
        const suffix = language === 'ru' ? 'rus' : 'eng';
        window.setTimeout(() => {
          downloadFile(xml, `st_PANDA_${factionKey}_interactive_conversations_${suffix}.xml`, 'application/xml');
        }, index * 150 + languageIndex * 75);
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    alert(message);
  }
}

/** Import from XML file */
export function importFromXml(): void {
  openProjectFile('.xml', ['xml']);
}

/** Import from .panda JSON file */
export function importFromJson(): void {
  openProjectFile('.panda,.json,.xml', ['panda', 'json', 'xml']);
}

function openProjectFile(accept: string, preferredExtensions: string[]): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result as string;
      const extension = getFileExtension(file.name);
      const parseOrder = extension && preferredExtensions.includes(extension)
        ? [extension, ...preferredExtensions.filter(ext => ext !== extension)]
        : preferredExtensions;

      const result = tryLoadProjectFile(raw, parseOrder);
      if (!result) {
        const expectedFormats = preferredExtensions.map(ext => `.${ext}`).join(', ');
        alert(`Failed to parse project file. Supported formats: ${expectedFormats}.`);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function tryLoadProjectFile(raw: string, parseOrder: string[]): boolean {
  for (const format of parseOrder) {
    if (format === 'xml') {
      const result = importXml(raw);
      if (result) {
        const project = normalizeProjectData(result.project);
        store.loadProject(project, result.systemStrings);
        layoutImportedProject(project);
        return true;
      }
      continue;
    }

    if (format === 'json' || format === 'panda') {
      try {
        const data = JSON.parse(raw);
        const hasSavedLayout = projectHasSavedTurnPositions(data);
        const systemStrings = new Map<string, string>(Object.entries(data.systemStrings || {}));
        delete data.systemStrings;
        const project = normalizeProjectData(data);
        store.loadProject(project, systemStrings);
        if (!hasSavedLayout) {
          layoutImportedProject(project);
        }
        return true;
      } catch {
        continue;
      }
    }
  }

  return false;
}

function layoutImportedProject(project: Project): void {
  store.batch(() => {
    for (const conversation of project.conversations) {
      store.autoLayoutConversation(conversation.id, { spacious: true, centerRoot: true });
    }
  });
}

function projectHasSavedTurnPositions(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const project = value as { conversations?: unknown };
  if (!Array.isArray(project.conversations)) return false;
  return project.conversations.some((conversation) => {
    if (!conversation || typeof conversation !== 'object') return false;
    const turns = (conversation as { turns?: unknown }).turns;
    if (!Array.isArray(turns)) return false;
    return turns.some((turn) => {
      if (!turn || typeof turn !== 'object') return false;
      const position = (turn as { position?: unknown }).position;
      if (!position || typeof position !== 'object') return false;
      const { x, y } = position as { x?: unknown; y?: unknown };
      return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y);
    });
  });
}

function getFileExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return null;
  return filename.slice(lastDot + 1).toLowerCase();
}

/** Download a string as a file (shared helper used by SharePanel). */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revocation so slower browsers can finish initiating the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getProjectConversationFactions(project: Project): Project['faction'][] {
  const factions = new Set<Project['faction']>();

  if (project.conversations.length === 0) {
    factions.add(project.faction);
  }

  for (const conversation of project.conversations) {
    factions.add(getConversationFaction(conversation, project.faction));
  }

  return [...factions];
}

const ONBOARDING_SAMPLE_PACK_ID = '21f5bc31-cf62-454a-baba-62163e5b0202';

export async function loadOnboardingSamplePack(): Promise<void> {
  const remoteConversation = await fetchConversationById(ONBOARDING_SAMPLE_PACK_ID);
  if (!remoteConversation) {
    throw new Error(`Could not find template conversation ${ONBOARDING_SAMPLE_PACK_ID}.`);
  }

  if (!remoteConversation.data?.conversations?.length) {
    throw new Error('The selected template conversation does not include editable conversation data.');
  }

  const project = normalizeSequentialConversationIds({
    version: remoteConversation.data.version || '2.0.0',
    faction: remoteConversation.data.faction || remoteConversation.faction,
    conversations: remoteConversation.data.conversations,
  });

  store.loadProject(normalizeProjectData(project), new Map());
}

function normalizeSequentialConversationIds(project: Project): Project {
  const normalizedConversations = [...project.conversations]
    .sort((a, b) => a.id - b.id)
    .map((conversation, index) => ({
      ...structuredClone(conversation),
      id: index + 1,
    }));

  return {
    ...project,
    conversations: normalizedConversations,
  };
}

type LegacyChannelNormalizationWarning = {
  scope: 'turn' | 'choice' | 'continue';
  conversationId: number;
  turnNumber: number;
  choiceIndex?: number;
};

function normalizeChannel(
  value: unknown,
  fallback: ConversationChannel,
  warningSink?: LegacyChannelNormalizationWarning[],
  warningContext?: Omit<LegacyChannelNormalizationWarning, 'scope'> & { scope: LegacyChannelNormalizationWarning['scope'] },
): ConversationChannel {
  if (value === 'pda' || value === 'f2f') {
    return value;
  }
  if (value === 'both') {
    warningSink?.push({
      scope: warningContext?.scope ?? 'turn',
      conversationId: warningContext?.conversationId ?? 0,
      turnNumber: warningContext?.turnNumber ?? 0,
      choiceIndex: warningContext?.choiceIndex,
    });
    return 'pda';
  }
  return fallback;
}

function normalizeFaction(value: unknown, fallback: FactionId): FactionId {
  return typeof value === 'string' && value in FACTION_XML_KEYS
    ? value as FactionId
    : fallback;
}

function normalizeStringArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const normalized = values.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeFlowEdgeBends(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const bends: Record<string, number> = {};
  for (const [key, rawBend] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d+:\d+:\d+:(continue|pause-success|pause-fail)$/.test(key)) continue;
    const bend = typeof rawBend === 'number' ? rawBend : Number(rawBend);
    if (!Number.isFinite(bend)) continue;
    const normalized = Math.max(-220, Math.min(220, Math.round(bend)));
    if (normalized !== 0) bends[key] = normalized;
  }
  return Object.keys(bends).length > 0 ? bends : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeOptionalNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : undefined;
}

function normalizeTurn(
  conversationId: number,
  turn: Turn,
  fallbackPosition: { x: number; y: number },
  warningSink: LegacyChannelNormalizationWarning[],
): Turn {
  const inferredLegacyChannel = inferLegacyTurnChannel(turn);
  const normalizedChannel = normalizeChannel(inferredLegacyChannel, 'pda', warningSink, {
    scope: 'turn',
    conversationId,
    turnNumber: turn.turnNumber,
  });
  const normalizedF2fEntry = typeof turn.f2f_entry === 'boolean' ? turn.f2f_entry : false;
  const normalizedFirstSpeaker = turn.firstSpeaker === 'npc' || turn.firstSpeaker === 'player'
    ? turn.firstSpeaker
    : (normalizedChannel === 'f2f' ? 'player' : 'npc');
  const normalizedPdaEntry = typeof turn.pda_entry === 'boolean' ? turn.pda_entry : turn.turnNumber === 1;

  const normalizedTurn: Turn = {
    ...turn,
    channel: normalizedChannel,
    requiresNpcFirst: typeof turn.requiresNpcFirst === 'boolean'
      ? turn.requiresNpcFirst
      : (normalizedChannel === 'f2f' ? true : undefined),
    firstSpeaker: normalizedFirstSpeaker,
    pda_entry: normalizedPdaEntry,
    f2f_entry: normalizedF2fEntry,
    openingAudio: normalizeOptionalString(turn.openingAudio),
    position: turn.position ?? fallbackPosition,
    choices: turn.choices.map((choice, index) => normalizeChoice(conversationId, turn.turnNumber, choice, index + 1, warningSink)),
  };

  if (normalizedTurn.channel === 'pda') {
    normalizedTurn.f2f_entry = false;
    return normalizedTurn;
  }

  normalizedTurn.pda_entry = false;
  return normalizedTurn;
}

function normalizeChoice(
  conversationId: number,
  turnNumber: number,
  choice: Choice,
  fallbackIndex: number,
  warningSink: LegacyChannelNormalizationWarning[],
): Choice {
  const normalizedTerminal = typeof choice.terminal === 'boolean'
    ? choice.terminal
    : choice.continueTo == null;
  const rawContinueChannel = choice.continueChannel ?? choice.continue_channel;
  const normalizedContinueChannel = rawContinueChannel == null
    ? undefined
    : normalizeChannel(rawContinueChannel, 'pda', warningSink, {
      scope: 'continue',
      conversationId,
      turnNumber,
      choiceIndex: typeof choice.index === 'number' ? choice.index : fallbackIndex,
    });
  return {
    ...choice,
    index: typeof choice.index === 'number' ? choice.index : fallbackIndex,
    terminal: normalizedTerminal,
    channel: normalizeChannel(choice.channel, 'pda', warningSink, {
      scope: 'choice',
      conversationId,
      turnNumber,
      choiceIndex: typeof choice.index === 'number' ? choice.index : fallbackIndex,
    }),
    continueChannel: normalizedContinueChannel,
    continue_channel: normalizedContinueChannel,
    pdaDelaySeconds: normalizeOptionalNonNegativeInteger(choice.pdaDelaySeconds),
    replyAudio: normalizeOptionalString(choice.replyAudio),
    story_npc_id: typeof choice.story_npc_id === 'string' && choice.story_npc_id.trim().length > 0
      ? choice.story_npc_id.trim()
      : undefined,
    npc_faction_filters: normalizeStringArray(choice.npc_faction_filters)?.filter((faction): faction is FactionId => faction in FACTION_XML_KEYS),
    npc_profile_filters: normalizeStringArray(choice.npc_profile_filters),
    allow_generic_stalker: typeof choice.allow_generic_stalker === 'boolean' ? choice.allow_generic_stalker : false,
  };
}

function normalizeConversation(
  conversation: Conversation,
  fallbackFaction: FactionId,
  warningSink: LegacyChannelNormalizationWarning[],
): Conversation {
  const normalizedTurns = conversation.turns.map((turn, index) => normalizeTurn(conversation.id, turn, { x: index * 340, y: 220 }, warningSink));
  const inferredInitialChannel = normalizedTurns.find((turn) => turn.turnNumber === 1)?.channel ?? 'pda';
  const normalizedInitialChannel = normalizeChannel(conversation.initialChannel, inferredInitialChannel, warningSink, {
    scope: 'turn',
    conversationId: conversation.id,
    turnNumber: 1,
  });
  const hintedF2fEntries = extractLegacyF2FEntryHints(conversation);
  const hintedF2fSet = new Set<number>(hintedF2fEntries);
  for (const turn of normalizedTurns) {
    if (hintedF2fSet.has(turn.turnNumber) && (turn.channel == null || turn.channel === 'f2f')) {
      turn.channel = 'f2f';
      turn.pda_entry = false;
      turn.f2f_entry = true;
      if (typeof turn.requiresNpcFirst !== 'boolean') {
        turn.requiresNpcFirst = true;
      }
    }
  }

  return {
    ...conversation,
    faction: normalizeFaction(conversation.faction, fallbackFaction),
    initialChannel: normalizedInitialChannel,
    flowEdgeBends: normalizeFlowEdgeBends(conversation.flowEdgeBends),
    turns: normalizedTurns,
  };
}

function inferLegacyTurnChannel(turn: Turn): unknown {
  if (turn.channel != null) return turn.channel;
  const legacyNpcOpenKey = (turn as Turn & { npcOpenKey?: unknown }).npcOpenKey;
  if (turn.f2f_entry === true) return 'f2f';
  if (turn.pda_entry === true) return 'pda';
  if (typeof legacyNpcOpenKey === 'string' && legacyNpcOpenKey.trim().length > 0) return 'f2f';
  if (turn.firstSpeaker === 'player') return 'f2f';
  return 'pda';
}

function extractLegacyF2FEntryHints(conversation: Conversation): number[] {
  const rawConversation = conversation as Conversation & {
    entryNodes?: { f2f?: unknown };
    registry?: { entryNodes?: { f2f?: unknown } };
  };

  const candidates = [
    rawConversation.entryNodes?.f2f,
    rawConversation.registry?.entryNodes?.f2f,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .map((value) => Math.floor(value));
  }
  return [];
}

export function normalizeProjectData(project: Project): Project {
  const normalizationWarnings: LegacyChannelNormalizationWarning[] = [];
  const fallbackFaction = normalizeFaction(project.faction, 'stalker');
  const normalized: Project = {
    ...project,
    version: typeof project.version === 'string' && project.version.trim().length > 0 ? project.version : '2.0.0',
    faction: fallbackFaction,
    conversations: project.conversations.map((conversation) => normalizeConversation(conversation, fallbackFaction, normalizationWarnings)),
  };

  const migrated = migrateLegacyF2FEntryOpenings(normalized);
  appendLegacyChannelWarnings(migrated, normalizationWarnings);
  maybeAlertLegacyChannelWarnings(normalizationWarnings);
  return migrated;
}

function appendLegacyChannelWarnings(project: Project, warnings: LegacyChannelNormalizationWarning[]): void {
  if (warnings.length === 0) return;
  const byTurn = new Map<string, string[]>();
  for (const warning of warnings) {
    if (warning.scope === 'turn') {
      const key = `${warning.conversationId}:${warning.turnNumber}`;
      const list = byTurn.get(key) ?? [];
      list.push('Legacy "both" turn channel was migrated to PDA.');
      byTurn.set(key, list);
      continue;
    }
    if (warning.choiceIndex == null) continue;
    const key = `${warning.conversationId}:${warning.turnNumber}`;
    const list = byTurn.get(key) ?? [];
    const label = warning.scope === 'choice' ? 'choice visibility' : 'choice handoff channel';
    list.push(`Legacy "both" ${label} on Choice ${warning.choiceIndex} was migrated to PDA.`);
    byTurn.set(key, list);
  }

  for (const conversation of project.conversations) {
    for (const turn of conversation.turns) {
      const key = `${conversation.id}:${turn.turnNumber}`;
      const messages = byTurn.get(key);
      if (!messages || messages.length === 0) continue;
      const existing = turn.migrationWarnings ?? [];
      turn.migrationWarnings = [...existing, ...messages];
    }
  }
}

function maybeAlertLegacyChannelWarnings(warnings: LegacyChannelNormalizationWarning[]): void {
  if (warnings.length === 0 || typeof window === 'undefined') {
    return;
  }

  const labels = warnings.map((warning) => {
    const prefix = `Conversation ${warning.conversationId}, Turn ${warning.turnNumber}`;
    if (warning.scope === 'turn') return `${prefix} (turn channel)`;
    const suffix = warning.scope === 'choice' ? 'choice channel' : 'continue channel';
    return `${prefix}, Choice ${warning.choiceIndex} (${suffix})`;
  });
  const unique = Array.from(new Set(labels));
  alert(
    `Legacy channel value "both" was migrated to "pda" for compatibility.\n\nAffected items:\n- ${unique.join('\n- ')}`,
  );
}
