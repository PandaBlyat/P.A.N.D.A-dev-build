// P.A.N.D.A. Conversation Editor — XML Export
// Generates valid PANDA XML string table files from the editor data model.

import type { Project, Conversation, Turn, Choice, PreconditionEntry, AnyPreconditionOption, Outcome, FactionId, NpcTemplate } from './types';
import { FACTION_XML_KEYS, getConversationFaction } from './types';
import type { UiLanguage } from './ui-language';
import { getDefaultFlowTurnPosition } from './flow-layout';
import { collectSegmentStartTurns as collectBranchSegmentStartTurns } from './branch-segments';

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

/** Trim trailing empty params only — preserves middle empties so positional
 *  argument indices on the Lua side stay aligned. */
function trimTrailingEmptyParams(params: string[]): string[] {
  const out = [...params];
  while (out.length > 0 && out[out.length - 1] === '') {
    out.pop();
  }
  return out;
}

/** Serialize a precondition entry to the colon-delimited string format */
function serializePrecondition(entry: PreconditionEntry): string {
  switch (entry.type) {
    case 'simple': {
      const parts = [entry.command, ...trimTrailingEmptyParams(entry.params)];
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
    if (!params[0] || params[0].trim() === '') {
      params[0] = 'af_medusa';
    }
  }

  const parts = [outcome.command, ...trimTrailingEmptyParams(params)];
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
      speakerNpcId: turn.speaker_npc_id ?? null,
      speakerNpcFactionFilters: turn.speaker_npc_faction_filters ?? [],
      speakerAllowGenericStalker: turn.speaker_allow_generic_stalker ?? false,
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
        contNpcId: choice.cont_npc_id ?? null,
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

/** Encode an NpcTemplate to the pipe-separated key=value string expected by the Lua engine */
export function encodeNpcTemplate(t: NpcTemplate): string {
  const parts: string[] = [];
  parts.push(`name=${t.name}`);
  parts.push(`faction=${t.faction}`);
  if (t.rank) parts.push(`rank=${t.rank}`);
  if (t.primary) parts.push(`primary=${t.primary}`);
  if (t.secondary) parts.push(`secondary=${t.secondary}`);
  if (t.outfit) parts.push(`outfit=${t.outfit}`);
  if (t.items) parts.push(`items=${t.items}`);
  if (t.relation && t.relation !== 'default') parts.push(`relation=${t.relation}`);
  if (t.spawnMode && t.spawnMode !== 'player') parts.push(`spawn_mode=${t.spawnMode}`);
  if (t.smartTerrain) parts.push(`smart_ref=${t.smartTerrain}`);
  if (t.spawnDist != null && t.spawnDist !== 50) parts.push(`spawn_dist=${t.spawnDist}`);
  if (t.trader) parts.push(`trader=1`);
  if (t.allowRoam === false) parts.push(`roam=0`);
  if (t.allowRoam === false && t.stationaryJob && t.stationaryJob !== 'auto') parts.push(`smart_job=${t.stationaryJob}`);
  return parts.join('|');
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
  if (conv.repeatable === false) {
    lines.push(emitString(`${prefix}_repeatable`, '0'));
  }
  const segmentStartTurns = collectBranchSegmentStartTurns(conv);

  // Process each turn
  for (const turn of conv.turns) {
    const turnInfix = turn.turnNumber === 1 ? '' : `_t${turn.turnNumber}`;

    const isEntryTurn = isEntryTurnForExport(turn);
    const turnChannel = normalizeChannel(turn.channel, 'pda');
    const hasAuthorOpening = (turn.openingMessage ?? '').trim() !== ''
      || (turn.openingImage ?? '').trim() !== ''
      || (turn.openingAudio ?? '').trim() !== '';
    const shouldExportOpening = turnChannel !== 'f2f'
      || segmentStartTurns.has(turn.turnNumber)
      || hasAuthorOpening;

    if (turn.preconditions.length > 0) {
      lines.push(emitString(`${prefix}${turnInfix}_branch_precond`, serializePreconditions(turn.preconditions)));
    }
    if (turn.speaker_npc_id) {
      lines.push(emitString(`${prefix}${turnInfix}_npc`, turn.speaker_npc_id));
    }
    if (turn.speaker_allow_generic_stalker && turn.speaker_npc_faction_filters?.length) {
      lines.push(emitString(`${prefix}${turnInfix}_npc_factions`, turn.speaker_npc_faction_filters.join(',')));
      lines.push(emitString(`${prefix}${turnInfix}_npc_allow_generic`, '1'));
    }

    // Export all PDA openers, and only meaningful F2F openers: entry/segment
    // starts or author-defined media/text.
    if (shouldExportOpening) {
      const openingKey = `${prefix}${turnInfix}_open`;
      let openingText = turn.openingMessage ?? '';
      const shouldAutofillMissingOpen =
        (isEntryTurn || segmentStartTurns.has(turn.turnNumber))
        && !config.strictDialogueValidation
        && config.autofillMissingOpenWhenNonStrict
        && openingText.trim().length === 0;
      if (shouldAutofillMissingOpen) {
        openingText = config.missingOpenPlaceholder;
      }
      lines.push(emitString(openingKey, openingText));
      if (turn.openingImage) {
        lines.push(emitString(`${openingKey}_image`, turn.openingImage));
      }
      if (turn.openingAudio) {
        lines.push(emitString(`${openingKey}_audio`, turn.openingAudio));
      }
    }

    // Choices
    for (const choice of turn.choices) {
      const choiceKey = `${prefix}${turnInfix}_choice_${choice.index}`;
      const replyKey = `${prefix}${turnInfix}_reply_${choice.index}`;
      const outcomeKey = `${prefix}${turnInfix}_outcome_${choice.index}`;

      lines.push(emitString(choiceKey, choice.text));
      lines.push(emitString(replyKey, choice.reply));
      if (choice.replyImage) {
        lines.push(emitString(`${replyKey}_image`, choice.replyImage));
      }
      if (choice.replyAudio) {
        lines.push(emitString(`${replyKey}_audio`, choice.replyAudio));
      }
      if (choice.preconditions.length > 0) {
        lines.push(emitString(`${prefix}${turnInfix}_choice_precond_${choice.index}`, serializePreconditions(choice.preconditions)));
      }

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
        if (choice.cont_npc_id) {
          lines.push(emitString(`${prefix}${turnInfix}_cont_npc_${choice.index}`, choice.cont_npc_id));
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
  // Pretty-print so no single line exceeds X-Ray's 4096-char XML line buffer
  // (IReader::r_string in xrXMLParser::ParseFile). Bridge regex tolerates whitespace.
  const registryPayload = createF2FRegistryPayload(conv);
  lines.push(emitString(`${prefix}${PANDA_F2F_REGISTRY_SUFFIX}`, JSON.stringify(registryPayload, null, 2)));

  // Start mode: tells the Lua runtime how this conversation is triggered.
  // Derived from the conversation's startMode field (authoritative) with fallback to entry nodes.
  const resolvedStartMode = conv.startMode ?? (registryPayload.entryNodes.f2f.length > 0 && registryPayload.entryNodes.pda.length === 0 ? 'f2f' : 'pda');
  if (resolvedStartMode === 'f2f') {
    lines.push(emitString(`${prefix}_start_mode`, 'f2f'));
  }

  return lines.join('\n');
}

/** Generate the complete XML file content */
export function generateXml(
  project: Project,
  systemStrings?: Map<string, string>,
  factionFilter?: FactionId,
  exporterConfig?: XmlExporterConfig,
  languageFilter?: UiLanguage,
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

  // NPC Templates (authored via the editor NPC builder)
  if (project.npcTemplates && project.npcTemplates.length > 0) {
    lines.push('    <!-- ═══ NPC TEMPLATES ═══ -->');
    lines.push('    <!-- Edit these via the "Spawn Custom NPC" outcome in the editor. -->');
    for (const template of project.npcTemplates) {
      lines.push(emitString(`st_panda_npc_template_${template.id}`, encodeNpcTemplate(template)));
    }
    lines.push('');
  }

  // Conversations (sorted by ID to maintain sequential order)
  const sorted = [...project.conversations]
    .filter((conv) => factionFilter == null || getConversationFaction(conv, project.faction) === factionFilter)
    .filter((conv) => languageFilter == null || (conv.language ?? 'en') === languageFilter)
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
    repeatable: true,
    turns: [createTurn(1)],
  };
}

/** Create a new empty turn */
export function createTurn(turnNumber: number): Turn {
  return {
    turnNumber,
    openingMessage: turnNumber === 1 ? '' : undefined,
    preconditions: [],
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
    preconditions: [],
    reply: '',
    outcomes: [],
    terminal: true,
    allow_generic_stalker: false,
  };
}
