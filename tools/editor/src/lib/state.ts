// P.A.N.D.A. Conversation Editor — Application State

import type { Project, Conversation, Turn, Choice, ValidationMessage, NpcTemplate, FlowAnnotation } from './types';
import type { CollabLock, CollabParticipant, CollabRemoteCursor } from './collab-protocol';
import { getConversationFaction } from './types';
import { cloneConversation } from './collab-protocol';
import { createEmptyProject, createConversation, createTurn, createChoice } from './xml-export';
import { migrateLegacyF2FEntryOpenings } from './f2f-entry-migration';
import { estimateFlowNodeHeight, getDefaultFlowTurnPosition, getFlowAutoLayoutSpacing, getFlowNodeLayout } from './flow-layout';
import { measurePerf } from './perf';
import {
  cancelPendingValidation,
  flushValidation,
  scheduleValidation as scheduleWorkerValidation,
  type ValidationMode,
} from './validation-client';

export type PropertiesTab = 'conversation' | 'selection';
export type FlowDensity = 'compact' | 'standard' | 'detailed';
export type BottomWorkspaceTab = 'strings' | 'xml';
export type CursorAnimationIntensity = 'low' | 'medium' | 'high';

const CURSOR_PREFS_KEY = 'panda:cursor-prefs:v1';
const ADVANCED_MODE_KEY = 'panda:advanced-mode:v1';

type CursorPrefs = {
  enabled: boolean;
  animationIntensity: CursorAnimationIntensity;
  size: number;
};

function loadCursorPrefs(): CursorPrefs {
  if (typeof window === 'undefined') {
    return { enabled: true, animationIntensity: 'medium', size: 16 };
  }
  const raw = window.localStorage.getItem(CURSOR_PREFS_KEY);
  if (!raw) return { enabled: true, animationIntensity: 'medium', size: 16 };
  const parsed = JSON.parse(raw) as Partial<CursorPrefs>;
  return {
    enabled: parsed.enabled ?? true,
    animationIntensity: parsed.animationIntensity ?? 'medium',
    size: Math.max(12, Math.min(28, Math.round(parsed.size ?? 16))),
  };
}

function persistCursorPrefs(prefs: CursorPrefs): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CURSOR_PREFS_KEY, JSON.stringify(prefs));
}

function loadAdvancedMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(ADVANCED_MODE_KEY) === 'true';
}

function persistAdvancedMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADVANCED_MODE_KEY, String(enabled));
}

export interface AppState {
  project: Project;
  systemStrings: Map<string, string>;
  selectedConversationId: number | null;
  selectedTurnNumber: number | null;
  selectedChoiceIndex: number | null;
  propertiesTab: PropertiesTab;
  validationMessages: ValidationMessage[];
  showXmlPreview: boolean;
  showSystemStringsPanel: boolean;
  showValidationPanel: boolean;
  advancedMode: boolean;
  bottomWorkspaceTab: BottomWorkspaceTab | null;
  bottomWorkspaceHeight: number;
  flowDensity: FlowDensity;
  customCursorEnabled: boolean;
  cursorAnimationIntensity: CursorAnimationIntensity;
  cursorSize: number;
  dirty: boolean;
  undoStack: string[];
  redoStack: string[];
  copiedTurn: TurnClipboard | null;
  copiedChoice: ChoiceClipboard | null;
  projectRevision: number;
  systemStringsRevision: number;
  validationRevision: number;
  flowContentRevision: number;
  flowStructureRevision: number;
  flowPositionRevision: number;
  conversationSourceMetadata: Map<number, ConversationSourceMetadata>;
  collab: CollabAppState;
}

export interface CollabAppState {
  sessionId: string | null;
  conversationId: number | null;
  hostId: string | null;
  localPublisherId: string | null;
  participants: CollabParticipant[];
  locks: Record<string, CollabLock>;
  remoteCursors: Record<string, CollabRemoteCursor>;
  pendingOps: number;
  version: number;
  isHost: boolean;
  hostDisconnected: boolean;
  guestEditCount: number;
  statusMessage: string | null;
}

export type RenderTarget =
  | 'appShell'
  | 'conversationList'
  | 'flowEditor'
  | 'propertiesPanel'
  | 'bottomWorkspace'
  | 'toolbar';

export interface StateChange {
  targets: readonly RenderTarget[];
  projectChanged: boolean;
  systemStringsChanged: boolean;
  validationChanged: boolean;
  reason: 'generic' | 'selection' | 'text-content' | 'structure' | 'position' | 'validation' | 'settings';
  flow?: {
    kind: 'selection' | 'text-content' | 'structure' | 'position' | 'validation' | 'settings';
  };
}

type Listener = (change: StateChange) => void;

export function createStateChange(...targets: RenderTarget[]): StateChange {
  return {
    targets: [...new Set(targets)],
    projectChanged: false,
    systemStringsChanged: false,
    validationChanged: false,
    reason: 'generic',
  };
}

export function createFlowChange(
  kind: NonNullable<StateChange['flow']>['kind'],
  ...targets: RenderTarget[]
): StateChange {
  const change = createStateChange(...targets);
  change.reason = kind;
  change.flow = { kind };
  return change;
}

export function createValidationChange(): StateChange {
  const change = createStateChange('conversationList');
  change.reason = 'validation';
  change.validationChanged = true;
  change.flow = { kind: 'validation' };
  return change;
}

export const FULL_APP_RENDER = createFlowChange('structure', 'appShell');
export const SELECTION_RENDER = createFlowChange('selection', 'flowEditor', 'propertiesPanel');
const VALIDATION_RENDER = createValidationChange();

function createEmptyCollabState(): CollabAppState {
  return {
    sessionId: null,
    conversationId: null,
    hostId: null,
    localPublisherId: null,
    participants: [],
    locks: {},
    remoteCursors: {},
    pendingOps: 0,
    version: 0,
    isHost: false,
    hostDisconnected: false,
    guestEditCount: 0,
    statusMessage: null,
  };
}

function inferTurnFirstSpeaker(
  turn: Pick<Turn, 'firstSpeaker' | 'f2f_entry' | 'channel'>,
  options: { allowChannelInference?: boolean } = {},
): 'npc' | 'player' {
  if (turn.firstSpeaker === 'npc' || turn.firstSpeaker === 'player') {
    return turn.firstSpeaker;
  }
  if (!(options.allowChannelInference ?? true)) {
    return 'npc';
  }
  return turn.channel === 'f2f' ? 'player' : 'npc';
}

function normalizeChannelValue(
  channel: Turn['channel'] | Choice['channel'] | Choice['continue_channel'] | Choice['continueChannel'] | undefined,
  fallback: 'pda' | 'f2f' = 'pda',
): 'pda' | 'f2f' {
  if (channel === 'pda' || channel === 'f2f') {
    return channel;
  }
  return fallback;
}

function normalizeOptionalNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : undefined;
}

function hasOwnUpdates<T extends object>(target: T, updates: Partial<T>): boolean {
  for (const key of Object.keys(updates) as Array<keyof T>) {
    if (!Object.is(target[key], updates[key])) {
      return true;
    }
  }
  return false;
}

function normalizeTurnEntryFlags(turn: Turn, options: { inferDefaults?: boolean } = {}): void {
  turn.channel = normalizeChannelValue(turn.channel, 'pda');
  const inferDefaults = options.inferDefaults ?? true;
  const defaultPdaEntry = turn.turnNumber === 1;

  if (turn.channel === 'pda') {
    turn.pda_entry = typeof turn.pda_entry === 'boolean'
      ? turn.pda_entry
      : (inferDefaults ? defaultPdaEntry : false);
    turn.f2f_entry = false;
    return;
  }
  if (turn.channel === 'f2f') {
    turn.pda_entry = false;
    turn.f2f_entry = typeof turn.f2f_entry === 'boolean' ? turn.f2f_entry : false;
    if (inferDefaults) {
      turn.requiresNpcFirst = typeof turn.requiresNpcFirst === 'boolean' ? turn.requiresNpcFirst : true;
    }
  }
}

function computeSegmentStartFlag(sourceChannel: 'pda' | 'f2f', destinationChannel: 'pda' | 'f2f'): boolean {
  return sourceChannel !== destinationChannel;
}

const VALIDATION_DEBOUNCE_MS = 120;
const TEXT_EDIT_IDLE_VALIDATION_MS = 1200;

type TurnPositionUpdate = {
  turnNumber: number;
  position: { x: number; y: number };
};

type AutoLayoutNodeMeta = {
  turnNumber: number;
  depth: number;
  parentTurnNumber: number | null;
  siblingIndex: number;
  groupKey: string;
  visitOrder: number;
};

type TurnClipboard = {
  conversationId: number;
  turn: Turn;
};

type ChoiceClipboard = {
  conversationId: number;
  turnNumber: number;
  choice: Choice;
};

type TextSession = {
  key: string;
  change: StateChange;
  projectChanged: boolean;
  systemStringsChanged: boolean;
};

type MutationOptions = {
  change?: StateChange;
  revalidate?: boolean;
  textSessionKey?: string;
};

export type ConversationSourceMetadata = {
  sourceCommunityId: string;
  sourcePublisherId: string;
  sourceCoAuthors?: string[];
  sourceUpdatedAt?: string;
};

function mergeChanges(a: StateChange, b: StateChange): StateChange {
  const merged = a.targets.includes('appShell') || b.targets.includes('appShell')
    ? { ...FULL_APP_RENDER }
    : createStateChange(...a.targets, ...b.targets);
  merged.projectChanged = a.projectChanged || b.projectChanged;
  merged.systemStringsChanged = a.systemStringsChanged || b.systemStringsChanged;
  merged.validationChanged = a.validationChanged || b.validationChanged;
  merged.reason = mergeReason(a.reason, b.reason);
  merged.flow = mergeFlow(a.flow, b.flow);
  return merged;
}

function mergeReason(a: StateChange['reason'], b: StateChange['reason']): StateChange['reason'] {
  if (a === b) return a;
  if (a === 'structure' || b === 'structure') return 'structure';
  if (a === 'position' || b === 'position') return 'position';
  if (a === 'text-content' || b === 'text-content') return 'text-content';
  if (a === 'settings' || b === 'settings') return 'settings';
  if (a === 'validation' || b === 'validation') return 'validation';
  if (a === 'selection' || b === 'selection') return 'selection';
  return 'generic';
}

function mergeFlow(a: StateChange['flow'], b: StateChange['flow']): StateChange['flow'] {
  if (!a) return b ? { ...b } : undefined;
  if (!b) return { ...a };
  return { kind: mergeReason(a.kind, b.kind) as NonNullable<StateChange['flow']>['kind'] };
}

class StateManager {
  private state: AppState;
  private listeners: Set<Listener> = new Set();
  private validationTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingValidationChange: StateChange | null = null;
  private validationRequestRevision = 0;
  private batchDepth = 0;
  private batchedChange: StateChange | null = null;
  private textSessions: Map<string, TextSession> = new Map();

  constructor() {
    const cursorPrefs = loadCursorPrefs();
    this.state = {
      project: createEmptyProject('stalker'),
      systemStrings: new Map(),
      selectedConversationId: null,
      selectedTurnNumber: null,
      selectedChoiceIndex: null,
      propertiesTab: 'conversation',
      validationMessages: [],
      showXmlPreview: false,
      showSystemStringsPanel: false,
      showValidationPanel: false,
      advancedMode: loadAdvancedMode(),
      bottomWorkspaceTab: null,
      bottomWorkspaceHeight: 280,
      flowDensity: 'standard',
      customCursorEnabled: cursorPrefs.enabled,
      cursorAnimationIntensity: cursorPrefs.animationIntensity,
      cursorSize: cursorPrefs.size,
      dirty: false,
      undoStack: [],
      redoStack: [],
      copiedTurn: null,
      copiedChoice: null,
      projectRevision: 0,
      systemStringsRevision: 0,
      validationRevision: 0,
      flowContentRevision: 0,
      flowStructureRevision: 0,
      flowPositionRevision: 0,
      conversationSourceMetadata: new Map(),
      collab: createEmptyCollabState(),
    };
  }

  get(): AppState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  startCollabSession(options: {
    sessionId: string;
    conversationId: number;
    hostId: string;
    localPublisherId: string;
    participants: CollabParticipant[];
    version?: number;
    isHost: boolean;
  }): void {
    this.state.collab = {
      ...createEmptyCollabState(),
      sessionId: options.sessionId,
      conversationId: options.conversationId,
      hostId: options.hostId,
      localPublisherId: options.localPublisherId,
      participants: options.participants,
      version: options.version ?? 0,
      isHost: options.isHost,
    };
    this.notify(createStateChange('conversationList', 'toolbar', 'flowEditor', 'propertiesPanel'));
  }

  updateCollabSession(updates: Partial<CollabAppState>): void {
    this.state.collab = {
      ...this.state.collab,
      ...updates,
    };
    this.notify(createStateChange('conversationList', 'toolbar', 'flowEditor', 'propertiesPanel'));
  }

  endCollabSession(): void {
    if (!this.state.collab.sessionId) return;
    this.state.collab = createEmptyCollabState();
    this.notify(createStateChange('toolbar', 'flowEditor', 'propertiesPanel'));
  }

  setCollabParticipants(participants: CollabParticipant[]): void {
    this.state.collab.participants = participants;
    this.notify(createStateChange('toolbar', 'flowEditor'));
  }

  upsertCollabLock(lock: CollabLock): void {
    this.state.collab.locks = {
      ...this.state.collab.locks,
      [lock.path]: lock,
    };
    this.notify(createStateChange('flowEditor', 'propertiesPanel'));
  }

  removeCollabLock(path: string, authorId?: string): void {
    const existing = this.state.collab.locks[path];
    if (!existing || (authorId && existing.authorId !== authorId)) return;
    const nextLocks = { ...this.state.collab.locks };
    delete nextLocks[path];
    this.state.collab.locks = nextLocks;
    this.notify(createStateChange('flowEditor', 'propertiesPanel'));
  }

  setCollabRemoteCursor(cursor: CollabRemoteCursor): void {
    if (cursor.authorId === this.state.collab.localPublisherId) return;
    this.state.collab.remoteCursors = {
      ...this.state.collab.remoteCursors,
      [cursor.authorId]: cursor,
    };
    this.notify(createFlowChange('position', 'flowEditor'));
  }

  clearExpiredCollabPresence(now = Date.now()): void {
    const nextLocks: Record<string, CollabLock> = {};
    for (const [path, lock] of Object.entries(this.state.collab.locks)) {
      if (lock.expiresAt > now) {
        nextLocks[path] = lock;
      }
    }
    const nextCursors: Record<string, CollabRemoteCursor> = {};
    for (const [authorId, cursor] of Object.entries(this.state.collab.remoteCursors)) {
      if (now - cursor.ts < 5000) {
        nextCursors[authorId] = cursor;
      }
    }
    if (
      Object.keys(nextLocks).length === Object.keys(this.state.collab.locks).length &&
      Object.keys(nextCursors).length === Object.keys(this.state.collab.remoteCursors).length
    ) {
      return;
    }
    this.state.collab.locks = nextLocks;
    this.state.collab.remoteCursors = nextCursors;
    this.notify(createStateChange('flowEditor', 'propertiesPanel'));
  }

  private notify(change: StateChange = FULL_APP_RENDER): void {
    if (this.batchDepth > 0) {
      this.batchedChange = this.batchedChange ? mergeChanges(this.batchedChange, change) : { ...change };
      return;
    }
    for (const fn of this.listeners) fn(change);
  }

  batch(fn: () => void): void {
    this.batchDepth += 1;
    try {
      fn();
    } finally {
      this.batchDepth -= 1;
      if (this.batchDepth === 0 && this.batchedChange) {
        const change = this.batchedChange;
        this.batchedChange = null;
        this.notify(change);
      }
    }
  }

  private markProjectChanged(): void {
    this.state.projectRevision += 1;
  }

  private markFlowChanged(kind: NonNullable<StateChange['flow']>['kind'] | undefined): void {
    if (!kind) return;
    if (kind === 'text-content') {
      this.state.flowContentRevision += 1;
      return;
    }
    if (kind === 'position') {
      this.state.flowPositionRevision += 1;
      return;
    }
    if (kind === 'structure') {
      this.state.flowStructureRevision += 1;
    }
  }

  private markSystemStringsChanged(): void {
    this.state.systemStringsRevision += 1;
  }

  private clearScheduledValidation(): void {
    if (this.validationTimer != null) {
      clearTimeout(this.validationTimer);
      this.validationTimer = null;
    }
    this.pendingValidationChange = null;
    cancelPendingValidation();
  }

  private clearPendingTextSessions(): void {
    this.textSessions.clear();
  }

  private prepareChange(
    change: StateChange,
    flags: {
      projectChanged?: boolean;
      systemStringsChanged?: boolean;
      validationChanged?: boolean;
    } = {},
  ): StateChange {
    let prepared = change.targets.includes('appShell')
      ? { ...FULL_APP_RENDER }
      : createStateChange(...change.targets);
    prepared.reason = change.reason;
    prepared.flow = change.flow ? { ...change.flow } : undefined;

    if ((flags.projectChanged ?? false) && this.state.showXmlPreview) {
      prepared = mergeChanges(prepared, createStateChange('bottomWorkspace'));
    }

    if ((flags.systemStringsChanged ?? false) && this.state.showSystemStringsPanel) {
      prepared = mergeChanges(prepared, createStateChange('bottomWorkspace'));
    }

    if (flags.validationChanged ?? false) {
      prepared = mergeChanges(prepared, VALIDATION_RENDER);
    }

    prepared.projectChanged = flags.projectChanged ?? false;
    prepared.systemStringsChanged = flags.systemStringsChanged ?? false;
    prepared.validationChanged = flags.validationChanged ?? false;
    return prepared;
  }

  private pushUndo(): void {
    measurePerf('state.undoSnapshot', () => {
      this.state.undoStack.push(JSON.stringify(this.state.project));
      if (this.state.undoStack.length > 50) this.state.undoStack.shift();
      this.state.redoStack = [];
    }, {
      conversations: this.state.project.conversations.length,
    });
  }

  private getConversationById(conversationId: number): Conversation | null {
    return this.state.project.conversations.find(c => c.id === conversationId) || null;
  }

  private finishProjectMutation({
    revalidate = true,
    change = FULL_APP_RENDER,
    projectChanged = true,
    systemStringsChanged = false,
  }: {
    revalidate?: boolean;
    change?: StateChange;
    projectChanged?: boolean;
    systemStringsChanged?: boolean;
  } = {}): void {
    this.state.dirty = true;
    if (projectChanged) this.markProjectChanged();
    if (systemStringsChanged) this.markSystemStringsChanged();
    const preparedChange = this.prepareChange(change, { projectChanged, systemStringsChanged });
    if (projectChanged) this.markFlowChanged(preparedChange.flow?.kind ?? (preparedChange.targets.includes('flowEditor') || preparedChange.targets.includes('appShell') ? 'structure' : undefined));
    if (revalidate) this.scheduleValidation(preparedChange);
    this.notify(preparedChange);
  }

  private createTextSession(
    sessionKey: string,
    change: StateChange,
    options: { projectChanged?: boolean; systemStringsChanged?: boolean } = {},
  ): TextSession {
    const projectChanged = options.projectChanged ?? true;
    const systemStringsChanged = options.systemStringsChanged ?? false;
    if (projectChanged && change.targets.includes('flowEditor')) {
      change = createFlowChange('text-content', ...change.targets);
    }
    const preparedChange = this.prepareChange(change, { projectChanged, systemStringsChanged });
    const existing = this.textSessions.get(sessionKey);

    if (existing) {
      existing.change = mergeChanges(existing.change, preparedChange);
      existing.projectChanged = existing.projectChanged || projectChanged;
      existing.systemStringsChanged = existing.systemStringsChanged || systemStringsChanged;
      existing.change.projectChanged = existing.projectChanged;
      existing.change.systemStringsChanged = existing.systemStringsChanged;
      return existing;
    }

    this.pushUndo();
    const session: TextSession = {
      key: sessionKey,
      change: preparedChange,
      projectChanged,
      systemStringsChanged,
    };
    this.textSessions.set(sessionKey, session);
    return session;
  }

  private scheduleTextSessionValidation(): void {
    if (this.textSessions.size === 0) return;

    let combined: StateChange | null = null;
    for (const session of this.textSessions.values()) {
      combined = combined ? mergeChanges(combined, session.change) : { ...session.change };
    }

    if (combined) {
      this.scheduleValidation(combined, TEXT_EDIT_IDLE_VALIDATION_MS);
    }
  }

  private applyTextMutation(
    sessionKey: string,
    change: StateChange,
    mutator: () => void,
    options: { projectChanged?: boolean; systemStringsChanged?: boolean } = {},
  ): void {
    this.state.dirty = true;
    this.createTextSession(sessionKey, change, options);
    mutator();
    this.scheduleTextSessionValidation();
  }

  private finalizeTextSessions(keys?: Iterable<string>): void {
    const targetKeys = keys ? [...keys] : [...this.textSessions.keys()];
    if (targetKeys.length === 0) return;

    let combined: TextSession | null = null;
    for (const key of targetKeys) {
      const session = this.textSessions.get(key);
      if (!session) continue;
      this.textSessions.delete(key);

      if (!combined) {
        combined = {
          key: session.key,
          change: { ...session.change },
          projectChanged: session.projectChanged,
          systemStringsChanged: session.systemStringsChanged,
        };
      } else {
        combined.change = mergeChanges(combined.change, session.change);
        combined.projectChanged = combined.projectChanged || session.projectChanged;
        combined.systemStringsChanged = combined.systemStringsChanged || session.systemStringsChanged;
      }
    }

    if (!combined) return;

    this.clearScheduledValidation();

    if (combined.projectChanged) this.markProjectChanged();
    if (combined.systemStringsChanged) this.markSystemStringsChanged();
    if (combined.projectChanged) this.markFlowChanged(combined.change.flow?.kind);

    const validationChange = this.revalidate(combined.change, { notify: false });
    const commitChange = validationChange ? mergeChanges(combined.change, validationChange) : { ...combined.change };
    commitChange.projectChanged = combined.projectChanged;
    commitChange.systemStringsChanged = combined.systemStringsChanged;
    commitChange.validationChanged = validationChange?.validationChanged ?? false;
    this.notify(commitChange);

    this.scheduleTextSessionValidation();
  }

  undo(): void {
    this.clearScheduledValidation();
    this.clearPendingTextSessions();
    const prev = this.state.undoStack.pop();
    if (!prev) return;
    this.state.redoStack.push(JSON.stringify(this.state.project));
    this.state.project = JSON.parse(prev);
    this.markProjectChanged();
    const baseChange = this.prepareChange(FULL_APP_RENDER, { projectChanged: true });
    const validationChange = this.revalidate(baseChange, { notify: false });
    const nextChange = validationChange ? mergeChanges(baseChange, validationChange) : baseChange;
    nextChange.projectChanged = true;
    nextChange.validationChanged = validationChange?.validationChanged ?? false;
    this.notify(nextChange);
  }

  redo(): void {
    this.clearScheduledValidation();
    this.clearPendingTextSessions();
    const next = this.state.redoStack.pop();
    if (!next) return;
    this.state.undoStack.push(JSON.stringify(this.state.project));
    this.state.project = JSON.parse(next);
    this.markProjectChanged();
    const baseChange = this.prepareChange(FULL_APP_RENDER, { projectChanged: true });
    const validationChange = this.revalidate(baseChange, { notify: false });
    const nextChange = validationChange ? mergeChanges(baseChange, validationChange) : baseChange;
    nextChange.projectChanged = true;
    nextChange.validationChanged = validationChange?.validationChanged ?? false;
    this.notify(nextChange);
  }

  private scheduleValidation(change: StateChange = FULL_APP_RENDER, delayMs = VALIDATION_DEBOUNCE_MS): void {
    const preparedChange = this.prepareChange(change);
    this.pendingValidationChange = this.pendingValidationChange
      ? mergeChanges(this.pendingValidationChange, preparedChange)
      : { ...preparedChange };

    if (this.validationTimer != null) {
      clearTimeout(this.validationTimer);
    }

    this.validationTimer = setTimeout(() => {
      this.validationTimer = null;
      const validationChange = this.pendingValidationChange ?? preparedChange;
      this.pendingValidationChange = null;
      this.revalidate(validationChange);
    }, delayMs);
  }

  private revalidate(change: StateChange = FULL_APP_RENDER, options: { notify?: boolean } = {}): StateChange | null {
    const revision = ++this.validationRequestRevision;
    const mode: ValidationMode = options.notify === false ? 'immediate' : 'idle';
    const projectSnapshot = JSON.parse(JSON.stringify(this.state.project)) as Project;
    const callback = (result: { revision: number; messages: ValidationMessage[]; durationMs: number }) => {
      if (result.revision !== this.validationRequestRevision) return;
      measurePerf('state.validation.apply', () => {
        this.applyValidationMessages(result.messages);
      }, {
        conversations: projectSnapshot.conversations.length,
        turns: projectSnapshot.conversations.reduce((sum, conversation) => sum + conversation.turns.length, 0),
      });
    };
    if (mode === 'immediate') {
      flushValidation(projectSnapshot, revision, callback);
    } else {
      scheduleWorkerValidation(projectSnapshot, revision, mode, callback, 0);
    }
    return null;
  }

  private applyValidationMessages(messages: ValidationMessage[]): void {
    const previousMessages = JSON.stringify(this.state.validationMessages);
    const previousShowValidationPanel = this.state.showValidationPanel;
    const previousBottomWorkspaceTab = this.state.bottomWorkspaceTab;

    this.state.validationMessages = messages;
    if (this.state.validationMessages.length === 0) {
      this.state.showValidationPanel = false;
    }
    this.syncBottomWorkspaceTab();

    const nextMessages = JSON.stringify(this.state.validationMessages);
    const validationChanged = previousMessages !== nextMessages
      || previousShowValidationPanel !== this.state.showValidationPanel
      || previousBottomWorkspaceTab !== this.state.bottomWorkspaceTab;

    if (!validationChanged) return;
    this.state.validationRevision += 1;
    this.notify(this.prepareChange(createValidationChange(), { validationChanged: true }));
  }

  commitTextEdit(sessionKey: string): void {
    this.finalizeTextSessions([sessionKey]);
  }

  commitPendingTextEdits(): void {
    this.finalizeTextSessions();
  }

  private getOpenBottomWorkspaceTabs(): BottomWorkspaceTab[] {
    const tabs: BottomWorkspaceTab[] = [];
    if (this.state.showSystemStringsPanel) tabs.push('strings');
    if (this.state.showXmlPreview) tabs.push('xml');
    return tabs;
  }

  private syncBottomWorkspaceTab(preferred?: BottomWorkspaceTab): void {
    const openTabs = this.getOpenBottomWorkspaceTabs();
    if (preferred && openTabs.includes(preferred)) {
      this.state.bottomWorkspaceTab = preferred;
      return;
    }
    if (this.state.bottomWorkspaceTab && openTabs.includes(this.state.bottomWorkspaceTab)) {
      return;
    }
    this.state.bottomWorkspaceTab = openTabs[0] ?? null;
  }

  private calculateAutoLayoutUpdates(conversation: Conversation, density: FlowDensity = 'standard'): TurnPositionUpdate[] {
    const turnsByNumber = new Map(conversation.turns.map(turn => [turn.turnNumber, turn]));
    const metadata = new Map<number, AutoLayoutNodeMeta>();
    const queue: AutoLayoutNodeMeta[] = [];
    const enqueue = (meta: AutoLayoutNodeMeta): void => {
      if (metadata.has(meta.turnNumber) || !turnsByNumber.has(meta.turnNumber)) return;
      metadata.set(meta.turnNumber, meta);
      queue.push(meta);
    };

    let visitOrder = 0;
    if (turnsByNumber.has(1)) {
      enqueue({
        turnNumber: 1,
        depth: 0,
        parentTurnNumber: null,
        siblingIndex: 0,
        groupKey: 'root',
        visitOrder: visitOrder++,
      });
    }

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const turn = turnsByNumber.get(current.turnNumber);
      if (!turn) continue;

      let siblingIndex = 0;
      for (const targetTurnNumber of this.getTurnTargetSequence(turn)) {
        const groupKey = current.depth === 0
          ? `branch-${siblingIndex}`
          : current.groupKey;
        enqueue({
          turnNumber: targetTurnNumber,
          depth: current.depth + 1,
          parentTurnNumber: current.turnNumber,
          siblingIndex,
          groupKey,
          visitOrder: visitOrder++,
        });
        siblingIndex += 1;
      }
    }

    let nextDepth = metadata.size > 0
      ? Math.max(...[...metadata.values()].map(item => item.depth)) + 1
      : 0;
    let islandIndex = 0;
    for (const turn of conversation.turns) {
      if (metadata.has(turn.turnNumber)) continue;
      metadata.set(turn.turnNumber, {
        turnNumber: turn.turnNumber,
        depth: nextDepth,
        parentTurnNumber: null,
        siblingIndex: 0,
        groupKey: `island-${islandIndex}`,
        visitOrder: visitOrder++,
      });
      nextDepth += 1;
      islandIndex += 1;
    }

    const orderedColumns = new Map<number, AutoLayoutNodeMeta[]>();
    for (const meta of metadata.values()) {
      const column = orderedColumns.get(meta.depth) ?? [];
      column.push(meta);
      orderedColumns.set(meta.depth, column);
    }

    const orderedTurnNumbers = [...metadata.values()]
      .sort((a, b) => a.visitOrder - b.visitOrder)
      .map(item => item.turnNumber);
    const orderIndexByTurn = new Map(orderedTurnNumbers.map((turnNumber, index) => [turnNumber, index]));

    for (const column of orderedColumns.values()) {
      column.sort((a, b) => {
        const aParentOrder = a.parentTurnNumber == null ? -1 : (orderIndexByTurn.get(a.parentTurnNumber) ?? Number.MAX_SAFE_INTEGER);
        const bParentOrder = b.parentTurnNumber == null ? -1 : (orderIndexByTurn.get(b.parentTurnNumber) ?? Number.MAX_SAFE_INTEGER);

        return aParentOrder - bParentOrder
          || a.siblingIndex - b.siblingIndex
          || a.groupKey.localeCompare(b.groupKey)
          || a.visitOrder - b.visitOrder
          || a.turnNumber - b.turnNumber;
      });
    }

    const layout = getFlowNodeLayout(density);
    const spacing = getFlowAutoLayoutSpacing(density);
    const positions = new Map<number, { x: number; y: number }>();

    for (const [depth, column] of [...orderedColumns.entries()].sort((a, b) => a[0] - b[0])) {
      const x = spacing.canvasPaddingX + depth * (layout.width + spacing.horizontalGutter);
      let cursorY = spacing.canvasPaddingY;
      let previousMeta: AutoLayoutNodeMeta | null = null;

      for (const meta of column) {
        if (previousMeta) {
          const gap = this.getAutoLayoutVerticalGap(previousMeta, meta, spacing);
          const previousTurn = turnsByNumber.get(previousMeta.turnNumber);
          if (previousTurn) {
            cursorY += estimateFlowNodeHeight(previousTurn, density) + gap;
          }
        }

        positions.set(meta.turnNumber, { x, y: cursorY });
        previousMeta = meta;
      }
    }

    return conversation.turns.map(turn => ({
      turnNumber: turn.turnNumber,
      position: positions.get(turn.turnNumber) ?? {
        x: spacing.canvasPaddingX,
        y: spacing.canvasPaddingY,
      },
    }));
  }

  private getDefaultTurnPlacement(turnNumber: number): { x: number; y: number } {
    return getDefaultFlowTurnPosition(turnNumber);
  }

  private getBranchTurnPlacement(sourceTurn: Turn, sourceChoiceIndex: number, newTurn: Turn): { x: number; y: number } {
    const layout = getFlowNodeLayout(this.state.flowDensity);
    const spacing = getFlowAutoLayoutSpacing(this.state.flowDensity);
    const sourceHeight = estimateFlowNodeHeight(sourceTurn, this.state.flowDensity);
    const newTurnHeight = estimateFlowNodeHeight(newTurn, this.state.flowDensity);

    return {
      x: sourceTurn.position.x + layout.width + spacing.horizontalGutter,
      y: Math.max(
        spacing.canvasPaddingY,
        sourceTurn.position.y + (sourceChoiceIndex - 1) * (newTurnHeight + spacing.siblingGap) - Math.round((newTurnHeight - sourceHeight) / 2),
      ),
    };
  }

  private getContextualTurnPlacement(
    conversation: Conversation,
    newTurn: Turn,
    options: {
      sourceTurnNumber?: number;
      sourceChoiceIndex?: number;
      anchorTurnNumber?: number | null;
    } = {},
  ): { x: number; y: number } {
    if (options.sourceTurnNumber != null && options.sourceChoiceIndex != null) {
      const sourceTurn = conversation.turns.find(turn => turn.turnNumber === options.sourceTurnNumber);
      if (sourceTurn) {
        return this.getBranchTurnPlacement(sourceTurn, options.sourceChoiceIndex, newTurn);
      }
    }

    if (options.anchorTurnNumber != null) {
      const anchorTurn = conversation.turns.find(turn => turn.turnNumber === options.anchorTurnNumber);
      if (anchorTurn) {
        const spacing = getFlowAutoLayoutSpacing(this.state.flowDensity);
        const anchorHeight = estimateFlowNodeHeight(anchorTurn, this.state.flowDensity);
        return {
          x: Math.max(0, anchorTurn.position.x + Math.round(spacing.horizontalGutter / 2)),
          y: Math.max(spacing.canvasPaddingY, anchorTurn.position.y + anchorHeight + spacing.siblingGap),
        };
      }
    }

    return this.getDefaultTurnPlacement(newTurn.turnNumber);
  }

  private collectReachableTurnNumbers(conversation: Conversation, rootTurnNumber: number): Set<number> {
    const turnsByNumber = new Map(conversation.turns.map(turn => [turn.turnNumber, turn]));
    const reachable = new Set<number>();
    const queue = [rootTurnNumber];

    while (queue.length > 0) {
      const turnNumber = queue.shift();
      if (turnNumber == null || reachable.has(turnNumber) || !turnsByNumber.has(turnNumber)) continue;
      reachable.add(turnNumber);

      const turn = turnsByNumber.get(turnNumber);
      if (!turn) continue;

      for (const targetTurnNumber of this.getTurnTargetSequence(turn)) {
        if (!reachable.has(targetTurnNumber)) queue.push(targetTurnNumber);
      }
    }

    return reachable;
  }

  private calculatePartialAutoLayoutUpdates(
    conversation: Conversation,
    anchorTurnNumber: number,
    subtreeRootTurnNumber: number,
  ): TurnPositionUpdate[] {
    const anchorTurn = conversation.turns.find(turn => turn.turnNumber === anchorTurnNumber);
    if (!anchorTurn) return [];

    const autoLayoutPositions = this.calculateAutoLayoutUpdates(conversation, this.state.flowDensity);
    const autoLayoutPositionByTurnNumber = new Map(autoLayoutPositions.map(update => [update.turnNumber, update.position]));
    const anchorAutoPosition = autoLayoutPositionByTurnNumber.get(anchorTurnNumber);
    if (!anchorAutoPosition) return [];

    const affectedTurnNumbers = this.collectReachableTurnNumbers(conversation, subtreeRootTurnNumber);
    affectedTurnNumbers.delete(anchorTurnNumber);

    return [...affectedTurnNumbers].map(turnNumber => {
      const autoPosition = autoLayoutPositionByTurnNumber.get(turnNumber);
      if (!autoPosition) {
        const turn = conversation.turns.find(item => item.turnNumber === turnNumber);
        return {
          turnNumber,
          position: turn?.position ?? this.getDefaultTurnPlacement(turnNumber),
        };
      }

      return {
        turnNumber,
        position: {
          x: anchorTurn.position.x + (autoPosition.x - anchorAutoPosition.x),
          y: Math.max(
            getFlowAutoLayoutSpacing(this.state.flowDensity).canvasPaddingY,
            anchorTurn.position.y + (autoPosition.y - anchorAutoPosition.y),
          ),
        },
      };
    });
  }

  private getTurnTargetSequence(turn: Turn): number[] {
    const targets: number[] = [];

    for (const choice of turn.choices) {
      if (choice.continueTo != null) {
        targets.push(choice.continueTo);
      }

      for (const outcome of choice.outcomes) {
        if (outcome.command !== 'pause_job') continue;

        const successTurn = parseInt(outcome.params[1], 10);
        const failTurn = parseInt(outcome.params[2], 10);

        if (!Number.isNaN(successTurn)) {
          targets.push(successTurn);
        }

        if (!Number.isNaN(failTurn)) {
          targets.push(failTurn);
        }
      }
    }

    return [...new Set(targets)];
  }

  private getAutoLayoutVerticalGap(
    previous: AutoLayoutNodeMeta,
    current: AutoLayoutNodeMeta,
    spacing: ReturnType<typeof getFlowAutoLayoutSpacing>,
  ): number {
    if (previous.parentTurnNumber != null && previous.parentTurnNumber === current.parentTurnNumber) {
      return spacing.siblingGap;
    }

    if (previous.groupKey === current.groupKey) {
      return spacing.siblingGap;
    }

    return spacing.branchGroupGap;
  }

  private cloneOutcomeList(outcomes: Choice['outcomes']): Choice['outcomes'] {
    return JSON.parse(JSON.stringify(outcomes)) as Choice['outcomes'];
  }

  private remapContinuationTarget(
    targetTurnNumber: number | undefined,
    options: {
      turnNumberMap?: ReadonlyMap<number, number>;
      validTurnNumbers?: ReadonlySet<number>;
    } = {},
  ): number | undefined {
    if (targetTurnNumber == null) return undefined;
    if (options.turnNumberMap?.has(targetTurnNumber)) {
      return options.turnNumberMap.get(targetTurnNumber);
    }
    if (options.validTurnNumbers?.has(targetTurnNumber)) {
      return targetTurnNumber;
    }
    return undefined;
  }

  private cloneChoiceFromSource(
    sourceChoice: Choice,
    index: number,
    options: {
      turnNumberMap?: ReadonlyMap<number, number>;
      validTurnNumbers?: ReadonlySet<number>;
      parentTurnChannel?: 'pda' | 'f2f';
    } = {},
  ): Choice {
    const parentTurnChannel = options.parentTurnChannel ?? 'pda';
    const choice = createChoice(index);
    choice.text = sourceChoice.text;
    choice.channel = parentTurnChannel;
    choice.preconditions = JSON.parse(JSON.stringify(sourceChoice.preconditions ?? [])) as Choice['preconditions'];
    choice.reply = sourceChoice.reply;
    if (sourceChoice.replyRelHigh != null) choice.replyRelHigh = sourceChoice.replyRelHigh;
    if (sourceChoice.replyRelLow != null) choice.replyRelLow = sourceChoice.replyRelLow;
    choice.outcomes = this.cloneOutcomeList(sourceChoice.outcomes);
    choice.terminal = sourceChoice.terminal ?? sourceChoice.continueTo == null;
    const sourceContinueChannel = sourceChoice.continueChannel ?? sourceChoice.continue_channel;
    choice.continueChannel = sourceContinueChannel == null ? undefined : normalizeChannelValue(sourceContinueChannel, parentTurnChannel);
    choice.continue_channel = choice.continueChannel;
    choice.pdaDelaySeconds = normalizeOptionalNonNegativeInteger(sourceChoice.pdaDelaySeconds);
    choice.story_npc_id = sourceChoice.story_npc_id;
    choice.npc_faction_filters = sourceChoice.npc_faction_filters ? [...sourceChoice.npc_faction_filters] : undefined;
    choice.npc_profile_filters = sourceChoice.npc_profile_filters ? [...sourceChoice.npc_profile_filters] : undefined;
    choice.allow_generic_stalker = sourceChoice.allow_generic_stalker ?? false;

    const continueTo = this.remapContinuationTarget(sourceChoice.continueTo, options);
    if (continueTo != null) choice.continueTo = continueTo;

    return choice;
  }

  private cloneTurnFromSource(
    sourceTurn: Turn,
    turnNumber: number,
    options: {
      turnNumberMap?: ReadonlyMap<number, number>;
      validTurnNumbers?: ReadonlySet<number>;
    } = {},
  ): Turn {
    const turn = createTurn(turnNumber);
    turn.openingMessage = sourceTurn.openingMessage;
    turn.preconditions = JSON.parse(JSON.stringify(sourceTurn.preconditions ?? [])) as Turn['preconditions'];
    turn.channel = normalizeChannelValue(sourceTurn.channel, 'pda');
    turn.requiresNpcFirst = sourceTurn.requiresNpcFirst;
    turn.pda_entry = sourceTurn.pda_entry ?? turnNumber === 1;
    turn.f2f_entry = sourceTurn.f2f_entry ?? false;
    turn.firstSpeaker = inferTurnFirstSpeaker(sourceTurn);
    turn.customLabel = sourceTurn.customLabel;
    turn.color = sourceTurn.color;
    turn.choices = sourceTurn.choices.map((choice, index) => this.cloneChoiceFromSource(choice, index + 1, {
      ...options,
      parentTurnChannel: turn.channel,
    }));
    normalizeTurnEntryFlags(turn);
    return turn;
  }

  loadProject(project: Project, systemStrings: Map<string, string>): void {
    this.clearScheduledValidation();
    this.clearPendingTextSessions();
    const sanitizedProject = migrateLegacyF2FEntryOpenings(project);
    this.state.project = {
      ...sanitizedProject,
      conversations: sanitizedProject.conversations.map((conversation) => ({
        ...conversation,
        initialChannel: normalizeChannelValue(conversation.initialChannel, normalizeChannelValue(conversation.turns.find((turn) => turn.turnNumber === 1)?.channel, 'pda')),
        faction: getConversationFaction(conversation, sanitizedProject.faction),
        turns: conversation.turns.map((turn, turnIndex) => {
          const parentTurnChannel = normalizeChannelValue(turn.channel, 'pda');
          const normalizedTurn: Turn = {
            ...turn,
            channel: parentTurnChannel,
            preconditions: JSON.parse(JSON.stringify(turn.preconditions ?? [])) as Turn['preconditions'],
            requiresNpcFirst: typeof turn.requiresNpcFirst === 'boolean'
              ? turn.requiresNpcFirst
              : undefined,
            pda_entry: typeof turn.pda_entry === 'boolean' ? turn.pda_entry : false,
            f2f_entry: turn.f2f_entry ?? false,
            firstSpeaker: inferTurnFirstSpeaker(turn, { allowChannelInference: false }),
            position: turn.position ?? getDefaultFlowTurnPosition(turnIndex + 1),
            choices: turn.choices.map((choice, choiceIndex) => ({
              ...choice,
              index: choice.index ?? choiceIndex + 1,
              channel: parentTurnChannel,
              preconditions: JSON.parse(JSON.stringify(choice.preconditions ?? [])) as Choice['preconditions'],
              terminal: choice.terminal ?? choice.continueTo == null,
              continueChannel: (() => {
                const sourceContinueChannel = choice.continueChannel ?? choice.continue_channel;
                return sourceContinueChannel == null ? undefined : normalizeChannelValue(sourceContinueChannel, parentTurnChannel);
              })(),
              continue_channel: (() => {
                const sourceContinueChannel = choice.continueChannel ?? choice.continue_channel;
                return sourceContinueChannel == null ? undefined : normalizeChannelValue(sourceContinueChannel, parentTurnChannel);
              })(),
              pdaDelaySeconds: normalizeOptionalNonNegativeInteger(choice.pdaDelaySeconds),
              allow_generic_stalker: choice.allow_generic_stalker ?? false,
            })),
          };
          normalizeTurnEntryFlags(normalizedTurn, { inferDefaults: false });
          return normalizedTurn;
        }),
      })),
    };
    this.state.systemStrings = systemStrings;
    this.state.selectedConversationId = sanitizedProject.conversations.length > 0 ? sanitizedProject.conversations[0].id : null;
    this.clearSelection({ notify: false });
    this.state.showXmlPreview = false;
    this.state.showSystemStringsPanel = false;
    this.state.showValidationPanel = false;
    this.state.bottomWorkspaceTab = null;
    this.state.bottomWorkspaceHeight = 280;
    this.state.dirty = false;
    this.state.undoStack = [];
    this.state.redoStack = [];
    this.state.copiedTurn = null;
    this.state.copiedChoice = null;
    this.state.conversationSourceMetadata = new Map();
    this.state.collab = createEmptyCollabState();
    this.markProjectChanged();
    this.markSystemStringsChanged();
    this.markFlowChanged('structure');
    const baseChange = this.prepareChange(FULL_APP_RENDER, { projectChanged: true, systemStringsChanged: true });
    const validationChange = this.revalidate(baseChange, { notify: false });
    const nextChange = validationChange ? mergeChanges(baseChange, validationChange) : baseChange;
    nextChange.projectChanged = true;
    nextChange.systemStringsChanged = true;
    nextChange.validationChanged = validationChange?.validationChanged ?? false;
    this.notify(nextChange);
  }

  applyCollabConversationSnapshot(
    conversationId: number,
    conversation: Conversation,
    version: number,
    options: { select?: boolean } = {},
  ): void {
    this.clearPendingTextSessions();
    const nextConversation = cloneConversation(conversation);
    const existingIndex = this.state.project.conversations.findIndex((item) => item.id === conversationId);
    if (existingIndex >= 0) {
      this.state.project.conversations[existingIndex] = nextConversation;
    } else {
      this.state.project.conversations.push(nextConversation);
    }
    if (options.select || this.state.selectedConversationId == null) {
      this.state.selectedConversationId = conversationId;
    }
    if (
      this.state.selectedConversationId === conversationId
      && this.state.selectedTurnNumber != null
      && !nextConversation.turns.some((turn) => turn.turnNumber === this.state.selectedTurnNumber)
    ) {
      this.state.selectedTurnNumber = null;
      this.state.selectedChoiceIndex = null;
    }
    this.state.dirty = true;
    this.state.collab.version = Math.max(this.state.collab.version, version);
    this.markProjectChanged();
    this.markFlowChanged('structure');
    const change = this.prepareChange(createFlowChange('structure', 'conversationList', 'flowEditor', 'propertiesPanel', 'toolbar'), {
      projectChanged: true,
    });
    const validationChange = this.revalidate(change, { notify: false });
    const nextChange = validationChange ? mergeChanges(change, validationChange) : change;
    nextChange.projectChanged = true;
    nextChange.validationChanged = validationChange?.validationChanged ?? false;
    this.notify(nextChange);
  }

  setFaction(faction: Project['faction']): void {
    this.pushUndo();
    this.state.project.faction = faction;
    this.finishProjectMutation();
  }

  setConversationFaction(id: number, faction: Project['faction']): void {
    const conv = this.state.project.conversations.find(c => c.id === id);
    if (!conv || conv.faction === faction) return;
    this.pushUndo();
    conv.faction = faction;
    this.finishProjectMutation();
  }

  setConversationInitialChannel(id: number, channel: 'pda' | 'f2f'): void {
    const conv = this.state.project.conversations.find(c => c.id === id);
    if (!conv) return;
    this.pushUndo();
    conv.initialChannel = channel;
    const firstTurn = conv.turns.find((turn) => turn.turnNumber === 1);
    if (firstTurn) {
      firstTurn.channel = channel;
      if (channel === 'f2f') {
        firstTurn.f2f_entry = true;
        firstTurn.pda_entry = false;
      } else {
        firstTurn.pda_entry = true;
        firstTurn.f2f_entry = false;
      }
      normalizeTurnEntryFlags(firstTurn);
    }
    this.finishProjectMutation();
  }

  clearSelection(options: { notify?: boolean } = {}): void {
    this.state.selectedTurnNumber = null;
    this.state.selectedChoiceIndex = null;
    this.state.propertiesTab = 'conversation';
    if (options.notify ?? true) this.notify(SELECTION_RENDER);
  }

  selectConversation(id: number | null): void {
    this.state.selectedConversationId = id;
    this.clearSelection({ notify: false });
    this.notify(FULL_APP_RENDER);
  }

  selectTurn(turnNumber: number): void {
    this.state.selectedTurnNumber = turnNumber;
    this.state.selectedChoiceIndex = null;
    this.state.propertiesTab = 'selection';
    this.notify(SELECTION_RENDER);
  }

  selectChoice(index: number | null): void {
    this.state.selectedChoiceIndex = index;
    if (index != null) this.state.propertiesTab = 'selection';
    this.notify(SELECTION_RENDER);
  }

  setPropertiesTab(tab: PropertiesTab): void {
    this.state.propertiesTab = tab;
    this.notify(SELECTION_RENDER);
  }

  toggleXmlPreview(): void {
    this.state.showXmlPreview = !this.state.showXmlPreview;
    this.syncBottomWorkspaceTab(this.state.showXmlPreview ? 'xml' : undefined);
    this.notify(FULL_APP_RENDER);
  }

  toggleSystemStringsPanel(): void {
    this.state.showSystemStringsPanel = !this.state.showSystemStringsPanel;
    this.syncBottomWorkspaceTab(this.state.showSystemStringsPanel ? 'strings' : undefined);
    this.notify(FULL_APP_RENDER);
  }

  toggleValidationPanel(): void {
    if (!this.state.showValidationPanel && this.state.validationMessages.length === 0) return;
    this.state.showValidationPanel = !this.state.showValidationPanel;
    this.syncBottomWorkspaceTab();
    this.notify(FULL_APP_RENDER);
  }

  setAdvancedMode(enabled: boolean): void {
    if (this.state.advancedMode === enabled) return;
    this.state.advancedMode = enabled;
    persistAdvancedMode(enabled);
    if (!enabled) {
      this.state.showXmlPreview = false;
      this.state.showSystemStringsPanel = false;
      this.syncBottomWorkspaceTab();
    }
    this.notify(FULL_APP_RENDER);
  }

  toggleAdvancedMode(): void {
    this.setAdvancedMode(!this.state.advancedMode);
  }

  setBottomWorkspaceTab(tab: BottomWorkspaceTab): void {
    if (this.getOpenBottomWorkspaceTabs().includes(tab)) {
      this.state.bottomWorkspaceTab = tab;
      this.notify(FULL_APP_RENDER);
    }
  }

  closeBottomWorkspaceTab(tab: BottomWorkspaceTab): void {
    if (tab === 'strings') this.state.showSystemStringsPanel = false;
    if (tab === 'xml') this.state.showXmlPreview = false;
    this.syncBottomWorkspaceTab();
    this.notify(FULL_APP_RENDER);
  }

  setBottomWorkspaceHeight(height: number): void {
    const next = Math.max(180, Math.min(520, Math.round(height)));
    if (next === this.state.bottomWorkspaceHeight) return;
    this.state.bottomWorkspaceHeight = next;
    this.notify(FULL_APP_RENDER);
  }

  setFlowDensity(density: FlowDensity): void {
    if (this.state.flowDensity === density) return;
    this.state.flowDensity = density;
    // Auto-relayout the selected conversation so nodes don't overlap at the new size.
    // batchUpdateTurnPositions() already triggers a single notify when positions change,
    // so avoid immediately issuing a second full-app render here.
    if (this.state.selectedConversationId != null) {
      const conv = this.getConversationById(this.state.selectedConversationId);
      if (conv) {
        const updates = this.calculateAutoLayoutUpdates(conv, density);
        let hasPositionChanges = false;
        for (const update of updates) {
          const turn = conv.turns.find(item => item.turnNumber === update.turnNumber);
          if (!turn) continue;
          const nextX = Math.max(0, Math.round(update.position.x));
          const nextY = Math.max(0, Math.round(update.position.y));
          if (turn.position.x !== nextX || turn.position.y !== nextY) {
            hasPositionChanges = true;
            break;
          }
        }
        this.batchUpdateTurnPositions(this.state.selectedConversationId, updates);
        if (hasPositionChanges) return;
      }
    }
    this.notify(FULL_APP_RENDER);
  }

  setCustomCursorEnabled(enabled: boolean): void {
    if (this.state.customCursorEnabled === enabled) return;
    this.state.customCursorEnabled = enabled;
    persistCursorPrefs({
      enabled: this.state.customCursorEnabled,
      animationIntensity: this.state.cursorAnimationIntensity,
      size: this.state.cursorSize,
    });
    this.notify(createFlowChange('settings', 'flowEditor'));
  }

  setCursorAnimationIntensity(intensity: CursorAnimationIntensity): void {
    if (this.state.cursorAnimationIntensity === intensity) return;
    this.state.cursorAnimationIntensity = intensity;
    persistCursorPrefs({
      enabled: this.state.customCursorEnabled,
      animationIntensity: this.state.cursorAnimationIntensity,
      size: this.state.cursorSize,
    });
    this.notify(createFlowChange('settings', 'flowEditor'));
  }

  setCursorSize(size: number): void {
    const next = Math.max(12, Math.min(28, Math.round(size)));
    if (this.state.cursorSize === next) return;
    this.state.cursorSize = next;
    persistCursorPrefs({
      enabled: this.state.customCursorEnabled,
      animationIntensity: this.state.cursorAnimationIntensity,
      size: this.state.cursorSize,
    });
    this.notify(createFlowChange('settings', 'flowEditor'));
  }

  getSelectedConversation(): Conversation | null {
    if (this.state.selectedConversationId == null) return null;
    return this.state.project.conversations.find(c => c.id === this.state.selectedConversationId) || null;
  }

  getSelectedTurn(): Turn | null {
    const conv = this.getSelectedConversation();
    if (!conv || this.state.selectedTurnNumber == null) return null;
    return conv.turns.find(t => t.turnNumber === this.state.selectedTurnNumber) || null;
  }

  getSelectedChoice(): Choice | null {
    const turn = this.getSelectedTurn();
    if (!turn || this.state.selectedChoiceIndex == null) return null;
    return turn.choices.find(c => c.index === this.state.selectedChoiceIndex) || null;
  }

  hasCopiedTurn(conversationId?: number | null): boolean {
    if (!this.state.copiedTurn) return false;
    return conversationId == null || this.state.copiedTurn.conversationId === conversationId;
  }

  hasCopiedChoice(conversationId?: number | null): boolean {
    if (!this.state.copiedChoice) return false;
    return conversationId == null || this.state.copiedChoice.conversationId === conversationId;
  }

  addConversation(): void {
    this.pushUndo();
    const conv = createConversation(this.state.project);
    conv.faction = getConversationFaction(this.getSelectedConversation(), this.state.project.faction);
    this.state.project.conversations.push(conv);
    this.state.selectedConversationId = conv.id;
    this.clearSelection({ notify: false });
    this.finishProjectMutation();
  }

  addConversationFromTemplate(conversation: Conversation, npcTemplates: NpcTemplate[] = []): void {
    this.pushUndo();
    const maxId = this.state.project.conversations.reduce((max, item) => Math.max(max, item.id), 0);
    const nextConversation: Conversation = JSON.parse(JSON.stringify(conversation));
    nextConversation.id = maxId + 1;
    nextConversation.faction = getConversationFaction(nextConversation, this.state.project.faction);
    nextConversation.turns.forEach((turn, index) => {
      turn.turnNumber = index + 1;
      turn.choices = turn.choices.map((choice, choiceIndex) => ({
        ...choice,
        index: choiceIndex + 1,
      }));
      normalizeTurnEntryFlags(turn);
    });
    this.state.project.conversations.push(nextConversation);
    if (npcTemplates.length > 0) {
      const existing = new Map((this.state.project.npcTemplates ?? []).map((template) => [template.id, template]));
      for (const template of npcTemplates) {
        existing.set(template.id, JSON.parse(JSON.stringify(template)) as NpcTemplate);
      }
      this.state.project.npcTemplates = [...existing.values()];
    }
    this.state.selectedConversationId = nextConversation.id;
    this.clearSelection({ notify: false });
    this.finishProjectMutation();
  }

  deleteConversation(id: number): void {
    this.pushUndo();
    const previousConversations = [...this.state.project.conversations];
    this.state.project.conversations = this.state.project.conversations.filter(c => c.id !== id);
    this.state.project.conversations.forEach((c, i) => { c.id = i + 1; });
    const remappedMetadata = new Map<number, ConversationSourceMetadata>();
    previousConversations
      .filter(conversation => conversation.id !== id)
      .forEach((conversation, index) => {
        const metadata = this.state.conversationSourceMetadata.get(conversation.id);
        if (metadata) remappedMetadata.set(index + 1, metadata);
      });
    this.state.conversationSourceMetadata = remappedMetadata;
    if (this.state.selectedConversationId === id) {
      this.state.selectedConversationId = this.state.project.conversations.length > 0
        ? this.state.project.conversations[0].id : null;
      this.clearSelection({ notify: false });
    }
    this.finishProjectMutation();
  }

  duplicateConversation(id: number): void {
    this.pushUndo();
    const source = this.state.project.conversations.find(c => c.id === id);
    if (!source) return;
    const maxId = this.state.project.conversations.reduce((m, c) => Math.max(m, c.id), 0);
    const dup: Conversation = JSON.parse(JSON.stringify(source));
    dup.id = maxId + 1;
    dup.label = source.label + ' (copy)';
    this.state.project.conversations.push(dup);
    this.state.conversationSourceMetadata.delete(dup.id);
    this.state.selectedConversationId = dup.id;
    this.clearSelection({ notify: false });
    this.finishProjectMutation();
  }

  updateConversation(id: number, updates: Partial<Conversation>, options: MutationOptions = {}): void {
    const conv = this.state.project.conversations.find(c => c.id === id);
    if (!conv) return;
    if (!hasOwnUpdates(conv, updates)) return;

    const apply = () => {
      Object.assign(conv, updates);
    };

    if (options.textSessionKey) {
      this.applyTextMutation(options.textSessionKey, options.change ?? FULL_APP_RENDER, apply);
      return;
    }

    this.pushUndo();
    apply();
    this.finishProjectMutation({
      revalidate: options.revalidate ?? true,
      change: options.change ?? FULL_APP_RENDER,
    });
  }

  autoLayoutConversation(conversationId: number): void {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) return;
    this.batchUpdateTurnPositions(conversationId, this.calculateAutoLayoutUpdates(conversation, this.state.flowDensity));
  }

  createConnectedTurn(
    conversationId: number,
    sourceTurnNumber: number,
    choiceIndex: number,
    options: { skipUndo?: boolean } = {},
  ): number | null {
    const conversation = this.getConversationById(conversationId);
    const sourceTurn = conversation?.turns.find(turn => turn.turnNumber === sourceTurnNumber);
    const sourceChoice = sourceTurn?.choices.find(choice => choice.index === choiceIndex);
    if (!conversation || !sourceTurn || !sourceChoice) return null;

    if (!(options.skipUndo ?? false)) {
      this.pushUndo();
    }

    const nextTurnNumber = conversation.turns.reduce((max, turn) => Math.max(max, turn.turnNumber), 0) + 1;
    const newTurn = createTurn(nextTurnNumber);
    const sourceTurnChannel = normalizeChannelValue(sourceTurn.channel, normalizeChannelValue(conversation.initialChannel, 'pda'));
    const sourceChoiceChannel = sourceTurnChannel;
    const sourceContinueChannel = sourceChoice.continueChannel ?? sourceChoice.continue_channel;
    const destinationChannel = normalizeChannelValue(sourceContinueChannel, sourceChoiceChannel);

    newTurn.channel = destinationChannel;
    for (const choice of newTurn.choices) {
      choice.channel = destinationChannel;
      choice.continueChannel = destinationChannel;
      choice.continue_channel = destinationChannel;
    }
    sourceChoice.continueChannel = destinationChannel;
    sourceChoice.continue_channel = destinationChannel;

    const isCrossChannelHandoff = computeSegmentStartFlag(sourceChoiceChannel, destinationChannel);
    if (destinationChannel === 'f2f') {
      newTurn.f2f_entry = isCrossChannelHandoff;
    } else {
      newTurn.pda_entry = isCrossChannelHandoff;
    }
    normalizeTurnEntryFlags(newTurn);

    newTurn.position = this.getContextualTurnPlacement(conversation, newTurn, {
      sourceTurnNumber,
      sourceChoiceIndex: choiceIndex,
    });

    sourceChoice.continueTo = nextTurnNumber;
    sourceChoice.terminal = false;
    conversation.turns.push(newTurn);
    const partialUpdates = this.calculatePartialAutoLayoutUpdates(conversation, sourceTurnNumber, sourceTurnNumber);
    for (const update of partialUpdates) {
      const turn = conversation.turns.find(item => item.turnNumber === update.turnNumber);
      if (!turn) continue;
      turn.position.x = Math.max(0, Math.round(update.position.x));
      turn.position.y = Math.max(0, Math.round(update.position.y));
    }
    this.state.selectedConversationId = conversationId;
    this.state.selectedTurnNumber = nextTurnNumber;
    this.state.selectedChoiceIndex = null;
    this.state.propertiesTab = 'selection';
    this.finishProjectMutation();
    return nextTurnNumber;
  }

  duplicateTurn(conversationId: number, sourceTurnNumber: number): number | null {
    const conversation = this.getConversationById(conversationId);
    const sourceTurn = conversation?.turns.find(turn => turn.turnNumber === sourceTurnNumber);
    if (!conversation || !sourceTurn) return null;

    const nextTurnNumber = conversation.turns.reduce((max, turn) => Math.max(max, turn.turnNumber), 0) + 1;
    const turnNumberMap = new Map([[sourceTurn.turnNumber, nextTurnNumber]]);
    const validTurnNumbers = new Set(conversation.turns.map(turn => turn.turnNumber));
    validTurnNumbers.add(nextTurnNumber);

    this.pushUndo();

    const duplicatedTurn = this.cloneTurnFromSource(sourceTurn, nextTurnNumber, {
      turnNumberMap,
      validTurnNumbers,
    });
    duplicatedTurn.position = this.getContextualTurnPlacement(conversation, duplicatedTurn, {
      anchorTurnNumber: sourceTurnNumber,
    });

    conversation.turns.push(duplicatedTurn);
    this.state.selectedConversationId = conversationId;
    this.state.selectedTurnNumber = duplicatedTurn.turnNumber;
    this.state.selectedChoiceIndex = null;
    this.state.propertiesTab = 'selection';
    this.finishProjectMutation();
    return duplicatedTurn.turnNumber;
  }

  copyTurn(conversationId: number, turnNumber: number): boolean {
    const conversation = this.getConversationById(conversationId);
    const turn = conversation?.turns.find(item => item.turnNumber === turnNumber);
    if (!turn) return false;

    this.state.copiedTurn = {
      conversationId,
      turn: JSON.parse(JSON.stringify(turn)) as Turn,
    };
    this.notify();
    return true;
  }

  pasteTurn(conversationId: number, anchorTurnNumber: number | null = null): number | null {
    const conversation = this.getConversationById(conversationId);
    const clipboard = this.state.copiedTurn;
    if (!conversation || !clipboard || clipboard.conversationId !== conversationId) return null;

    const nextTurnNumber = conversation.turns.reduce((max, turn) => Math.max(max, turn.turnNumber), 0) + 1;
    const turnNumberMap = new Map([[clipboard.turn.turnNumber, nextTurnNumber]]);
    const validTurnNumbers = new Set(conversation.turns.map(turn => turn.turnNumber));
    validTurnNumbers.add(nextTurnNumber);

    this.pushUndo();

    const pastedTurn = this.cloneTurnFromSource(clipboard.turn, nextTurnNumber, {
      turnNumberMap,
      validTurnNumbers,
    });
    pastedTurn.position = this.getContextualTurnPlacement(conversation, pastedTurn, {
      anchorTurnNumber,
    });

    conversation.turns.push(pastedTurn);
    this.state.selectedConversationId = conversationId;
    this.state.selectedTurnNumber = pastedTurn.turnNumber;
    this.state.selectedChoiceIndex = null;
    this.state.propertiesTab = 'selection';
    this.finishProjectMutation();
    return pastedTurn.turnNumber;
  }

  addTurn(conversationId: number): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    this.pushUndo();
    const maxTurn = conv.turns.reduce((m, t) => Math.max(m, t.turnNumber), 0);
    const turn = createTurn(maxTurn + 1);
    turn.position = this.getContextualTurnPlacement(conv, turn, {
      anchorTurnNumber: this.state.selectedConversationId === conversationId ? this.state.selectedTurnNumber : null,
    });
    conv.turns.push(turn);
    this.state.selectedConversationId = conversationId;
    this.state.selectedTurnNumber = turn.turnNumber;
    this.state.selectedChoiceIndex = null;
    this.state.propertiesTab = 'selection';
    this.finishProjectMutation();
  }

  deleteTurn(conversationId: number, turnNumber: number): void {
    if (turnNumber === 1) return;
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    this.pushUndo();
    conv.turns = conv.turns.filter(t => t.turnNumber !== turnNumber);
    if (this.state.selectedTurnNumber === turnNumber) {
      this.clearSelection({ notify: false });
    }
    this.finishProjectMutation();
  }

  updateTurn(conversationId: number, turnNumber: number, updates: Partial<Turn>, options: MutationOptions = {}): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    if (!turn) return;
    if (!hasOwnUpdates(turn, updates)) return;

    const apply = () => {
      const previousChannel = normalizeChannelValue(turn.channel, 'pda');
      Object.assign(turn, updates);
      normalizeTurnEntryFlags(turn);
      const normalizedTurnChannel = normalizeChannelValue(turn.channel, 'pda');
      if (normalizedTurnChannel !== previousChannel || updates.channel != null) {
        for (const choice of turn.choices) {
          choice.channel = normalizedTurnChannel;
        }
      }
    };

    if (options.textSessionKey) {
      this.applyTextMutation(options.textSessionKey, options.change ?? FULL_APP_RENDER, apply);
      return;
    }

    this.pushUndo();
    apply();
    this.finishProjectMutation({
      revalidate: options.revalidate ?? true,
      change: options.change ?? FULL_APP_RENDER,
    });
  }

  updateTurnPosition(conversationId: number, turnNumber: number, position: { x: number; y: number }): void {
    const conv = this.getConversationById(conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    if (!turn) return;

    const nextX = Math.max(0, Math.round(position.x));
    const nextY = Math.max(0, Math.round(position.y));
    if (turn.position.x === nextX && turn.position.y === nextY) return;

    this.pushUndo();
    turn.position.x = nextX;
    turn.position.y = nextY;
    this.finishProjectMutation({ revalidate: false, change: createFlowChange('position', 'flowEditor') });
  }

  batchUpdateTurnPositions(conversationId: number, updates: TurnPositionUpdate[]): void {
    if (updates.length === 0) return;

    const conv = this.getConversationById(conversationId);
    if (!conv) return;

    let changed = false;
    for (const update of updates) {
      const turn = conv.turns.find(t => t.turnNumber === update.turnNumber);
      if (!turn) continue;

      const nextX = Math.max(0, Math.round(update.position.x));
      const nextY = Math.max(0, Math.round(update.position.y));
      if (turn.position.x === nextX && turn.position.y === nextY) continue;

      if (!changed) this.pushUndo();
      changed = true;
      turn.position.x = nextX;
      turn.position.y = nextY;
    }

    if (!changed) return;
    this.finishProjectMutation({ revalidate: false, change: createFlowChange('position', 'flowEditor') });
  }

  setTurnCustomLabel(conversationId: number, turnNumber: number, label: string): void {
    const conv = this.getConversationById(conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    if (!turn) return;
    this.pushUndo();
    if (label.trim() === '') {
      delete turn.customLabel;
    } else {
      turn.customLabel = label.trim();
    }
    this.finishProjectMutation({ revalidate: false });
  }

  setTurnColor(conversationId: number, turnNumber: number, color: string): void {
    const conv = this.getConversationById(conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    if (!turn) return;
    this.pushUndo();
    if (color === '') {
      delete turn.color;
    } else {
      turn.color = color;
    }
    this.finishProjectMutation({ revalidate: false });
  }

  addFlowAnnotation(conversationId: number, annotation: FlowAnnotation): void {
    const conv = this.getConversationById(conversationId);
    if (!conv) return;
    this.pushUndo();
    conv.flowAnnotations = [...(conv.flowAnnotations ?? []), cloneConversation(annotation)];
    this.finishProjectMutation({ revalidate: false, change: createFlowChange('structure', 'flowEditor') });
  }

  updateFlowAnnotation(conversationId: number, annotationId: string, updates: Partial<FlowAnnotation>): void {
    const conv = this.getConversationById(conversationId);
    const annotation = conv?.flowAnnotations?.find(item => item.id === annotationId);
    if (!conv || !annotation) return;
    if (!hasOwnUpdates(annotation, updates)) return;
    this.pushUndo();
    Object.assign(annotation, cloneConversation(updates));
    this.finishProjectMutation({ revalidate: false, change: createFlowChange('structure', 'flowEditor') });
  }

  deleteFlowAnnotation(conversationId: number, annotationId: string): void {
    const conv = this.getConversationById(conversationId);
    if (!conv?.flowAnnotations?.some(item => item.id === annotationId)) return;
    this.pushUndo();
    conv.flowAnnotations = conv.flowAnnotations.filter(item => item.id !== annotationId);
    if (conv.flowAnnotations.length === 0) {
      delete conv.flowAnnotations;
    }
    this.finishProjectMutation({ revalidate: false, change: createFlowChange('structure', 'flowEditor') });
  }

  clearFlowAnnotations(conversationId: number): void {
    const conv = this.getConversationById(conversationId);
    if (!conv?.flowAnnotations?.length) return;
    this.pushUndo();
    delete conv.flowAnnotations;
    this.finishProjectMutation({ revalidate: false, change: createFlowChange('structure', 'flowEditor') });
  }

  addChoice(conversationId: number, turnNumber: number): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    if (!turn || turn.choices.length >= 4) return;
    this.pushUndo();
    const nextIndex = turn.choices.length + 1;
    const newChoice = createChoice(nextIndex);
    newChoice.channel = normalizeChannelValue(turn.channel, 'pda');
    turn.choices.push(newChoice);
    this.finishProjectMutation();
  }

  duplicateChoice(conversationId: number, turnNumber: number, choiceIndex: number): number | null {
    const conv = this.getConversationById(conversationId);
    const turn = conv?.turns.find(item => item.turnNumber === turnNumber);
    const sourceChoice = turn?.choices.find(choice => choice.index === choiceIndex);
    if (!conv || !turn || !sourceChoice || turn.choices.length >= 4) return null;

    const validTurnNumbers = new Set(conv.turns.map(item => item.turnNumber));
    const nextIndex = turn.choices.length + 1;

    this.pushUndo();
    turn.choices.push(this.cloneChoiceFromSource(sourceChoice, nextIndex, {
      validTurnNumbers,
      parentTurnChannel: normalizeChannelValue(turn.channel, 'pda'),
    }));
    this.state.selectedConversationId = conversationId;
    this.state.selectedTurnNumber = turnNumber;
    this.state.selectedChoiceIndex = nextIndex;
    this.state.propertiesTab = 'selection';
    this.finishProjectMutation();
    return nextIndex;
  }

  copyChoice(conversationId: number, turnNumber: number, choiceIndex: number): boolean {
    const conv = this.getConversationById(conversationId);
    const turn = conv?.turns.find(item => item.turnNumber === turnNumber);
    const choice = turn?.choices.find(item => item.index === choiceIndex);
    if (!choice) return false;

    this.state.copiedChoice = {
      conversationId,
      turnNumber,
      choice: JSON.parse(JSON.stringify(choice)) as Choice,
    };
    this.notify();
    return true;
  }

  pasteChoice(conversationId: number, turnNumber: number): number | null {
    const conv = this.getConversationById(conversationId);
    const turn = conv?.turns.find(item => item.turnNumber === turnNumber);
    const clipboard = this.state.copiedChoice;
    if (!conv || !turn || !clipboard || clipboard.conversationId !== conversationId || turn.choices.length >= 4) return null;

    const validTurnNumbers = new Set(conv.turns.map(item => item.turnNumber));
    const nextIndex = turn.choices.length + 1;

    this.pushUndo();
    turn.choices.push(this.cloneChoiceFromSource(clipboard.choice, nextIndex, {
      validTurnNumbers,
      parentTurnChannel: normalizeChannelValue(turn.channel, 'pda'),
    }));
    this.state.selectedConversationId = conversationId;
    this.state.selectedTurnNumber = turnNumber;
    this.state.selectedChoiceIndex = nextIndex;
    this.state.propertiesTab = 'selection';
    this.finishProjectMutation();
    return nextIndex;
  }

  deleteChoice(conversationId: number, turnNumber: number, choiceIndex: number): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    if (!turn || turn.choices.length <= 1) return;
    this.pushUndo();
    turn.choices = turn.choices.filter(c => c.index !== choiceIndex);
    turn.choices.forEach((c, i) => { c.index = i + 1; });
    if (this.state.selectedChoiceIndex === choiceIndex) {
      this.state.selectedChoiceIndex = null;
    }
    this.finishProjectMutation();
  }

  updateChoice(
    conversationId: number,
    turnNumber: number,
    choiceIndex: number,
    updates: Partial<Choice>,
    options: MutationOptions = {},
  ): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    const choice = turn?.choices.find(c => c.index === choiceIndex);
    if (!choice || !turn) return;
    if (!hasOwnUpdates(choice, updates)) return;

    const apply = () => {
      Object.assign(choice, updates);
      choice.pdaDelaySeconds = normalizeOptionalNonNegativeInteger(choice.pdaDelaySeconds);
      if (choice.continueTo == null) {
        choice.terminal = true;
        delete choice.continueChannel;
        delete choice.continue_channel;
      } else {
        choice.terminal = false;
        const normalizedTurnChannel = normalizeChannelValue(turn.channel, 'pda');
        const normalizedContinuationChannel = normalizeChannelValue(
          choice.continueChannel ?? choice.continue_channel,
          normalizedTurnChannel,
        );
        choice.continueChannel = normalizedContinuationChannel;
        choice.continue_channel = normalizedContinuationChannel;
      }
      choice.channel = normalizeChannelValue(turn.channel, 'pda');
    };

    if (options.textSessionKey) {
      this.applyTextMutation(options.textSessionKey, options.change ?? FULL_APP_RENDER, apply);
      return;
    }

    this.pushUndo();
    apply();
    this.finishProjectMutation({
      revalidate: options.revalidate ?? true,
      change: options.change ?? FULL_APP_RENDER,
    });
  }

  setChoiceContinuationChannel(conversationId: number, turnNumber: number, choiceIndex: number, nextChannel: 'pda' | 'f2f'): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    const choice = turn?.choices.find(c => c.index === choiceIndex);
    if (!conv || !turn || !choice) return;

    this.pushUndo();
    this.applyChoiceContinuationChannel(conv, turn, choice, nextChannel);
    this.finishProjectMutation();
  }

  ensureChoiceContinuationTurn(
    conversationId: number,
    turnNumber: number,
    choiceIndex: number,
    nextChannel: 'pda' | 'f2f',
  ): number | null {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    const choice = turn?.choices.find(c => c.index === choiceIndex);
    if (!conv || !turn || !choice) return null;

    if (choice.continueTo == null) {
      this.pushUndo();
      choice.continueChannel = nextChannel;
      choice.continue_channel = nextChannel;
      return this.createConnectedTurn(conversationId, turnNumber, choiceIndex, { skipUndo: true });
    }

    this.pushUndo();
    this.applyChoiceContinuationChannel(conv, turn, choice, nextChannel);
    this.finishProjectMutation();
    return choice.continueTo;
  }

  connectChoiceToTurn(conversationId: number, turnNumber: number, choiceIndex: number, targetTurnNumber: number): void {
    if (turnNumber === targetTurnNumber) return;
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    const target = conv?.turns.find(t => t.turnNumber === targetTurnNumber);
    const choice = turn?.choices.find(c => c.index === choiceIndex);
    if (!conv || !turn || !choice || !target) return;
    this.pushUndo();
    choice.continueTo = targetTurnNumber;
    choice.terminal = false;
    const sourceChannel = normalizeChannelValue(turn.channel, normalizeChannelValue(conv.initialChannel, 'pda'));
    const destinationChannel = normalizeChannelValue(target.channel, sourceChannel);
    choice.continueChannel = destinationChannel;
    choice.continue_channel = destinationChannel;
    this.finishProjectMutation();
  }

  clearChoiceContinuation(conversationId: number, turnNumber: number, choiceIndex: number): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    const choice = turn?.choices.find(c => c.index === choiceIndex);
    if (!choice || choice.continueTo == null) return;
    this.pushUndo();
    delete choice.continueTo;
    choice.terminal = true;
    delete choice.continueChannel;
    delete choice.continue_channel;
    this.finishProjectMutation();
  }

  private applyChoiceContinuationChannel(
    conv: Conversation,
    turn: Turn,
    choice: Choice,
    nextChannel: 'pda' | 'f2f',
  ): void {
    const sourceTurnChannel = normalizeChannelValue(turn.channel, normalizeChannelValue(conv.initialChannel, 'pda'));
    const sourceChoiceChannel = sourceTurnChannel;
    const isSegmentStart = computeSegmentStartFlag(sourceChoiceChannel, nextChannel);

    choice.continueChannel = nextChannel;
    choice.continue_channel = nextChannel;

    if (choice.continueTo == null) return;
    const targetTurn = conv.turns.find((candidate) => candidate.turnNumber === choice.continueTo);
    if (!targetTurn) return;

    targetTurn.channel = nextChannel;
    for (const targetChoice of targetTurn.choices) {
      targetChoice.channel = nextChannel;
    }
    if (nextChannel === 'f2f') {
      targetTurn.f2f_entry = isSegmentStart;
      targetTurn.pda_entry = false;
    } else {
      targetTurn.pda_entry = isSegmentStart;
      targetTurn.f2f_entry = false;
    }
    normalizeTurnEntryFlags(targetTurn);
  }

  /**
   * Appends conversations from an external source into the current project,
   * re-assigning IDs to avoid conflicts with existing conversations.
   * Returns the ID of the first imported conversation so callers can select it.
   */
  mergeConversations(incoming: Conversation[]): number | null {
    if (incoming.length === 0) return null;
    this.pushUndo();
    const maxId = this.state.project.conversations.reduce((m, c) => Math.max(m, c.id), 0);
    let nextId = maxId + 1;
    let firstId: number | null = null;
    for (const conv of incoming) {
      const merged: Conversation = JSON.parse(JSON.stringify(conv));
      merged.id = nextId++;
      if (firstId === null) firstId = merged.id;
      this.state.project.conversations.push(merged);
      this.state.conversationSourceMetadata.delete(merged.id);
    }
    this.finishProjectMutation();
    return firstId;
  }

  getConversationSourceMetadata(conversationId: number | null | undefined): ConversationSourceMetadata | null {
    if (conversationId == null) return null;
    return this.state.conversationSourceMetadata.get(conversationId) ?? null;
  }

  getSelectedConversationSourceMetadata(): ConversationSourceMetadata | null {
    return this.getConversationSourceMetadata(this.state.selectedConversationId);
  }

  setConversationSourceMetadata(
    conversationId: number,
    metadata: ConversationSourceMetadata | null,
    options: { notify?: boolean } = {},
  ): void {
    if (metadata) {
      this.state.conversationSourceMetadata.set(conversationId, {
        sourceCommunityId: metadata.sourceCommunityId,
        sourcePublisherId: metadata.sourcePublisherId,
        sourceCoAuthors: metadata.sourceCoAuthors ? [...metadata.sourceCoAuthors] : undefined,
        sourceUpdatedAt: metadata.sourceUpdatedAt,
      });
    } else {
      this.state.conversationSourceMetadata.delete(conversationId);
    }
    if (options.notify ?? false) this.notify(FULL_APP_RENDER);
  }

  clearConversationSourceMetadata(conversationId: number, options: { notify?: boolean } = {}): void {
    this.setConversationSourceMetadata(conversationId, null, options);
  }

  upsertNpcTemplate(template: NpcTemplate): void {
    this.pushUndo();
    const templates = [...(this.state.project.npcTemplates ?? [])];
    const idx = templates.findIndex(t => t.id === template.id);
    if (idx >= 0) templates[idx] = template;
    else templates.push(template);
    this.state.project = { ...this.state.project, npcTemplates: templates };
    this.finishProjectMutation();
  }

  removeNpcTemplate(id: string): void {
    this.pushUndo();
    const templates = (this.state.project.npcTemplates ?? []).filter(t => t.id !== id);
    this.state.project = { ...this.state.project, npcTemplates: templates };
    this.finishProjectMutation();
  }

  setSystemString(key: string, value: string): void {
    const normalized = key.trim();
    if (!normalized) return;
    this.pushUndo();
    this.state.systemStrings.set(normalized, value);
    this.finishProjectMutation({ revalidate: false, projectChanged: false, systemStringsChanged: true });
  }

  renameSystemString(oldKey: string, nextKey: string): void {
    const normalizedOld = oldKey.trim();
    const normalizedNext = nextKey.trim();
    if (!normalizedOld || !normalizedNext || normalizedOld === normalizedNext) return;
    const value = this.state.systemStrings.get(normalizedOld);
    if (value == null) return;
    this.pushUndo();
    this.state.systemStrings.delete(normalizedOld);
    this.state.systemStrings.set(normalizedNext, value);
    this.finishProjectMutation({ revalidate: false, projectChanged: false, systemStringsChanged: true });
  }

  deleteSystemString(key: string): void {
    const normalized = key.trim();
    if (!normalized || !this.state.systemStrings.has(normalized)) return;
    this.pushUndo();
    this.state.systemStrings.delete(normalized);
    this.finishProjectMutation({ revalidate: false, projectChanged: false, systemStringsChanged: true });
  }
}

export const store = new StateManager();
