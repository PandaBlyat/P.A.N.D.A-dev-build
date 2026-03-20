// P.A.N.D.A. Conversation Editor — Main Entry Point

import './app.css';
import { store } from './lib/state';
import { renderApp } from './components/App';

// Boot
const app = document.getElementById('app')!;
renderApp(app);

// ─── Focus-safe rendering ────────────────────────────────────────────────
// The app does full DOM rebuilds. We must preserve focus across renders.

function isEditableElement(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return el instanceof HTMLInputElement ||
         el instanceof HTMLTextAreaElement ||
         el instanceof HTMLSelectElement;
}

interface FocusSnapshot {
  key: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  scrollTop: number;
}

function captureFocus(): FocusSnapshot | null {
  const active = document.activeElement;
  if (!active || !app.contains(active) || !isEditableElement(active)) return null;
  const key = active.getAttribute('data-field-key');
  if (!key) return null;
  return {
    key,
    selectionStart: 'selectionStart' in active ? active.selectionStart : null,
    selectionEnd: 'selectionEnd' in active ? active.selectionEnd : null,
    scrollTop: 'scrollTop' in active ? (active as HTMLElement).scrollTop : 0,
  };
}

function restoreFocus(snap: FocusSnapshot | null): void {
  if (!snap) return;
  const el = app.querySelector(`[data-field-key="${CSS.escape(snap.key)}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return;
  el.focus();
  if (snap.selectionStart != null && 'setSelectionRange' in el) {
    try { el.setSelectionRange(snap.selectionStart, snap.selectionEnd ?? snap.selectionStart); } catch { /* select inputs throw */ }
  }
  if (snap.scrollTop) el.scrollTop = snap.scrollTop;
}

function safeRender(): void {
  const snap = captureFocus();
  renderApp(app);
  restoreFocus(snap);
}

// Re-render on state changes, but skip while an input is focused to prevent
// the DOM rebuild from stealing focus (the "tabs out after each keypress" bug).
let renderPending = false;

store.subscribe(() => {
  if (isEditableElement(document.activeElement) && app.contains(document.activeElement)) {
    renderPending = true;
    return;
  }
  renderPending = false;
  safeRender();
});

// When the user leaves an input, flush any deferred render —
// but only if focus hasn't moved to ANOTHER editable element.
document.addEventListener('focusout', () => {
  if (!renderPending) return;
  requestAnimationFrame(() => {
    // Re-check: if focus moved to another input, keep deferring.
    if (isEditableElement(document.activeElement) && app.contains(document.activeElement)) {
      return; // renderPending stays true
    }
    renderPending = false;
    safeRender();
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Enter key in an editable field: flush any pending render so the UI updates
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    const active = document.activeElement;
    if (active && isEditableElement(active) && app.contains(active)) {
      // Don't intercept Enter in textareas (they need newlines)
      if (active instanceof HTMLTextAreaElement) return;
      if (renderPending) {
        renderPending = false;
        safeRender();
      }
      return;
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    store.undo();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    store.redo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    const search = document.querySelector('[data-global-search="true"]') as HTMLInputElement | null;
    search?.focus();
    search?.select();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
    e.preventDefault();
    store.toggleValidationPanel();
  }
});
