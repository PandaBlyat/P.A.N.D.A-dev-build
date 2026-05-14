import type {
  Choice,
  Conversation,
  FactionId,
  NpcTemplate,
  PreconditionEntry,
  SimplePrecondition,
  Turn,
} from './types';
import { FACTION_DISPLAY_NAMES } from './types';
import type { FocusedCharacterRef } from './state';
import { STORY_NPC_OPTIONS } from './generated/story-npc-catalog';

export type CharacterFocusEntry = {
  ref: FocusedCharacterRef;
  id: string;
  kind: 'custom' | 'story';
  label: string;
  meta: string;
  branchCount: number;
  firstTurnNumber: number | null;
};

const storyNpcById = new Map(STORY_NPC_OPTIONS.map((option) => [option.value, option] as const));

export function normalizeCharacterRef(value: string | undefined | null): FocusedCharacterRef | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('custom:')) return `custom:${raw.slice(7)}`;
  if (raw.startsWith('story:')) return `story:${raw.slice(6)}`;
  if (raw.startsWith('npc:')) return `custom:${raw.slice(4)}`;
  return `story:${raw}`;
}

export function collectConversationCharacters(
  conversation: Conversation,
  npcTemplates: readonly NpcTemplate[],
): CharacterFocusEntry[] {
  const refs = new Set<FocusedCharacterRef>();
  for (const ref of getConversationEntryCharacterRefs(conversation)) refs.add(ref);
  for (const ref of getConversationNpcRefs(conversation)) refs.add(ref);
  for (const turn of conversation.turns) {
    for (const ref of getTurnCharacterRefs(conversation, turn)) refs.add(ref);
    for (const choice of turn.choices) {
      addNormalized(refs, choice.story_npc_id);
      addNormalized(refs, choice.cont_npc_id);
    }
  }

  const entries = [...refs].map((ref): CharacterFocusEntry => {
    const { kind, id } = splitCharacterRef(ref);
    const matchingTurns = conversation.turns
      .filter((turn) => turnMatchesCharacter(conversation, turn, ref))
      .sort((a, b) => a.turnNumber - b.turnNumber);
    return {
      ref,
      id,
      kind,
      ...getCharacterDisplay(kind, id, npcTemplates),
      branchCount: matchingTurns.length,
      firstTurnNumber: matchingTurns[0]?.turnNumber ?? conversation.turns[0]?.turnNumber ?? null,
    };
  });

  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'custom' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function getConversationEntryCharacterRefs(conversation: Conversation): FocusedCharacterRef[] {
  return collectPreconditionCharacterRefs(conversation.preconditions);
}

export function getTurnCharacterRefs(conversation: Conversation, turn: Turn): FocusedCharacterRef[] {
  const refs = new Set<FocusedCharacterRef>();
  addNormalized(refs, turn.speaker_npc_id);
  for (const ref of collectPreconditionCharacterRefs(turn.preconditions)) refs.add(ref);

  if (turn.turnNumber === 1 || turn.pda_entry === true || turn.f2f_entry === true) {
    for (const ref of getConversationEntryCharacterRefs(conversation)) refs.add(ref);
  }

  for (const sourceTurn of conversation.turns) {
    for (const choice of sourceTurn.choices) {
      if (choice.continueTo === turn.turnNumber) {
        addNormalized(refs, choice.cont_npc_id);
      }
    }
  }

  return [...refs];
}

export function turnMatchesCharacter(
  conversation: Conversation,
  turn: Turn,
  ref: FocusedCharacterRef | null,
): boolean {
  if (!ref) return false;
  if (getTurnCharacterRefs(conversation, turn).includes(ref)) return true;
  return turn.choices.some((choice) => choiceMatchesCharacter(choice, ref));
}

function choiceMatchesCharacter(choice: Choice, ref: FocusedCharacterRef): boolean {
  return normalizeCharacterRef(choice.story_npc_id) === ref
    || normalizeCharacterRef(choice.cont_npc_id) === ref;
}

function collectPreconditionCharacterRefs(entries: readonly PreconditionEntry[] | undefined): FocusedCharacterRef[] {
  const refs = new Set<FocusedCharacterRef>();
  for (const entry of entries ?? []) {
    collectPreconditionCharacterRef(entry, refs);
  }
  return [...refs];
}

function collectPreconditionCharacterRef(entry: PreconditionEntry, refs: Set<FocusedCharacterRef>): void {
  if (entry.type === 'simple') {
    addSimplePreconditionRef(refs, entry);
    return;
  }
  if (entry.type === 'not') {
    return;
  }
  if (entry.type === 'any') {
    for (const option of entry.options) {
      if (option.type === 'all') {
        for (const child of option.entries) collectPreconditionCharacterRef(child, refs);
      } else {
        collectPreconditionCharacterRef(option, refs);
      }
    }
  }
}

function addSimplePreconditionRef(refs: Set<FocusedCharacterRef>, entry: SimplePrecondition): void {
  const value = entry.params[0];
  if (entry.command === 'req_custom_story_npc') {
    const id = (value ?? '').trim();
    if (id) refs.add(`custom:${stripNpcPrefix(id)}`);
    return;
  }
  if (entry.command === 'req_story_npc') {
    addNormalized(refs, value);
  }
}

function getConversationNpcRefs(conversation: Conversation): FocusedCharacterRef[] {
  const refs = new Set<FocusedCharacterRef>();
  for (const value of conversation.npc_refs ?? []) addNormalized(refs, value);
  return [...refs];
}

function addNormalized(refs: Set<FocusedCharacterRef>, value: string | undefined | null): void {
  const ref = normalizeCharacterRef(value);
  if (ref) refs.add(ref);
}

function stripNpcPrefix(value: string): string {
  return value.startsWith('npc:') ? value.slice(4) : value;
}

function splitCharacterRef(ref: FocusedCharacterRef): { kind: 'custom' | 'story'; id: string } {
  if (ref.startsWith('custom:')) return { kind: 'custom', id: ref.slice(7) };
  return { kind: 'story', id: ref.slice(6) };
}

function getCharacterDisplay(
  kind: 'custom' | 'story',
  id: string,
  npcTemplates: readonly NpcTemplate[],
): { label: string; meta: string } {
  if (kind === 'custom') {
    const template = npcTemplates.find((candidate) => candidate.id === id);
    const faction = template?.faction ? FACTION_DISPLAY_NAMES[template.faction as FactionId] ?? template.faction : 'Custom';
    return {
      label: template?.name?.trim() || id,
      meta: `${faction} custom NPC`,
    };
  }

  const storyNpc = storyNpcById.get(id);
  if (!storyNpc) return { label: id, meta: 'Story NPC' };
  const parts = [storyNpc.faction, storyNpc.level, storyNpc.role].filter(Boolean);
  return {
    label: storyNpc.characterName || id,
    meta: parts.length > 0 ? parts.join(' / ') : 'Story NPC',
  };
}
