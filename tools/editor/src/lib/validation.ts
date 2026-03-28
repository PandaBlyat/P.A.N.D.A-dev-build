// P.A.N.D.A. Conversation Editor — Validation Engine

import { ALL_SMART_TERRAIN_IDS, FACTION_ALIASES, FACTION_IDS, LEVEL_DISPLAY_NAMES, MUTANT_TYPES, RANKS } from './constants';
import { findSchema, OUTCOME_SCHEMAS, PRECONDITION_SCHEMAS } from './schema';
import { createTurnDisplayLabeler } from './turn-labels';
import { STORY_NPC_OPTIONS } from './generated/story-npc-catalog';
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
const KNOWN_SMART_TERRAINS = new Set(ALL_SMART_TERRAIN_IDS);
const KNOWN_FACTIONS = new Set([...FACTION_IDS, ...Object.keys(FACTION_ALIASES)]);
const KNOWN_STORY_NPCS = new Set(STORY_NPC_OPTIONS.map((option) => option.value));
const SPAWN_JOB_OUTCOMES = new Set([
  'spawn_hostile',
  'spawn_friendly',
  'spawn_npc',
  'spawn_mutant',
  'spawn_hostile_at_smart',
  'spawn_mutant_at_smart',
  'spawn_companion',
]);

/** Task outcome commands that have success_turn and fail_turn params (value = [successParamIndex, failParamIndex, timeoutParamIndex]). */
const TASK_OUTCOME_TURN_INDICES: Record<string, [number, number, number]> = {
  'panda_task_delivery':  [3, 4, 2],
  'panda_task_fetch':     [3, 4, 2],
  'panda_task_bounty':    [4, 5, 3],
  'panda_task_dead_drop': [3, 4, 2],
  'panda_task_artifact':  [4, 5, 3],
  'panda_task_escort':    [2, 3, 1],
  'panda_task_eliminate': [4, 5, 3],
};
const TASK_OUTCOME_COMMANDS = new Set(Object.keys(TASK_OUTCOME_TURN_INDICES));
const ANOMALY_ARTIFACT_OUTCOMES = new Set([
  'start_anomaly_scan_task',
  'start_artifact_retrieval_task',
  'spawn_artifact_on_npc',
  'spawn_artifact_in_zone',
  'require_detector_tier',
  'turn_in_artifact',
  'set_anomaly_target',
  'fail_if_artifact_lost',
]);
const ANOMALY_TASK_ID_OUTCOMES = new Set([
  'start_anomaly_scan_task',
  'start_artifact_retrieval_task',
  'spawn_artifact_on_npc',
  'spawn_artifact_in_zone',
  'turn_in_artifact',
  'set_anomaly_target',
  'fail_if_artifact_lost',
]);
const ANOMALY_TASK_START_OUTCOMES = new Set([
  'start_anomaly_scan_task',
  'start_artifact_retrieval_task',
]);
const MAX_ANOMALY_TASK_STARTS_PER_CONVERSATION = 3;
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
type TurnField = 'opening-message' | 'channel' | 'pda-entry' | 'f2f-entry' | 'npc-open-key' | 'requires-npc-first';
type ChoiceField =
  | 'text'
  | 'reply'
  | 'reply-rel-high'
  | 'reply-rel-low'
  | 'channel'
  | 'terminal'
  | 'continue-to'
  | 'continue-channel'
  | 'story-npc-id'
  | 'npc-faction-filters'
  | 'npc-profile-filters'
  | 'allow-generic-stalker';

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

  validateConversationPreconditionLogic(conv, messages);
  validateConversationAnomalyArtifactSafety(conv, messages);
  validateConversationF2FAndChannelFlow(conv, messages);

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
  const turnLabels = createTurnDisplayLabeler(conv);

  for (const turn of conv.turns) {
    validateTurn(conv, turn, turnNumbers, turnLabels, messages);
  }

  if (conv.turns.length > 1) {
    validateReachability(conv, turnNumbers, turnLabels, messages);
  }
}

function validateConversationAnomalyArtifactSafety(conv: Conversation, messages: ValidationMessage[]): void {
  const runtimeTaskIds = new Map<string, { turnNumber: number; choiceIndex: number; outcomeIndex: number }>();
  let starts = 0;

  conv.turns.forEach((turn) => {
    turn.choices.forEach((choice) => {
      choice.outcomes.forEach((outcome, outcomeIndex) => {
        if (!ANOMALY_ARTIFACT_OUTCOMES.has(outcome.command)) {
          return;
        }

        if (ANOMALY_TASK_START_OUTCOMES.has(outcome.command)) {
          starts += 1;
        }

        if (ANOMALY_TASK_ID_OUTCOMES.has(outcome.command)) {
          const taskId = (outcome.params[0] ?? '').trim();
          if (!taskId) {
            return;
          }

          const existing = runtimeTaskIds.get(taskId);
          if (existing) {
            pushMessage(messages, {
              code: 'duplicate-anomaly-task-id',
              group: 'logic',
              scope: 'outcome',
              level: 'error',
              conversationId: conv.id,
              turnNumber: turn.turnNumber,
              choiceIndex: choice.index,
              outcomeIndex,
              propertiesTab: 'selection',
              fieldKey: getOutcomeParamFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex, 0),
              fieldLabel: 'Runtime Task ID',
              message: `Duplicate runtime task ID "${taskId}". Already used by Branch ${existing.turnNumber}, choice ${existing.choiceIndex}, outcome ${existing.outcomeIndex + 1}.`,
            });
            return;
          }

          runtimeTaskIds.set(taskId, { turnNumber: turn.turnNumber, choiceIndex: choice.index, outcomeIndex });
        }
      });
    });
  });

  if (starts > MAX_ANOMALY_TASK_STARTS_PER_CONVERSATION) {
    pushMessage(messages, {
      code: 'too-many-anomaly-task-starts',
      group: 'logic',
      scope: 'conversation',
      level: 'warning',
      conversationId: conv.id,
      propertiesTab: 'conversation',
      message: `This conversation starts ${starts} anomaly/artifact tasks. Recommended maximum is ${MAX_ANOMALY_TASK_STARTS_PER_CONVERSATION}.`,
    });
  }
}

function validateTurn(
  conv: Conversation,
  turn: Conversation['turns'][number],
  turnNumbers: Set<number>,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
  messages: ValidationMessage[],
): void {
  for (const warning of turn.migrationWarnings ?? []) {
    pushMessage(messages, {
      code: 'legacy-f2f-opening-migration-warning',
      group: 'logic',
      scope: 'turn',
      level: 'warning',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      propertiesTab: 'selection',
      fieldKey: getTurnFieldKey(conv.id, turn.turnNumber, 'opening-message'),
      fieldLabel: 'Opening Message',
      message: `${turnLabels.getLongLabel(turn.turnNumber)}: ${warning}`,
    });
  }

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

  // ── Validate pause_job and panda_task_* turn references & timeout ──

  const taskIndices = TASK_OUTCOME_TURN_INDICES[outcome.command];
  const isPauseJob = outcome.command === 'pause_job';
  const isTask = taskIndices != null;

  if (!isPauseJob && !isTask) {
    return;
  }

  // Resolve param indices for success_turn, fail_turn, timeout
  const successIdx = isPauseJob ? 1 : taskIndices![0];
  const failIdx    = isPauseJob ? 2 : taskIndices![1];
  const timeoutIdx = isPauseJob ? 0 : taskIndices![2];
  const cmdLabel = outcome.command;

  const timeout = parseStrictNumber(outcome.params[timeoutIdx]);
  const successTurn = parseStrictInteger(outcome.params[successIdx]);
  const failTurn = parseStrictInteger(outcome.params[failIdx]);

  if (successTurn != null && !turnNumbers.has(successTurn)) {
    pushMessage(messages, {
      code: 'job-missing-success-turn',
      group: 'structure',
      scope: 'outcome',
      level: 'error',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
      fieldKey: getOutcomeParamFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex, successIdx),
      fieldLabel: 'Success Turn',
      message: `${cmdLabel} references success ${turnLabels.getLongLabel(successTurn)} which does not exist.`,
    });
  }

  if (failTurn != null && !turnNumbers.has(failTurn)) {
    pushMessage(messages, {
      code: 'job-missing-fail-turn',
      group: 'structure',
      scope: 'outcome',
      level: 'error',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
      fieldKey: getOutcomeParamFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex, failIdx),
      fieldLabel: 'Fail Turn',
      message: `${cmdLabel} references fail ${turnLabels.getLongLabel(failTurn)} which does not exist.`,
    });
  }

  if (successTurn != null && failTurn != null && successTurn === failTurn) {
    pushMessage(messages, {
      code: 'job-identical-branches',
      group: 'logic',
      scope: 'outcome',
      level: 'warning',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
      fieldKey: getOutcomeItemFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex),
      message: `${cmdLabel} sends both success and fail to the same turn, which is probably not intended.`,
    });
  }

  if (timeout != null && timeout < 5) {
    pushMessage(messages, {
      code: 'job-short-timeout',
      group: 'logic',
      scope: 'outcome',
      level: 'warning',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      outcomeIndex,
      propertiesTab: 'selection',
      fieldKey: getOutcomeParamFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex, timeoutIdx),
      fieldLabel: 'Timeout (s)',
      message: `${cmdLabel} timeout is very short and may complete before the player can act.`,
    });
  }

  // pause_job-specific checks
  if (isPauseJob) {
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

  // Task-specific: warn if multiple task outcomes on same choice
  if (isTask) {
    const taskCount = choice.outcomes.filter(item => TASK_OUTCOME_COMMANDS.has(item.command)).length;
    if (taskCount > 1) {
      pushMessage(messages, {
        code: 'task-multiple',
        group: 'logic',
        scope: 'outcome',
        level: 'warning',
        conversationId: conv.id,
        turnNumber: turn.turnNumber,
        choiceIndex: choice.index,
        outcomeIndex,
        propertiesTab: 'selection',
        fieldKey: getOutcomeItemFieldKey(conv.id, turn.turnNumber, choice.index, outcomeIndex),
        message: 'Multiple task outcomes exist on this choice; only one task per choice is expected.',
      });
    }
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
        // Resolve success/fail turn indices for pause_job and panda_task_* commands
        let sIdx: number | undefined;
        let fIdx: number | undefined;
        if (outcome.command === 'pause_job') {
          sIdx = 1;
          fIdx = 2;
        } else {
          const ti = TASK_OUTCOME_TURN_INDICES[outcome.command];
          if (ti) {
            sIdx = ti[0];
            fIdx = ti[1];
          }
        }
        if (sIdx == null) continue;

        const successTurn = parseStrictInteger(outcome.params[sIdx]);
        const failTurn = parseStrictInteger(outcome.params[fIdx!]);
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

function validateConversationF2FAndChannelFlow(conv: Conversation, messages: ValidationMessage[]): void {
  const turnByNumber = new Map(conv.turns.map((turn) => [turn.turnNumber, turn]));
  const requiredF2FOpeningTurns = new Set<number>();

  for (const turn of conv.turns) {
    const turnChannel = normalizeChannel(turn.channel, 'pda');
    if (turnChannel === 'f2f' && (turn.npcOpenKey ?? '').trim() === '') {
      pushMessage(messages, {
        code: 'missing-f2f-npc-open-key',
        group: 'structure',
        scope: 'turn',
        level: 'error',
        conversationId: conv.id,
        turnNumber: turn.turnNumber,
        propertiesTab: 'selection',
        fieldKey: getTurnFieldKey(conv.id, turn.turnNumber, 'npc-open-key'),
        fieldLabel: 'NPC Open Key',
        message: `Branch ${turn.turnNumber} is an F2F turn and must define npcOpenKey.`,
      });
    }
    const f2fVisibleChoices = turn.choices.filter((choice) => isChannelVisible(normalizeChannel(choice.channel, 'pda'), 'f2f'));
    if (turn.f2f_entry === true) {
      requiredF2FOpeningTurns.add(turn.turnNumber);
    }

    for (const choice of turn.choices) {
      const terminal = choice.terminal;
      if (typeof terminal !== 'boolean') {
        pushMessage(messages, {
          code: 'missing-choice-terminal-flag',
          group: 'schema',
          scope: 'choice',
          level: 'error',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          propertiesTab: 'selection',
          fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'terminal'),
          fieldLabel: 'Terminal Choice',
          message: `Branch ${turn.turnNumber}, Choice ${choice.index} is missing the explicit terminal flag.`,
        });
      }

      const continueChannelRaw = choice.continueChannel ?? choice.continue_channel;
      if (continueChannelRaw != null && !isStrictChannel(continueChannelRaw)) {
        pushMessage(messages, {
          code: 'invalid-continue-channel',
          group: 'schema',
          scope: 'choice',
          level: 'error',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          propertiesTab: 'selection',
          fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-channel'),
          fieldLabel: 'Continue Channel',
          message: `Branch ${turn.turnNumber}, Choice ${choice.index} has invalid continuation channel "${String(continueChannelRaw)}". Use only "pda" or "f2f".`,
        });
      }

      const choiceChannel = normalizeChannel(choice.channel, 'pda');
      const continueChannel = normalizeChannel(continueChannelRaw, 'pda');

      if (terminal !== true && choice.continueTo == null) {
        pushMessage(messages, {
          code: 'missing-choice-continue-to',
          group: 'structure',
          scope: 'choice',
          level: 'error',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          propertiesTab: 'selection',
          fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-to'),
          fieldLabel: 'Continue To Turn',
          message: `Branch ${turn.turnNumber}, Choice ${choice.index} must define continueTo when terminal is false.`,
        });
      }

      if (terminal !== true && continueChannelRaw == null) {
        pushMessage(messages, {
          code: 'missing-choice-continue-channel',
          group: 'structure',
          scope: 'choice',
          level: 'error',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          propertiesTab: 'selection',
          fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-channel'),
          fieldLabel: 'Continue Channel',
          message: `Branch ${turn.turnNumber}, Choice ${choice.index} must define continueChannel when terminal is false.`,
        });
      }

      if (!isChannelVisible(choiceChannel, 'f2f')) {
        if ((choice.story_npc_id ?? '').trim() !== '' || (choice.npc_faction_filters?.length ?? 0) > 0 || (choice.npc_profile_filters?.length ?? 0) > 0 || choice.allow_generic_stalker) {
          pushMessage(messages, {
            code: 'f2f-targeting-on-non-f2f-choice',
            group: 'logic',
            scope: 'choice',
            level: 'warning',
            conversationId: conv.id,
            turnNumber: turn.turnNumber,
            choiceIndex: choice.index,
            propertiesTab: 'selection',
            fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'channel'),
            fieldLabel: 'Choice Channel',
            message: `Branch ${turn.turnNumber}, Choice ${choice.index} is not visible in F2F, so NPC targeting filters will not be used.`,
          });
        }
      } else {
        validateF2FTargeting(conv, turn, choice, messages);
      }

      if (terminal === true || choice.continueTo == null) {
        continue;
      }

      const targetTurn = turnByNumber.get(choice.continueTo);
      if (!targetTurn) {
        continue;
      }

      if (!isCrossChannelHandoff(choiceChannel, continueChannel)) {
        continue;
      }

      const destinationChannel: 'pda' | 'f2f' = continueChannel === 'f2f' ? 'f2f' : 'pda';

      if (!isChannelVisible(normalizeChannel(targetTurn.channel, 'pda'), destinationChannel)) {
        pushMessage(messages, {
          code: 'handoff-target-hidden-channel',
          group: 'structure',
          scope: 'choice',
          level: 'error',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          propertiesTab: 'selection',
          fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-to'),
          fieldLabel: 'Continue To Turn',
          message: `Cross-channel handoff to Branch ${choice.continueTo} is invalid: target turn is not visible on ${destinationChannel.toUpperCase()}.`,
        });
      }

      const hasEntry = destinationChannel === 'pda'
        ? targetTurn.pda_entry === true
        : targetTurn.f2f_entry === true;
      if (!hasEntry) {
        pushMessage(messages, {
          code: 'handoff-target-not-entry',
          group: 'structure',
          scope: 'choice',
          level: 'error',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          propertiesTab: 'selection',
          fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'continue-to'),
          fieldLabel: 'Continue To Turn',
          message: `Cross-channel handoff to Branch ${choice.continueTo} is invalid: target is not marked as a ${destinationChannel.toUpperCase()} entry turn.`,
        });
      }

      if (destinationChannel === 'f2f' && hasEntry) {
        requiredF2FOpeningTurns.add(targetTurn.turnNumber);
      }
    }

    if (turnChannel === 'f2f' && turn.f2f_entry === true && f2fVisibleChoices.length > 0) {
      const hasF2FExit = f2fVisibleChoices.some((choice) => {
        const continueTo = choice.continueTo;
        if (continueTo != null) {
          return true;
        }
        return choice.outcomes.some((outcome) => {
          if (outcome.command === 'pause_job') {
            return parseStrictInteger(outcome.params[1]) != null || parseStrictInteger(outcome.params[2]) != null;
          }
          const task = TASK_OUTCOME_TURN_INDICES[outcome.command];
          return task != null && (parseStrictInteger(outcome.params[task[0]]) != null || parseStrictInteger(outcome.params[task[1]]) != null);
        });
      });

      if (!hasF2FExit) {
        pushMessage(messages, {
          code: 'forced-f2f-dead-end',
          group: 'logic',
          scope: 'turn',
          level: 'error',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          propertiesTab: 'selection',
          fieldKey: getTurnFieldKey(conv.id, turn.turnNumber, 'opening-message'),
          fieldLabel: 'Opening Message',
          message: `Branch ${turn.turnNumber} is a forced F2F entry with no exit path (no continuation or task resume turn).`,
        });
      }
    }
  }

  for (const turnNumber of requiredF2FOpeningTurns) {
    const turn = turnByNumber.get(turnNumber);
    if (!turn) continue;
    if ((turn.openingMessage ?? '').trim() !== '') continue;

    pushMessage(messages, {
      code: 'missing-f2f-opening-message',
      group: 'structure',
      scope: 'turn',
      level: 'error',
      conversationId: conv.id,
      turnNumber,
      propertiesTab: 'selection',
      fieldKey: getTurnFieldKey(conv.id, turnNumber, 'opening-message'),
      fieldLabel: 'Opening Message',
      message: `Branch ${turnNumber} is required for F2F entry turns and must have an opening message.`,
    });
  }
}

function validateF2FTargeting(conv: Conversation, turn: Conversation['turns'][number], choice: Choice, messages: ValidationMessage[]): void {
  const storyNpc = (choice.story_npc_id ?? '').trim();
  const factionFilters = choice.npc_faction_filters ?? [];
  const profileFilters = choice.npc_profile_filters?.map((filter) => filter.trim()).filter(Boolean) ?? [];
  const broadScope = choice.allow_generic_stalker === true;
  const hasSpecificFilters = storyNpc !== '' || factionFilters.length > 0 || profileFilters.length > 0;

  if (!hasSpecificFilters && !broadScope) {
    pushMessage(messages, {
      code: 'f2f-missing-targeting',
      group: 'logic',
      scope: 'choice',
      level: 'error',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      propertiesTab: 'selection',
      fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'story-npc-id'),
      fieldLabel: 'Story NPC',
      message: `Branch ${turn.turnNumber}, Choice ${choice.index} is visible in F2F but has no NPC target filters and no broad-scope fallback.`,
    });
  }

  if (storyNpc !== '' && !KNOWN_STORY_NPCS.has(storyNpc)) {
    pushMessage(messages, {
      code: 'f2f-unknown-story-npc',
      group: 'schema',
      scope: 'choice',
      level: 'error',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      propertiesTab: 'selection',
      fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'story-npc-id'),
      fieldLabel: 'Story NPC',
      message: `Unknown story NPC "${storyNpc}" for F2F targeting.`,
    });
  }

  if (storyNpc !== '' && (factionFilters.length > 0 || profileFilters.length > 0 || broadScope)) {
    pushMessage(messages, {
      code: 'f2f-ambiguous-targeting',
      group: 'logic',
      scope: 'choice',
      level: 'warning',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      propertiesTab: 'selection',
      fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'story-npc-id'),
      fieldLabel: 'Story NPC',
      message: `Story NPC target is combined with broader sim-NPC filters, which can make F2F selection ambiguous.`,
    });
  }

  if (factionFilters.length === 0 && profileFilters.length > 0 && !broadScope && storyNpc === '') {
    pushMessage(messages, {
      code: 'f2f-profile-filter-without-scope',
      group: 'logic',
      scope: 'choice',
      level: 'warning',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      propertiesTab: 'selection',
      fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'npc-profile-filters'),
      fieldLabel: 'NPC Profile Filters',
      message: 'Profile-only targeting may match multiple sim NPCs. Consider setting Story NPC, faction filters, or broad scope explicitly.',
    });
  }

  if (factionFilters.length > 0 && storyNpc !== '') {
    pushMessage(messages, {
      code: 'f2f-impossible-filter-combo',
      group: 'logic',
      scope: 'choice',
      level: 'error',
      conversationId: conv.id,
      turnNumber: turn.turnNumber,
      choiceIndex: choice.index,
      propertiesTab: 'selection',
      fieldKey: getChoiceFieldKey(conv.id, turn.turnNumber, choice.index, 'npc-faction-filters'),
      fieldLabel: 'NPC Faction Filters',
      message: 'Story NPC targeting cannot be combined with faction filters. This filter combo is not resolvable.',
    });
  }
}

function normalizeChannel(
  channel: Conversation['turns'][number]['channel'] | Choice['channel'] | Choice['continue_channel'] | Choice['continueChannel'] | undefined,
  fallback: 'pda' | 'f2f',
): 'pda' | 'f2f' {
  if (channel === 'pda' || channel === 'f2f') {
    return channel;
  }
  return fallback;
}

function isStrictChannel(channel: unknown): channel is 'pda' | 'f2f' {
  return channel === 'pda' || channel === 'f2f';
}

function isChannelVisible(value: 'pda' | 'f2f', target: 'pda' | 'f2f'): boolean {
  return value === target;
}

function isCrossChannelHandoff(from: 'pda' | 'f2f', to: 'pda' | 'f2f'): boolean {
  return (from === 'pda' && to === 'f2f') || (from === 'f2f' && to === 'pda');
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
    case 'story_npc':
      return KNOWN_STORY_NPCS.has(trimmed) ? trimmed : null;
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
    case 'story_npc':
      return 'a known story NPC id';
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
