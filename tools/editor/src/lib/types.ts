// P.A.N.D.A. Conversation Editor — Data Model

import type { UiLanguage } from './ui-language';

export interface NpcTemplate {
  id: string;
  name: string;
  faction: string;
  rank?: string;
  relation?: string;
  primary?: string;
  secondary?: string;
  outfit?: string;
  items?: string;
  spawnDist?: number;
  count?: number;
  trader?: boolean;
  allowRoam?: boolean;
  stationaryJob?: string;
}

export interface Project {
  version: string;
  faction: FactionId;
  conversations: Conversation[];
  npcTemplates?: NpcTemplate[];
}

export type FactionId =
  | 'stalker' | 'dolg' | 'freedom' | 'csky' | 'ecolog'
  | 'killer' | 'army' | 'bandit' | 'monolith' | 'zombied'
  | 'isg' | 'renegade' | 'greh';

export type ConversationChannel = 'pda' | 'f2f';
export type TurnFirstSpeaker = 'npc' | 'player';
export type ConversationStartMode = 'pda' | 'f2f';

export interface Conversation {
  id: number;
  label: string;
  faction?: FactionId;
  language?: UiLanguage;
  translation?: ConversationTranslationMetadata;
  initialChannel?: ConversationChannel;
  /** Controls how this conversation is triggered: 'pda' (default) via PDA message, 'f2f' via NPC dialogue option. */
  startMode?: ConversationStartMode;
  preconditions: PreconditionEntry[];
  /** When false, this story can only start once in the same save/playthrough. */
  repeatable?: boolean;
  timeout?: number;
  timeoutMessage?: string;
  flowAnnotations?: FlowAnnotation[];
  flowEdgeBends?: Record<string, number>;
  turns: Turn[];
}

export type FlowAnnotation = FlowLineAnnotation | FlowLineSetAnnotation | FlowNoteAnnotation;

export interface FlowAnnotationBase {
  id: string;
  color: string;
  authorName?: string;
  createdAt: string;
}

export interface ConversationTranslationMetadata {
  source_id: string;
  source_language: UiLanguage;
  target_language: UiLanguage;
  source_label?: string;
  source_author?: string;
}

export interface FlowLineAnnotation extends FlowAnnotationBase {
  type: 'line';
  points: Array<{ x: number; y: number }>;
}

export interface FlowLineSetAnnotation extends FlowAnnotationBase {
  type: 'line-set';
  lines: Array<Array<{ x: number; y: number }>>;
}

export interface FlowNoteAnnotation extends FlowAnnotationBase {
  type: 'note';
  x: number;
  y: number;
  text: string;
  fontSize?: number;
}

/** A single precondition expression used at the top level or inside nested groups. */
export type PreconditionEntry =
  | SimplePrecondition
  | NotPrecondition
  | AnyPrecondition
  | InvalidPrecondition;

/** An AND-group used for a single any() branch containing multiple conditions. */
export interface AllPreconditionGroup {
  type: 'all';
  entries: PreconditionEntry[];
}

/** A single any() option can be one expression or an explicit AND-group. */
export type AnyPreconditionOption = PreconditionEntry | AllPreconditionGroup;

export interface SimplePrecondition {
  type: 'simple';
  command: string;
  params: string[];
}

export interface NotPrecondition {
  type: 'not';
  inner: PreconditionEntry;
}

export interface AnyPrecondition {
  type: 'any';
  options: AnyPreconditionOption[];
}

export interface InvalidPrecondition {
  type: 'invalid';
  raw: string;
  error: string;
}

export interface Turn {
  turnNumber: number;
  openingMessage?: string;
  /** Story/custom NPC id that owns this branch when reached directly or by job resume. */
  speaker_npc_id?: string;
  /** Factions used when this branch should be delivered by any simulated NPC. */
  speaker_npc_faction_filters?: FactionId[];
  /** Allows the branch speaker to be resolved from simulated stalkers instead of story/custom ids. */
  speaker_allow_generic_stalker?: boolean;
  /** DDS texture basename under gamedata/textures/ui attached to this branch opener. */
  openingImage?: string;
  /** Sound basename under gamedata/sounds/panda/audio attached to this branch opener. */
  openingAudio?: string;
  /** Preconditions required before this branch turn can be entered. */
  preconditions: PreconditionEntry[];
  /** Internal marker used by legacy F2F opening migration. */
  openingMessagePlaceholder?: string;
  channel?: ConversationChannel;
  /** @deprecated Legacy field kept only for backward-compatible import parsing. */
  npcOpenKey?: string;
  /** Whether the NPC line is required to play before choices are shown in F2F. */
  requiresNpcFirst?: boolean;
  firstSpeaker?: TurnFirstSpeaker;
  pda_entry?: boolean;
  f2f_entry?: boolean;
  /** Non-blocking notes produced by migration passes. */
  migrationWarnings?: string[];
  choices: Choice[];
  position: { x: number; y: number };
  /** Optional custom display name for this branch node. */
  customLabel?: string;
  /** Optional CSS color for this branch node accent. */
  color?: string;
}

export interface Choice {
  index: number;
  text: string;
  channel?: ConversationChannel;
  /** Preconditions required before this choice is shown to the player. */
  preconditions: PreconditionEntry[];
  reply: string;
  /** DDS texture basename under gamedata/textures/ui attached to the NPC reply. */
  replyImage?: string;
  /** Sound basename under gamedata/sounds/panda/audio attached to the NPC reply. */
  replyAudio?: string;
  replyRelHigh?: string;
  replyRelLow?: string;
  outcomes: Outcome[];
  /** Explicitly marks this choice as ending the branch flow. */
  terminal?: boolean;
  continueTo?: number;
  continueChannel?: ConversationChannel;
  /** @deprecated Legacy snake_case field retained for migration compatibility. */
  continue_channel?: ConversationChannel;
  /** Optional delay before a face-to-face branch resumes remotely on PDA. */
  pdaDelaySeconds?: number;
  story_npc_id?: string;
  npc_faction_filters?: FactionId[];
  npc_profile_filters?: string[];
  allow_generic_stalker?: boolean;
  /** Story NPC ID of the NPC who should deliver the next continuation turn (multi-NPC handoff). */
  cont_npc_id?: string;
}

export interface Outcome {
  command: string;
  params: string[];
  chancePercent?: number;
}

export type ValidationScope = 'project' | 'conversation' | 'turn' | 'choice' | 'precondition' | 'outcome';
export type ValidationGroup = 'structure' | 'schema' | 'logic';

export interface ValidationMessage {
  level: 'error' | 'warning';
  code: string;
  group: ValidationGroup;
  scope: ValidationScope;
  conversationId: number;
  turnNumber?: number;
  choiceIndex?: number;
  preconditionIndex?: number;
  outcomeIndex?: number;
  paramIndex?: number;
  propertiesTab?: 'conversation' | 'selection';
  fieldKey?: string;
  fieldLabel?: string;
  /** Dot-notation data path hint (for fast fixing in forms and exports). */
  fieldPath?: string;
  message: string;
}

/** Faction display mapping for the editor UI */
export const FACTION_DISPLAY_NAMES: Record<FactionId, string> = {
  stalker: 'Loner',
  dolg: 'Duty',
  freedom: 'Freedom',
  csky: 'Clear Sky',
  ecolog: 'Ecologists',
  killer: 'Mercenaries',
  army: 'Military',
  bandit: 'Bandits',
  monolith: 'Monolith',
  zombied: 'Zombified',
  isg: 'ISG',
  renegade: 'Renegades',
  greh: 'Sin',
};

/** Map faction ID to the XML file faction key (used in st_pda_ic_<key>_N_...) */
export const FACTION_XML_KEYS: Record<FactionId, string> = {
  stalker: 'loner',
  dolg: 'dolg',
  freedom: 'freedom',
  csky: 'csky',
  ecolog: 'ecolog',
  killer: 'killer',
  army: 'army',
  bandit: 'bandit',
  monolith: 'monolith',
  zombied: 'zombied',
  isg: 'isg',
  renegade: 'renegade',
  greh: 'greh',
};

export function getConversationFaction(conversation: Pick<Conversation, 'faction'> | null | undefined, fallback: FactionId = 'stalker'): FactionId {
  return conversation?.faction ?? fallback;
}

export type {
  CollabFrame,
  CollabLock,
  CollabOp,
  CollabParticipant,
  CollabRemoteCursor,
  CollabSession,
  CollabSnapshot,
} from './collab-protocol';
