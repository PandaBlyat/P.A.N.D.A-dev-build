import type { Project, Turn } from './types';

export const F2F_ENTRY_OPENING_SENTINEL = '__PANDA_F2F_ENTRY_STARTER__';

export const LEGACY_F2F_OPENING_WARNINGS = new Set([
  'Legacy F2F _open text found, but choice_1 is missing; NPC text could not be auto-mapped to reply_1.',
  'Legacy F2F _open text and reply_1 were both populated; kept existing reply_1 and preserved legacy text only in migration history.',
]);

function sanitizeLegacyF2FOpeningArtifacts(turn: Turn): Turn {
  let changed = false;
  const nextTurn: Turn = { ...turn };

  if (nextTurn.openingMessage === F2F_ENTRY_OPENING_SENTINEL) {
    nextTurn.openingMessage = '';
    changed = true;
  }

  if (nextTurn.openingMessagePlaceholder != null) {
    delete nextTurn.openingMessagePlaceholder;
    changed = true;
  }

  if ((nextTurn.migrationWarnings?.length ?? 0) > 0) {
    const filteredWarnings = nextTurn.migrationWarnings?.filter((warning) => !LEGACY_F2F_OPENING_WARNINGS.has(warning)) ?? [];
    if (filteredWarnings.length !== (nextTurn.migrationWarnings?.length ?? 0)) {
      nextTurn.migrationWarnings = filteredWarnings.length > 0 ? filteredWarnings : undefined;
      changed = true;
    }
  }

  return changed ? nextTurn : turn;
}

/**
 * Historical cleanup pass for editor data polluted by the retired legacy F2F opener migration.
 *
 * Authored F2F `_open` text is now preserved as-is, so this pass only removes old sentinel,
 * placeholder, and warning artifacts from previously migrated editor data.
 */
export function migrateLegacyF2FEntryOpenings(project: Project): Project {
  let touched = false;
  const conversations = project.conversations.map((conversation) => {
    let conversationTouched = false;
    const turns = conversation.turns.map((turn) => {
      const sanitizedTurn = sanitizeLegacyF2FOpeningArtifacts(turn);
      if (sanitizedTurn !== turn) {
        touched = true;
        conversationTouched = true;
      }
      return sanitizedTurn;
    });

    if (!conversationTouched) {
      return conversation;
    }

    return {
      ...conversation,
      turns,
    };
  });

  if (!touched) {
    return project;
  }

  return {
    ...project,
    conversations,
  };
}
