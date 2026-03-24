// P.A.N.D.A. Conversation Editor — Application State

import type { Project, Conversation, Turn, Choice, ValidationMessage } from './types';
import { getConversationFaction } from './types';
import { createEmptyProject, createConversation, createTurn, createChoice } from './xml-export';
import { validate } from './validation';
import { estimateFlowNodeHeight, getFlowAutoLayoutSpacing, getFlowNodeLayout } from './flow-layout';

export type PropertiesTab = 'conversation' | 'selection';
export type FlowDensity = 'compact' | 'standard' | 'detailed';
export type BottomWorkspaceTab = 'strings' | 'xml';

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
  bottomWorkspaceTab: BottomWorkspaceTab | null;
  bottomWorkspaceHeight: number;
  flowDensity: FlowDensity;
  dirty: boolean;
  undoStack: string[];
  redoStack: string[];
  copiedTurn: TurnClipboard | null;
  copiedChoice: ChoiceClipboard | null;
  projectRevision: number;
  systemStringsRevision: number;
  validationRevision: number;
  conversationSourceMetadata: Map<number, ConversationSourceMetadata>;
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
}

type Listener = (change: StateChange) => void;

export function createStateChange(...targets: RenderTarget[]): StateChange {
  return {
    targets: [...new Set(targets)],
    projectChanged: false,
    systemStringsChanged: false,
    validationChanged: false,
  };
}

export const FULL_APP_RENDER = createStateChange('appShell');
export const SELECTION_RENDER = createStateChange('flowEditor', 'propertiesPanel');

const VALIDATION_DEBOUNCE_MS = 120;

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

export type ConversationSourceMetadata = {
  sourceCommunityId: string;
  sourcePublisherId: string;
  sourceUpdatedAt?: string;
};

function mergeChanges(a: StateChange, b: StateChange): StateChange {
  const merged = a.targets.includes('appShell') || b.targets.includes('appShell')
    ? { ...FULL_APP_RENDER }
    : createStateChange(...a.targets, ...b.targets);
  merged.projectChanged = a.projectChanged || b.projectChanged;
  merged.systemStringsChanged = a.systemStringsChanged || b.systemStringsChanged;
  merged.validationChanged = a.validationChanged || b.validationChanged;
  return merged;
}

class StateManager {
  private state: AppState;
  private listeners: Set<Listener> = new Set();
  private validationTimer: ReturnType<typeof setTimeout> | null = null;
  private batchDepth = 0;
  private batchedChange: StateChange | null = null;

  constructor() {
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
      bottomWorkspaceTab: null,
      bottomWorkspaceHeight: 280,
      flowDensity: 'standard',
      dirty: false,
      undoStack: [],
      redoStack: [],
      copiedTurn: null,
      copiedChoice: null,
      projectRevision: 0,
      systemStringsRevision: 0,
      validationRevision: 0,
      conversationSourceMetadata: new Map(),
    };
  }

  get(): AppState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
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

  private markSystemStringsChanged(): void {
    this.state.systemStringsRevision += 1;
  }

  private pushUndo(): void {
    this.state.undoStack.push(JSON.stringify(this.state.project));
    if (this.state.undoStack.length > 50) this.state.undoStack.shift();
    this.state.redoStack = [];
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
    if (revalidate) this.scheduleValidation(change);
    this.notify({ ...change, projectChanged, systemStringsChanged });
  }

  undo(): void {
    const prev = this.state.undoStack.pop();
    if (!prev) return;
    this.state.redoStack.push(JSON.stringify(this.state.project));
    this.state.project = JSON.parse(prev);
    this.markProjectChanged();
    this.revalidate();
    this.notify({ ...FULL_APP_RENDER, projectChanged: true });
  }

  redo(): void {
    const next = this.state.redoStack.pop();
    if (!next) return;
    this.state.undoStack.push(JSON.stringify(this.state.project));
    this.state.project = JSON.parse(next);
    this.markProjectChanged();
    this.revalidate();
    this.notify({ ...FULL_APP_RENDER, projectChanged: true });
  }

  private scheduleValidation(change: StateChange = FULL_APP_RENDER): void {
    if (this.validationTimer != null) {
      clearTimeout(this.validationTimer);
    }
    this.validationTimer = setTimeout(() => {
      this.validationTimer = null;
      this.revalidate(change);
    }, VALIDATION_DEBOUNCE_MS);
  }

  private revalidate(change: StateChange = FULL_APP_RENDER): void {
    const previousMessages = JSON.stringify(this.state.validationMessages);
    const previousShowValidationPanel = this.state.showValidationPanel;
    const previousBottomWorkspaceTab = this.state.bottomWorkspaceTab;

    this.state.validationMessages = validate(this.state.project);
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
    this.notify({ ...change, validationChanged: true });
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
    return {
      x: Math.max(0, (turnNumber - 1) * 300),
      y: 0,
    };
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
    } = {},
  ): Choice {
    const choice = createChoice(index);
    choice.text = sourceChoice.text;
    choice.reply = sourceChoice.reply;
    if (sourceChoice.replyRelHigh != null) choice.replyRelHigh = sourceChoice.replyRelHigh;
    if (sourceChoice.replyRelLow != null) choice.replyRelLow = sourceChoice.replyRelLow;
    choice.outcomes = this.cloneOutcomeList(sourceChoice.outcomes);

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
    turn.customLabel = sourceTurn.customLabel;
    turn.color = sourceTurn.color;
    turn.choices = sourceTurn.choices.map((choice, index) => this.cloneChoiceFromSource(choice, index + 1, options));
    return turn;
  }

  loadProject(project: Project, systemStrings: Map<string, string>): void {
    this.state.project = {
      ...project,
      conversations: project.conversations.map((conversation) => ({
        ...conversation,
        faction: getConversationFaction(conversation, project.faction),
      })),
    };
    this.state.systemStrings = systemStrings;
    this.state.selectedConversationId = project.conversations.length > 0 ? project.conversations[0].id : null;
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
    this.markProjectChanged();
    this.markSystemStringsChanged();
    this.revalidate();
    this.notify({ ...FULL_APP_RENDER, projectChanged: true, systemStringsChanged: true });
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

  updateConversation(id: number, updates: Partial<Conversation>): void {
    const conv = this.state.project.conversations.find(c => c.id === id);
    if (!conv) return;
    this.pushUndo();
    Object.assign(conv, updates);
    this.finishProjectMutation();
  }

  autoLayoutConversation(conversationId: number): void {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) return;
    this.batchUpdateTurnPositions(conversationId, this.calculateAutoLayoutUpdates(conversation, this.state.flowDensity));
  }

  createConnectedTurn(conversationId: number, sourceTurnNumber: number, choiceIndex: number): number | null {
    const conversation = this.getConversationById(conversationId);
    const sourceTurn = conversation?.turns.find(turn => turn.turnNumber === sourceTurnNumber);
    const sourceChoice = sourceTurn?.choices.find(choice => choice.index === choiceIndex);
    if (!conversation || !sourceTurn || !sourceChoice) return null;

    this.pushUndo();

    const nextTurnNumber = conversation.turns.reduce((max, turn) => Math.max(max, turn.turnNumber), 0) + 1;
    const newTurn = createTurn(nextTurnNumber);
    newTurn.position = this.getContextualTurnPlacement(conversation, newTurn, {
      sourceTurnNumber,
      sourceChoiceIndex: choiceIndex,
    });

    sourceChoice.continueTo = nextTurnNumber;
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

  updateTurn(conversationId: number, turnNumber: number, updates: Partial<Turn>): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    if (!turn) return;
    this.pushUndo();
    Object.assign(turn, updates);
    this.finishProjectMutation();
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
    this.finishProjectMutation({ revalidate: false });
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
    this.finishProjectMutation({ revalidate: false });
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

  addChoice(conversationId: number, turnNumber: number): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    if (!turn || turn.choices.length >= 4) return;
    this.pushUndo();
    const nextIndex = turn.choices.length + 1;
    turn.choices.push(createChoice(nextIndex));
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
    turn.choices.push(this.cloneChoiceFromSource(sourceChoice, nextIndex, { validTurnNumbers }));
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
    turn.choices.push(this.cloneChoiceFromSource(clipboard.choice, nextIndex, { validTurnNumbers }));
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

  updateChoice(conversationId: number, turnNumber: number, choiceIndex: number, updates: Partial<Choice>): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    const choice = turn?.choices.find(c => c.index === choiceIndex);
    if (!choice) return;
    this.pushUndo();
    Object.assign(choice, updates);
    this.finishProjectMutation();
  }

  connectChoiceToTurn(conversationId: number, turnNumber: number, choiceIndex: number, targetTurnNumber: number): void {
    if (turnNumber === targetTurnNumber) return;
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    const target = conv?.turns.find(t => t.turnNumber === targetTurnNumber);
    const choice = turn?.choices.find(c => c.index === choiceIndex);
    if (!choice || !target) return;
    this.pushUndo();
    choice.continueTo = targetTurnNumber;
    this.finishProjectMutation();
  }

  clearChoiceContinuation(conversationId: number, turnNumber: number, choiceIndex: number): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    const turn = conv?.turns.find(t => t.turnNumber === turnNumber);
    const choice = turn?.choices.find(c => c.index === choiceIndex);
    if (!choice || choice.continueTo == null) return;
    this.pushUndo();
    delete choice.continueTo;
    this.finishProjectMutation();
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
