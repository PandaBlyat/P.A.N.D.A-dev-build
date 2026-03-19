// P.A.N.D.A. Conversation Editor — Validation Bar

import { store } from '../lib/state';

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
  } else {
    const errors = messages.filter(m => m.level === 'error').length;
    const warnings = messages.filter(m => m.level === 'warning').length;

    if (errors > 0) {
      const badge = document.createElement('span');
      badge.style.cssText = 'color:var(--danger); font-weight:bold;';
      badge.textContent = `${errors} error${errors !== 1 ? 's' : ''}`;
      bar.appendChild(badge);
    }
    if (warnings > 0) {
      const badge = document.createElement('span');
      badge.style.cssText = 'color:var(--warning);';
      badge.textContent = `${warnings} warning${warnings !== 1 ? 's' : ''}`;
      bar.appendChild(badge);
    }

    const sep = document.createElement('span');
    sep.style.cssText = 'width:1px; height:14px; background:var(--border);';
    bar.appendChild(sep);

    for (const msg of messages.slice(0, 8)) {
      const item = document.createElement('span');
      item.className = `validation-msg ${msg.level}`;
      item.textContent = `[${msg.conversationId}${msg.turnNumber ? `:T${msg.turnNumber}` : ''}] ${msg.message}`;
      item.onclick = () => {
        store.selectConversation(msg.conversationId);
        if (msg.turnNumber) store.selectTurn(msg.turnNumber);
        if (msg.choiceIndex) store.selectChoice(msg.choiceIndex);
      };
      bar.appendChild(item);
    }

    if (messages.length > 8) {
      const more = document.createElement('span');
      more.style.color = 'var(--text-dim)';
      more.textContent = `+${messages.length - 8} more`;
      bar.appendChild(more);
    }
  }

  container.appendChild(bar);
}
