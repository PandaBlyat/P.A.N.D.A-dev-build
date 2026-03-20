// P.A.N.D.A. Conversation Editor — Main Entry Point

import './app.css';
import { store } from './lib/state';
import { clearDraft, persistDraft, readDraft } from './lib/draft-storage';
import { renderApp } from './components/App';
import { flushAllDebounced } from './components/PropertiesPanel';

// Boot
const app = document.getElementById('app')!;
const restoredDraft = readDraft();
if (restoredDraft) {
  store.loadProject(restoredDraft.project, restoredDraft.systemStrings);
}
renderApp(app);

// ─── Focus-safe rendering ────────────────────────────────────────────────
// The app keeps the outer shell mounted, but focus still needs to survive section re-renders.

function isEditableElement(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return el instanceof HTMLInputElement ||
         el instanceof HTMLTextAreaElement ||
         el instanceof HTMLSelectElement;
}

function shouldDeferRenderForActiveElement(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
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

// Re-render on state changes, but skip while an input is focused so section updates
// do not interrupt active editing (the "tabs out after each keypress" bug).
let renderPending = false;

store.subscribe(() => {
  const state = store.get();
  const isPristineEmptyState = state.project.conversations.length === 0 && state.systemStrings.size === 0 && !state.dirty;
  if (isPristineEmptyState) {
    clearDraft();
  } else {
    persistDraft(state.project, state.systemStrings);
  }

  if (shouldDeferRenderForActiveElement(document.activeElement) && app.contains(document.activeElement)) {
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
    if (shouldDeferRenderForActiveElement(document.activeElement) && app.contains(document.activeElement)) {
      return; // renderPending stays true
    }
    renderPending = false;
    safeRender();
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Enter key in an editable field: flush any pending render so the UI updates.
  // In textareas: Enter = apply/refresh, Shift+Enter = newline.
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    const active = document.activeElement;
    if (active && isEditableElement(active) && app.contains(active)) {
      if (active instanceof HTMLTextAreaElement) {
        if (e.shiftKey) return; // Shift+Enter inserts a newline as usual
        // Plain Enter: flush all pending debounced changes and re-render
        e.preventDefault();
        active.blur(); // remove focus so the render isn't deferred
      }
      flushAllDebounced();
      renderPending = false;
      safeRender();
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
