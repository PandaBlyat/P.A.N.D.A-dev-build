import type { Project, Turn } from './types';

export const LEGACY_F2F_OPENING_MIGRATION_VERSION = '2.1.0';
export const F2F_ENTRY_OPENING_SENTINEL = '__PANDA_F2F_ENTRY_STARTER__';

function hasAuthoredOpening(turn: Turn): boolean {
  return typeof turn.openingMessage === 'string'
    && turn.openingMessage.trim().length > 0
    && turn.openingMessage !== F2F_ENTRY_OPENING_SENTINEL;
}

function isVersionAtLeast(current: string | undefined, minimum: string): boolean {
  if (!current) return false;
  const a = current.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const b = minimum.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return true;
}

/**
 * Migration pass for legacy F2F-entry authored `_open` text.
 *
 * Rules:
 * - For F2F entry turns with non-empty authored opening text, move text to reply_1 if reply_1 is empty.
 * - Always replace opening text with a starter sentinel.
 * - Flag ambiguous/conflicting cases as non-blocking migration warnings.
 * - Bump schema version when migration has run so we do not repeatedly reprocess legacy data.
 */
export function migrateLegacyF2FEntryOpenings(project: Project): Project {
  if (isVersionAtLeast(project.version, LEGACY_F2F_OPENING_MIGRATION_VERSION)) {
    return project;
  }

  let touched = false;
  const conversations = project.conversations.map((conversation) => {
    const turns = conversation.turns.map((turn) => {
      if (turn.f2f_entry !== true || !hasAuthoredOpening(turn)) {
        return turn;
      }

      touched = true;
      const migratedWarnings = [...(turn.migrationWarnings ?? [])];
      const choices = turn.choices.map((choice) => ({ ...choice }));
      const choice1 = choices.find((choice) => choice.index === 1);
      const legacyOpening = turn.openingMessage ?? '';

      if (!choice1) {
        migratedWarnings.push('Legacy F2F _open text found, but choice_1 is missing; NPC text could not be auto-mapped to reply_1.');
      } else if ((choice1.reply ?? '').trim().length === 0) {
        choice1.reply = legacyOpening;
      } else {
        migratedWarnings.push('Legacy F2F _open text and reply_1 were both populated; kept existing reply_1 and preserved legacy text only in migration history.');
      }

      return {
        ...turn,
        choices,
        openingMessage: F2F_ENTRY_OPENING_SENTINEL,
        openingMessagePlaceholder: 'f2f_entry_starter_v1',
        migrationWarnings: migratedWarnings.length > 0 ? migratedWarnings : undefined,
      };
    });

    return {
      ...conversation,
      turns,
    };
  });

  return {
    ...project,
    version: touched ? LEGACY_F2F_OPENING_MIGRATION_VERSION : project.version,
    conversations,
  };
}
