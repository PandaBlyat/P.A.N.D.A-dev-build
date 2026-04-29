import type { Choice, Conversation, PreconditionEntry, SimplePrecondition, Turn } from './types';
import { parseOutcomeResumeTurnNumbers } from './outcome-branching';

function normalizeChannel(value: Choice['channel'] | Choice['continueChannel'] | Turn['channel'] | undefined, fallback: 'pda' | 'f2f'): 'pda' | 'f2f' {
  return value === 'f2f' ? 'f2f' : value === 'pda' ? 'pda' : fallback;
}

export function hasNewNpcContinuation(choice: Choice): boolean {
  return (choice.cont_npc_id ?? '').trim() !== ''
    || choice.allow_generic_stalker === true
    || (choice.npc_faction_filters?.length ?? 0) > 0
    || (choice.npc_profile_filters?.length ?? 0) > 0;
}

export function hasBranchSpeakerTargeting(turn: Turn | undefined): boolean {
  if (!turn) return false;
  return (turn.speaker_npc_id ?? '').trim() !== ''
    || turn.speaker_allow_generic_stalker === true
    || (turn.speaker_npc_faction_filters?.length ?? 0) > 0;
}

export function preconditionsHaveNpcTargeting(entries: readonly PreconditionEntry[] | undefined): boolean {
  if (!entries) return false;
  return entries.some((entry) => preconditionHasNpcTargeting(entry));
}

function preconditionHasNpcTargeting(entry: PreconditionEntry): boolean {
  if (entry.type === 'simple') {
    return isNpcTargetingCommand(entry);
  }
  if (entry.type === 'not') {
    return false;
  }
  if (entry.type === 'any') {
    return entry.options.some((option) => {
      if (option.type === 'all') {
        return option.entries.some(preconditionHasNpcTargeting);
      }
      return preconditionHasNpcTargeting(option);
    });
  }
  return false;
}

function isNpcTargetingCommand(entry: SimplePrecondition): boolean {
  return entry.command === 'req_npc_friendly'
    || entry.command === 'req_npc_faction'
    || entry.command === 'req_story_npc'
    || entry.command === 'req_custom_story_npc';
}

export function choiceRequiresContinuationOpener(
  conv: Conversation,
  sourceTurn: Turn,
  choice: Choice,
  targetTurn?: Turn,
): boolean {
  if (choice.terminal === true || choice.continueTo == null) return false;
  const sourceChannel = normalizeChannel(sourceTurn.channel, normalizeChannel(conv.initialChannel, 'pda'));
  const continueChannel = normalizeChannel(choice.continueChannel ?? choice.continue_channel, sourceChannel);
  return sourceChannel !== continueChannel
    || hasNewNpcContinuation(choice)
    || hasBranchSpeakerTargeting(targetTurn);
}

export function collectSegmentStartTurns(conv: Conversation): Set<number> {
  const segmentStarts = new Set<number>();
  const turnByNumber = new Map(conv.turns.map((turn) => [turn.turnNumber, turn] as const));

  const firstPdaEntryTurn = conv.turns
    .filter((turn) => normalizeChannel(turn.channel, 'pda') === 'pda' && turn.pda_entry === true)
    .sort((a, b) => a.turnNumber - b.turnNumber)[0];
  if (firstPdaEntryTurn) {
    segmentStarts.add(firstPdaEntryTurn.turnNumber);
  } else if (turnByNumber.has(1)) {
    segmentStarts.add(1);
  }

  const firstF2FEntryTurn = conv.turns
    .filter((turn) => normalizeChannel(turn.channel, 'pda') === 'f2f' && turn.f2f_entry === true)
    .sort((a, b) => a.turnNumber - b.turnNumber)[0];
  if (firstF2FEntryTurn) {
    segmentStarts.add(firstF2FEntryTurn.turnNumber);
  }

  for (const turn of conv.turns) {
    for (const choice of turn.choices) {
      if (choice.terminal === true || choice.continueTo == null) continue;
      const targetTurn = turnByNumber.get(choice.continueTo);
      if (!targetTurn) continue;
      if (choiceRequiresContinuationOpener(conv, turn, choice, targetTurn)) {
        segmentStarts.add(choice.continueTo);
      }
    }

    for (const choice of turn.choices) {
      for (const outcome of choice.outcomes) {
        const resumeTargets = parseOutcomeResumeTurnNumbers(outcome);
        if (!resumeTargets) continue;
        if (resumeTargets.successTurn != null && turnByNumber.has(resumeTargets.successTurn)) {
          segmentStarts.add(resumeTargets.successTurn);
        }
        if (resumeTargets.failTurn != null && turnByNumber.has(resumeTargets.failTurn)) {
          segmentStarts.add(resumeTargets.failTurn);
        }
      }
    }
  }

  return segmentStarts;
}
