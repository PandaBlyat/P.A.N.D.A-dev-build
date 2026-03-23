// P.A.N.D.A. Conversation Editor — Main Entry Point

import './app.css';
import {
  store,
  FULL_APP_RENDER,
  createStateChange,
  type RenderTarget,
  type StateChange,
} from './lib/state';
import { clearDraft, persistDraft, readDraft } from './lib/draft-storage';
import {
  getRenderRoot,
  renderApp,
  renderBottomWorkspace,
  renderConversationList,
  renderFlowEditor,
  renderPropertiesPanel,
  renderToolbar,
} from './components/App';
import { flushAllDebounced } from './components/PropertiesPanel';
import { trackSiteVisitor, fetchVisitorCount } from './lib/api-client';

// Boot
const app = document.getElementById('app')!;
const restoredDraft = readDraft();
if (restoredDraft) {
  store.loadProject(restoredDraft.project, restoredDraft.systemStrings);
}
renderApp(app);

// Track site visitor (best-effort, fire-and-forget)
void trackSiteVisitor();

// Fetch visitor count and expose it for the toolbar via global bridge
(globalThis as any).__pandaVisitorCount = 0;
void fetchVisitorCount().then(count => {
  (globalThis as any).__pandaVisitorCount = count;
  renderWithFocusPreserved(getRenderRoot(app, 'toolbar') ?? app, () => renderToolbar(app));
});

// ─── Focus-safe rendering ────────────────────────────────────────────────
// The app keeps the outer shell mounted, but focus still needs to survive section re-renders.

function isEditableElement(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return el instanceof HTMLInputElement ||
         el instanceof HTMLTextAreaElement ||
         el instanceof HTMLSelectElement;
}

function isTextEntryInput(input: HTMLInputElement): boolean {
  if (input.dataset.allowImmediateRender === 'true') return false;
  const type = (input.type || 'text').toLowerCase();
  return type === 'text'
    || type === 'search'
    || type === 'url'
    || type === 'tel'
    || type === 'email'
    || type === 'password'
    || type === 'number';
}

function shouldDeferRenderForActiveElement(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) {
    return el.dataset.allowImmediateRender !== 'true';
  }
  return el instanceof HTMLInputElement && isTextEntryInput(el);
}

function isInteractiveTextTarget(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return isTextEntryInput(el) || el.type === 'file';
  if (el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLElement && el.isContentEditable;
}

function hasBlockingDialogOrPicker(): boolean {
  return document.querySelector('[aria-modal="true"], .command-picker-panel') != null;
}

interface FocusSnapshot {
  key: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  scrollTop: number;
}

function captureFocus(root: HTMLElement): FocusSnapshot | null {
  const active = document.activeElement;
  if (!active || !root.contains(active) || !isEditableElement(active)) return null;
  const key = active.getAttribute('data-field-key');
  if (!key) return null;
  return {
    key,
    selectionStart: 'selectionStart' in active ? active.selectionStart : null,
    selectionEnd: 'selectionEnd' in active ? active.selectionEnd : null,
    scrollTop: 'scrollTop' in active ? (active as HTMLElement).scrollTop : 0,
  };
}

function restoreFocus(root: HTMLElement, snap: FocusSnapshot | null): void {
  if (!snap) return;
  const el = root.querySelector(`[data-field-key="${CSS.escape(snap.key)}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return;
  el.focus();
  if (snap.selectionStart != null && 'setSelectionRange' in el) {
    try { el.setSelectionRange(snap.selectionStart, snap.selectionEnd ?? snap.selectionStart); } catch { /* select inputs throw */ }
  }
  if (snap.scrollTop) el.scrollTop = snap.scrollTop;
}

function renderWithFocusPreserved(root: HTMLElement, render: () => void): void {
  const snap = captureFocus(root);
  render();
  restoreFocus(root, snap);
}

function mergeStateChanges(current: StateChange | null, incoming: StateChange): StateChange {
  if (!current) return incoming;
  if (current.targets.includes('appShell') || incoming.targets.includes('appShell')) {
    return FULL_APP_RENDER;
  }
  return createStateChange(...current.targets, ...incoming.targets);
}

function renderTarget(target: RenderTarget): void {
  const root = target === 'appShell' ? app : getRenderRoot(app, target);
  if (!root) return;

  const renderers: Record<Exclude<RenderTarget, 'appShell'>, () => void> = {
    conversationList: () => renderConversationList(app),
    flowEditor: () => renderFlowEditor(app),
    propertiesPanel: () => renderPropertiesPanel(app),
    bottomWorkspace: () => renderBottomWorkspace(app),
    toolbar: () => renderToolbar(app),
  };

  if (target === 'appShell') {
    renderWithFocusPreserved(root, () => renderApp(app));
    return;
  }

  renderWithFocusPreserved(root, renderers[target]);
}

function flushRender(change: StateChange): void {
  if (change.targets.includes('appShell')) {
    renderTarget('appShell');
    return;
  }

  for (const target of change.targets) {
    renderTarget(target);
  }
}

// Re-render on state changes, but skip while an input is focused so section updates
// do not interrupt active editing (the "tabs out after each keypress" bug).
let pendingChange: StateChange | null = null;

store.subscribe((change) => {
  const state = store.get();
  const isPristineEmptyState = state.project.conversations.length === 0 && state.systemStrings.size === 0 && !state.dirty;
  if (isPristineEmptyState) {
    clearDraft();
  } else {
    persistDraft(state.project, state.systemStrings);
  }

  if (shouldDeferRenderForActiveElement(document.activeElement) && app.contains(document.activeElement)) {
    pendingChange = mergeStateChanges(pendingChange, change);
    return;
  }
  pendingChange = null;
  flushRender(change);
});

// When the user leaves an input, flush any deferred render —
// but only if focus hasn't moved to ANOTHER editable element.
document.addEventListener('focusout', () => {
  if (!pendingChange) return;
  requestAnimationFrame(() => {
    // Re-check: if focus moved to another input, keep deferring.
    if (shouldDeferRenderForActiveElement(document.activeElement) && app.contains(document.activeElement)) {
      return; // pendingChange stays queued
    }
    const change = pendingChange;
    pendingChange = null;
    if (change) flushRender(change);
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
      const change = pendingChange ?? FULL_APP_RENDER;
      pendingChange = null;
      flushRender(change);
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
    return;
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key === 'Escape') {
    if (isInteractiveTextTarget(e.target) || hasBlockingDialogOrPicker()) {
      return;
    }
    const state = store.get();
    if (state.selectedTurnNumber == null && state.selectedChoiceIndex == null && state.propertiesTab !== 'selection') {
      return;
    }
    e.preventDefault();
    store.clearSelection();
  }
});
