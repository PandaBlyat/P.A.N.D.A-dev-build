// P.A.N.D.A. Conversation Editor — Play Panel (Conversation Simulator)

import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import type { Conversation, Choice, Outcome } from '../lib/types';
import { findSchema, OUTCOME_SCHEMAS } from '../lib/schema';
import { createIcon } from './icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimMessage {
  type: 'npc' | 'player' | 'system';
  text: string;
}

interface SimState {
  conversation: Conversation;
  messages: SimMessage[];
  currentTurnNumber: number | null;
}

// ---------------------------------------------------------------------------
// Module-level singleton state (mirrors HelpModal pattern)
// ---------------------------------------------------------------------------

let overlayEl: HTMLElement | null = null;
let focusTrapCtrl: FocusTrapController | null = null;
let restoreFocusEl: HTMLElement | null = null;
let simState: SimState | null = null;

// DOM references kept for efficient updates
let messagesEl: HTMLElement | null = null;
let choicesEl: HTMLElement | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function openPlayPanel(conversation: Conversation): void {
  if (overlayEl) return; // already open

  restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  // -- overlay --
  const overlay = document.createElement('div');
  overlay.className = 'play-overlay';
  overlay.onclick = (e) => {
    if (e.target === overlay) closePlayPanel();
  };

  // -- panel --
  const panel = document.createElement('div');
  panel.className = 'play-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'play-panel-title');

  // -- header --
  const header = document.createElement('div');
  header.className = 'play-panel-header';

  const title = document.createElement('div');
  title.className = 'play-panel-title';
  title.id = 'play-panel-title';
  title.append(createIcon('play'), document.createTextNode(conversation.label || `Conversation ${conversation.id}`));
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-icon';
  closeBtn.appendChild(createIcon('close'));
  closeBtn.title = 'Close preview';
  closeBtn.onclick = closePlayPanel;
  header.appendChild(closeBtn);

  panel.appendChild(header);

  // -- disclaimer --
  const disclaimer = document.createElement('div');
  disclaimer.className = 'play-disclaimer';
  disclaimer.textContent = 'Preview mode \u2014 Preconditions, dynamic references, chance-based outcomes, and relationship variants are not simulated. This shows conversation structure only.';
  panel.appendChild(disclaimer);

  // -- messages --
  const messages = document.createElement('div');
  messages.className = 'play-messages';
  panel.appendChild(messages);
  messagesEl = messages;

  // -- choices --
  const choices = document.createElement('div');
  choices.className = 'play-choices';
  panel.appendChild(choices);
  choicesEl = choices;

  // -- footer --
  const footer = document.createElement('div');
  footer.className = 'play-panel-footer';

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'btn-sm';
  restartBtn.append(createIcon('restart'), document.createTextNode('Restart'));
  restartBtn.title = 'Restart conversation from the beginning';
  restartBtn.onclick = () => restartSimulation();
  footer.appendChild(restartBtn);

  panel.appendChild(footer);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  overlayEl = overlay;

  // -- focus trap --
  focusTrapCtrl = trapFocus(panel, {
    restoreFocus: restoreFocusEl,
    initialFocus: closeBtn,
    onEscape: closePlayPanel,
  });

  // -- start simulation --
  simState = {
    conversation,
    messages: [],
    currentTurnNumber: null,
  };

  if (conversation.turns.length === 0) {
    pushMessage('system', 'This conversation has no turns to simulate.');
    renderMessages();
    renderChoices([]);
  } else {
    advanceTurn(1);
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function closePlayPanel(): void {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  focusTrapCtrl?.release();
  focusTrapCtrl = null;
  restoreFocusEl = null;
  simState = null;
  messagesEl = null;
  choicesEl = null;
}

function restartSimulation(): void {
  if (!simState) return;
  simState.messages = [];
  simState.currentTurnNumber = null;
  if (simState.conversation.turns.length === 0) {
    pushMessage('system', 'This conversation has no turns to simulate.');
    renderMessages();
    renderChoices([]);
  } else {
    advanceTurn(1);
  }
}

function advanceTurn(turnNumber: number): void {
  if (!simState) return;

  const turn = simState.conversation.turns.find((t) => t.turnNumber === turnNumber);
  if (!turn) {
    pushMessage('system', `Turn ${turnNumber} not found \u2014 the conversation tree may be incomplete.`);
    simState.currentTurnNumber = null;
    renderMessages();
    renderChoices([]);
    return;
  }

  simState.currentTurnNumber = turnNumber;

  if (turn.openingMessage) {
    pushMessage('npc', turn.openingMessage);
  }

  if (turn.choices.length > 0) {
    renderMessages();
    renderChoices(turn.choices);
  } else {
    pushMessage('system', 'Conversation ended \u2014 no choices in this turn.');
    simState.currentTurnNumber = null;
    renderMessages();
    renderChoices([]);
  }
}

function handleChoice(choice: Choice): void {
  if (!simState) return;

  // Player bubble
  pushMessage('player', choice.text);

  // NPC reply bubble
  if (choice.reply) {
    pushMessage('npc', choice.reply);
  }

  // Note about relationship variants
  if (choice.replyRelHigh || choice.replyRelLow) {
    pushMessage('system', 'This reply has relationship variants not shown in preview.');
  }

  // Outcomes as system messages
  for (const outcome of choice.outcomes) {
    pushMessage('system', formatOutcome(outcome));
  }

  // Continue or end
  if (choice.continueTo != null) {
    advanceTurn(choice.continueTo);
  } else {
    pushMessage('system', 'Conversation ended.');
    simState.currentTurnNumber = null;
    renderMessages();
    renderChoices([]);
  }
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function pushMessage(type: SimMessage['type'], text: string): void {
  if (!simState) return;
  simState.messages.push({ type, text });
}

function renderMessages(): void {
  if (!messagesEl || !simState) return;
  messagesEl.textContent = '';

  for (const msg of simState.messages) {
    const div = document.createElement('div');
    div.className = `play-msg play-msg-${msg.type}`;
    div.textContent = msg.text;
    messagesEl.appendChild(div);
  }

  // Scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderChoices(choices: Choice[]): void {
  if (!choicesEl) return;
  choicesEl.textContent = '';

  if (choices.length === 0) {
    choicesEl.style.display = 'none';
    return;
  }

  choicesEl.style.display = '';

  for (const choice of choices) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'play-choice-btn';
    btn.textContent = choice.text;
    btn.onclick = () => handleChoice(choice);
    choicesEl.appendChild(btn);
  }

  // Focus the first choice for keyboard accessibility
  const firstBtn = choicesEl.querySelector('button');
  if (firstBtn) firstBtn.focus();
}

function formatOutcome(outcome: Outcome): string {
  const schema = findSchema(OUTCOME_SCHEMAS, outcome.command);
  const label = schema ? schema.label : outcome.command;
  const params = outcome.params.length > 0 ? `: ${outcome.params.join(', ')}` : '';
  const chance = outcome.chancePercent != null ? ` (${outcome.chancePercent}% chance)` : '';
  return `\u26A1 ${label}${params}${chance}`;
}
