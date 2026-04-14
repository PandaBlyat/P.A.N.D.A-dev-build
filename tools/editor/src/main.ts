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
import { measurePerf } from './lib/perf';

import {
  getRenderRoot,
  renderApp,
  renderBottomWorkspace,
  renderConversationList,
  renderFlowEditor,
  renderPropertiesPanel,
  renderToolbar,
  tryFastFlowUpdate,
  trySyncFlowEditor,
} from './components/App';
import { flushAllDebounced } from './components/PropertiesPanel';
import { installPerfBenchmark } from './lib/perf-benchmark';
import {
  trackSiteVisitor,
  fetchVisitorCount,
  fetchActiveEditorUserCount,
  fetchActiveEditorUsernames,
  startActiveEditorPresenceTracking,
  fetchUserProfile,
  getStoredUsername,
  clearStoredUsername,
  awardXpCapped,
  updateUserStreak,
  type UserProfile,
  type UserStreakState,
} from './lib/api-client';
import { setProfileForBadge } from './components/ProfileBadge';
import { openUsernameModal, isUsernameModalOpen } from './components/UsernameModal';
import { recordDailyLogin } from './lib/gamification';
import { showXpToast } from './components/XpToast';
import { showGamificationToast } from './components/AchievementToast';
import { installBeginnerTooltipBridge } from './components/BeginnerTooltip';
import { mountBeginnerTooltipController } from './lib/beginner-tooltips';

type IdleCallbackHandle = number;
type IdleCallbackDeadline = { didTimeout: boolean; timeRemaining: () => number };
type IdleCallbackScheduler = (callback: (deadline: IdleCallbackDeadline) => void, options?: { timeout?: number }) => IdleCallbackHandle;
type IdleCallbackCanceller = (handle: IdleCallbackHandle) => void;

// Boot
const app = document.getElementById('app')!;
installBeginnerTooltipBridge();
const restoredDraft = readDraft();
if (restoredDraft) {
  store.loadProject(restoredDraft.project, restoredDraft.systemStrings);
}
renderApp(app);
installPerfBenchmark();
mountBeginnerTooltipController(document.body);

// Track site visitor (best-effort, fire-and-forget)
void trackSiteVisitor();

// Fetch visitor count and expose it for the toolbar via global bridge
(globalThis as any).__pandaVisitorCount = 0;
void fetchVisitorCount().then(count => {
  (globalThis as any).__pandaVisitorCount = count;
  renderWithFocusPreserved(getRenderRoot(app, 'toolbar') ?? app, () => renderToolbar(app));
});

(globalThis as any).__pandaActiveUserCount = 0;
(globalThis as any).__pandaActiveUsernames = [] as string[];

async function refreshActiveUsersInToolbar(countOverride?: number): Promise<void> {
  const [count, usernames] = await Promise.all([
    typeof countOverride === 'number' ? Promise.resolve(countOverride) : fetchActiveEditorUserCount(),
    fetchActiveEditorUsernames(),
  ]);
  (globalThis as any).__pandaActiveUserCount = count;
  (globalThis as any).__pandaActiveUsernames = usernames;
  renderWithFocusPreserved(getRenderRoot(app, 'toolbar') ?? app, () => renderToolbar(app));
}

void refreshActiveUsersInToolbar();

const stopPresenceTracking = startActiveEditorPresenceTracking((count) => {
  void refreshActiveUsersInToolbar(count);
});
window.addEventListener('pagehide', () => {
  stopPresenceTracking();
}, { once: true });

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

function setCurrentProfile(profile: UserProfile | null): void {
  (globalThis as any).__pandaUserProfile = profile;
  refreshToolbarProfile();
}

function buildSyncedStreakPayload(profile: UserProfile, loginResult: ReturnType<typeof recordDailyLogin>): UserStreakState {
  return {
    publish_streak: profile.streaks?.publish_streak ?? 0,
    longest_streak: profile.streaks?.longest_streak ?? 0,
    last_publish_week: profile.streaks?.last_publish_week ?? '',
    login_streak: loginResult.loginStreakData.currentStreak,
    last_login_date: loginResult.loginStreakData.lastLoginDate,
  };
}

function handleProfileRegistered(profile: UserProfile): void {
  setCurrentProfile(profile);

  const loginResult = recordDailyLogin();
  if (!loginResult.isNew) return;

  void (async () => {
    try {
      await updateUserStreak(profile.publisher_id, buildSyncedStreakPayload(profile, loginResult));
      if (loginResult.xp > 0) {
        await awardXpCapped(profile.publisher_id, loginResult.xp);
      }

      const refreshed = await fetchUserProfile(profile.publisher_id);
      if (refreshed) {
        setCurrentProfile(refreshed);
      }

      if (loginResult.xp > 0) {
        showXpToast(loginResult.xp, `Daily login (${loginResult.streak}-day streak)`);
      }
      if (loginResult.streak >= 7 && loginResult.streak % 7 === 0) {
        setTimeout(() => {
          showGamificationToast('\u{1F525}', `${loginResult.streak}-Day Login Streak!`, 'Keep opening the editor daily!');
        }, 800);
      }
    } catch {
      // Keep the cached local streak as a fallback if sync fails.
    }
  })();
}

function openLoginModal(): void {
  if (isUsernameModalOpen()) return;
  openUsernameModal({
    publisherId,
    onRegistered: handleProfileRegistered,
  });
}

(globalThis as any).__pandaOpenLoginModal = openLoginModal;

if (storedUsername) {
  // Already registered — fetch profile
  void fetchUserProfile(publisherId).then(profile => {
    if (profile) {
      handleProfileRegistered(profile);
      return;
    }
    clearStoredUsername();
    setCurrentProfile(null);
  });
} else {
  // First visit — show username modal after a short delay so the app settles
  setTimeout(() => {
    openLoginModal();
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
    measurePerf('state.autosavePersist', () => clearDraft(), { mode: 'clear' });
  } else {
    measurePerf('state.autosavePersist', () => persistDraft(state.project, state.systemStrings), {
      mode: 'persist',
      conversationCount: state.project.conversations.length,
      systemStringCount: state.systemStrings.size,
    });
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
  flushAllDebounced();
  store.commitPendingTextEdits();
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
  merged.reason = mergeRenderReason(current.reason, incoming.reason);
  merged.flow = mergeFlowMeta(current.flow, incoming.flow);
  return merged;
}

function mergeRenderReason(a: StateChange['reason'], b: StateChange['reason']): StateChange['reason'] {
  if (a === b) return a;
  if (a === 'structure' || b === 'structure') return 'structure';
  if (a === 'position' || b === 'position') return 'position';
  if (a === 'text-content' || b === 'text-content') return 'text-content';
  if (a === 'settings' || b === 'settings') return 'settings';
  if (a === 'validation' || b === 'validation') return 'validation';
  if (a === 'selection' || b === 'selection') return 'selection';
  return 'generic';
}

function mergeFlowMeta(a: StateChange['flow'], b: StateChange['flow']): StateChange['flow'] {
  if (!a) return b ? { ...b } : undefined;
  if (!b) return { ...a };
  return { kind: mergeRenderReason(a.kind, b.kind) as NonNullable<StateChange['flow']>['kind'] };
}

function cloneChangeForTargets(change: StateChange, targets: readonly RenderTarget[]): StateChange | null {
  if (targets.length === 0) return null;
  const next = targets.includes('appShell')
    ? { ...FULL_APP_RENDER }
    : createStateChange(...targets);
  next.projectChanged = change.projectChanged;
  next.systemStringsChanged = change.systemStringsChanged;
  next.validationChanged = change.validationChanged;
  next.reason = change.reason;
  next.flow = change.flow ? { ...change.flow } : undefined;
  return next;
}

function splitChangeForActiveEditor(change: StateChange, active: Element | null): { immediate: StateChange | null; deferred: StateChange | null } | null {
  if (!shouldDeferRenderForActiveElement(active) || !app.contains(active)) {
    return null;
  }
  if (change.targets.includes('appShell')) {
    return {
      immediate: null,
      deferred: { ...change },
    };
  }

  const immediateTargets: RenderTarget[] = [];
  const deferredTargets: RenderTarget[] = [];

  for (const target of change.targets) {
    if (target === 'appShell') {
      deferredTargets.push(target);
      continue;
    }
    const root = getRenderRoot(app, target);
    if (root && root.contains(active)) {
      deferredTargets.push(target);
    } else {
      immediateTargets.push(target);
    }
  }

  return {
    immediate: cloneChangeForTargets(change, immediateTargets),
    deferred: cloneChangeForTargets(change, deferredTargets),
  };
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
    && change.targets.includes('propertiesPanel')
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
  } else if (change.targets.includes('flowEditor')) {
    flowHandled = trySyncFlowEditor(change);
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

  const splitChange = splitChangeForActiveEditor(change, document.activeElement);
  if (splitChange) {
    if (splitChange.deferred) {
      pendingChange = mergeStateChanges(pendingChange, splitChange.deferred);
    }
    if (splitChange.immediate) {
      flushRender(splitChange.immediate);
    }
    return;
  }

  const nextChange = pendingChange ? mergeStateChanges(pendingChange, change) : change;
  pendingChange = null;
  flushRender(nextChange);
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
      store.commitPendingTextEdits();
      const change = pendingChange ?? FULL_APP_RENDER;
      pendingChange = null;
      flushRender(change);
      return;
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    flushAllDebounced();
    store.commitPendingTextEdits();
    store.undo();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    flushAllDebounced();
    store.commitPendingTextEdits();
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
