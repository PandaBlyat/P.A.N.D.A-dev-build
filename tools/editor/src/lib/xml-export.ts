// P.A.N.D.A. Conversation Editor — XML Export
// Generates valid PANDA XML string table files from the editor data model.

import type { Project, Conversation, Turn, Choice, PreconditionEntry, AnyPreconditionOption, Outcome, FactionId } from './types';
import { FACTION_XML_KEYS, getConversationFaction } from './types';
import { getDefaultFlowTurnPosition } from './flow-layout';

const PANDA_F2F_REGISTRY_SCHEMA = 'panda_f2f_bridge_registry_v1';
const PANDA_F2F_REGISTRY_SUFFIX = '_panda_f2f_registry';
const DEFAULT_MISSING_OPEN_PLACEHOLDER = '[MISSING_OPEN_LINE]';

export type XmlExporterConfig = {
  strictDialogueValidation?: boolean;
  autofillMissingOpenWhenNonStrict?: boolean;
  missingOpenPlaceholder?: string;
  validateDialogueStrings?: boolean;
};

export const DEFAULT_XML_EXPORTER_CONFIG: Required<XmlExporterConfig> = {
  strictDialogueValidation: true,
  autofillMissingOpenWhenNonStrict: false,
  missingOpenPlaceholder: DEFAULT_MISSING_OPEN_PLACEHOLDER,
  validateDialogueStrings: false,
};

/** Escape special XML characters in text content */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeAnyOption(option: AnyPreconditionOption): string {
  if (option.type === 'all') {
    return option.entries.map(serializePrecondition).join(',');
  }
  return serializePrecondition(option);
}

/** Serialize a precondition entry to the colon-delimited string format */
function serializePrecondition(entry: PreconditionEntry): string {
  switch (entry.type) {
    case 'simple': {
      const parts = [entry.command, ...entry.params.filter(p => p !== '')];
      return parts.join(':');
    }
    case 'not':
      return `not(${serializePrecondition(entry.inner)})`;
    case 'any':
      return `any(${entry.options.map(serializeAnyOption).join('|')})`;
    case 'invalid':
      return entry.raw;
  }
}

/** Serialize preconditions list to comma-separated string */
export function serializePreconditions(entries: PreconditionEntry[]): string {
  return entries.map(serializePrecondition).join(',');
}

/** Serialize an outcome to colon-delimited string */
function serializeOutcome(outcome: Outcome): string {
  const params = [...outcome.params];

  if (outcome.command === 'panda_task_artifact') {
    // Keep slot stability: empty artifact section should still serialize as random.
    if (!params[0] || params[0].trim() === '') {
      params[0] = 'random';
    }
    // Artifact Hunt is level-based only; enforce random level mode on export.
    params[1] = 'random_level';
  }

  const parts = [outcome.command, ...params.filter(p => p !== '')];
  const base = parts.join(':');
  if (outcome.chancePercent != null && outcome.chancePercent < 100) {
    return `chance:${outcome.chancePercent}:${base}`;
  }
  return base;
}

/** Serialize outcomes list to comma-separated string */
export function serializeOutcomes(outcomes: Outcome[]): string {
  if (outcomes.length === 0) return 'none';
  return outcomes.map(serializeOutcome).join(',');
}

/** Emit a single XML string entry */
function emitString(id: string, text: string): string {
  return `    <string id="${id}">\n        <text>${escapeXml(text)}</text>\n    </string>`;
}

function isDialogueBearingKey(id: string): boolean {
  return /_open$/.test(id)
    || /_choice_\d+$/.test(id)
    || /_reply_\d+$/.test(id)
    || /_timeout_msg$/.test(id);
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

function validateEmittedDialogueStrings(
  xml: string,
  config: Required<XmlExporterConfig>,
): void {
  const stringRecordRegex = /<string id="([^"]+)">\s*<text>([\s\S]*?)<\/text>\s*<\/string>/g;
  let match: RegExpExecArray | null;
  while ((match = stringRecordRegex.exec(xml)) != null) {
    const id = match[1];
    if (!isDialogueBearingKey(id)) continue;
    if (/(_open)$/.test(id) && !config.strictDialogueValidation) continue;

    const text = decodeXmlEntities(match[2]).trim();
    if (text.length === 0) {
      throw new Error(`Export blocked: empty dialogue text for key "${id}".`);
    }
  }
}

function normalizeChannel(
  value: Conversation['turns'][number]['channel'] | Choice['channel'] | Choice['continue_channel'] | Choice['continueChannel'] | undefined,
  fallback: 'pda' | 'f2f',
): 'pda' | 'f2f' {
  if (value === 'pda' || value === 'f2f') {
    return value;
  }
  return fallback;
}

function inferTurnFirstSpeaker(turn: Turn): 'npc' | 'player' {
  if (turn.firstSpeaker === 'npc' || turn.firstSpeaker === 'player') {
    return turn.firstSpeaker;
  }
  const channel = normalizeChannel(turn.channel, 'pda');
  if (channel === 'f2f') {
    return 'player';
  }
  return 'npc';
}

function resolveRegistryEntryFlags(turn: Turn): { pdaEntry: boolean; f2fEntry: boolean } {
  const channel = normalizeChannel(turn.channel, 'pda');
  const basePdaEntry = turn.pda_entry ?? turn.turnNumber === 1;
  const baseF2FEntry = turn.f2f_entry ?? false;

  if (channel === 'pda') {
    return { pdaEntry: basePdaEntry, f2fEntry: false };
  }
  if (channel === 'f2f') {
    return { pdaEntry: false, f2fEntry: baseF2FEntry };
  }
  return { pdaEntry: false, f2fEntry: baseF2FEntry };
}

function inferContinueChannelFromDestination(
  conv: Conversation,
  choice: Choice,
  fallback: 'pda' | 'f2f' = 'pda',
): 'pda' | 'f2f' {
  const configured = choice.continueChannel ?? choice.continue_channel;
  const configuredChannel = configured == null ? fallback : normalizeChannel(configured, fallback);
  if (choice.continueTo == null) return configuredChannel;

  const targetTurn = conv.turns.find((candidate) => candidate.turnNumber === choice.continueTo);
  if (!targetTurn) return configuredChannel;

  return normalizeChannel(targetTurn.channel, 'pda');
}

function createF2FRegistryPayload(conv: Conversation) {
  const turns = conv.turns.map((turn) => {
    const { pdaEntry, f2fEntry } = resolveRegistryEntryFlags(turn);
    const turnChannel = normalizeChannel(turn.channel, 'pda');
    return {
      turnNumber: turn.turnNumber,
      channel: turnChannel,
      firstSpeaker: inferTurnFirstSpeaker(turn),
      requiresNpcFirst: turnChannel === 'f2f' ? (turn.requiresNpcFirst ?? true) : null,
      pdaEntry,
      f2fEntry,
      choices: turn.choices.map((choice) => ({
        index: choice.index,
        channel: normalizeChannel(choice.channel, 'pda'),
        terminal: choice.terminal === true,
        continueTo: choice.continueTo ?? null,
        continueChannel: (choice.terminal === true)
          ? null
          : (choice.continueChannel ?? choice.continue_channel ?? null),
        storyNpcId: choice.story_npc_id ?? null,
        npcFactionFilters: choice.npc_faction_filters ?? [],
        npcProfileFilters: choice.npc_profile_filters ?? [],
        allowGenericStalker: choice.allow_generic_stalker ?? false,
      })),
    };
  });

  return {
    schema: PANDA_F2F_REGISTRY_SCHEMA,
    conversationId: conv.id,
    entryNodes: {
      pda: turns.filter((turn) => turn.pdaEntry).map((turn) => turn.turnNumber),
      f2f: turns.filter((turn) => turn.f2fEntry).map((turn) => turn.turnNumber),
    },
    turns,
  };
}

function isEntryTurnForExport(turn: Turn): boolean {
  const { pdaEntry, f2fEntry } = resolveRegistryEntryFlags(turn);
  return pdaEntry || f2fEntry;
}

function resolveContinueChannelForExport(
  conv: Conversation,
  _turn: Turn,
  choice: Choice,
  _prefix: string,
): 'pda' | 'f2f' {
  return inferContinueChannelFromDestination(conv, choice, 'pda');
}

/** Generate system strings block */
function generateSystemStrings(systemStrings: Map<string, string>): string {
  const lines: string[] = [];
  lines.push('    <!-- ═══ SYSTEM STRINGS ═══ -->');
  for (const [id, text] of systemStrings) {
    lines.push(emitString(id, text));
  }
  return lines.join('\n');
}

/** Generate XML for a single conversation */
function generateConversation(
  conv: Conversation,
  factionKey: string,
  exportId: number,
  config: Required<XmlExporterConfig>,
): string {
  const prefix = `st_pda_ic_${factionKey}_${exportId}`;
  const lines: string[] = [];

  lines.push(`\n    <!-- ═══════════════════════════════════════════════════════════ -->`);
  lines.push(`    <!-- CONVERSATION ${exportId}: ${conv.label || 'Untitled'} -->`);
  lines.push(`    <!-- ═══════════════════════════════════════════════════════════ -->`);

  // Preconditions
  lines.push(emitString(`${prefix}_precond`, serializePreconditions(conv.preconditions)));

  // Process each turn
  for (const turn of conv.turns) {
    const turnInfix = turn.turnNumber === 1 ? '' : `_t${turn.turnNumber}`;

    const isEntryTurn = isEntryTurnForExport(turn);
    const isNonEntryF2FTurn = normalizeChannel(turn.channel, 'pda') === 'f2f' && !isEntryTurn;

    // Opening message export:
    // - Export all non-F2F turns as before.
    // - Export F2F opener only for entry turns (initial NPC-first handoff/start).
    // This prevents authoring/runtime drift where continuation F2F branches carry
    // redundant per-branch opener strings.
    if (!isNonEntryF2FTurn) {
      const openingKey = `${prefix}${turnInfix}_open`;
      let openingText = turn.openingMessage ?? '';
      const shouldAutofillMissingOpen =
        isEntryTurn
        && !config.strictDialogueValidation
        && config.autofillMissingOpenWhenNonStrict
        && openingText.trim().length === 0;
      if (shouldAutofillMissingOpen) {
        openingText = config.missingOpenPlaceholder;
      }
      lines.push(emitString(openingKey, openingText));
    }

    // Choices
    for (const choice of turn.choices) {
      const choiceKey = `${prefix}${turnInfix}_choice_${choice.index}`;
      const replyKey = `${prefix}${turnInfix}_reply_${choice.index}`;
      const outcomeKey = `${prefix}${turnInfix}_outcome_${choice.index}`;

      lines.push(emitString(choiceKey, choice.text));
      lines.push(emitString(replyKey, choice.reply));

      // Relationship reply variants
      if (choice.replyRelHigh) {
        lines.push(emitString(`${replyKey}_rel_high`, choice.replyRelHigh));
      }
      if (choice.replyRelLow) {
        lines.push(emitString(`${replyKey}_rel_low`, choice.replyRelLow));
      }

      lines.push(emitString(outcomeKey, serializeOutcomes(choice.outcomes)));

      // Continuation
      if (choice.continueTo != null) {
        lines.push(emitString(`${prefix}${turnInfix}_cont_${choice.index}`, String(choice.continueTo)));
        lines.push(
          emitString(
            `${prefix}${turnInfix}_cont_channel_${choice.index}`,
            resolveContinueChannelForExport(conv, turn, choice, prefix),
          ),
        );
        if (choice.pdaDelaySeconds != null && Number.isFinite(choice.pdaDelaySeconds) && choice.pdaDelaySeconds >= 0) {
          lines.push(
            emitString(
              `${prefix}${turnInfix}_pda_delay_${choice.index}`,
              String(Math.floor(choice.pdaDelaySeconds)),
            ),
          );
        }
      }
    }
  }

  // Timeout
  if (conv.timeout != null) {
    lines.push(emitString(`${prefix}_timeout`, String(conv.timeout)));
  }
  if (conv.timeoutMessage) {
    lines.push(emitString(`${prefix}_timeout_msg`, conv.timeoutMessage));
  }

  // PANDA-managed F2F metadata registry payload (consumed by panda_f2f_bridge.script).
  lines.push(emitString(`${prefix}${PANDA_F2F_REGISTRY_SUFFIX}`, JSON.stringify(createF2FRegistryPayload(conv))));

  return lines.join('\n');
}

/** Generate the complete XML file content */
export function generateXml(
  project: Project,
  systemStrings?: Map<string, string>,
  factionFilter?: FactionId,
  exporterConfig?: XmlExporterConfig,
): string {
  const config: Required<XmlExporterConfig> = {
    ...DEFAULT_XML_EXPORTER_CONFIG,
    ...(exporterConfig ?? {}),
  };
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="utf-8"?>');
  lines.push('<string_table>');
  lines.push('');

  // System strings
  if (systemStrings && systemStrings.size > 0) {
    lines.push(generateSystemStrings(systemStrings));
    lines.push('');
  }

  // Conversations (sorted by ID to maintain sequential order)
  const sorted = [...project.conversations]
    .filter((conv) => factionFilter == null || getConversationFaction(conv, project.faction) === factionFilter)
    .sort((a, b) => a.id - b.id);
  const exportCounts = new Map<FactionId, number>();
  for (const conv of sorted) {
    const faction = getConversationFaction(conv, project.faction);
    const exportId = (exportCounts.get(faction) ?? 0) + 1;
    exportCounts.set(faction, exportId);
    lines.push(generateConversation(conv, FACTION_XML_KEYS[faction], exportId, config));
    lines.push('');
  }

  lines.push('</string_table>');

  const xml = lines.join('\n');
  if (config.validateDialogueStrings) {
    validateEmittedDialogueStrings(xml, config);
  }
  return xml;
}

/** Create a default empty project */
export function createEmptyProject(faction: Project['faction'] = 'stalker'): Project {
  return {
    version: '2.0.0',
    faction,
    conversations: [],
  };
}

/** Create a new empty conversation with the next available ID */
export function createConversation(project: Project): Conversation {
  const maxId = project.conversations.reduce((max, c) => Math.max(max, c.id), 0);
  return {
    id: maxId + 1,
    label: `Conversation ${maxId + 1}`,
    faction: project.faction,
    initialChannel: 'pda',
    preconditions: [],
    turns: [createTurn(1)],
  };
}

/** Create a new empty turn */
export function createTurn(turnNumber: number): Turn {
  return {
    turnNumber,
    openingMessage: turnNumber === 1 ? '' : undefined,
    channel: 'pda',
    requiresNpcFirst: undefined,
    firstSpeaker: 'npc',
    pda_entry: turnNumber === 1,
    f2f_entry: false,
    choices: [createChoice(1)],
    position: getDefaultFlowTurnPosition(turnNumber),
  };
}

/** Create a new empty choice */
export function createChoice(index: number): Choice {
  return {
    index,
    text: '',
    channel: 'pda',
    reply: '',
    outcomes: [],
    terminal: true,
    allow_generic_stalker: false,
  };
}
