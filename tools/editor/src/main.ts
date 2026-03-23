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
  tryFastFlowUpdate,
} from './components/App';
import { flushAllDebounced } from './components/PropertiesPanel';
import { trackSiteVisitor, fetchVisitorCount, fetchUserProfile, getStoredUsername, type UserProfile } from './lib/api-client';
import { setProfileForBadge } from './components/ProfileBadge';
import { openUsernameModal, isUsernameModalOpen } from './components/UsernameModal';

type IdleCallbackHandle = number;
type IdleCallbackDeadline = { didTimeout: boolean; timeRemaining: () => number };
type IdleCallbackScheduler = (callback: (deadline: IdleCallbackDeadline) => void, options?: { timeout?: number }) => IdleCallbackHandle;
type IdleCallbackCanceller = (handle: IdleCallbackHandle) => void;

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

// ─── User Profile / Gamification Bootstrap ─────────────────────────────────
const LOCAL_PUBLISHER_ID_KEY = 'panda-community-publisher-id';

function getPublisherId(): string {
  if (typeof window === 'undefined') return 'server-publisher';
  const existing = window.localStorage.getItem(LOCAL_PUBLISHER_ID_KEY)?.trim();
  if (existing) return existing;
  const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `publisher-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(LOCAL_PUBLISHER_ID_KEY, generated);
  return generated;
}

(globalThis as any).__pandaUserProfile = null as UserProfile | null;

function refreshToolbarProfile(): void {
  setProfileForBadge((globalThis as any).__pandaUserProfile);
  renderWithFocusPreserved(getRenderRoot(app, 'toolbar') ?? app, () => renderToolbar(app));
}

const publisherId = getPublisherId();
const storedUsername = getStoredUsername();

if (storedUsername) {
  // Already registered — fetch profile
  void fetchUserProfile(publisherId).then(profile => {
    if (profile) {
      (globalThis as any).__pandaUserProfile = profile;
      refreshToolbarProfile();
    }
  });
} else {
  // First visit — show username modal after a short delay so the app settles
  setTimeout(() => {
    if (isUsernameModalOpen()) return;
    openUsernameModal({
      publisherId,
      onRegistered: (profile) => {
        (globalThis as any).__pandaUserProfile = profile;
        refreshToolbarProfile();
      },
    });
  }, 1500);
}

const requestIdle = ((globalThis as typeof globalThis & { requestIdleCallback?: IdleCallbackScheduler }).requestIdleCallback
  ?? ((callback: (deadline: IdleCallbackDeadline) => void) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 150))) as IdleCallbackScheduler;
const cancelIdle = ((globalThis as typeof globalThis & { cancelIdleCallback?: IdleCallbackCanceller }).cancelIdleCallback
  ?? ((handle: IdleCallbackHandle) => window.clearTimeout(handle))) as IdleCallbackCanceller;

const AUTOSAVE_DEBOUNCE_MS = 300;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveIdleHandle: IdleCallbackHandle | null = null;
let queuedAutosave: { projectRevision: number; systemStringsRevision: number } | null = null;
let lastPersistedProjectRevision = restoredDraft ? store.get().projectRevision : -1;
let lastPersistedSystemStringsRevision = restoredDraft ? store.get().systemStringsRevision : -1;

function flushAutosave(): void {
  if (autosaveTimer != null) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  if (autosaveIdleHandle != null) {
    cancelIdle(autosaveIdleHandle);
    autosaveIdleHandle = null;
  }
  if (!queuedAutosave) return;

  const state = store.get();
  const isPristineEmptyState = state.project.conversations.length === 0 && state.systemStrings.size === 0 && !state.dirty;
  if (isPristineEmptyState) {
    clearDraft();
  } else {
    persistDraft(state.project, state.systemStrings);
  }

  lastPersistedProjectRevision = queuedAutosave.projectRevision;
  lastPersistedSystemStringsRevision = queuedAutosave.systemStringsRevision;
  queuedAutosave = null;
}

function scheduleAutosave(): void {
  const state = store.get();
  if (state.projectRevision === lastPersistedProjectRevision && state.systemStringsRevision === lastPersistedSystemStringsRevision) {
    return;
  }

  queuedAutosave = {
    projectRevision: state.projectRevision,
    systemStringsRevision: state.systemStringsRevision,
  };

  if (autosaveTimer != null) clearTimeout(autosaveTimer);
  if (autosaveIdleHandle != null) cancelIdle(autosaveIdleHandle);

  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    autosaveIdleHandle = requestIdle(() => {
      autosaveIdleHandle = null;
      flushAutosave();
    }, { timeout: 500 });
  }, AUTOSAVE_DEBOUNCE_MS);
}

window.addEventListener('beforeunload', () => {
  flushAutosave();
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
  if (!current) return { ...incoming };

  const merged = current.targets.includes('appShell') || incoming.targets.includes('appShell')
    ? { ...FULL_APP_RENDER }
    : createStateChange(...current.targets, ...incoming.targets);

  merged.projectChanged = current.projectChanged || incoming.projectChanged;
  merged.systemStringsChanged = current.systemStringsChanged || incoming.systemStringsChanged;
  merged.validationChanged = current.validationChanged || incoming.validationChanged;
  return merged;
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

function isSelectionOnlyChange(change: StateChange): boolean {
  return !change.projectChanged
    && !change.systemStringsChanged
    && !change.validationChanged
    && change.targets.includes('flowEditor')
    && !change.targets.includes('appShell');
}

function flushRender(change: StateChange): void {
  if (change.targets.includes('appShell')) {
    renderTarget('appShell');
    return;
  }

  // Fast path: selection-only changes can update flow editor incrementally
  let flowHandled = false;
  if (isSelectionOnlyChange(change)) {
    flowHandled = tryFastFlowUpdate();
  }

  for (const target of change.targets) {
    if (flowHandled && target === 'flowEditor') continue;
    renderTarget(target);
  }
}

// Re-render on state changes, but skip while an input is focused so section updates
// do not interrupt active editing (the "tabs out after each keypress" bug).
let pendingChange: StateChange | null = null;

store.subscribe((change) => {
  if (change.projectChanged || change.systemStringsChanged) {
    scheduleAutosave();
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
