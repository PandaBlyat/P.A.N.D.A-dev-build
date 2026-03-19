// P.A.N.D.A. Conversation Editor — Application State

import type { Project, Conversation, Turn, Choice, ValidationMessage } from './types';
import { createEmptyProject, createConversation, createTurn, createChoice } from './xml-export';
import { validate } from './validation';

export type PropertiesTab = 'conversation' | 'selection';

export interface AppState {
  project: Project;
  systemStrings: Map<string, string>;
  selectedConversationId: number | null;
  selectedTurnNumber: number | null;
  selectedChoiceIndex: number | null;
  propertiesTab: PropertiesTab;
  validationMessages: ValidationMessage[];
  showXmlPreview: boolean;
  dirty: boolean;
  undoStack: string[];
  redoStack: string[];
}

type Listener = () => void;

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
  }

  // ─── Project ────────────────────────────────────────────────────────────

  loadProject(project: Project, systemStrings: Map<string, string>): void {
    this.state.project = project;
    this.state.systemStrings = systemStrings;
    this.state.selectedConversationId = project.conversations.length > 0 ? project.conversations[0].id : null;
    this.state.selectedTurnNumber = null;
    this.state.selectedChoiceIndex = null;
    this.state.propertiesTab = 'conversation';
    this.state.dirty = false;
    this.state.undoStack = [];
    this.state.redoStack = [];
    this.revalidate();
    this.notify();
  }

  setFaction(faction: Project['faction']): void {
    this.pushUndo();
    this.state.project.faction = faction;
    this.state.dirty = true;
    this.revalidate();
    this.notify();
  }

  // ─── Selection ──────────────────────────────────────────────────────────

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
    this.notify();
  }

  // ─── Conversation CRUD ──────────────────────────────────────────────────

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
    this.state.dirty = true;
    this.revalidate();
    this.notify();
  }

  deleteConversation(id: number): void {
    this.pushUndo();
    this.state.project.conversations = this.state.project.conversations.filter(c => c.id !== id);
    // Renumber to keep sequential
    this.state.project.conversations.forEach((c, i) => { c.id = i + 1; });
    if (this.state.selectedConversationId === id) {
      this.state.selectedConversationId = this.state.project.conversations.length > 0
        ? this.state.project.conversations[0].id : null;
      this.state.selectedTurnNumber = null;
      this.state.selectedChoiceIndex = null;
    }
    this.state.dirty = true;
    this.revalidate();
    this.notify();
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
    this.state.dirty = true;
    this.revalidate();
    this.notify();
  }

  updateConversation(id: number, updates: Partial<Conversation>): void {
    this.pushUndo();
    const conv = this.state.project.conversations.find(c => c.id === id);
    if (!conv) return;
    Object.assign(conv, updates);
    this.state.dirty = true;
    this.revalidate();
    this.notify();
  }

  // ─── Turn CRUD ──────────────────────────────────────────────────────────

  addTurn(conversationId: number): void {
    this.pushUndo();
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    const maxTurn = conv.turns.reduce((m, t) => Math.max(m, t.turnNumber), 0);
    const turn = createTurn(maxTurn + 1);
    conv.turns.push(turn);
    this.state.selectedTurnNumber = turn.turnNumber;
    this.state.dirty = true;
    this.revalidate();
    this.notify();
  }

  deleteTurn(conversationId: number, turnNumber: number): void {
    if (turnNumber === 1) return; // Can't delete turn 1
    this.pushUndo();
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    conv.turns = conv.turns.filter(t => t.turnNumber !== turnNumber);
    if (this.state.selectedTurnNumber === turnNumber) {
      this.state.selectedTurnNumber = null;
      this.state.selectedChoiceIndex = null;
    }
    this.state.dirty = true;
    this.revalidate();
    this.notify();
  }

  updateTurn(conversationId: number, turnNumber: number, updates: Partial<Turn>): void {
    this.pushUndo();
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    const turn = conv.turns.find(t => t.turnNumber === turnNumber);
    if (!turn) return;
    Object.assign(turn, updates);
    this.state.dirty = true;
    this.revalidate();
    this.notify();
  }

  // ─── Choice CRUD ────────────────────────────────────────────────────────

  addChoice(conversationId: number, turnNumber: number): void {
    this.pushUndo();
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    const turn = conv.turns.find(t => t.turnNumber === turnNumber);
    if (!turn || turn.choices.length >= 4) return;
    const nextIndex = turn.choices.length + 1;
    turn.choices.push(createChoice(nextIndex));
    this.state.dirty = true;
    this.revalidate();
    this.notify();
  }

  deleteChoice(conversationId: number, turnNumber: number, choiceIndex: number): void {
    this.pushUndo();
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    const turn = conv.turns.find(t => t.turnNumber === turnNumber);
    if (!turn || turn.choices.length <= 1) return;
    turn.choices = turn.choices.filter(c => c.index !== choiceIndex);
    // Renumber
    turn.choices.forEach((c, i) => { c.index = i + 1; });
    if (this.state.selectedChoiceIndex === choiceIndex) {
      this.state.selectedChoiceIndex = null;
    }
    this.state.dirty = true;
    this.revalidate();
    this.notify();
  }

  updateChoice(conversationId: number, turnNumber: number, choiceIndex: number, updates: Partial<Choice>): void {
    this.pushUndo();
    const conv = this.state.project.conversations.find(c => c.id === conversationId);
    if (!conv) return;
    const turn = conv.turns.find(t => t.turnNumber === turnNumber);
    if (!turn) return;
    const choice = turn.choices.find(c => c.index === choiceIndex);
    if (!choice) return;
    Object.assign(choice, updates);
    this.state.dirty = true;
    this.revalidate();
    this.notify();
  }
}

export const store = new StateManager();
