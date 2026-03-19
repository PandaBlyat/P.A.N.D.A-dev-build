// P.A.N.D.A. Conversation Editor — Validation Engine

import type { Project, Conversation, ValidationMessage } from './types';

/** Validate the entire project and return all messages */
export function validate(project: Project): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  // Check for sequential ID gaps
  const ids = project.conversations.map(c => c.id).sort((a, b) => a - b);
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] !== i + 1) {
      messages.push({
        level: 'error',
        conversationId: ids[i],
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
  // Must have preconditions
  if (conv.preconditions.length === 0) {
    messages.push({
      level: 'error',
      conversationId: conv.id,
      message: 'Missing preconditions. Every conversation must have at least one precondition.',
    });
  }

  // Must have at least turn 1
  if (conv.turns.length === 0) {
    messages.push({
      level: 'error',
      conversationId: conv.id,
      message: 'No turns defined.',
    });
    return;
  }

  const turn1 = conv.turns.find(t => t.turnNumber === 1);
  if (!turn1) {
    messages.push({
      level: 'error',
      conversationId: conv.id,
      message: 'Missing Turn 1.',
    });
    return;
  }

  // Turn 1 must have opening message
  if (!turn1.openingMessage || turn1.openingMessage.trim() === '') {
    messages.push({
      level: 'error',
      conversationId: conv.id,
      turnNumber: 1,
      message: 'Turn 1 is missing an opening message.',
    });
  }

  // Validate each turn
  const turnNumbers = new Set(conv.turns.map(t => t.turnNumber));

  for (const turn of conv.turns) {
    // Must have at least one choice
    if (turn.choices.length === 0) {
      messages.push({
        level: 'error',
        conversationId: conv.id,
        turnNumber: turn.turnNumber,
        message: `Turn ${turn.turnNumber} has no choices.`,
      });
      continue;
    }

    for (const choice of turn.choices) {
      // Choice text required
      if (!choice.text || choice.text.trim() === '') {
        messages.push({
          level: 'error',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          message: `Turn ${turn.turnNumber}, Choice ${choice.index}: Missing choice text.`,
        });
      }

      // Reply required
      if (!choice.reply || choice.reply.trim() === '') {
        messages.push({
          level: 'error',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          message: `Turn ${turn.turnNumber}, Choice ${choice.index}: Missing reply text.`,
        });
      }

      // Continuation must point to existing turn
      if (choice.continueTo != null && !turnNumbers.has(choice.continueTo)) {
        messages.push({
          level: 'error',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          message: `Turn ${turn.turnNumber}, Choice ${choice.index}: Continues to Turn ${choice.continueTo} which does not exist.`,
        });
      }

      // Validate pause_job outcomes
      for (const outcome of choice.outcomes) {
        if (outcome.command === 'pause_job') {
          const successTurn = parseInt(outcome.params[1], 10);
          const failTurn = parseInt(outcome.params[2], 10);
          if (!turnNumbers.has(successTurn)) {
            messages.push({
              level: 'error',
              conversationId: conv.id,
              turnNumber: turn.turnNumber,
              choiceIndex: choice.index,
              message: `pause_job references success Turn ${successTurn} which does not exist.`,
            });
          }
          if (!turnNumbers.has(failTurn)) {
            messages.push({
              level: 'error',
              conversationId: conv.id,
              turnNumber: turn.turnNumber,
              choiceIndex: choice.index,
              message: `pause_job references fail Turn ${failTurn} which does not exist.`,
            });
          }
        }
      }
    }
  }

  // Check for orphaned turns (not reachable from turn 1)
  if (conv.turns.length > 1) {
    const reachable = new Set<number>();
    reachable.add(1);
    const queue = [1];
    while (queue.length > 0) {
      const tn = queue.pop()!;
      const turn = conv.turns.find(t => t.turnNumber === tn);
      if (!turn) continue;
      for (const choice of turn.choices) {
        if (choice.continueTo != null && !reachable.has(choice.continueTo)) {
          reachable.add(choice.continueTo);
          queue.push(choice.continueTo);
        }
        // Also check pause_job targets
        for (const outcome of choice.outcomes) {
          if (outcome.command === 'pause_job') {
            const st = parseInt(outcome.params[1], 10);
            const ft = parseInt(outcome.params[2], 10);
            if (!isNaN(st) && !reachable.has(st)) { reachable.add(st); queue.push(st); }
            if (!isNaN(ft) && !reachable.has(ft)) { reachable.add(ft); queue.push(ft); }
          }
        }
      }
    }

    for (const turn of conv.turns) {
      if (!reachable.has(turn.turnNumber)) {
        messages.push({
          level: 'warning',
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          message: `Turn ${turn.turnNumber} is unreachable from Turn 1.`,
        });
      }
    }
  }
}
