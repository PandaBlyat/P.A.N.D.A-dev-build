// P.A.N.D.A. Conversation Editor — Creator Support Panel

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
};

let overlayEl: HTMLElement | null = null;
let focusTrap: FocusTrapController | null = null;
let restoreFocusEl: HTMLElement | null = null;

export function openSupportPanel(): void {
  if (overlayEl) return;

  restoreFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

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
    <div class="support-highlight support-highlight-upvote">
      <strong>You can also support by just leaving an upvote!</strong>
      <span>Morale support! If you enjoy the editor or a community conversation, tossing it an upvote is a fast way to show appreciation and help surface the good stuff.</span>
    </div>
  `;

  body.append(introCard, highlights);
  panel.append(header, body);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  overlayEl = overlay;
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
}
