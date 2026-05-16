// P.A.N.D.A. Conversation Editor — XML Export
// Generates valid PANDA XML string table files from the editor data model.

import type { Project, Conversation, Turn, Choice, PreconditionEntry, AnyPreconditionOption, Outcome, FactionId, NpcTemplate } from './types';
import { FACTION_XML_KEYS, getConversationFaction } from './types';
import type { UiLanguage } from './ui-language';
import { getDefaultFlowTurnPosition } from './flow-layout';
import { collectSegmentStartTurns as collectBranchSegmentStartTurns, isTurnOpenerActive } from './branch-segments';

const PANDA_F2F_REGISTRY_SCHEMA = 'panda_f2f_bridge_registry_v1';
const PANDA_F2F_REGISTRY_SUFFIX = '_panda_f2f_registry';
const DEFAULT_MISSING_OPEN_PLACEHOLDER = '[MISSING_OPEN_LINE]';
const BLOCKED_DIALOGUE_PLACEHOLDERS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^test$/i, label: 'test' },
  { pattern: /^todo$/i, label: 'TODO' },
  { pattern: /^fixme$/i, label: 'FIXME' },
  { pattern: /^tbd$/i, label: 'TBD' },
  { pattern: /^placeholder$/i, label: 'placeholder' },
  { pattern: /^lorem ipsum\b/i, label: 'lorem ipsum' },
  { pattern: /^\[MISSING_[A-Z0-9_]+\]$/i, label: '[MISSING_*]' },
];

export type XmlExporterConfig = {
  strictDialogueValidation?: boolean;
  autofillMissingOpenWhenNonStrict?: boolean;
  missingOpenPlaceholder?: string;
  validateDialogueStrings?: boolean;
  conversationKeyPrefix?: string;
  useStoryKeyPrefixes?: boolean;
  conversationIdOffset?: number;
};

export const DEFAULT_XML_EXPORTER_CONFIG: Required<XmlExporterConfig> = {
  strictDialogueValidation: true,
  autofillMissingOpenWhenNonStrict: false,
  missingOpenPlaceholder: DEFAULT_MISSING_OPEN_PLACEHOLDER,
  validateDialogueStrings: false,
  conversationKeyPrefix: '',
  useStoryKeyPrefixes: false,
  conversationIdOffset: 0,
};

function slugifyStoryKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'story';
}

function buildStoryKeySlug(conv: Conversation): string {
  return slugifyStoryKey(conv.storyline_id || conv.label || `story_${conv.id}`);
}

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

const CUSTOM_NPC_REF_PRECONDITIONS = new Set([
  'req_custom_story_npc',
  'req_custom_npc_alive',
  'req_custom_npc_dead',
  'req_custom_npc_near',
]);

const CUSTOM_NPC_REF_OUTCOMES = new Set([
  'spawn_custom_npc',
  'spawn_custom_npc_at',
  'spawn_dead_custom_npc',
  'spawn_dead_custom_npc_at',
]);

function addNpcRef(refs: Set<string>, kind: 'story' | 'custom', value: string | null | undefined): void {
  const id = (value ?? '').trim();
  if (!id) return;
  refs.add(`${kind}:${id.startsWith('npc:') ? id.slice(4).trim() : id}`);
}

function addSpeakerNpcRef(refs: Set<string>, value: string | null | undefined): void {
  const id = (value ?? '').trim();
  if (!id) return;
  if (id.startsWith('npc:')) {
    addNpcRef(refs, 'custom', id);
  } else {
    addNpcRef(refs, 'story', id);
  }
}

function collectNpcRefsFromPrecondition(entry: PreconditionEntry, refs: Set<string>): void {
  if (entry.type === 'simple') {
    if (entry.command === 'req_story_npc') {
      addNpcRef(refs, 'story', entry.params[0]);
    } else if (CUSTOM_NPC_REF_PRECONDITIONS.has(entry.command)) {
      addNpcRef(refs, 'custom', entry.params[0]);
    }
    return;
  }
  if (entry.type === 'not') {
    collectNpcRefsFromPrecondition(entry.inner, refs);
    return;
  }
  if (entry.type === 'any') {
    for (const option of entry.options) {
      if (option.type === 'all') {
        option.entries.forEach((nested) => collectNpcRefsFromPrecondition(nested, refs));
      } else {
        collectNpcRefsFromPrecondition(option, refs);
      }
    }
  }
}

function collectConversationNpcRefs(conv: Conversation): string[] {
  const refs = new Set<string>(conv.npc_refs ?? []);
  conv.preconditions.forEach((entry) => collectNpcRefsFromPrecondition(entry, refs));

  for (const turn of conv.turns) {
    turn.preconditions.forEach((entry) => collectNpcRefsFromPrecondition(entry, refs));
    addSpeakerNpcRef(refs, turn.speaker_npc_id);

    for (const choice of turn.choices) {
      choice.preconditions?.forEach((entry) => collectNpcRefsFromPrecondition(entry, refs));
      addSpeakerNpcRef(refs, choice.story_npc_id);
      addSpeakerNpcRef(refs, choice.cont_npc_id);
      if (Array.isArray(choice.fanout_targets)) {
        for (const target of choice.fanout_targets) {
          addSpeakerNpcRef(refs, target.cont_npc_id);
        }
      }

      for (const outcome of choice.outcomes) {
        if (CUSTOM_NPC_REF_OUTCOMES.has(outcome.command)) {
          addNpcRef(refs, 'custom', outcome.params[0]);
        }
        if (outcome.command === 'panda_task_escort' && outcome.params[4] === 'custom_npc') {
          addNpcRef(refs, 'custom', outcome.params[5]);
        }
        if (outcome.command === 'panda_task_escort' && outcome.params[4] === 'story_npc') {
          addNpcRef(refs, 'story', outcome.params[5]);
        }
        if (outcome.command === 'panda_task_rescue' && outcome.params[3] && outcome.params[3] !== 'random') {
          addNpcRef(refs, 'custom', outcome.params[3]);
        }
      }
    }
  }

  return Array.from(refs)
    .map((ref) => ref.trim())
    .filter((ref) => /^(story|custom):[^,\s]+$/.test(ref))
    .sort();
}

/** Emit a single XML string entry */
function emitString(id: string, text: string): string {
  return `    <string id="${id}">\n        <text>${escapeXml(text)}</text>\n    </string>`;
}

function isDialogueBearingKey(id: string): boolean {
  return /_open$/.test(id)
    || /_choice_\d+$/.test(id)
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
    const placeholder = BLOCKED_DIALOGUE_PLACEHOLDERS.find(({ pattern }) => pattern.test(text));
    if (placeholder) {
      throw new Error(`Export blocked: placeholder dialogue text "${placeholder.label}" for key "${id}".`);
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
  if (t.gender && t.gender !== 'male') parts.push(`gender=${t.gender}`);
  if (t.visualPreset) parts.push(`visual_preset=${t.visualPreset}`);
  if (t.visual) parts.push(`visual=${t.visual}`);
  if (t.memberSection) parts.push(`member_section=${t.memberSection}`);
  if (t.movementMode && t.movementMode !== 'roam') parts.push(`movement=${t.movementMode}`);
  if (t.relation && t.relation !== 'default') parts.push(`relation=${t.relation}`);
  if (t.spawnMode && t.spawnMode !== 'player') parts.push(`spawn_mode=${t.spawnMode}`);
  if (t.smartTerrain) parts.push(`smart_ref=${t.smartTerrain}`);
  if (t.spawnDist != null && t.spawnDist !== 50) parts.push(`spawn_dist=${t.spawnDist}`);
  if (t.trader) parts.push(`trader=1`);
  if (t.allowRoam === false && !t.movementMode) parts.push(`roam=0`);
  if ((t.allowRoam === false || t.movementMode === 'smart') && t.stationaryJob && t.stationaryJob !== 'auto') parts.push(`smart_job=${t.stationaryJob}`);
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
  keyPrefixOverride?: string,
): string {
  const keyPrefix = (keyPrefixOverride ?? config.conversationKeyPrefix).trim();
  const prefix = keyPrefix
    ? `st_pda_ic_${keyPrefix}_${factionKey}_${exportId}`
    : `st_pda_ic_${factionKey}_${exportId}`;
  const lines: string[] = [];

  lines.push(`\n    <!-- ═══════════════════════════════════════════════════════════ -->`);
  lines.push(`    <!-- CONVERSATION ${exportId}: ${conv.label || 'Untitled'} -->`);
  lines.push(`    <!-- ═══════════════════════════════════════════════════════════ -->`);

  // Preconditions
  lines.push(emitString(`${prefix}_precond`, serializePreconditions(conv.preconditions)));
  if (conv.repeatable === false) {
    lines.push(emitString(`${prefix}_repeatable`, '0'));
  }
  if (conv.storyline_id && conv.storyline_id.trim() !== '') {
    lines.push(emitString(`${prefix}_storyline_id`, conv.storyline_id.trim()));
  }
  const npcRefs = collectConversationNpcRefs(conv);
  if (npcRefs.length > 0) {
    lines.push(emitString(`${prefix}_npc_refs`, npcRefs.join(',')));
  }
  const segmentStartTurns = collectBranchSegmentStartTurns(conv);

  // Process each turn
  for (const turn of conv.turns) {
    const turnInfix = turn.turnNumber === 1 ? '' : `_t${turn.turnNumber}`;

    const isEntryTurn = isEntryTurnForExport(turn);
    const shouldExportOpening = isTurnOpenerActive(turn, segmentStartTurns.has(turn.turnNumber));

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
      // Omit the reply entry entirely when the author left it blank.
      // The engine's string table crashes on <text></text>, and the runtime
      // (pda_interactive_conv + panda_f2f_bridge) already treats a missing
      // reply key as a silent choice.
      if (typeof choice.reply === 'string' && choice.reply.trim().length > 0) {
        lines.push(emitString(replyKey, choice.reply));
      }
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

        // Mutual-exclusion fan-out: emit each additional NPC continuation as a
        // sibling of the primary (continueTo + cont_npc_id). A shared group token
        // ties them together so the runtime can cancel the losers once the
        // player engages one of the threads.
        const fanout = Array.isArray(choice.fanout_targets)
          ? choice.fanout_targets.filter((target) => target && target.cont_npc_id && target.continueTo != null)
          : [];
        if (fanout.length > 0) {
          const groupToken = `${prefix}${turnInfix}_g${choice.index}`;
          lines.push(emitString(`${prefix}${turnInfix}_fanout_group_${choice.index}`, groupToken));
          lines.push(emitString(`${prefix}${turnInfix}_fanout_count_${choice.index}`, String(fanout.length)));
          for (let j = 0; j < fanout.length; j++) {
            const target = fanout[j];
            const jIdx = j + 1;
            const targetTurn = conv.turns.find((candidate) => candidate.turnNumber === target.continueTo);
            const targetChannel = normalizeChannel(
              target.continueChannel ?? (targetTurn ? targetTurn.channel : undefined),
              'pda',
            );
            lines.push(emitString(`${prefix}${turnInfix}_fanout_${choice.index}_${jIdx}_turn`, String(target.continueTo)));
            lines.push(emitString(`${prefix}${turnInfix}_fanout_${choice.index}_${jIdx}_npc`, target.cont_npc_id));
            lines.push(emitString(`${prefix}${turnInfix}_fanout_${choice.index}_${jIdx}_channel`, targetChannel));
            if (target.pdaDelaySeconds != null && Number.isFinite(target.pdaDelaySeconds) && target.pdaDelaySeconds >= 0) {
              lines.push(
                emitString(
                  `${prefix}${turnInfix}_fanout_${choice.index}_${jIdx}_delay`,
                  String(Math.floor(target.pdaDelaySeconds)),
                ),
              );
            }
          }
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
    // Dedupe by template id — last occurrence wins. Prevents duplicate
    // <string id="st_panda_npc_template_X"> entries when the project array
    // has multiple records with the same id (e.g. from importing an XML
    // that already contained duplicates).
    const uniqueTemplates = new Map<string, NpcTemplate>();
    for (const template of project.npcTemplates) {
      uniqueTemplates.set(template.id, template);
    }
    if (uniqueTemplates.size > 0) {
      lines.push('    <!-- ═══ NPC TEMPLATES ═══ -->');
      lines.push('    <!-- Edit these via the "Spawn Custom NPC" outcome in the editor. -->');
      for (const template of uniqueTemplates.values()) {
        lines.push(emitString(`st_panda_npc_template_${template.id}`, encodeNpcTemplate(template)));
      }
      lines.push('');
    }
  }

  // Conversations (sorted by ID to maintain sequential order)
  const sorted = [...project.conversations]
    .filter((conv) => factionFilter == null || getConversationFaction(conv, project.faction) === factionFilter)
    .filter((conv) => languageFilter == null || (conv.language ?? 'en') === languageFilter)
    .sort((a, b) => a.id - b.id);

  const storyPrefixByConversation = new Map<Conversation, string>();
  if (config.useStoryKeyPrefixes && config.conversationKeyPrefix.trim() === 'panda') {
    const usedByFaction = new Map<FactionId, Map<string, number>>();
    const manifestByFaction = new Map<FactionId, string[]>();
    for (const conv of sorted) {
      const faction = getConversationFaction(conv, project.faction);
      const used = usedByFaction.get(faction) ?? new Map<string, number>();
      usedByFaction.set(faction, used);

      const baseSlug = buildStoryKeySlug(conv);
      const nextCount = (used.get(baseSlug) ?? 0) + 1;
      used.set(baseSlug, nextCount);
      const uniqueSlug = nextCount === 1 ? baseSlug : `${baseSlug}_${nextCount}`;
      const storyPrefix = `panda_${uniqueSlug}`;
      storyPrefixByConversation.set(conv, storyPrefix);

      const manifest = manifestByFaction.get(faction) ?? [];
      manifest.push(storyPrefix);
      manifestByFaction.set(faction, manifest);
    }

    for (const [faction, prefixes] of manifestByFaction.entries()) {
      const factionKey = FACTION_XML_KEYS[faction];
      lines.push(emitString(`st_pda_ic_panda_${factionKey}_prefixes`, Array.from(new Set(prefixes)).join(',')));
      lines.push('');
    }
  }

  const exportCounts = new Map<string, number>();
  for (const conv of sorted) {
    const faction = getConversationFaction(conv, project.faction);
    const storyPrefix = storyPrefixByConversation.get(conv);
    const countKey = storyPrefix ? `${faction}:${storyPrefix}` : faction;
    const count = (exportCounts.get(countKey) ?? 0) + 1;
    const exportId = count + Math.max(0, Math.floor(config.conversationIdOffset));
    exportCounts.set(countKey, count);
    lines.push(generateConversation(conv, FACTION_XML_KEYS[faction], exportId, config, storyPrefix));
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
    // Leave openerEnabled undefined so the segment-start fallback in
    // isTurnOpenerActive() decides: entries and continuations that change
    // channel/NPC keep their default opener; same-NPC same-channel
    // continuations stay silent. Paste explicitly sets this to false.
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
