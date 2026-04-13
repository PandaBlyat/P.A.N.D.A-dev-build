// P.A.N.D.A. Conversation Editor — Validation Bar

import { requestFlowCenter } from '../lib/flow-navigation';
import { store } from '../lib/state';
import { createTurnDisplayLabeler } from '../lib/turn-labels';
import type { ValidationMessage } from '../lib/types';
import { createBadge, createControlContent, setButtonContent } from './icons';
import { setBeginnerTooltip } from '../lib/beginner-tooltips';

export function renderValidationBar(container: HTMLElement): void {
  const state = store.get();
  const messages = state.validationMessages;

  const bar = document.createElement('div');
  bar.className = 'validation-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Validation summary');

  const summary = document.createElement('div');
  summary.className = 'validation-summary';
  const errors = messages.filter(m => m.level === 'error').length;
  const warnings = messages.filter(m => m.level === 'warning').length;

  if (messages.length === 0) {
    summary.appendChild(createBadge('success', 'Ready', 'success'));
  } else {
    if (errors > 0) {
      summary.appendChild(createBadge('error', `${errors} error${errors !== 1 ? 's' : ''}`, 'danger'));
    }
    if (warnings > 0) {
      summary.appendChild(createBadge('warning', `${warnings} warning${warnings !== 1 ? 's' : ''}`, 'warning'));
    }
  }
  bar.appendChild(summary);

  if (messages.length > 0) {
    const highlights = document.createElement('div');
    highlights.className = 'validation-highlights';
    highlights.setAttribute('role', 'list');
    highlights.setAttribute('aria-label', 'Validation issues');

    for (const msg of messages.slice(0, 8)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `validation-msg ${msg.level}`;
      const leading = msg.level === 'error' ? 'Error' : 'Warning';
      const authorMessage = getAuthorMessage(msg);
      item.setAttribute('aria-label', `${leading} at ${formatLocation(msg)}. ${authorMessage}`);
      item.innerHTML = `<strong>${leading} · ${formatLocation(msg)}</strong><span>${escapeHtml(authorMessage)}</span>`;
      item.title = buildTooltip(msg);
      setBeginnerTooltip(item, 'validation-message');
      item.onclick = () => navigateToMessage(msg);
      highlights.appendChild(item);
    }

    bar.appendChild(highlights);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn-sm';
    setButtonContent(toggle, state.showValidationPanel ? 'close' : 'warning', state.showValidationPanel ? 'Hide issues' : `Open issues (${messages.length})`);
    toggle.onclick = () => store.toggleValidationPanel();
    bar.appendChild(toggle);
  }

  container.appendChild(bar);
}

export function createValidationWorkspaceContent(messages: ValidationMessage[]): HTMLElement {
  const body = document.createElement('div');
  body.className = 'validation-drawer-body';

  for (const level of ['error', 'warning'] as const) {
    const group = messages.filter((message) => message.level === level);
    if (group.length === 0) continue;

    const section = document.createElement('div');
    section.className = 'validation-drawer-section';

    const title = document.createElement('div');
    title.className = 'validation-drawer-title';
    title.appendChild(createControlContent(level === 'error' ? 'error' : 'warning', `${level === 'error' ? 'Errors' : 'Warnings'} (${group.length})`));
    section.appendChild(title);

    const list = document.createElement('div');
    list.className = 'validation-drawer-list';
    list.setAttribute('role', 'list');

    for (const msg of group) {
      const row = document.createElement('div');
      row.className = 'validation-drawer-row';
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `validation-drawer-item ${msg.level}`;
      item.setAttribute('aria-label', `${level === 'error' ? 'Error' : 'Warning'} at ${formatLocation(msg)}. ${getAuthorMessage(msg)}`);
      item.innerHTML = `<strong>${formatLocation(msg)}</strong><span>${escapeHtml(getAuthorMessage(msg))}</span><small>${escapeHtml(msg.code)}</small>`;
      setBeginnerTooltip(item, 'validation-message');
      item.onclick = () => navigateToMessage(msg);
      row.appendChild(item);

      const quickFix = getQuickFix(msg);
      if (quickFix) {
        const fixBtn = document.createElement('button');
        fixBtn.type = 'button';
        fixBtn.className = 'btn-sm validation-quick-fix';
        fixBtn.textContent = quickFix.label;
        fixBtn.onclick = quickFix.apply;
        row.appendChild(fixBtn);
      }
      list.appendChild(row);
    }

    section.appendChild(list);
    body.appendChild(section);
  }

  return body;
}

function formatLocation(msg: ValidationMessage): string {
  const parts = [`C${msg.conversationId}`];
  const conv = store.get().project.conversations.find(item => item.id === msg.conversationId);
  const turnLabels = conv ? createTurnDisplayLabeler(conv) : null;
  if (msg.turnNumber != null) parts.push(turnLabels?.getCompactLabel(msg.turnNumber) ?? `B${msg.turnNumber}`);
  if (msg.choiceIndex != null) parts.push(`C${msg.choiceIndex}`);
  return `[${parts.join(' / ')}]`;
}

function formatMessage(msg: ValidationMessage): string {
  return msg.message;
}

function getAuthorMessage(msg: ValidationMessage): string {
  switch (msg.code) {
    case 'missing-preconditions':
      return 'Add at least one start rule so author controls who can trigger story.';
    case 'missing-choice-text':
      return 'Write player reply text for this choice.';
    case 'missing-choice-reply':
      return 'Write NPC response after player picks this reply.';
    case 'missing-continue-target':
      return 'Pick next scene, create follow-up scene, or mark reply as ending story.';
    case 'f2f-start-mode-no-entry-turn':
      return 'Face-to-face story needs one in-person entry scene.';
    case 'missing-choices':
      return 'Add at least one player reply to this scene.';
    default:
      return msg.message;
  }
}

function getQuickFix(msg: ValidationMessage): { label: string; apply: () => void } | null {
  if (msg.code === 'missing-preconditions') {
    return {
      label: 'Add friendly NPC rule',
      apply: () => {
        const conv = store.get().project.conversations.find(item => item.id === msg.conversationId);
        if (!conv) return;
        store.updateConversation(conv.id, {
          preconditions: [...conv.preconditions, { type: 'simple', command: 'req_npc_friendly', params: [] }],
        });
      },
    };
  }

  if (msg.turnNumber == null || msg.choiceIndex == null) return null;

  if (msg.code === 'missing-choice-text') {
    return {
      label: 'Add placeholder',
      apply: () => store.updateChoice(msg.conversationId, msg.turnNumber!, msg.choiceIndex!, {
        text: 'Tell me more.',
      }),
    };
  }

  if (msg.code === 'missing-choice-reply') {
    return {
      label: 'Add placeholder',
      apply: () => store.updateChoice(msg.conversationId, msg.turnNumber!, msg.choiceIndex!, {
        reply: 'I will explain.',
      }),
    };
  }

  if (msg.code === 'missing-continue-target') {
    return {
      label: 'End story here',
      apply: () => store.clearChoiceContinuation(msg.conversationId, msg.turnNumber!, msg.choiceIndex!),
    };
  }

  return null;
}

function buildTooltip(msg: ValidationMessage): string {
  const target = msg.fieldLabel ? `Focus ${msg.fieldLabel}` : 'Navigate to issue';
  return `${target} • ${msg.code}`;
}

function navigateToMessage(msg: ValidationMessage): void {
  store.selectConversation(msg.conversationId);
  if (msg.turnNumber != null) {
    store.selectTurn(msg.turnNumber);
  }
  if (msg.choiceIndex != null) {
    store.selectChoice(msg.choiceIndex);
  }

  requestFlowCenter({
    conversationId: msg.conversationId,
    turnNumber: msg.turnNumber,
    fit: msg.turnNumber == null,
  });
  if (msg.propertiesTab) {
    store.setPropertiesTab(msg.propertiesTab);
  }

  requestAnimationFrame(() => {
    if (!msg.fieldKey) return;
    const field = document.querySelector(`[data-field-key="${CSS.escape(msg.fieldKey)}"]`) as HTMLElement | null;
    if (!field) return;
    field.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    if (isFocusable(field)) {
      field.focus();
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;');
}

function isFocusable(el: HTMLElement): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement | HTMLLIElement {
  return el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLButtonElement ||
    el instanceof HTMLLIElement;
}
