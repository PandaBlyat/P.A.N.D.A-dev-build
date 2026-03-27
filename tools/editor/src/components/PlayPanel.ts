// P.A.N.D.A. Conversation Editor — Play Panel (Conversation Simulator)

import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import type { Conversation, Choice, Outcome } from '../lib/types';
import { findSchema, OUTCOME_SCHEMAS } from '../lib/schema';
import { createTurnDisplayLabeler } from '../lib/turn-labels';
import { createIcon } from './icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StructuredOutcome {
  label: string;
  params: string[];
  chancePercent?: number;
}

interface SimMessage {
  kind: 'branch-entry' | 'npc' | 'player' | 'system' | 'outcome' | 'timeout';
  text?: string;
  turnNumber?: number;
  outcomes?: StructuredOutcome[];
}

interface TurnLabeler {
  getLongLabel: (turnNumber: number) => string;
  getCompactLabel: (turnNumber: number) => string;
  getPath: (turnNumber: number) => string | null;
}

interface SimState {
  conversation: Conversation;
  messages: SimMessage[];
  currentTurnNumber: number | null;
  path: number[];
  turnLabels: TurnLabeler;
  timeoutSeconds: number | null;
  timeoutMessage: string | null;
  mode: 'runtime-parity' | 'authoring-raw';
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
let statusEl: HTMLElement | null = null;
let timeoutBtnEl: HTMLButtonElement | null = null;

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
  panel.setAttribute('aria-describedby', 'play-panel-disclaimer');

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
  closeBtn.setAttribute('aria-label', 'Close conversation simulator');
  closeBtn.onclick = closePlayPanel;
  header.appendChild(closeBtn);

  panel.appendChild(header);

  // -- disclaimer --
  const disclaimer = document.createElement('div');
  disclaimer.className = 'play-disclaimer';
  disclaimer.id = 'play-panel-disclaimer';
  disclaimer.textContent = 'Preview mode \u2014 Preconditions, dynamic references, chance-based outcomes, and relationship variants are not simulated. This shows conversation structure only.';
  panel.appendChild(disclaimer);

  // -- status strip --
  const status = document.createElement('div');
  status.className = 'play-panel-status';
  status.id = 'play-panel-status';
  panel.appendChild(status);
  statusEl = status;

  // -- messages --
  const messages = document.createElement('div');
  messages.className = 'play-messages';
  messages.setAttribute('aria-live', 'polite');
  messages.setAttribute('aria-label', 'Conversation transcript');
  panel.appendChild(messages);
  messagesEl = messages;

  // -- choices --
  const choices = document.createElement('div');
  choices.className = 'play-choices';
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', 'Available choices');
  panel.appendChild(choices);
  choicesEl = choices;

  // -- footer --
  const footer = document.createElement('div');
  footer.className = 'play-panel-footer';

  const footerLeft = document.createElement('div');
  footerLeft.className = 'play-footer-left';

  const modeWrapper = document.createElement('label');
  modeWrapper.className = 'play-mode-select-wrap';
  const modeLabel = document.createElement('span');
  modeLabel.className = 'play-mode-select-label';
  modeLabel.textContent = 'Opening message view';
  const modeSelect = document.createElement('select');
  modeSelect.className = 'play-mode-select';
  modeSelect.setAttribute('aria-label', 'Opening message display mode');
  const runtimeOption = document.createElement('option');
  runtimeOption.value = 'runtime-parity';
  runtimeOption.textContent = 'Runtime-accurate parity mode';
  const rawOption = document.createElement('option');
  rawOption.value = 'authoring-raw';
  rawOption.textContent = 'Authoring raw mode';
  modeSelect.append(runtimeOption, rawOption);
  modeSelect.onchange = () => {
    if (!simState) return;
    simState.mode = modeSelect.value === 'authoring-raw' ? 'authoring-raw' : 'runtime-parity';
    restartSimulation();
  };
  modeWrapper.append(modeLabel, modeSelect);
  footerLeft.appendChild(modeWrapper);

  // Timeout trigger button (only if timeout configured)
  const hasTimeout = conversation.timeout != null && conversation.timeout > 0;
  if (hasTimeout) {
    const timeoutBtn = document.createElement('button');
    timeoutBtn.type = 'button';
    timeoutBtn.className = 'btn-sm play-timeout-btn';
    timeoutBtn.append(createIcon('clock'), document.createTextNode('Trigger Timeout'));
    timeoutBtn.title = `Simulate timeout (${conversation.timeout}s)`;
    timeoutBtn.onclick = () => triggerTimeout();
    footerLeft.appendChild(timeoutBtn);
    timeoutBtnEl = timeoutBtn;
  }
  footer.appendChild(footerLeft);

  const footerRight = document.createElement('div');
  footerRight.className = 'play-footer-right';

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className = 'btn-sm';
  restartBtn.append(createIcon('restart'), document.createTextNode('Restart'));
  restartBtn.title = 'Restart conversation from the beginning';
  restartBtn.onclick = () => restartSimulation();
  footerRight.appendChild(restartBtn);

  const footerCloseBtn = document.createElement('button');
  footerCloseBtn.type = 'button';
  footerCloseBtn.className = 'btn-sm';
  footerCloseBtn.append(createIcon('close'), document.createTextNode('Close'));
  footerCloseBtn.setAttribute('aria-label', 'Close conversation simulator');
  footerCloseBtn.onclick = closePlayPanel;
  footerRight.appendChild(footerCloseBtn);

  footer.appendChild(footerRight);
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

  // -- initialize simulation state --
  const turnLabels = createTurnDisplayLabeler(conversation);
  simState = {
    conversation,
    messages: [],
    currentTurnNumber: null,
    path: [],
    turnLabels,
    timeoutSeconds: hasTimeout ? conversation.timeout! : null,
    timeoutMessage: hasTimeout ? (conversation.timeoutMessage ?? null) : null,
    mode: 'runtime-parity',
  };

  if (conversation.turns.length === 0) {
    pushMessage({ kind: 'system', text: 'This conversation has no turns to simulate.' });
    renderMessages();
    renderChoices([]);
  } else {
    advanceTurn(1);
  }

  renderStatus();
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
  statusEl = null;
  timeoutBtnEl = null;
}

function restartSimulation(): void {
  if (!simState) return;
  simState.messages = [];
  simState.currentTurnNumber = null;
  simState.path = [];
  if (simState.conversation.turns.length === 0) {
    pushMessage({ kind: 'system', text: 'This conversation has no turns to simulate.' });
    renderMessages();
    renderChoices([]);
  } else {
    advanceTurn(1);
  }
  renderStatus();
  if (timeoutBtnEl) timeoutBtnEl.disabled = false;
}

function advanceTurn(turnNumber: number): void {
  if (!simState) return;

  const turn = simState.conversation.turns.find((t) => t.turnNumber === turnNumber);
  if (!turn) {
    pushMessage({ kind: 'system', text: `Turn ${turnNumber} not found \u2014 the conversation tree may be incomplete.` });
    simState.currentTurnNumber = null;
    renderMessages();
    renderChoices([]);
    renderStatus();
    return;
  }

  simState.currentTurnNumber = turnNumber;
  simState.path.push(turnNumber);

  // Branch-entry event
  const branchLabel = simState.turnLabels.getLongLabel(turnNumber);
  pushMessage({ kind: 'branch-entry', text: branchLabel, turnNumber });

  if (turn.openingMessage && shouldDisplayOpeningMessage(turn)) {
    const openingSpeaker = turn.firstSpeaker === 'player' ? 'player' : 'npc';
    pushMessage({ kind: openingSpeaker, text: turn.openingMessage, turnNumber });
  }

  if (turn.choices.length > 0) {
    renderMessages();
    renderChoices(turn.choices);
  } else {
    pushMessage({ kind: 'system', text: 'Conversation ended \u2014 no choices in this turn.' });
    simState.currentTurnNumber = null;
    renderMessages();
    renderChoices([]);
  }

  renderStatus();
}

function handleChoice(choice: Choice): void {
  if (!simState) return;

  // Player bubble
  pushMessage({ kind: 'player', text: choice.text });

  // NPC reply bubble
  if (choice.reply) {
    pushMessage({ kind: 'npc', text: choice.reply });
  }

  // Note about relationship variants
  if (choice.replyRelHigh || choice.replyRelLow) {
    pushMessage({ kind: 'system', text: 'This reply has relationship variants not shown in preview.' });
  }

  // Structured outcomes
  if (choice.outcomes.length > 0) {
    const structured = choice.outcomes.map(parseOutcome);
    pushMessage({ kind: 'outcome', outcomes: structured });
  }

  // Continue or end
  if (choice.continueTo != null) {
    advanceTurn(choice.continueTo);
  } else {
    pushMessage({ kind: 'system', text: 'Conversation ended.' });
    simState.currentTurnNumber = null;
    renderMessages();
    renderChoices([]);
    renderStatus();
  }
}

function triggerTimeout(): void {
  if (!simState) return;

  const hasMessage = simState.timeoutMessage != null && simState.timeoutMessage.trim() !== '';

  if (hasMessage) {
    pushMessage({ kind: 'timeout', text: `Timeout: ${simState.timeoutMessage}` });
  } else {
    pushMessage({ kind: 'timeout', text: 'Conversation timed out. (No timeout message configured)' });
  }

  simState.currentTurnNumber = null;
  renderMessages();
  renderChoices([]);
  renderStatus();
  if (timeoutBtnEl) timeoutBtnEl.disabled = true;
}

function normalizeTurnChannel(channel: Conversation['turns'][number]['channel'] | undefined): 'pda' | 'f2f' {
  return channel === 'f2f' ? 'f2f' : 'pda';
}

function isEntryTurn(turn: Conversation['turns'][number]): boolean {
  const channel = normalizeTurnChannel(turn.channel);
  if (channel === 'f2f') {
    return turn.f2f_entry === true;
  }
  return turn.pda_entry ?? turn.turnNumber === 1;
}

function shouldDisplayOpeningMessage(turn: Conversation['turns'][number]): boolean {
  if (!simState) return false;
  if (simState.mode === 'authoring-raw') return true;
  return isEntryTurn(turn);
}

// ---------------------------------------------------------------------------
// Outcome helpers
// ---------------------------------------------------------------------------

function parseOutcome(outcome: Outcome): StructuredOutcome {
  const schema = findSchema(OUTCOME_SCHEMAS, outcome.command);
  const label = schema ? schema.label : outcome.command;
  const chance = outcome.chancePercent != null && outcome.chancePercent !== 100
    ? outcome.chancePercent
    : undefined;
  return { label, params: outcome.params, chancePercent: chance };
}

// ---------------------------------------------------------------------------
// Choice helpers
// ---------------------------------------------------------------------------

function getChoiceReplyPreview(choice: Choice): string {
  if (!choice.reply) return '';
  const maxLen = 80;
  if (choice.reply.length <= maxLen) return choice.reply;
  return choice.reply.slice(0, maxLen).trimEnd() + '\u2026';
}

function getChoiceDestinationText(choice: Choice): string {
  if (!simState) return '';
  if (choice.continueTo == null) return 'Ends conversation';
  return '\u2192 ' + simState.turnLabels.getLongLabel(choice.continueTo);
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function pushMessage(msg: SimMessage): void {
  if (!simState) return;
  simState.messages.push(msg);
}

function renderMessages(): void {
  if (!messagesEl || !simState) return;
  messagesEl.textContent = '';

  for (const msg of simState.messages) {
    messagesEl.appendChild(renderMessage(msg));
  }

  // Scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderMessage(msg: SimMessage): HTMLElement {
  switch (msg.kind) {
    case 'branch-entry':
      return renderBranchEntry(msg);
    case 'outcome':
      return renderOutcomeBlock(msg);
    case 'timeout':
      return renderTimeoutMessage(msg);
    default:
      return renderBasicMessage(msg);
  }
}

function renderBasicMessage(msg: SimMessage): HTMLElement {
  const div = document.createElement('div');
  div.className = `play-msg play-msg-${msg.kind}`;
  div.textContent = msg.text ?? '';
  return div;
}

function renderBranchEntry(msg: SimMessage): HTMLElement {
  const div = document.createElement('div');
  div.className = 'play-msg play-msg-branch';

  const label = document.createElement('span');
  label.className = 'play-branch-label';
  label.textContent = msg.text ?? '';
  div.appendChild(label);

  return div;
}

function renderOutcomeBlock(msg: SimMessage): HTMLElement {
  const block = document.createElement('div');
  block.className = 'play-outcome-block';

  const heading = document.createElement('div');
  heading.className = 'play-outcome-heading';
  heading.textContent = 'Effects';
  block.appendChild(heading);

  for (const outcome of (msg.outcomes ?? [])) {
    const row = document.createElement('div');
    row.className = 'play-outcome-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'play-outcome-label';
    labelEl.textContent = outcome.label;
    row.appendChild(labelEl);

    if (outcome.params.length > 0) {
      const paramsEl = document.createElement('span');
      paramsEl.className = 'play-outcome-params';
      paramsEl.textContent = outcome.params.join(', ');
      row.appendChild(paramsEl);
    }

    if (outcome.chancePercent != null) {
      const chanceEl = document.createElement('span');
      chanceEl.className = 'play-outcome-chance';
      chanceEl.textContent = `${outcome.chancePercent}%`;
      row.appendChild(chanceEl);
    }

    block.appendChild(row);
  }

  return block;
}

function renderTimeoutMessage(msg: SimMessage): HTMLElement {
  const div = document.createElement('div');
  div.className = 'play-msg play-msg-timeout';

  const icon = createIcon('clock');
  div.appendChild(icon);

  const text = document.createElement('span');
  text.textContent = msg.text ?? '';
  div.appendChild(text);

  return div;
}

function renderStatus(): void {
  if (!statusEl || !simState) return;
  statusEl.textContent = '';

  // Path chips
  if (simState.path.length > 0) {
    for (const turnNumber of simState.path) {
      const chip = document.createElement('span');
      chip.className = 'play-path-chip';
      chip.textContent = simState.turnLabels.getCompactLabel(turnNumber);
      statusEl.appendChild(chip);
    }
  }

  // Timeout chip
  if (simState.timeoutSeconds != null) {
    const timeoutChip = document.createElement('span');
    const hasMessage = simState.timeoutMessage != null && simState.timeoutMessage.trim() !== '';
    timeoutChip.className = 'play-timeout-chip' + (hasMessage ? '' : ' play-warning-chip');
    timeoutChip.textContent = `\u23F1 ${simState.timeoutSeconds}s`;
    if (!hasMessage) {
      timeoutChip.title = 'Timeout is set but no timeout message is configured';
    }
    statusEl.appendChild(timeoutChip);
  }

  statusEl.style.display = statusEl.children.length > 0 ? '' : 'none';
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
    btn.className = 'play-choice-card';
    btn.onclick = () => handleChoice(choice);

    // Title line
    const titleEl = document.createElement('div');
    titleEl.className = 'play-choice-title';
    titleEl.textContent = choice.text;
    btn.appendChild(titleEl);

    // Reply preview
    const preview = getChoiceReplyPreview(choice);
    if (preview) {
      const previewEl = document.createElement('div');
      previewEl.className = 'play-choice-preview';
      previewEl.textContent = preview;
      btn.appendChild(previewEl);
    }

    // Metadata row
    const meta = document.createElement('div');
    meta.className = 'play-choice-meta';

    // Destination badge
    const destEl = document.createElement('span');
    destEl.className = 'play-choice-badge play-choice-destination';
    destEl.textContent = getChoiceDestinationText(choice);
    meta.appendChild(destEl);

    // Effect count badge
    if (choice.outcomes.length > 0) {
      const effectEl = document.createElement('span');
      effectEl.className = 'play-choice-badge';
      effectEl.textContent = `${choice.outcomes.length} effect${choice.outcomes.length !== 1 ? 's' : ''}`;
      meta.appendChild(effectEl);
    }

    // Relationship variant badge
    if (choice.replyRelHigh || choice.replyRelLow) {
      const relEl = document.createElement('span');
      relEl.className = 'play-choice-badge play-choice-rel';
      relEl.textContent = 'Rel. variants';
      meta.appendChild(relEl);
    }

    btn.appendChild(meta);
    choicesEl.appendChild(btn);
  }

  // Focus the first choice for keyboard accessibility
  const firstBtn = choicesEl.querySelector('button');
  if (firstBtn) firstBtn.focus();
}
