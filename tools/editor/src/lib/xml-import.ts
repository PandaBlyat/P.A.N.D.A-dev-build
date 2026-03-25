// P.A.N.D.A. Conversation Editor — XML Import
// Parses existing PANDA XML string table files into the editor data model.

import type { Project, Conversation, Turn, Choice, PreconditionEntry, AnyPreconditionOption, Outcome, FactionId } from './types';
import { FACTION_XML_KEYS } from './types';
import { SYSTEM_STRING_IDS } from './constants';
import { getDefaultFlowTurnPosition } from './flow-layout';

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

    // Parse Turn 1
    const turn1: Turn = {
      turnNumber: 1,
      openingMessage: strings.get(openKey) || '',
      choices: parseTurnChoices(strings, prefix, ''),
      position: getDefaultFlowTurnPosition(1),
    };
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
        choices: parseTurnChoices(strings, prefix, turnInfix),
        position: getDefaultFlowTurnPosition(turnNum),
      };
      conv.turns.push(turn);
      turnNum++;
    }

    conversations.push(conv);
    convId++;
  }

  return {
    project: {
      version: '2.0.0',
      faction: factionId,
      conversations,
    },
    systemStrings,
  };
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

    const choice: Choice = {
      index: i,
      text: choiceText,
      reply: strings.get(replyKey) || '',
      outcomes: parseOutcomes(strings.get(outcomeKey) || 'none'),
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
    }

    choices.push(choice);
  }

  return choices;
}
