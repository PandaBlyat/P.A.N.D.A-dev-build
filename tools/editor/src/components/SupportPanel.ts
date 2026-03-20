// P.A.N.D.A. Conversation Editor — Creator Support Panel

import { fetchCreatorSupportStats, incrementCreatorSupportUpvote } from '../lib/api-client';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { createIcon, setButtonContent } from './icons';

// Replace this with your live Ko-fi, Patreon, or link hub URL before shipping.
const SUPPORT_PAGE_URL = 'https://ko-fi.com/your-page';
const SUPPORT_PANEL_COPY = {
  eyebrow: 'Support the project',
  title: 'Fuel future P.A.N.D.A. updates',
  intro: 'P.A.N.D.A. is a passion project built to make writing, testing, and shipping atmospheric PDA conversations much easier. Every editor feature, quality-of-life pass, and mod update is something I keep building in my own time because I love bringing more life to the Zone.',
  mod: 'If the editor or the mod has helped your workflow, sparked ideas, or saved you a few headaches, support is always appreciated but never expected. Even a small contribution helps justify more polish passes, new systems, and continued maintenance.',
  support: 'If you want to help out, the button below will take you straight to my Ko-fi or Patreon page so you can chip in however you feel comfortable.',
  upvoteTitle: 'You can also support by just leaving an upvote!',
  upvoteBody: 'Morale support! If you enjoy the editor or a community conversation, tossing it an upvote is a fast way to show appreciation and help surface the good stuff.',
  upvoteStatsLabel: 'total morale upvotes',
  upvoteCta: 'Leave an upvote',
  upvoteDone: 'Upvoted — thank you!',
  upvoteLoading: 'Loading support count…',
  upvoteUnavailable: 'Counter unavailable right now, but you can still leave an upvote.',
  upvoteError: 'Could not save your upvote right now.',
  upvoteThanks: 'Thanks for the morale boost. It genuinely helps.',
};
const SUPPORT_UPVOTE_KEY = 'panda-creator-support-upvote';

let overlayEl: HTMLElement | null = null;
let focusTrap: FocusTrapController | null = null;
let restoreFocusEl: HTMLElement | null = null;
let supportUpvoteButtonEl: HTMLButtonElement | null = null;
let supportUpvoteCountEl: HTMLElement | null = null;
let supportUpvoteStatusEl: HTMLElement | null = null;
let supportUpvoteCount = 0;
let supportUpvoteReady = false;
let supportUpvoteCountAvailable = false;
let supportUpvoteBusy = false;

export function openSupportPanel(): void {
  if (overlayEl) return;

  restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  supportUpvoteCount = 0;
  supportUpvoteReady = false;
  supportUpvoteCountAvailable = false;
  supportUpvoteBusy = false;

  const overlay = document.createElement('div');
  overlay.className = 'support-overlay';
  overlay.onclick = (event) => {
    if (event.target === overlay) closeSupportPanel();
  };

  const panel = document.createElement('section');
  panel.className = 'support-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'support-panel-title');
  panel.onclick = (event) => event.stopPropagation();

  const header = document.createElement('div');
  header.className = 'support-panel-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'support-panel-title-wrap';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'support-panel-eyebrow';
  eyebrow.textContent = SUPPORT_PANEL_COPY.eyebrow;

  const title = document.createElement('div');
  title.className = 'support-panel-title';
  title.id = 'support-panel-title';
  title.append(createIcon('support'), document.createTextNode(SUPPORT_PANEL_COPY.title));

  titleWrap.append(eyebrow, title);

  const actions = document.createElement('div');
  actions.className = 'support-panel-header-actions';

  const supportBtn = document.createElement('button');
  supportBtn.type = 'button';
  supportBtn.className = 'btn btn-primary support-panel-cta';
  setButtonContent(supportBtn, 'support', 'Visit Ko-fi / Patreon');
  supportBtn.title = 'Open the creator support page in a new tab';
  supportBtn.onclick = () => window.open(SUPPORT_PAGE_URL, '_blank', 'noopener,noreferrer');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-icon';
  closeBtn.title = 'Close support panel';
  closeBtn.setAttribute('aria-label', 'Close support panel');
  closeBtn.appendChild(createIcon('close'));
  closeBtn.onclick = closeSupportPanel;

  actions.append(supportBtn, closeBtn);
  header.append(titleWrap, actions);

  const body = document.createElement('div');
  body.className = 'support-panel-body';

  const introCard = document.createElement('div');
  introCard.className = 'support-panel-card';
  introCard.innerHTML = `
    <p>${SUPPORT_PANEL_COPY.intro}</p>
    <p>${SUPPORT_PANEL_COPY.mod}</p>
    <p>${SUPPORT_PANEL_COPY.support}</p>
  `;

  const highlights = document.createElement('div');
  highlights.className = 'support-panel-highlights';
  highlights.innerHTML = `
    <div class="support-highlight">
      <strong>Why support helps</strong>
      <span>It gives me more room to keep improving the editor, maintain the mod, and spend time on the weird little details that make the project feel good to use.</span>
    </div>
    <div class="support-highlight">
      <strong>What your support means</strong>
      <span>Bug fixes, feature updates, more writing tools, and continued upkeep for P.A.N.D.A. without turning the project into something bloated or intrusive.</span>
    </div>
  `;

  const upvoteCard = document.createElement('div');
  upvoteCard.className = 'support-highlight support-highlight-upvote';

  const upvoteText = document.createElement('div');
  upvoteText.className = 'support-highlight-upvote-copy';

  const upvoteTitle = document.createElement('strong');
  upvoteTitle.textContent = SUPPORT_PANEL_COPY.upvoteTitle;

  const upvoteBody = document.createElement('span');
  upvoteBody.textContent = SUPPORT_PANEL_COPY.upvoteBody;

  upvoteText.append(upvoteTitle, upvoteBody);

  const upvoteActions = document.createElement('div');
  upvoteActions.className = 'support-highlight-upvote-actions';

  const upvoteCountBox = document.createElement('div');
  upvoteCountBox.className = 'support-upvote-count-box';

  const upvoteCount = document.createElement('strong');
  upvoteCount.className = 'support-upvote-count';
  upvoteCount.textContent = '—';

  const upvoteCountLabel = document.createElement('span');
  upvoteCountLabel.className = 'support-upvote-count-label';
  upvoteCountLabel.textContent = SUPPORT_PANEL_COPY.upvoteStatsLabel;

  upvoteCountBox.append(upvoteCount, upvoteCountLabel);

  const upvoteBtn = document.createElement('button');
  upvoteBtn.type = 'button';
  upvoteBtn.className = 'btn support-upvote-button';
  upvoteBtn.onclick = () => {
    void handleSupportUpvote();
  };

  const upvoteStatus = document.createElement('div');
  upvoteStatus.className = 'support-upvote-status';
  upvoteStatus.setAttribute('aria-live', 'polite');

  upvoteActions.append(upvoteCountBox, upvoteBtn, upvoteStatus);
  upvoteCard.append(upvoteText, upvoteActions);

  body.append(introCard, highlights, upvoteCard);
  panel.append(header, body);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  overlayEl = overlay;
  supportUpvoteButtonEl = upvoteBtn;
  supportUpvoteCountEl = upvoteCount;
  supportUpvoteStatusEl = upvoteStatus;
  renderSupportUpvoteState();
  void loadSupportUpvoteCount();

  focusTrap = trapFocus(panel, {
    restoreFocus: restoreFocusEl,
    initialFocus: supportBtn,
    onEscape: closeSupportPanel,
  });
}

export function closeSupportPanel(): void {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  focusTrap?.release();
  focusTrap = null;
  restoreFocusEl = null;
  supportUpvoteButtonEl = null;
  supportUpvoteCountEl = null;
  supportUpvoteStatusEl = null;
  supportUpvoteCount = 0;
  supportUpvoteReady = false;
  supportUpvoteCountAvailable = false;
  supportUpvoteBusy = false;
}

function renderSupportUpvoteState(message?: string): void {
  const hasVoted = hasSupportUpvoted();
  const hasError = message === SUPPORT_PANEL_COPY.upvoteError;
  const isUnavailable = message === SUPPORT_PANEL_COPY.upvoteUnavailable;

  if (supportUpvoteCountEl) {
    supportUpvoteCountEl.textContent = supportUpvoteCountAvailable ? new Intl.NumberFormat().format(supportUpvoteCount) : '—';
  }

  if (supportUpvoteButtonEl) {
    supportUpvoteButtonEl.disabled = supportUpvoteBusy || hasVoted || !supportUpvoteReady;
    setButtonContent(
      supportUpvoteButtonEl,
      'support',
      supportUpvoteBusy ? 'Saving…' : hasVoted ? SUPPORT_PANEL_COPY.upvoteDone : SUPPORT_PANEL_COPY.upvoteCta,
    );
  }

  if (supportUpvoteStatusEl) {
    supportUpvoteStatusEl.textContent = message ?? (!supportUpvoteReady
      ? SUPPORT_PANEL_COPY.upvoteLoading
      : hasVoted
        ? SUPPORT_PANEL_COPY.upvoteThanks
        : !supportUpvoteCountAvailable
          ? SUPPORT_PANEL_COPY.upvoteUnavailable
          : '');
    supportUpvoteStatusEl.dataset.state = hasError ? 'error' : isUnavailable ? 'warning' : !supportUpvoteReady ? 'loading' : hasVoted ? 'success' : 'idle';
  }
}

async function loadSupportUpvoteCount(): Promise<void> {
  renderSupportUpvoteState();

  try {
    const stats = await fetchCreatorSupportStats();
    supportUpvoteCount = stats.upvotes ?? 0;
    supportUpvoteCountAvailable = true;
  } catch {
    supportUpvoteCountAvailable = false;
  } finally {
    supportUpvoteReady = true;
    renderSupportUpvoteState(supportUpvoteCountAvailable ? undefined : SUPPORT_PANEL_COPY.upvoteUnavailable);
  }
}

async function handleSupportUpvote(): Promise<void> {
  if (supportUpvoteBusy || !supportUpvoteReady || hasSupportUpvoted()) return;

  supportUpvoteBusy = true;
  renderSupportUpvoteState();

  try {
    await incrementCreatorSupportUpvote();
    rememberSupportUpvote();

    try {
      const stats = await fetchCreatorSupportStats();
      supportUpvoteCount = stats.upvotes ?? supportUpvoteCount + 1;
      supportUpvoteCountAvailable = true;
    } catch {
      if (supportUpvoteCountAvailable) {
        supportUpvoteCount += 1;
      }
    }

    renderSupportUpvoteState(SUPPORT_PANEL_COPY.upvoteThanks);
  } catch {
    renderSupportUpvoteState(SUPPORT_PANEL_COPY.upvoteError);
  } finally {
    supportUpvoteBusy = false;
    renderSupportUpvoteState(supportUpvoteStatusEl?.dataset.state === 'error'
      ? SUPPORT_PANEL_COPY.upvoteError
      : supportUpvoteCountAvailable
        ? undefined
        : SUPPORT_PANEL_COPY.upvoteUnavailable);
  }
}

function hasSupportUpvoted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SUPPORT_UPVOTE_KEY) === '1';
}

function rememberSupportUpvote(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SUPPORT_UPVOTE_KEY, '1');
}
