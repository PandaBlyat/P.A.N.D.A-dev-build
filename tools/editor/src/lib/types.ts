// P.A.N.D.A. Conversation Editor — Data Model

export interface Project {
  version: string;
  faction: FactionId;
  conversations: Conversation[];
}

export type FactionId =
  | 'stalker' | 'dolg' | 'freedom' | 'csky' | 'ecolog'
  | 'killer' | 'army' | 'bandit' | 'monolith' | 'zombied'
  | 'isg' | 'renegade' | 'greh';

export interface Conversation {
  id: number;
  label: string;
  preconditions: PreconditionEntry[];
  timeout?: number;
  timeoutMessage?: string;
  turns: Turn[];
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
  choices: Choice[];
  position: { x: number; y: number };
}

export interface Choice {
  index: number;
  text: string;
  reply: string;
  replyRelHigh?: string;
  replyRelLow?: string;
  outcomes: Outcome[];
  continueTo?: number;
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
