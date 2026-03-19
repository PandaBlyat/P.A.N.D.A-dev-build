// P.A.N.D.A. Conversation Editor — Validation Bar

import { requestFlowCenter } from '../lib/flow-navigation';
import { store } from '../lib/state';
import type { ValidationMessage } from '../lib/types';

export function renderValidationBar(container: HTMLElement): void {
  const state = store.get();
  const messages = state.validationMessages;

  const bar = document.createElement('div');
  bar.className = 'validation-bar';

  if (messages.length === 0) {
    const ok = document.createElement('span');
    ok.style.color = 'var(--accent)';
    ok.textContent = '\u2713 No issues';
    bar.appendChild(ok);
    container.appendChild(bar);
    return;
  }

  const summary = document.createElement('div');
  summary.style.cssText = 'display:flex; align-items:center; gap:12px;';
  const errors = messages.filter(m => m.level === 'error').length;
  const warnings = messages.filter(m => m.level === 'warning').length;

  if (errors > 0) {
    const badge = document.createElement('span');
    badge.style.cssText = 'color:var(--danger); font-weight:bold;';
    badge.textContent = `${errors} error${errors !== 1 ? 's' : ''}`;
    summary.appendChild(badge);
  }
  if (warnings > 0) {
    const badge = document.createElement('span');
    badge.style.cssText = 'color:var(--warning);';
    badge.textContent = `${warnings} warning${warnings !== 1 ? 's' : ''}`;
    summary.appendChild(badge);
  }
  bar.appendChild(summary);

  const groups: Array<['error' | 'warning', ValidationMessage[]]> = [
    ['error', messages.filter(msg => msg.level === 'error')],
    ['warning', messages.filter(msg => msg.level === 'warning')],
  ];

  for (const [level, groupMessages] of groups) {
    if (groupMessages.length === 0) continue;

    const section = document.createElement('div');
    section.style.cssText = 'display:flex; align-items:center; gap:6px; min-width:max-content;';

    const label = document.createElement('span');
    label.style.cssText = `font-weight:600; text-transform:uppercase; color:${level === 'error' ? 'var(--danger)' : 'var(--warning)'};`;
    label.textContent = level === 'error' ? 'Errors' : 'Warnings';
    section.appendChild(label);

    for (const msg of groupMessages.slice(0, 6)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `validation-msg ${msg.level}`;
      item.textContent = `${formatLocation(msg)} ${msg.message}`;
      item.title = buildTooltip(msg);
      item.onclick = () => navigateToMessage(msg);
      section.appendChild(item);
    }

    if (groupMessages.length > 6) {
      const more = document.createElement('span');
      more.style.color = 'var(--text-dim)';
      more.textContent = `+${groupMessages.length - 6} more`;
      section.appendChild(more);
    }

    bar.appendChild(section);
  }

  container.appendChild(bar);
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

function isFocusable(el: HTMLElement): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement | HTMLLIElement {
  return el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLButtonElement ||
    el instanceof HTMLLIElement;
}
