import type { Outcome } from './types';

const TASK_OUTCOME_TURN_INDICES: Record<string, [number, number, number]> = {
  panda_task_delivery: [2, 3, 1],
  panda_task_fetch: [3, 4, 2],
  panda_task_bounty: [4, 5, 3],
  panda_task_dead_drop: [3, 4, 2],
  panda_task_artifact: [3, 4, 2],
  panda_task_escort: [2, 3, 1],
  panda_task_eliminate: [4, 5, 3],
  panda_task_rescue: [5, 6, 4],
};

export type OutcomeResumeBranchKind = 'pause' | 'task' | 'check';

export function isTaskOutcomeCommand(command: string): boolean {
  return Object.prototype.hasOwnProperty.call(TASK_OUTCOME_TURN_INDICES, command);
}

export function isCheckOutcomeCommand(command: string): boolean {
  return command === 'dialogue_skill_check' || command === 'random_chance_check';
}

export function getOutcomeResumeTurnParamIndices(
  command: string,
): { successIndex: number; failIndex: number; timeoutIndex: number; kind: OutcomeResumeBranchKind } | null {
  if (command === 'pause_job') {
    return {
      successIndex: 1,
      failIndex: 2,
      timeoutIndex: 0,
      kind: 'pause',
    };
  }

  if (command === 'dialogue_skill_check') {
    // params: stat_key, difficulty, success_turn, fail_turn
    return {
      successIndex: 2,
      failIndex: 3,
      timeoutIndex: -1,
      kind: 'check',
    };
  }

  if (command === 'random_chance_check') {
    // params: chance_percent, success_turn, fail_turn
    return {
      successIndex: 1,
      failIndex: 2,
      timeoutIndex: -1,
      kind: 'check',
    };
  }

  const taskIndices = TASK_OUTCOME_TURN_INDICES[command];
  if (!taskIndices) return null;

  return {
    successIndex: taskIndices[0],
    failIndex: taskIndices[1],
    timeoutIndex: taskIndices[2],
    kind: 'task',
  };
}

export function parseOutcomeResumeTurnNumbers(
  outcome: Outcome,
): { successTurn: number | null; failTurn: number | null; kind: OutcomeResumeBranchKind } | null {
  const indices = getOutcomeResumeTurnParamIndices(outcome.command);
  if (!indices) return null;

  return {
    successTurn: parseInteger(outcome.params[indices.successIndex]),
    failTurn: parseInteger(outcome.params[indices.failIndex]),
    kind: indices.kind,
  };
}

function parseInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
