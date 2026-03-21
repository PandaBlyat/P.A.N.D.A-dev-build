// P.A.N.D.A. Conversation Editor — Creator Support Panel

import { fetchCreatorSupportStats, incrementCreatorSupportUpvote } from '../lib/api-client';
import { trapFocus, type FocusTrapController } from '../lib/focus-trap';
import { createIcon, setButtonContent } from './icons';

// Replace this with your live Ko-fi, Patreon, or link hub URL before shipping.
const SUPPORT_PAGE_URL = 'https://ko-fi.com/your-page';
const SUPPORT_PANEL_COPY = {
  eyebrow: 'Support the project',
  title: 'Fuel future P.A.N.D.A. updates',
  intro: 'P.A.N.D.A. is my passion project that started as a very basic expansion to vanilla dynamic news dialogues with UDE. Over the years as I learnt X-Ray scripting, my scope grew far, far bigger.',
  mod: 'I\'ve been working on P.A.N.D.A. for a long while and a lot of work (and boring-ass bug testing) has gone into making all of this possible. The mod will be released once it has enough conversations and meets polished standards.',
  support: 'I have a lot of new features planned for the future and there is a lot of room for mechanical growth gameplay-wise. If you want to tip me or show appreciation, the button above will take you straight to my Ko-fi.',
  upvoteTitle: 'Give a Morale Boost!',
  upvoteBody: 'It costs nothing, but it makes the dev happy.',
  upvoteStatsLabel: 'Total morale upvotes',
  upvoteCta: 'Leave an upvote',
  upvoteDone: 'Upvoted — thank you!',
  upvoteLoading: 'Loading support count…',
  upvoteError: 'Could not reach the support counter right now.',
  upvoteThanks: 'Thanks for the morale boost. *Self-esteem UP* .',
};
const SUPPORT_UPVOTE_KEY = 'panda-creator-support-upvote';

let overlayEl: HTMLElement | null = null;
let focusTrap: FocusTrapController | null = null;
let restoreFocusEl: HTMLElement | null = null;
let supportUpvoteButtonEl: HTMLButtonElement | null = null;
let supportUpvoteCountEl: HTMLElement | null = null;
let supportUpvoteStatusEl: HTMLElement | null = null;
let supportUpvoteCount = 0;
let supportUpvoteLoaded = false;
let supportUpvoteBusy = false;

export function openSupportPanel(): void {
  if (overlayEl) return;

  restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  supportUpvoteCount = 0;
  supportUpvoteLoaded = false;
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
      <span>It gives me more room to keep adding new interesting features to anomaly, maintain the mod and improve the editor over time to support vanilla systems as well.</span>
    </div>
    <div class="support-highlight">
      <strong>What your support means</strong>
      <span>It genuinely shows all the hours I spent haven't been for nothing, which would you know, be a bit of a bummer.</span>
    </div>
  `;

  const upvoteCard = document.createElement('div');
  upvoteCard.className = 'support-highlight support-highlight-upvote';
  // STRUCTURAL OVERRIDES: Center everything and give it padding
  upvoteCard.style.display = 'flex';
  upvoteCard.style.flexDirection = 'column';
  upvoteCard.style.alignItems = 'center';
  upvoteCard.style.textAlign = 'center';
  upvoteCard.style.gap = '1.5rem';
  upvoteCard.style.padding = '2.5rem 1.5rem';

  const upvoteText = document.createElement('div');
  upvoteText.className = 'support-highlight-upvote-copy';

  const upvoteTitle = document.createElement('strong');
  upvoteTitle.textContent = SUPPORT_PANEL_COPY.upvoteTitle;
  upvoteTitle.style.fontSize = '1.2rem';

  const upvoteBody = document.createElement('span');
  upvoteBody.textContent = SUPPORT_PANEL_COPY.upvoteBody;
  upvoteBody.style.display = 'block';
  upvoteBody.style.marginTop = '0.25rem';

  upvoteText.append(upvoteTitle, upvoteBody);

  const upvoteActions = document.createElement('div');
  upvoteActions.className = 'support-highlight-upvote-actions';
  // STRUCTURAL OVERRIDES: Column layout for the button and big number
  upvoteActions.style.display = 'flex';
  upvoteActions.style.flexDirection = 'column';
  upvoteActions.style.alignItems = 'center';
  upvoteActions.style.gap = '1.25rem';
  upvoteActions.style.width = '100%';

  const upvoteCountBox = document.createElement('div');
  upvoteCountBox.className = 'support-upvote-count-box';

  const upvoteCount = document.createElement('strong');
  upvoteCount.className = 'support-upvote-count';
  upvoteCount.textContent = '—';
  // BIG NUMBER STYLING
  upvoteCount.style.fontSize = '4.5rem';
  upvoteCount.style.display = 'block';
  upvoteCount.style.lineHeight = '1';
  upvoteCount.style.color = 'var(--panda-accent-upvote, #10b981)';
  upvoteCount.style.textShadow = '0 4px 24px rgba(16, 185, 129, 0.3)';
  upvoteCount.style.marginBottom = '0.5rem';
  upvoteCount.style.fontVariantNumeric = 'tabular-nums';

  const upvoteCountLabel = document.createElement('span');
  upvoteCountLabel.className = 'support-upvote-count-label';
  upvoteCountLabel.textContent = SUPPORT_PANEL_COPY.upvoteStatsLabel;
  upvoteCountLabel.style.fontSize = '0.85rem';
  upvoteCountLabel.style.textTransform = 'uppercase';
  upvoteCountLabel.style.letterSpacing = '0.1em';

  upvoteCountBox.append(upvoteCount, upvoteCountLabel);

  const upvoteBtn = document.createElement('button');
  upvoteBtn.type = 'button';
  upvoteBtn.className = 'btn support-upvote-button';
  // Make the button slightly larger to match the new layout
  upvoteBtn.style.padding = '0.75rem 1.5rem';
  upvoteBtn.style.fontSize = '1rem';
  upvoteBtn.onclick = () => {
    void handleSupportUpvote();
  };

  const upvoteStatus = document.createElement('div');
  upvoteStatus.className = 'support-upvote-status';
  upvoteStatus.setAttribute('aria-live', 'polite');
  upvoteStatus.style.position = 'static'; // Remove absolute positioning if inherited
  upvoteStatus.style.marginTop = '0';

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
  supportUpvoteLoaded = false;
  supportUpvoteBusy = false;
}

function renderSupportUpvoteState(message?: string): void {
  const hasVoted = hasSupportUpvoted();
  const hasError = message === SUPPORT_PANEL_COPY.upvoteError;

  if (supportUpvoteCountEl) {
    supportUpvoteCountEl.textContent = supportUpvoteLoaded ? new Intl.NumberFormat().format(supportUpvoteCount) : '—';
  }

  if (supportUpvoteButtonEl) {
    supportUpvoteButtonEl.disabled = supportUpvoteBusy || hasVoted || !supportUpvoteLoaded;
    if (hasVoted) supportUpvoteButtonEl.setAttribute('data-voted', 'true');
    setButtonContent(
      supportUpvoteButtonEl,
      hasVoted ? 'check' : 'support',
      supportUpvoteBusy ? 'Saving…' : hasVoted ? SUPPORT_PANEL_COPY.upvoteDone : SUPPORT_PANEL_COPY.upvoteCta,
    );
  }

  if (supportUpvoteStatusEl) {
    supportUpvoteStatusEl.textContent = message ?? (!supportUpvoteLoaded ? SUPPORT_PANEL_COPY.upvoteLoading : hasVoted ? SUPPORT_PANEL_COPY.upvoteThanks : '');
    supportUpvoteStatusEl.dataset.state = hasError ? 'error' : !supportUpvoteLoaded ? 'loading' : hasVoted ? 'success' : 'idle';
  }
}

async function loadSupportUpvoteCount(): Promise<void> {
  renderSupportUpvoteState();

  try {
    const stats = await fetchCreatorSupportStats();
    supportUpvoteCount = stats.upvotes ?? 0;
    supportUpvoteLoaded = true;
    renderSupportUpvoteState();
  } catch {
    supportUpvoteLoaded = false;
    renderSupportUpvoteState(SUPPORT_PANEL_COPY.upvoteError);
  }
}

async function handleSupportUpvote(): Promise<void> {
  if (supportUpvoteBusy || !supportUpvoteLoaded || hasSupportUpvoted()) return;

  // --- OPTIMISTIC UI UPDATE ---
  // Instantly update the UI so it feels lightning fast to the user
  supportUpvoteBusy = true;
  supportUpvoteCount += 1;
  rememberSupportUpvote();
  
  if (supportUpvoteButtonEl) {
    fireConfetti(supportUpvoteButtonEl); // Trigger explosion!
  }
  
  // Render the success state immediately
  renderSupportUpvoteState(SUPPORT_PANEL_COPY.upvoteThanks);

  try {
    // Attempt the actual background API call
    await incrementCreatorSupportUpvote();
  } catch {
    // If it fails, quietly roll back the UI changes
    supportUpvoteCount -= 1;
    if (typeof window !== 'undefined') window.localStorage.removeItem(SUPPORT_UPVOTE_KEY);
    renderSupportUpvoteState(SUPPORT_PANEL_COPY.upvoteError);
  } finally {
    supportUpvoteBusy = false;
    // Keep the thanks message if it succeeded, otherwise keep the error
    renderSupportUpvoteState(supportUpvoteStatusEl?.dataset.state === 'error' ? SUPPORT_PANEL_COPY.upvoteError : SUPPORT_PANEL_COPY.upvoteThanks);
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

// --- PARTICLE / CONFETTI EXPLOSION SYSTEM ---
function fireConfetti(buttonEl: HTMLElement) {
  // Get the exact center coordinates of the button
  const rect = buttonEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // A mix of S.T.A.L.K.E.R. PDA green, Ko-fi coral, and some golds/purples
  const colors = ['#10b981', '#34d399', '#a78bfa', '#ff5e5b', '#fbbf24', '#ffffff'];
  const particleCount = 45;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    document.body.appendChild(particle);

    // Randomize particle size and shape
    const size = Math.random() * 6 + 4;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.position = 'fixed';
    particle.style.left = `${centerX}px`;
    particle.style.top = `${centerY}px`;
    particle.style.borderRadius = Math.random() > 0.4 ? '50%' : '2px'; // Mix of circles and squares
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '10000'; // Make sure it stays over the modal

    // Physics calculations
    const angle = Math.random() * Math.PI * 2;
    // Push particles further outwards
    const velocity = 60 + Math.random() * 120; 
    const tx = Math.cos(angle) * velocity;
    // Slight upward anti-gravity bias for a "burst" effect
    const ty = Math.sin(angle) * velocity - 40; 
    const rot = Math.random() * 360;

    // Utilize Web Animations API for smooth, hardware-accelerated movement
    const animation = particle.animate([
      { 
        transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', 
        opacity: 1 
      },
      { 
        transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0) rotate(${rot}deg)`, 
        opacity: 0 
      }
    ], {
      duration: 700 + Math.random() * 500, // Random duration between 0.7s and 1.2s
      easing: 'cubic-bezier(0.25, 1, 0.3, 1)', // Nice deceleration curve
      fill: 'forwards'
    });

    // Cleanup the DOM node when the animation finishes to prevent memory leaks
    animation.onfinish = () => particle.remove();
  }
}
