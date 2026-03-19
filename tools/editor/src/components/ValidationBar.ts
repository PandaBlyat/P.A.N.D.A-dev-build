// P.A.N.D.A. Conversation Editor — Validation Bar

import { requestFlowCenter } from '../lib/flow-navigation';
import { store } from '../lib/state';
import type { ValidationMessage } from '../lib/types';
import { createBadge, createControlContent, setButtonContent } from './icons';

export function renderValidationBar(container: HTMLElement): void {
  const state = store.get();
  const messages = state.validationMessages;

  const bar = document.createElement('div');
  bar.className = 'validation-bar';

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

    for (const msg of messages.slice(0, 8)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `validation-msg ${msg.level}`;
      const leading = msg.level === 'error' ? 'Error' : 'Warning';
      item.innerHTML = `<strong>${leading} · ${formatLocation(msg)}</strong><span>${escapeHtml(msg.message)}</span>`;
      item.title = buildTooltip(msg);
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

    for (const msg of group) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `validation-drawer-item ${msg.level}`;
      item.innerHTML = `<strong>${formatLocation(msg)}</strong><span>${escapeHtml(msg.message)}</span><small>${escapeHtml(msg.code)}</small>`;
      item.onclick = () => navigateToMessage(msg);
      list.appendChild(item);
    }

    section.appendChild(list);
    body.appendChild(section);
  }

  return body;
}

function formatLocation(msg: ValidationMessage): string {
  const parts = [`C${msg.conversationId}`];
  if (msg.turnNumber != null) parts.push(`T${msg.turnNumber}`);
  if (msg.choiceIndex != null) parts.push(`C${msg.choiceIndex}`);
  return `[${parts.join(' / ')}]`;
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
