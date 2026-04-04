// P.A.N.D.A. Conversation Editor — XML Import
// Parses existing PANDA XML string table files into the editor data model.

import type { Project, Conversation, Turn, Choice, PreconditionEntry, AnyPreconditionOption, Outcome, FactionId, NpcTemplate } from './types';
import { FACTION_XML_KEYS } from './types';
import { SYSTEM_STRING_IDS } from './constants';
import { getDefaultFlowTurnPosition } from './flow-layout';
import { migrateLegacyF2FEntryOpenings } from './f2f-entry-migration';

const PANDA_F2F_REGISTRY_SCHEMA = 'panda_f2f_bridge_registry_v1';
const PANDA_F2F_REGISTRY_SUFFIX = '_panda_f2f_registry';

interface ImportedF2FChoiceMetadata {
  index: number;
  channel?: 'pda' | 'f2f' | 'both';
  continueTo?: number | null;
  continueChannel?: 'pda' | 'f2f' | 'both';
  terminal?: boolean;
  storyNpcId?: string | null;
  npcFactionFilters?: string[];
  npcProfileFilters?: string[];
  allowGenericStalker?: boolean;
  contNpcId?: string | null;
}

interface ImportedF2FTurnMetadata {
  turnNumber: number;
  channel?: 'pda' | 'f2f' | 'both';
  npcOpenKey?: string | null;
  requiresNpcFirst?: boolean;
  firstSpeaker?: 'npc' | 'player';
  pdaEntry?: boolean;
  f2fEntry?: boolean;
  choices?: ImportedF2FChoiceMetadata[];
}

interface ImportedF2FRegistryPayload {
  schema?: string;
  entryNodes?: {
    pda?: number[];
    f2f?: number[];
  };
  turns?: ImportedF2FTurnMetadata[];
}

/** Parse XML text into a map of string IDs to text values */
function parseStringTable(xmlText: string): Map<string, string> {
  const map = new Map<string, string>();
  // Match <string id="..."><text>...</text></string> (allowing whitespace/newlines)
  const regex = /<string\s+id="([^"]+)"\s*>\s*<text>([\s\S]*?)<\/text>\s*<\/string>/g;
  let match;
  while ((match = regex.exec(xmlText)) !== null) {
    const id = match[1];
    // Unescape XML entities
    const text = match[2]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
    map.set(id, text);
  }
  return map;
}

/** Detect faction from string table keys */
function detectFaction(strings: Map<string, string>): { factionId: FactionId; factionKey: string } | null {
  // Try each faction key and look for _1_open
  for (const [fid, fkey] of Object.entries(FACTION_XML_KEYS)) {
    if (strings.has(`st_pda_ic_${fkey}_1_open`)) {
      return { factionId: fid as FactionId, factionKey: fkey };
    }
  }
  return null;
}

/** Split a top-level comma-separated string, respecting parentheses depth */
function splitTopLevel(str: string, delimiter: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === delimiter && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    result.push(current.trim());
  }
  return result;
}

function hasBalancedParentheses(str: string): boolean {
  let depth = 0;
  for (const ch of str) {
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function createInvalidPrecondition(raw: string, error: string): PreconditionEntry {
  return {
    type: 'invalid',
    raw,
    error,
  };
}

function parseAnyOption(token: string): AnyPreconditionOption {
  const trimmed = token.trim();
  if (trimmed === '') {
    return createInvalidPrecondition(token, 'Empty any() option.');
  }

  const andParts = splitTopLevel(trimmed, ',');
  if (andParts.length === 1) {
    return parsePreconditionToken(andParts[0]);
  }

  return {
    type: 'all',
    entries: andParts.map(parsePreconditionToken),
  };
}

/** Parse a single precondition token into a PreconditionEntry */
function parsePreconditionToken(token: string): PreconditionEntry {
  token = token.trim();

  if (token === '') {
    return createInvalidPrecondition(token, 'Empty precondition token.');
  }

  if (!hasBalancedParentheses(token)) {
    return createInvalidPrecondition(token, 'Unbalanced parentheses in precondition expression.');
  }

  // Check for not() wrapper
  if (token.startsWith('not(') && token.endsWith(')')) {
    const inner = token.slice(4, -1).trim();
    if (inner === '') {
      return createInvalidPrecondition(token, 'not() requires an inner expression.');
    }
    if (splitTopLevel(inner, ',').length !== 1) {
      return createInvalidPrecondition(token, 'not() cannot directly wrap multiple comma-separated conditions.');
    }
    return { type: 'not', inner: parsePreconditionToken(inner) };
  }

  // Check for any() wrapper
  if (token.startsWith('any(') && token.endsWith(')')) {
    const inner = token.slice(4, -1);
    if (inner.trim() === '') {
      return createInvalidPrecondition(token, 'any() requires at least one option.');
    }
    const options = splitTopLevel(inner, '|');
    return {
      type: 'any',
      options: options.map(parseAnyOption),
    };
  }

  if (token.includes('(') || token.includes(')')) {
    return createInvalidPrecondition(token, 'Unexpected parentheses in simple precondition.');
  }

  // Simple precondition: command:param1:param2
  const parts = token.split(':');
  if (!parts[0]) {
    return createInvalidPrecondition(token, 'Missing precondition command name.');
  }

  return {
    type: 'simple',
    command: parts[0],
    params: parts.slice(1),
  };
}

/** Parse precondition string into entries */
export function parsePreconditions(precondStr: string): PreconditionEntry[] {
  if (!precondStr || precondStr.trim() === '') return [];
  const tokens = splitTopLevel(precondStr, ',');
  return tokens.map(parsePreconditionToken);
}

/** Parse a single outcome token */
function parseOutcomeToken(token: string): Outcome {
  token = token.trim();

  // Check for chance wrapper: chance:N:command:params
  if (token.startsWith('chance:')) {
    const afterChance = token.slice(7); // after "chance:"
    const colonIdx = afterChance.indexOf(':');
    if (colonIdx !== -1) {
      const percent = parseInt(afterChance.slice(0, colonIdx), 10);
      const rest = afterChance.slice(colonIdx + 1);
      const parts = rest.split(':');
      return {
        command: parts[0],
        params: normalizeOutcomeParams(parts[0], parts.slice(1)),
        chancePercent: percent,
      };
    }
  }

  const parts = token.split(':');
  return {
    command: parts[0],
    params: normalizeOutcomeParams(parts[0], parts.slice(1)),
  };
}

function normalizeOutcomeParams(command: string, params: string[]): string[] {
  if (command !== 'panda_task_artifact') {
    return params;
  }

  const normalized = [...params];
  const zoneModes = new Set(['specific', 'any', 'random_level']);
  const first = normalized[0] ?? '';

  // If authors left artifact section empty, exported XML can start directly at zone_mode.
  if (zoneModes.has(first)) {
    normalized.unshift('random');
  }

  const zoneMode = normalized[1] ?? '';
  const zoneTarget = normalized[2] ?? '';
  const inferredLevelToken = inferLevelToken(zoneMode, zoneTarget, normalized[3] ?? '');

  // Artifact Hunt now always uses random_level targeting by level token.
  normalized[1] = 'random_level';
  normalized[2] = inferredLevelToken || '';

  return normalized;
}

function inferLevelToken(zoneMode: string, zoneTarget: string, splitLevelTokenRemainder: string): string {
  if (zoneMode === 'random_level') {
    // Recombine level tokens split by ':' in XML (level:gar -> "level", "gar").
    if (zoneTarget === 'level' && splitLevelTokenRemainder) {
      return `level:${splitLevelTokenRemainder}`;
    }
    if (/^level:[a-z0-9_]+$/i.test(zoneTarget)) {
      return zoneTarget;
    }
  }

  if (zoneMode === 'specific') {
    const match = /^([a-z0-9]+)_/i.exec(zoneTarget);
    if (match?.[1]) {
      return `level:${match[1].toLowerCase()}`;
    }
  }

  return '';
}

type LegacyChannelNormalizationWarning = {
  scope: 'turn' | 'choice' | 'continue';
  turnNumber: number;
  choiceIndex?: number;
};

function normalizeChannel(
  value: string | undefined,
  fallback: 'pda' | 'f2f',
  warningSink?: LegacyChannelNormalizationWarning[],
  warning?: LegacyChannelNormalizationWarning,
): 'pda' | 'f2f' {
  if (value === 'pda' || value === 'f2f') {
    return value;
  }
  if (value === 'both') {
    if (warningSink && warning) warningSink.push(warning);
    return 'pda';
  }
  return fallback;
}

function parseF2FRegistryPayload(payloadRaw: string | undefined): ImportedF2FRegistryPayload | null {
  if (!payloadRaw || payloadRaw.trim() === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadRaw) as ImportedF2FRegistryPayload;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (parsed.schema != null && parsed.schema !== PANDA_F2F_REGISTRY_SCHEMA) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function inferFirstSpeaker(
  turn: Turn,
  metadata: ImportedF2FTurnMetadata | undefined,
  f2fEntryTargets: ReadonlySet<number>,
): 'npc' | 'player' {
  if (metadata?.firstSpeaker === 'npc' || metadata?.firstSpeaker === 'player') {
    return metadata.firstSpeaker;
  }

  const channel = normalizeChannel(metadata?.channel ?? turn.channel, 'pda');
  if (channel === 'f2f') {
    return 'player';
  }

  return 'npc';
}

function applyTurnMetadata(
  turn: Turn,
  metadata: ImportedF2FTurnMetadata | undefined,
  f2fEntryTargets: ReadonlySet<number>,
  warningSink: LegacyChannelNormalizationWarning[],
): void {
  if (!metadata) {
    turn.channel = 'pda';
    turn.pda_entry = turn.turnNumber === 1;
    turn.f2f_entry = false;
    turn.requiresNpcFirst = undefined;
    turn.firstSpeaker = inferFirstSpeaker(turn, metadata, f2fEntryTargets);
    return;
  }

  turn.channel = normalizeChannel(metadata.channel, 'pda', warningSink, {
    scope: 'turn',
    turnNumber: turn.turnNumber,
  });
  turn.pda_entry = typeof metadata.pdaEntry === 'boolean' ? metadata.pdaEntry : turn.turnNumber === 1;
  turn.f2f_entry = typeof metadata.f2fEntry === 'boolean' ? metadata.f2fEntry : f2fEntryTargets.has(turn.turnNumber);
  turn.requiresNpcFirst = typeof metadata.requiresNpcFirst === 'boolean'
    ? metadata.requiresNpcFirst
    : (turn.channel === 'f2f' ? true : undefined);
  turn.firstSpeaker = inferFirstSpeaker(turn, metadata, f2fEntryTargets);

  if (turn.channel === 'pda') {
    turn.f2f_entry = false;
  } else {
    turn.pda_entry = false;
  }

  const choiceMap = new Map<number, ImportedF2FChoiceMetadata>();
  for (const item of metadata.choices ?? []) {
    choiceMap.set(item.index, item);
  }

  for (const choice of turn.choices) {
    const choiceMeta = choiceMap.get(choice.index);
    if (!choiceMeta) {
      choice.channel = 'pda';
      choice.terminal = false;
      choice.continueChannel = undefined;
      choice.continue_channel = undefined;
      choice.allow_generic_stalker = false;
      continue;
    }

    choice.channel = normalizeChannel(choiceMeta.channel, 'pda', warningSink, {
      scope: 'choice',
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
    });
    choice.terminal = typeof choiceMeta.terminal === 'boolean' ? choiceMeta.terminal : choiceMeta.continueTo == null;
    if (choiceMeta.continueChannel != null) {
      const normalizedContinueChannel = normalizeChannel(choiceMeta.continueChannel, 'pda', warningSink, {
        scope: 'continue',
        turnNumber: turn.turnNumber,
        choiceIndex: choice.index,
      });
      choice.continueChannel = normalizedContinueChannel;
      choice.continue_channel = normalizedContinueChannel;
    } else {
      choice.continueChannel = undefined;
      choice.continue_channel = undefined;
    }
    choice.allow_generic_stalker = choiceMeta.allowGenericStalker === true;
    choice.story_npc_id = choiceMeta.storyNpcId ?? undefined;
    choice.npc_faction_filters = (choiceMeta.npcFactionFilters ?? []).filter((faction): faction is FactionId => faction in FACTION_XML_KEYS);
    choice.npc_profile_filters = (choiceMeta.npcProfileFilters ?? []).filter((profile) => typeof profile === 'string' && profile.trim().length > 0);
    choice.cont_npc_id = choiceMeta.contNpcId ?? undefined;

    if (choiceMeta.continueTo == null) {
      choice.continueTo = undefined;
    } else if (typeof choiceMeta.continueTo === 'number' && Number.isFinite(choiceMeta.continueTo)) {
      choice.continueTo = Math.floor(choiceMeta.continueTo);
    }
  }
}

/** Parse outcome string into entries */
export function parseOutcomes(outcomeStr: string): Outcome[] {
  if (!outcomeStr || outcomeStr.trim() === '' || outcomeStr.trim() === 'none') return [];
  const tokens = splitTopLevel(outcomeStr, ',');
  return tokens.map(parseOutcomeToken);
}

/** Extract system strings from the string table */
function extractSystemStrings(strings: Map<string, string>): Map<string, string> {
  const system = new Map<string, string>();
  for (const id of SYSTEM_STRING_IDS) {
    const text = strings.get(id);
    if (text != null) {
      system.set(id, text);
    }
  }
  return system;
}

/** Decode a pipe-separated NPC template string back into an NpcTemplate object */
function decodeNpcTemplate(id: string, raw: string): NpcTemplate {
  const tpl: NpcTemplate = { id, name: '', faction: 'stalker' };
  for (const pair of raw.split('|')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    switch (k) {
      case 'name': tpl.name = v; break;
      case 'faction': tpl.faction = v; break;
      case 'rank': tpl.rank = v; break;
      case 'primary': tpl.primary = v; break;
      case 'secondary': tpl.secondary = v; break;
      case 'outfit': tpl.outfit = v; break;
      case 'items': tpl.items = v; break;
      case 'relation': tpl.relation = v; break;
      case 'spawn_dist': { const n = parseInt(v, 10); if (!isNaN(n)) tpl.spawnDist = n; break; }
      case 'count': { const n = parseInt(v, 10); if (!isNaN(n)) tpl.count = n; break; }
      case 'trader': tpl.trader = v === '1' || v === 'true'; break;
      case 'roam': tpl.allowRoam = !(v === '0' || v === 'false'); break;
      case 'smart_job':
      case 'stationary_job':
      case 'job_behavior':
      case 'behavior':
      case 'job':
        tpl.stationaryJob = v;
        break;
    }
  }
  return tpl;
}

/** Import a PANDA XML file into the editor data model */
export function importXml(xmlText: string): { project: Project; systemStrings: Map<string, string> } | null {
  const strings = parseStringTable(xmlText);

  const detected = detectFaction(strings);
  if (!detected) return null;

  const { factionId, factionKey } = detected;
  const systemStrings = extractSystemStrings(strings);

  const conversations: Conversation[] = [];
  let convId = 1;

  // Scan sequentially for conversations
  while (true) {
    const prefix = `st_pda_ic_${factionKey}_${convId}`;
    const openKey = `${prefix}_open`;

    if (!strings.has(openKey)) break;
    const channelWarnings: LegacyChannelNormalizationWarning[] = [];
    const metadata = parseF2FRegistryPayload(strings.get(`${prefix}${PANDA_F2F_REGISTRY_SUFFIX}`));
    const f2fEntryTargets = new Set<number>(
      (metadata?.entryNodes?.f2f ?? [])
        .filter((turnNumber): turnNumber is number => typeof turnNumber === 'number' && Number.isFinite(turnNumber))
        .map((turnNumber) => Math.floor(turnNumber)),
    );
    const metadataTurns = new Map<number, ImportedF2FTurnMetadata>();
    for (const turnMeta of metadata?.turns ?? []) {
      metadataTurns.set(turnMeta.turnNumber, turnMeta);
    }

    const conv: Conversation = {
      id: convId,
      label: `Conversation ${convId}`,
      faction: factionId,
      preconditions: [],
      turns: [],
    };

    // Preconditions
    const precondStr = strings.get(`${prefix}_precond`);
    if (precondStr) {
      conv.preconditions = parsePreconditions(precondStr);
    }

    // Timeout
    const timeoutStr = strings.get(`${prefix}_timeout`);
    if (timeoutStr) {
      conv.timeout = parseInt(timeoutStr, 10);
    }
    const timeoutMsg = strings.get(`${prefix}_timeout_msg`);
    if (timeoutMsg) {
      conv.timeoutMessage = timeoutMsg;
    }

    // Start mode
    const startModeStr = strings.get(`${prefix}_start_mode`);
    if (startModeStr === 'pda' || startModeStr === 'f2f') {
      conv.startMode = startModeStr;
    }

    // Parse Turn 1
    const turn1: Turn = {
      turnNumber: 1,
      openingMessage: strings.get(openKey) || '',
      preconditions: parsePreconditions(strings.get(`${prefix}_branch_precond`) || ''),
      choices: parseTurnChoices(strings, prefix, ''),
      position: getDefaultFlowTurnPosition(1),
    };
    applyTurnMetadata(turn1, metadataTurns.get(1), f2fEntryTargets, channelWarnings);
    conv.turns.push(turn1);

    // Parse multi-turn: t2, t3, etc.
    let turnNum = 2;
    while (true) {
      const turnInfix = `_t${turnNum}`;
      // Check if any choice exists for this turn
      const firstChoiceKey = `${prefix}${turnInfix}_choice_1`;
      if (!strings.has(firstChoiceKey)) break;

      const turn: Turn = {
        turnNumber: turnNum,
        openingMessage: strings.get(`${prefix}${turnInfix}_open`) || '',
        preconditions: parsePreconditions(strings.get(`${prefix}${turnInfix}_branch_precond`) || ''),
        choices: parseTurnChoices(strings, prefix, turnInfix),
        position: getDefaultFlowTurnPosition(turnNum),
      };
      applyTurnMetadata(turn, metadataTurns.get(turnNum), f2fEntryTargets, channelWarnings);
      conv.turns.push(turn);
      turnNum++;
    }

    applyLegacyChannelWarningsToConversation(conv, channelWarnings);

    conversations.push(conv);
    convId++;
  }

  // Parse NPC templates authored via the editor (st_panda_npc_template_<id>)
  const npcTemplates: NpcTemplate[] = [];
  for (const [key, value] of strings) {
    const match = /^st_panda_npc_template_(.+)$/.exec(key);
    if (match && match[1]) {
      npcTemplates.push(decodeNpcTemplate(match[1], value));
    }
  }

  const importedProject = migrateLegacyF2FEntryOpenings({
    version: '2.0.0',
    faction: factionId,
    conversations,
    ...(npcTemplates.length > 0 ? { npcTemplates } : {}),
  });

  return {
    project: importedProject,
    systemStrings,
  };
}

function applyLegacyChannelWarningsToConversation(conv: Conversation, warnings: LegacyChannelNormalizationWarning[]): void {
  if (warnings.length === 0) return;
  const byTurn = new Map<number, string[]>();
  for (const warning of warnings) {
    const list = byTurn.get(warning.turnNumber) ?? [];
    if (warning.scope === 'turn') {
      list.push('Legacy "both" turn channel from XML registry was migrated to PDA.');
    } else if (warning.choiceIndex != null) {
      const label = warning.scope === 'choice' ? 'choice visibility' : 'choice handoff channel';
      list.push(`Legacy "both" ${label} on Choice ${warning.choiceIndex} from XML registry was migrated to PDA.`);
    }
    byTurn.set(warning.turnNumber, list);
  }

  for (const turn of conv.turns) {
    const messages = byTurn.get(turn.turnNumber);
    if (!messages?.length) continue;
    const existing = turn.migrationWarnings ?? [];
    turn.migrationWarnings = [...existing, ...messages];
  }
}

/** Parse choices for a single turn */
function parseTurnChoices(strings: Map<string, string>, prefix: string, turnInfix: string): Choice[] {
  const choices: Choice[] = [];

  for (let i = 1; i <= 4; i++) {
    const choiceKey = `${prefix}${turnInfix}_choice_${i}`;
    const choiceText = strings.get(choiceKey);
    if (!choiceText) break;

    const replyKey = `${prefix}${turnInfix}_reply_${i}`;
    const outcomeKey = `${prefix}${turnInfix}_outcome_${i}`;
    const contKey = `${prefix}${turnInfix}_cont_${i}`;
    const pdaDelayKey = `${prefix}${turnInfix}_pda_delay_${i}`;

    const choice: Choice = {
      index: i,
      text: choiceText,
      preconditions: parsePreconditions(strings.get(`${prefix}${turnInfix}_choice_precond_${i}`) || ''),
      reply: strings.get(replyKey) || '',
      outcomes: parseOutcomes(strings.get(outcomeKey) || 'none'),
      terminal: true,
    };

    // Relationship reply variants
    const relHigh = strings.get(`${replyKey}_rel_high`);
    if (relHigh) choice.replyRelHigh = relHigh;
    const relLow = strings.get(`${replyKey}_rel_low`);
    if (relLow) choice.replyRelLow = relLow;

    // Continuation
    const contStr = strings.get(contKey);
    if (contStr) {
      choice.continueTo = parseInt(contStr, 10);
      choice.terminal = false;
    }

    const pdaDelayStr = strings.get(pdaDelayKey);
    if (pdaDelayStr) {
      const parsedDelay = parseInt(pdaDelayStr, 10);
      if (Number.isFinite(parsedDelay) && parsedDelay >= 0) {
        choice.pdaDelaySeconds = Math.floor(parsedDelay);
      }
    }

    // Multi-NPC handoff: direct XML key (authoritative, overrides registry if present)
    const contNpcStr = strings.get(`${prefix}${turnInfix}_cont_npc_${i}`);
    if (contNpcStr && contNpcStr.trim()) {
      choice.cont_npc_id = contNpcStr.trim();
    }

    choices.push(choice);
  }

  return choices;
}
