// P.A.N.D.A. Conversation Editor — Application State

import type { Project, Conversation, Turn, Choice, ValidationMessage } from './types';
import { createEmptyProject, createConversation, createTurn, createChoice } from './xml-export';
import { validate } from './validation';

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
}

type Listener = () => void;

type TurnPositionUpdate = {
  turnNumber: number;
  position: { x: number; y: number };
};

class StateManager {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

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
    };
  }

  get(): AppState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private pushUndo(): void {
    this.state.undoStack.push(JSON.stringify(this.state.project));
    if (this.state.undoStack.length > 50) this.state.undoStack.shift();
    this.state.redoStack = [];
  }

  private getConversationById(conversationId: number): Conversation | null {
    return this.state.project.conversations.find(c => c.id === conversationId) || null;
  }

  private finishProjectMutation({ revalidate = true }: { revalidate?: boolean } = {}): void {
    this.state.dirty = true;
    if (revalidate) this.revalidate();
    this.notify();
  }

  undo(): void {
    const prev = this.state.undoStack.pop();
    if (!prev) return;
    this.state.redoStack.push(JSON.stringify(this.state.project));
    this.state.project = JSON.parse(prev);
    this.revalidate();
    this.notify();
  }

  redo(): void {
    const next = this.state.redoStack.pop();
    if (!next) return;
    this.state.undoStack.push(JSON.stringify(this.state.project));
    this.state.project = JSON.parse(next);
    this.revalidate();
    this.notify();
  }

  private revalidate(): void {
    this.state.validationMessages = validate(this.state.project);
    if (this.state.validationMessages.length === 0) {
      this.state.showValidationPanel = false;
    }
    this.syncBottomWorkspaceTab();
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

  private static readonly DENSITY_SPACING: Record<FlowDensity, { colWidth: number; rowHeight: number }> = {
    compact: { colWidth: 240, rowHeight: 140 },
    standard: { colWidth: 300, rowHeight: 180 },
    detailed: { colWidth: 360, rowHeight: 240 },
  };

  private calculateAutoLayoutUpdates(conversation: Conversation, density: FlowDensity = 'standard'): TurnPositionUpdate[] {
    const visited = new Set<number>();
    const queue: { turnNumber: number; col: number; row: number }[] = [{ turnNumber: 1, col: 0, row: 0 }];
    const positions = new Map<number, { col: number; row: number }>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.turnNumber)) continue;

      visited.add(current.turnNumber);
      positions.set(current.turnNumber, { col: current.col, row: current.row });

      const turn = conversation.turns.find(t => t.turnNumber === current.turnNumber);
      if (!turn) continue;

      let childRow = 0;
      for (const choice of turn.choices) {
        const targets: number[] = [];
        if (choice.continueTo != null) targets.push(choice.continueTo);

        for (const outcome of choice.outcomes) {
          if (outcome.command !== 'pause_job') continue;
          const successTurn = parseInt(outcome.params[1], 10);
          const failTurn = parseInt(outcome.params[2], 10);
          if (!Number.isNaN(successTurn)) targets.push(successTurn);
          if (!Number.isNaN(failTurn)) targets.push(failTurn);
        }

        for (const targetTurnNumber of targets) {
          if (visited.has(targetTurnNumber)) continue;
          queue.push({ turnNumber: targetTurnNumber, col: current.col + 1, row: childRow });
          childRow += 1;
        }
      }
    }

    let nextUnvisitedCol = positions.size > 0
      ? Math.max(...[...positions.values()].map(position => position.col)) + 1
      : 0;

    for (const turn of conversation.turns) {
      if (positions.has(turn.turnNumber)) continue;
      positions.set(turn.turnNumber, { col: nextUnvisitedCol, row: 0 });
      nextUnvisitedCol += 1;
    }

    const spacing = StateManager.DENSITY_SPACING[density];
    return conversation.turns.map(turn => {
      const position = positions.get(turn.turnNumber) ?? { col: 0, row: 0 };
      return {
        turnNumber: turn.turnNumber,
        position: {
          x: position.col * spacing.colWidth + 20,
          y: position.row * spacing.rowHeight + 20,
        },
      };
    });
  }

  loadProject(project: Project, systemStrings: Map<string, string>): void {
    this.state.project = project;
    this.state.systemStrings = systemStrings;
    this.state.selectedConversationId = project.conversations.length > 0 ? project.conversations[0].id : null;
    this.state.selectedTurnNumber = null;
    this.state.selectedChoiceIndex = null;
    this.state.propertiesTab = 'conversation';
    this.state.showXmlPreview = false;
    this.state.showSystemStringsPanel = false;
    this.state.showValidationPanel = false;
    this.state.bottomWorkspaceTab = null;
    this.state.bottomWorkspaceHeight = 280;
    this.state.dirty = false;
    this.state.undoStack = [];
    this.state.redoStack = [];
    this.revalidate();
    this.notify();
  }

  setFaction(faction: Project['faction']): void {
    this.pushUndo();
    this.state.project.faction = faction;
    this.finishProjectMutation();
  }

  selectConversation(id: number | null): void {
    this.state.selectedConversationId = id;
    this.state.selectedTurnNumber = null;
    this.state.selectedChoiceIndex = null;
    this.state.propertiesTab = 'conversation';
    this.notify();
  }

  selectTurn(turnNumber: number | null): void {
    this.state.selectedTurnNumber = turnNumber;
    this.state.selectedChoiceIndex = null;
    if (turnNumber != null) this.state.propertiesTab = 'selection';
    this.notify();
  }

  selectChoice(index: number | null): void {
    this.state.selectedChoiceIndex = index;
    if (index != null) this.state.propertiesTab = 'selection';
    this.notify();
  }

  setPropertiesTab(tab: PropertiesTab): void {
    this.state.propertiesTab = tab;
    this.notify();
  }

  toggleXmlPreview(): void {
    this.state.showXmlPreview = !this.state.showXmlPreview;
    this.syncBottomWorkspaceTab(this.state.showXmlPreview ? 'xml' : undefined);
    this.notify();
  }

  toggleSystemStringsPanel(): void {
    this.state.showSystemStringsPanel = !this.state.showSystemStringsPanel;
    this.syncBottomWorkspaceTab(this.state.showSystemStringsPanel ? 'strings' : undefined);
    this.notify();
  }

  toggleValidationPanel(): void {
    if (!this.state.showValidationPanel && this.state.validationMessages.length === 0) return;
    this.state.showValidationPanel = !this.state.showValidationPanel;
    this.syncBottomWorkspaceTab();
    this.notify();
  }

  setBottomWorkspaceTab(tab: BottomWorkspaceTab): void {
    if (this.getOpenBottomWorkspaceTabs().includes(tab)) {
      this.state.bottomWorkspaceTab = tab;
      this.notify();
    }
  }

  closeBottomWorkspaceTab(tab: BottomWorkspaceTab): void {
    if (tab === 'strings') this.state.showSystemStringsPanel = false;
    if (tab === 'xml') this.state.showXmlPreview = false;
    this.syncBottomWorkspaceTab();
    this.notify();
  }

  setBottomWorkspaceHeight(height: number): void {
    const next = Math.max(180, Math.min(520, Math.round(height)));
    if (next === this.state.bottomWorkspaceHeight) return;
    this.state.bottomWorkspaceHeight = next;
    this.notify();
  }

  setFlowDensity(density: FlowDensity): void {
    if (this.state.flowDensity === density) return;
    this.state.flowDensity = density;
    // Auto-relayout the selected conversation so nodes don't overlap at the new size
    if (this.state.selectedConversationId != null) {
      const conv = this.getConversationById(this.state.selectedConversationId);
      if (conv) {
        this.batchUpdateTurnPositions(this.state.selectedConversationId, this.calculateAutoLayoutUpdates(conv, density));
      }
    }
    this.notify();
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

  addConversation(): void {
    this.pushUndo();
    const conv = createConversation(this.state.project);
    this.state.project.conversations.push(conv);
    this.state.selectedConversationId = conv.id;
    this.state.selectedTurnNumber = null;
    this.state.selectedChoiceIndex = null;
    this.finishProjectMutation();
  }

  deleteConversation(id: number): void {
    this.pushUndo();
    this.state.project.conversations = this.state.project.conversations.filter(c => c.id !== id);
    this.state.project.conversations.forEach((c, i) => { c.id = i + 1; });
    if (this.state.selectedConversationId === id) {
      this.state.selectedConversationId = this.state.project.conversations.length > 0
        ? this.state.project.conversations[0].id : null;
      this.state.selectedTurnNumber = null;
      this.state.selectedChoiceIndex = null;
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
    this.state.selectedConversationId = dup.id;
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

  addTurn(conversationId: number): void {
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    this.pushUndo();
    const maxTurn = conv.turns.reduce((m, t) => Math.max(m, t.turnNumber), 0);
    const turn = createTurn(maxTurn + 1);
    conv.turns.push(turn);
    this.state.selectedTurnNumber = turn.turnNumber;
    this.finishProjectMutation();
  }

  deleteTurn(conversationId: number, turnNumber: number): void {
    if (turnNumber === 1) return;
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    this.pushUndo();
    conv.turns = conv.turns.filter(t => t.turnNumber !== turnNumber);
    if (this.state.selectedTurnNumber === turnNumber) {
      this.state.selectedTurnNumber = null;
      this.state.selectedChoiceIndex = null;
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
    }
    this.finishProjectMutation();
    return firstId;
  }

  setSystemString(key: string, value: string): void {
    const normalized = key.trim();
    if (!normalized) return;
    this.pushUndo();
    this.state.systemStrings.set(normalized, value);
    this.finishProjectMutation({ revalidate: false });
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
    this.finishProjectMutation({ revalidate: false });
  }

  deleteSystemString(key: string): void {
    const normalized = key.trim();
    if (!normalized || !this.state.systemStrings.has(normalized)) return;
    this.pushUndo();
    this.state.systemStrings.delete(normalized);
    this.finishProjectMutation({ revalidate: false });
  }
}

export const store = new StateManager();
