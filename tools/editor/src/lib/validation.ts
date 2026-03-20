// P.A.N.D.A. Conversation Editor — Validation Engine

import { FACTION_ALIASES, FACTION_IDS, LEVEL_DISPLAY_NAMES, MUTANT_TYPES, RANKS, SMART_TERRAIN_LEVELS } from './constants';
import { findSchema, OUTCOME_SCHEMAS, PRECONDITION_SCHEMAS } from './schema';
import { createTurnDisplayLabeler } from './turn-labels';
import type { CommandSchema, ParamDef } from './schema';
import type {
  AnyPrecondition,
  Choice,
  Conversation,
  Outcome,
  PreconditionEntry,
  Project,
  SimplePrecondition,
  ValidationGroup,
  ValidationMessage,
  ValidationScope,
} from './types';

const PRECONDITION_COMMANDS = new Map(PRECONDITION_SCHEMAS.map(schema => [schema.name, schema]));
const OUTCOME_COMMANDS = new Map(OUTCOME_SCHEMAS.map(schema => [schema.name, schema]));
const KNOWN_LEVELS = new Set(Object.keys(LEVEL_DISPLAY_NAMES));
const KNOWN_SMART_TERRAINS = new Set(Object.values(SMART_TERRAIN_LEVELS).flat());
const KNOWN_FACTIONS = new Set([...FACTION_IDS, ...Object.keys(FACTION_ALIASES)]);
const SPAWN_JOB_OUTCOMES = new Set([
  'spawn_hostile',
  'spawn_mutant',
  'spawn_hostile_at_smart',
  'spawn_mutant_at_smart',
  'spawn_companion',
]);
const PRECONDITION_RANGE_PAIRS: Array<{ minCommand: string; maxCommand: string; label: string; rankBased?: boolean }> = [
  { minCommand: 'req_money', maxCommand: 'req_money_max', label: 'money' },
  { minCommand: 'req_rep', maxCommand: 'req_rep_max', label: 'reputation' },
  { minCommand: 'req_goodwill', maxCommand: 'req_goodwill_max', label: 'goodwill' },
  { minCommand: 'req_health_min', maxCommand: 'req_health_max', label: 'health' },
  { minCommand: 'req_companions', maxCommand: 'req_companions_max', label: 'companions' },
  { minCommand: 'req_rank', maxCommand: 'req_rank_max', label: 'player rank', rankBased: true },
  { minCommand: 'req_npc_rank', maxCommand: 'req_npc_rank_max', label: 'NPC rank', rankBased: true },
] as const;

type ConversationField = 'label' | 'timeout' | 'timeout-message' | 'preconditions';
type TurnField = 'opening-message';
type ChoiceField = 'text' | 'reply' | 'reply-rel-high' | 'reply-rel-low' | 'continue-to';

interface ValidationContext {
  conversationId: number;
  turnNumber?: number;
  choiceIndex?: number;
  preconditionIndex?: number;
  outcomeIndex?: number;
  paramIndex?: number;
  propertiesTab: 'conversation' | 'selection';
}

interface RangeConstraint {
  command: string;
  index: number;
  rawValue: string;
  parsedValue: number;
  rankValue?: number;
}

interface FlattenedPrecondition {
  command: string;
  params: string[];
  normalizedParams: string[];
  polarity: 'positive' | 'negative';
  index: number;
  raw: string;
}

/** Field keys shared by the properties panel and validation bar navigation. */
export function getConversationFieldKey(conversationId: number, field: ConversationField): string {
  return `conversation-${conversationId}-${field}`;
}

export function getPreconditionItemFieldKey(conversationId: number, preconditionIndex: number): string {
  return `conversation-${conversationId}-precondition-${preconditionIndex}`;
}

export function getPreconditionParamFieldKey(conversationId: number, preconditionIndex: number, paramIndex: number): string {
  return `${getPreconditionItemFieldKey(conversationId, preconditionIndex)}-param-${paramIndex}`;
}

export function getTurnFieldKey(conversationId: number, turnNumber: number, field: TurnField): string {
  return `conversation-${conversationId}-turn-${turnNumber}-${field}`;
}

export function getChoiceFieldKey(conversationId: number, turnNumber: number, choiceIndex: number, field: ChoiceField): string {
  return `conversation-${conversationId}-turn-${turnNumber}-choice-${choiceIndex}-${field}`;
}

export function getOutcomeItemFieldKey(conversationId: number, turnNumber: number, choiceIndex: number, outcomeIndex: number): string {
  return `conversation-${conversationId}-turn-${turnNumber}-choice-${choiceIndex}-outcome-${outcomeIndex}`;
}

export function getOutcomeParamFieldKey(conversationId: number, turnNumber: number, choiceIndex: number, outcomeIndex: number, paramIndex: number): string {
  return `${getOutcomeItemFieldKey(conversationId, turnNumber, choiceIndex, outcomeIndex)}-param-${paramIndex}`;
}

export function getOutcomeChanceFieldKey(conversationId: number, turnNumber: number, choiceIndex: number, outcomeIndex: number): string {
  return `${getOutcomeItemFieldKey(conversationId, turnNumber, choiceIndex, outcomeIndex)}-chance`;
}

/** Validate the entire project and return all messages. */
export function validate(project: Project): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  const ids = project.conversations.map(c => c.id).sort((a, b) => a - b);
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] !== i + 1) {
      pushMessage(messages, {
        code: 'conversation-id-gap',
        group: 'structure',
        scope: 'project',
        level: 'error',
        conversationId: ids[i],
        propertiesTab: 'conversation',
        message: `Conversation IDs are not sequential. Expected ${i + 1}, found ${ids[i]}. The game engine stops scanning at the first gap.`,
      });
      break;
    }
  }

  for (const conv of project.conversations) {
    validateConversation(conv, messages);
  }

  return messages;
}

function validateConversation(conv: Conversation, messages: ValidationMessage[]): void {
  if (conv.preconditions.length === 0) {
    pushMessage(messages, {
      code: 'missing-preconditions',
      group: 'structure',
      scope: 'conversation',
      level: 'error',
      conversationId: conv.id,
      propertiesTab: 'conversation',
      fieldKey: getConversationFieldKey(conv.id, 'preconditions'),
      fieldLabel: 'Preconditions',
      message: 'Missing preconditions. Every conversation must have at least one precondition.',
    });
  } else {
    conv.preconditions.forEach((entry, idx) => {
      validatePrecondition(entry, idx, conv.id, messages);
    });
  }

  if (conv.timeout != null) {
    if (!Number.isFinite(conv.timeout) || conv.timeout < 1) {
      pushMessage(messages, {
        code: 'invalid-timeout',
        group: 'schema',
        scope: 'conversation',
        level: 'error',
        conversationId: conv.id,
        propertiesTab: 'conversation',
        fieldKey: getConversationFieldKey(conv.id, 'timeout'),
        fieldLabel: 'Timeout (seconds)',
        message: 'Timeout must be a positive number of seconds.',
      });
    }
    if ((conv.timeoutMessage ?? '').trim() === '') {
      pushMessage(messages, {
        code: 'missing-timeout-message',
        group: 'logic',
        scope: 'conversation',
        level: 'warning',
        conversationId: conv.id,
        propertiesTab: 'conversation',
        fieldKey: getConversationFieldKey(conv.id, 'timeout-message'),
        fieldLabel: 'Timeout Message',
        message: 'Timeout is set, but the timeout message is empty.',
      });
    }
  }

  conv.preconditions.forEach((entry, index) => {
    validatePrecondition(entry, index, conv.id, messages);
  });
  validateConversationPreconditionLogic(conv, messages);

  if (conv.turns.length === 0) {
    pushMessage(messages, {
      code: 'missing-turns',
      group: 'structure',
      scope: 'conversation',
      level: 'error',
      conversationId: conv.id,
      propertiesTab: 'conversation',
      message: 'No turns defined.',
    });
    return;
  }

  const turn1 = conv.turns.find(t => t.turnNumber === 1);
  if (!turn1) {
    pushMessage(messages, {
      code: 'missing-turn-1',
      group: 'structure',
      scope: 'conversation',
      level: 'error',
      conversationId: conv.id,
      propertiesTab: 'conversation',
      message: 'Missing Branch 1.',
    });
    return;
  }

  if (!turn1.openingMessage || turn1.openingMessage.trim() === '') {
    pushMessage(messages, {
      code: 'missing-opening-message',
      group: 'structure',
      scope: 'turn',
      level: 'error',
      conversationId: conv.id,
      turnNumber: 1,
      propertiesTab: 'selection',
      fieldKey: getTurnFieldKey(conv.id, 1, 'opening-message'),
      fieldLabel: 'Opening Message',
      message: 'Branch 1 is missing an opening message.',
    });
  }

  const turnNumbers = new Set(conv.turns.map(t => t.turnNumber));
  const highestTurnNumber = Math.max(...conv.turns.map(t => t.turnNumber));
  const turnLabels = createTurnDisplayLabeler(conv);

  for (const turn of conv.turns) {
    validateTurn(conv, turn, turnNumbers, highestTurnNumber, turnLabels, messages);
  }

  if (conv.turns.length > 1) {
    validateReachability(conv, turnNumbers, turnLabels, messages);
  }
}

function validateTurn(
  conv: Conversation,
  turn: Conversation['turns'][number],
  turnNumbers: Set<number>,
  highestTurnNumber: number,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
  messages: ValidationMessage[],
): void {
  if (turn.choices.length === 0) {
    pushMessage(messages, {
      code: 'missing-choices',
      group: 'structure',
      scope: 'turn',
      level: 'error',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      propertiesTab: 'selection',
      message: `${turnLabels.getLongLabel(turn.turnNumber)} has no choices.`,
    });
    return;
  }

  let turnHasContinuationIntent = false;

  for (const choice of turn.choices) {
    if (!choice.text || choice.text.trim() === '') {
      pushMessage(messages, {
        code: 'missing-choice-text',
        group: 'structure',
        scope: 'choice',
        level: 'error',
        conversationId: conv.id,
        turnNumber: turn.turnNumber,
        choiceIndex: choice.index,
        propertiesTab: 'selection',
        fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'text'),
        fieldLabel: 'Player Choice Text',
        message: `${turnLabels.getLongLabel(turn.turnNumber)}, Choice ${choice.index}: Missing choice text.`,
      });
    }

    if (!choice.reply || choice.reply.trim() === '') {
      pushMessage(messages, {
        code: 'missing-choice-reply',
        group: 'structure',
        scope: 'choice',
        level: 'error',
        conversationId: conv.id,
        turnNumber: turn.turnNumber,
        choiceIndex: choice.index,
        propertiesTab: 'selection',
        fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'reply'),
        fieldLabel: 'NPC Reply',
        message: `${turnLabels.getLongLabel(turn.turnNumber)}, Choice ${choice.index}: Missing reply text.`,
      });
    }

    if (choice.continueTo != null) {
      turnHasContinuationIntent = true;
      if (choice.continueTo === turn.turnNumber) {
        pushMessage(messages, {
          code: 'self-loop-continuation',
          group: 'logic',
          scope: 'choice',
          level: 'warning',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          propertiesTab: 'selection',
          fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-to'),
          fieldLabel: 'Continue To Turn',
          message: `${turnLabels.getLongLabel(turn.turnNumber)}, Choice ${choice.index}: Continues to itself.`,
        });
      } else if (!turnNumbers.has(choice.continueTo)) {
        pushMessage(messages, {
          code: 'missing-continue-target',
          group: 'structure',
          scope: 'choice',
          level: 'error',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          propertiesTab: 'selection',
          fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-to'),
          fieldLabel: 'Continue To Turn',
          message: `${turnLabels.getLongLabel(turn.turnNumber)}, Choice ${choice.index}: Continues to ${turnLabels.getLongLabel(choice.continueTo)} which does not exist.`,
        });
      }
    }

    choice.outcomes.forEach((outcome, outcomeIndex) => {
      validateOutcome(conv, turn, choice, outcome, outcomeIndex, turnNumbers, turnLabels, messages);
      if (outcome.command === 'pause_job') {
        turnHasContinuationIntent = true;
      }
    });

    if (choice.outcomes.length === 0 && choice.continueTo == null && highestTurnNumber > turn.turnNumber) {
      pushMessage(messages, {
        code: 'choice-dead-end',
        group: 'logic',
        scope: 'choice',
        level: 'warning',
        conversationId: conv.id,
        turnNumber: turn.turnNumber,
        choiceIndex: choice.index,
        propertiesTab: 'selection',
        fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-to'),
        fieldLabel: 'Continue To Turn',
        message: `${turnLabels.getLongLabel(turn.turnNumber)}, Choice ${choice.index}: Ends immediately with no continuation or branching outcome.`,
      });
    }
  }

  if (!turnHasContinuationIntent && highestTurnNumber > turn.turnNumber) {
    pushMessage(messages, {
      code: 'turn-dead-end',
      group: 'logic',
      scope: 'turn',
      level: 'warning',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      propertiesTab: 'selection',
      message: `${turnLabels.getLongLabel(turn.turnNumber)} has no continuation intent, but later turns exist in this conversation.`,
    });
  }
}

function validatePrecondition(entry: PreconditionEntry, preconditionIndex: number, conversationId: number, messages: ValidationMessage[]): void {
  if (entry.type === 'simple') {
    validateSimpleCommand({
      command: entry.command,
      params: entry.params,
      schema: PRECONDITION_COMMANDS.get(entry.command),
      registryName: 'precondition',
      schemaLookup: PRECONDITION_SCHEMAS,
      context: {
        conversationId,
        preconditionIndex,
        propertiesTab: 'conversation',
      },
      getItemFieldKey: () => getPreconditionItemFieldKey(conversationId, preconditionIndex),
      getParamFieldKey: paramIndex => getPreconditionParamFieldKey(conversationId, preconditionIndex, paramIndex),
      messages,
    });
    return;
  }

  if (entry.type === 'not') {
    validatePrecondition(entry.inner, preconditionIndex, conversationId, messages);
    return;
  }

  const group = entry as AnyPrecondition;
  if (group.options.length === 0) {
    pushMessage(messages, {
      code: 'empty-any-group',
      group: 'logic',
      scope: 'precondition',
      level: 'warning',
      conversationId,
      preconditionIndex,
      propertiesTab: 'conversation',
      fieldKey: getPreconditionItemFieldKey(conversationId, preconditionIndex),
      message: 'ANY precondition group is empty and can never match.',
    });
    return;
  }

  group.options.forEach((option) => {
    if (option.type === 'all') {
      option.entries.forEach((entry) => validatePrecondition(entry, preconditionIndex, conversationId, messages));
      return;
    }
    validatePrecondition(option, preconditionIndex, conversationId, messages);
  });
}

function validateOutcome(
  conv: Conversation,
  turn: Conversation['turns'][number],
  choice: Choice,
  outcome: Outcome,
  outcomeIndex: number,
  turnNumbers: Set<number>,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
  messages: ValidationMessage[],
): void {
  validateSimpleCommand({
    command: outcome.command,
    params: outcome.params,
    schema: OUTCOME_COMMANDS.get(outcome.command),
    registryName: 'outcome',
    schemaLookup: OUTCOME_SCHEMAS,
    context: {
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
    },
    getItemFieldKey: () => getOutcomeItemFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex),
    getParamFieldKey: paramIndex => getOutcomeParamFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex, paramIndex),
    messages,
  });

  if (outcome.chancePercent != null && (!Number.isFinite(outcome.chancePercent) || outcome.chancePercent < 1 || outcome.chancePercent > 100)) {
    pushMessage(messages, {
      code: 'invalid-outcome-chance',
      group: 'schema',
      scope: 'outcome',
      level: 'error',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
      fieldKey: getOutcomeChanceFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex),
      fieldLabel: 'Chance %',
      message: 'Outcome chance must be between 1 and 100.',
    });
  }

  if (outcome.command !== 'pause_job') {
    return;
  }

  const timeout = parseStrictNumber(outcome.params[0]);
  const successTurn = parseStrictInteger(outcome.params[1]);
  const failTurn = parseStrictInteger(outcome.params[2]);

  if (successTurn != null && !turnNumbers.has(successTurn)) {
    pushMessage(messages, {
      code: 'pause-job-missing-success-turn',
      group: 'structure',
      scope: 'outcome',
      level: 'error',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
      fieldKey: getOutcomeParamFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex, 1),
      fieldLabel: 'Success Turn',
      message: `pause_job references success ${turnLabels.getLongLabel(successTurn)} which does not exist.`,
    });
  }

  if (failTurn != null && !turnNumbers.has(failTurn)) {
    pushMessage(messages, {
      code: 'pause-job-missing-fail-turn',
      group: 'structure',
      scope: 'outcome',
      level: 'error',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
      fieldKey: getOutcomeParamFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex, 2),
      fieldLabel: 'Fail Turn',
      message: `pause_job references fail ${turnLabels.getLongLabel(failTurn)} which does not exist.`,
    });
  }

  if (successTurn != null && failTurn != null && successTurn === failTurn) {
    pushMessage(messages, {
      code: 'pause-job-identical-branches',
      group: 'logic',
      scope: 'outcome',
      level: 'warning',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
      fieldKey: getOutcomeItemFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex),
      message: 'pause_job sends both success and fail to the same turn, which is probably not intended.',
    });
  }

  if (timeout != null && timeout < 5) {
    pushMessage(messages, {
      code: 'pause-job-short-timeout',
      group: 'logic',
      scope: 'outcome',
      level: 'warning',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
      fieldKey: getOutcomeParamFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex, 0),
      fieldLabel: 'Timeout (s)',
      message: 'pause_job timeout is very short and may fire before spawned squads meaningfully engage.',
    });
  }

  const pauseJobsInChoice = choice.outcomes.filter(item => item.command === 'pause_job').length;
  if (pauseJobsInChoice > 1) {
    pushMessage(messages, {
      code: 'pause-job-multiple',
      group: 'logic',
      scope: 'outcome',
      level: 'warning',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
      fieldKey: getOutcomeItemFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex),
      message: 'Multiple pause_job outcomes exist on this choice; only one job timer is usually expected.',
    });
  }

  if (!choice.outcomes.some(item => SPAWN_JOB_OUTCOMES.has(item.command))) {
    pushMessage(messages, {
      code: 'pause-job-without-spawn',
      group: 'logic',
      scope: 'outcome',
      level: 'warning',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
      fieldKey: getOutcomeItemFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex),
      message: 'pause_job is present without a squad-spawning outcome on the same choice, which is suspicious.',
    });
  }
}

function validateSimpleCommand(options: {
  command: string;
  params: string[];
  schema: CommandSchema | undefined;
  registryName: 'precondition' | 'outcome';
  schemaLookup: CommandSchema[];
  context: ValidationContext;
  getItemFieldKey: () => string;
  getParamFieldKey: (paramIndex: number) => string;
  messages: ValidationMessage[];
}): void {
  const { command, params, schema, registryName, schemaLookup, context, getItemFieldKey, getParamFieldKey, messages } = options;

  if (!schema) {
    pushMessage(messages, {
      ...context,
      code: `unknown-${registryName}-command`,
      group: 'schema',
      scope: registryName,
      level: 'error',
      fieldKey: getItemFieldKey(),
      message: `Unknown ${registryName} command \"${command}\". It does not exist in the schema registry.`,
    });
    return;
  }

  for (let i = 0; i < schema.params.length; i++) {
    const paramDef = schema.params[i];
    const rawValue = params[i] ?? '';
    const trimmed = rawValue.trim();

    if (paramDef.required && trimmed === '') {
      pushMessage(messages, {
        ...context,
        code: `${registryName}-missing-required-param`,
        group: 'schema',
        scope: registryName,
        level: 'error',
        paramIndex: i,
        fieldKey: getParamFieldKey(i),
        fieldLabel: paramDef.label,
        message: `${schema.label}: Missing required parameter \"${paramDef.label}\".`,
      });
      continue;
    }

    if (trimmed === '') {
      continue;
    }

    validateParamValue({
      registryName,
      schema,
      schemaLookup,
      paramDef,
      rawValue: trimmed,
      paramIndex: i,
      context,
      fieldKey: getParamFieldKey(i),
      messages,
    });
  }
}

function validateParamValue(options: {
  registryName: 'precondition' | 'outcome';
  schema: CommandSchema;
  schemaLookup: CommandSchema[];
  paramDef: ParamDef;
  rawValue: string;
  paramIndex: number;
  context: ValidationContext;
  fieldKey: string;
  messages: ValidationMessage[];
}): void {
  const { registryName, schema, schemaLookup, paramDef, rawValue, paramIndex, context, fieldKey, messages } = options;

  if (paramDef.type === 'number' || paramDef.type === 'slot') {
    const parsed = parseStrictNumber(rawValue);
    if (parsed == null) {
      pushMessage(messages, {
        ...context,
        code: `${registryName}-invalid-number`,
        group: 'schema',
        scope: registryName,
        level: 'error',
        paramIndex,
        fieldKey,
        fieldLabel: paramDef.label,
        message: `${schema.label}: \"${paramDef.label}\" must be a valid number.`,
      });
      return;
    }

    if (paramDef.type === 'slot' && !Number.isInteger(parsed)) {
      pushMessage(messages, {
        ...context,
        code: `${registryName}-slot-not-integer`,
        group: 'schema',
        scope: registryName,
        level: 'error',
        paramIndex,
        fieldKey,
        fieldLabel: paramDef.label,
        message: `${schema.label}: \"${paramDef.label}\" must be a whole number.`,
      });
      return;
    }

    if (paramDef.min != null && parsed < paramDef.min) {
      pushMessage(messages, {
        ...context,
        code: `${registryName}-number-below-min`,
        group: 'schema',
        scope: registryName,
        level: 'error',
        paramIndex,
        fieldKey,
        fieldLabel: paramDef.label,
        message: `${schema.label}: \"${paramDef.label}\" must be at least ${paramDef.min}.`,
      });
    }
    if (paramDef.max != null && parsed > paramDef.max) {
      pushMessage(messages, {
        ...context,
        code: `${registryName}-number-above-max`,
        group: 'schema',
        scope: registryName,
        level: 'error',
        paramIndex,
        fieldKey,
        fieldLabel: paramDef.label,
        message: `${schema.label}: \"${paramDef.label}\" must be at most ${paramDef.max}.`,
      });
    }
    return;
  }

  const normalized = normalizeParamValue(paramDef.type, rawValue);
  if (normalized == null) {
    const allowedValues = describeAllowedValues(paramDef.type, schemaLookup);
    pushMessage(messages, {
      ...context,
      code: `${registryName}-invalid-enum-value`,
      group: 'schema',
      scope: registryName,
      level: 'error',
      paramIndex,
      fieldKey,
      fieldLabel: paramDef.label,
      message: `${schema.label}: \"${paramDef.label}\" has an unknown value \"${rawValue}\"${allowedValues ? `. Expected ${allowedValues}.` : '.'}`,
    });
  }
}

function validateConversationPreconditionLogic(conv: Conversation, messages: ValidationMessage[]): void {
  const flat = conv.preconditions.flatMap((entry, index) => flattenTopLevelPrecondition(entry, index));
  const seen = new Map<string, FlattenedPrecondition>();

  for (const item of flat) {
    const key = `${item.polarity}:${item.command}:${item.normalizedParams.join('|')}`;
    const existing = seen.get(key);
    if (existing) {
      pushMessage(messages, {
        code: 'duplicate-precondition',
        group: 'logic',
        scope: 'precondition',
        level: 'warning',
        conversationId: conv.id,
        preconditionIndex: item.index,
        propertiesTab: 'conversation',
        fieldKey: getPreconditionItemFieldKey(conv.id, item.index),
        message: `Duplicate precondition: ${item.raw}.`,
      });
    } else {
      seen.set(key, item);
    }

    const oppositeKey = `${item.polarity === 'positive' ? 'negative' : 'positive'}:${item.command}:${item.normalizedParams.join('|')}`;
    if (seen.has(oppositeKey)) {
      pushMessage(messages, {
        code: 'contradictory-precondition',
        group: 'logic',
        scope: 'precondition',
        level: 'warning',
        conversationId: conv.id,
        preconditionIndex: item.index,
        propertiesTab: 'conversation',
        fieldKey: getPreconditionItemFieldKey(conv.id, item.index),
        message: `Contradictory precondition: ${item.raw} conflicts with another condition in this conversation.`,
      });
    }
  }

  for (const pair of PRECONDITION_RANGE_PAIRS) {
    const mins = collectRangeConstraints(conv.preconditions, pair.minCommand);
    const maxes = collectRangeConstraints(conv.preconditions, pair.maxCommand);

    for (const minConstraint of mins) {
      for (const maxConstraint of maxes) {
        if (!rangeTargetsMatch(minConstraint, maxConstraint, pair.rankBased === true)) {
          continue;
        }
        const minValue = pair.rankBased ? minConstraint.rankValue : minConstraint.parsedValue;
        const maxValue = pair.rankBased ? maxConstraint.rankValue : maxConstraint.parsedValue;
        if (minValue == null || maxValue == null || minValue <= maxValue) {
          continue;
        }
        pushMessage(messages, {
          code: 'contradictory-range-precondition',
          group: 'logic',
          scope: 'precondition',
          level: 'warning',
          conversationId: conv.id,
          preconditionIndex: maxConstraint.index,
          propertiesTab: 'conversation',
          fieldKey: getPreconditionItemFieldKey(conv.id, maxConstraint.index),
          message: `Contradictory ${pair.label} limits: minimum ${minConstraint.rawValue} is greater than maximum ${maxConstraint.rawValue}.`,
        });
      }
    }
  }
}

function validateReachability(
  conv: Conversation,
  turnNumbers: Set<number>,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
  messages: ValidationMessage[],
): void {
  const reachable = new Set<number>([1]);
  const queue = [1];

  while (queue.length > 0) {
    const turnNumber = queue.pop()!;
    const turn = conv.turns.find(t => t.turnNumber === turnNumber);
    if (!turn) continue;

    for (const choice of turn.choices) {
      if (choice.continueTo != null && !reachable.has(choice.continueTo) && turnNumbers.has(choice.continueTo)) {
        reachable.add(choice.continueTo);
        queue.push(choice.continueTo);
      }

      for (const outcome of choice.outcomes) {
        if (outcome.command !== 'pause_job') continue;
        const successTurn = parseStrictInteger(outcome.params[1]);
        const failTurn = parseStrictInteger(outcome.params[2]);
        if (successTurn != null && turnNumbers.has(successTurn) && !reachable.has(successTurn)) {
          reachable.add(successTurn);
          queue.push(successTurn);
        }
        if (failTurn != null && turnNumbers.has(failTurn) && !reachable.has(failTurn)) {
          reachable.add(failTurn);
          queue.push(failTurn);
        }
      }
    }
  }

  for (const turn of conv.turns) {
    if (reachable.has(turn.turnNumber)) continue;
    pushMessage(messages, {
      code: 'unreachable-turn',
      group: 'logic',
      scope: 'turn',
      level: 'warning',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      propertiesTab: 'selection',
      message: `${turnLabels.getLongLabel(turn.turnNumber)} is unreachable from ${turnLabels.getLongLabel(1)}.`,
    });
  }
}

function flattenTopLevelPrecondition(entry: PreconditionEntry, index: number): FlattenedPrecondition[] {
  if (entry.type === 'simple') {
    return [buildFlattenedPrecondition(entry, 'positive', index)];
  }
  if (entry.type === 'not' && entry.inner.type === 'simple') {
    return [buildFlattenedPrecondition(entry.inner, 'negative', index)];
  }
  return [];
}

function buildFlattenedPrecondition(entry: SimplePrecondition, polarity: FlattenedPrecondition['polarity'], index: number): FlattenedPrecondition {
  return {
    command: entry.command,
    params: entry.params,
    normalizedParams: entry.params.map((value, paramIndex) => normalizePreconditionParam(entry.command, paramIndex, value)),
    polarity,
    index,
    raw: formatPrecondition(entry.command, entry.params, polarity),
  };
}

function collectRangeConstraints(entries: PreconditionEntry[], command: string): RangeConstraint[] {
  const constraints: RangeConstraint[] = [];

  entries.forEach((entry, index) => {
    if (entry.type !== 'simple' || entry.command !== command) {
      return;
    }
    const value = entry.params[0]?.trim() ?? '';
    const parsedValue = parseStrictNumber(value);
    if (parsedValue == null) {
      return;
    }
    constraints.push({
      command,
      index,
      rawValue: value,
      parsedValue,
      rankValue: command.includes('rank') ? rankIndex(value) : undefined,
    });
  });

  return constraints;
}

function rangeTargetsMatch(a: RangeConstraint, b: RangeConstraint, rankBased: boolean): boolean {
  if (rankBased) {
    return a.rankValue != null && b.rankValue != null;
  }
  return true;
}

function normalizePreconditionParam(command: string, paramIndex: number, value: string): string {
  const schema = PRECONDITION_COMMANDS.get(command);
  const paramType = schema?.params[paramIndex]?.type;
  return normalizeComparableValue(paramType, value);
}

function normalizeComparableValue(type: ParamDef['type'] | undefined, value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';

  switch (type) {
    case 'faction':
      return FACTION_ALIASES[trimmed.toLowerCase()] ?? trimmed.toLowerCase();
    default:
      return trimmed.toLowerCase();
  }
}

function normalizeParamValue(type: ParamDef['type'], value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;

  switch (type) {
    case 'faction':
      return KNOWN_FACTIONS.has(trimmed.toLowerCase()) ? (FACTION_ALIASES[trimmed.toLowerCase()] ?? trimmed.toLowerCase()) : null;
    case 'rank':
      return RANKS.includes(trimmed.toLowerCase() as typeof RANKS[number]) ? trimmed.toLowerCase() : null;
    case 'level':
      return KNOWN_LEVELS.has(trimmed) ? trimmed : null;
    case 'mutant_type':
      return MUTANT_TYPES.includes(trimmed.toLowerCase() as typeof MUTANT_TYPES[number]) ? trimmed.toLowerCase() : null;
    case 'smart_terrain':
      return isSmartTerrainPlaceholder(trimmed) || KNOWN_SMART_TERRAINS.has(trimmed) ? trimmed : null;
    default:
      return trimmed;
  }
}

function describeAllowedValues(type: ParamDef['type'], schemas: CommandSchema[]): string | null {
  switch (type) {
    case 'faction':
      return 'a known faction id';
    case 'rank':
      return RANKS.join(', ');
    case 'level':
      return 'a known level key';
    case 'mutant_type':
      return MUTANT_TYPES.join(', ');
    case 'smart_terrain':
      return 'a known smart terrain id or %level_panda_st_key% placeholder';
    case 'slot':
      return 'a slot between 0 and 12';
    case 'string':
      if (schemas.some(schema => schema.name === 'recruit_companion')) {
        return null;
      }
      return null;
    default:
      return null;
  }
}

function parseStrictNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === '' || !/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStrictInteger(value: string | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === '' || !/^-?\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

function rankIndex(value: string): number | undefined {
  const index = RANKS.indexOf(value.trim().toLowerCase() as typeof RANKS[number]);
  return index >= 0 ? index : undefined;
}

function isSmartTerrainPlaceholder(value: string): boolean {
  return /^%[a-z0-9_]+_panda_st(?:_key)?%$/i.test(value);
}

function formatPrecondition(command: string, params: string[], polarity: FlattenedPrecondition['polarity']): string {
  const schema = findSchema(PRECONDITION_SCHEMAS, command);
  const base = schema?.label ?? command;
  const suffix = params.filter(Boolean).join(' : ');
  return `${polarity === 'negative' ? 'NOT ' : ''}${base}${suffix ? ` : ${suffix}` : ''}`;
}

function pushMessage(messages: ValidationMessage[], message: ValidationMessage): void {
  messages.push(message);
}
