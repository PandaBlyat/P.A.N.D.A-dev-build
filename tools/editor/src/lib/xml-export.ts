// P.A.N.D.A. Conversation Editor — XML Export
// Generates valid PANDA XML string table files from the editor data model.

import type { Project, Conversation, Turn, Choice, PreconditionEntry, AnyPreconditionOption, Outcome, FactionId } from './types';
import { FACTION_XML_KEYS, getConversationFaction } from './types';
import { getDefaultFlowTurnPosition } from './flow-layout';

const PANDA_F2F_REGISTRY_SCHEMA = 'panda_f2f_bridge_registry_v1';
const PANDA_F2F_REGISTRY_SUFFIX = '_panda_f2f_registry';

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

function normalizeChannel(value: Conversation['turns'][number]['channel'] | Choice['channel'] | Choice['continue_channel'] | undefined, fallback: 'pda' | 'both'): 'pda' | 'f2f' | 'both' {
  if (value === 'pda' || value === 'f2f' || value === 'both') {
    return value;
  }
  return fallback;
}

function createF2FRegistryPayload(conv: Conversation) {
  const turns = conv.turns.map((turn) => ({
    turnNumber: turn.turnNumber,
    channel: normalizeChannel(turn.channel, 'both'),
    pdaEntry: turn.pda_entry ?? turn.turnNumber === 1,
    f2fEntry: turn.f2f_entry ?? false,
    choices: turn.choices.map((choice) => ({
      index: choice.index,
      channel: normalizeChannel(choice.channel, 'pda'),
      continueTo: choice.continueTo ?? null,
      continueChannel: normalizeChannel(choice.continue_channel, 'pda'),
      storyNpcId: choice.story_npc_id ?? null,
      npcFactionFilters: choice.npc_faction_filters ?? [],
      npcProfileFilters: choice.npc_profile_filters ?? [],
      allowGenericStalker: choice.allow_generic_stalker ?? false,
    })),
  }));

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
function generateConversation(conv: Conversation, factionKey: string, exportId: number): string {
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

    // Opening message (turn 1 only)
    if (turn.turnNumber === 1 && turn.openingMessage) {
      lines.push(emitString(`${prefix}_open`, turn.openingMessage));
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
export function generateXml(project: Project, systemStrings?: Map<string, string>, factionFilter?: FactionId): string {
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
    lines.push(generateConversation(conv, FACTION_XML_KEYS[faction], exportId));
    lines.push('');
  }

  lines.push('</string_table>');

  return lines.join('\n');
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
    preconditions: [],
    turns: [createTurn(1)],
  };
}

/** Create a new empty turn */
export function createTurn(turnNumber: number): Turn {
  return {
    turnNumber,
    openingMessage: turnNumber === 1 ? '' : undefined,
    channel: 'both',
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
    continue_channel: 'pda',
    allow_generic_stalker: false,
  };
}
