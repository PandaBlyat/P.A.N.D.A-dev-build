import { hasDraft } from '../lib/draft-storage';
import { createBlankProject, importFromXml, loadSampleProject } from '../lib/project-io';
import { createIcon, setButtonContent } from './icons';

type OnboardingCardOptions = {
  title: string;
  body: string;
  compact?: boolean;
};

const CHECKLIST_ITEMS = [
  'Create a conversation',
  'Wire preconditions',
  'Write replies & branches',
  'Link turns together',
  'Validate your logic',
  'Export game-ready XML',
];

const NARRATOR_LINES = [
  'In the beginning, the Zone was created.',
  'This has made a lot of people very angry and been widely regarded as a bad move.',
  'Fortunately, a developer known only as Panda — who is, by his own remarkably humble admission, the single greatest modder the Zone has ever produced — built you this editor.',
  'It is a curious fact that Panda named his mod after himself. This is not, as lesser minds might suggest, narcissism. It is simply that no other name in any language could adequately convey the system\'s majesty.',
  'The P.A.N.D.A. editor knows where your conversations are going even when you do not. Especially when you do not.',
  'So: relax, click a button below, and remember the two most important words in the English language…',
];

export function shouldShowFirstRunExperience(): boolean {
  return !hasDraft();
}

export function renderFirstRunExperience(container: HTMLElement): void {
  const shell = document.createElement('section');
  shell.className = 'first-run-shell';

  const hero = document.createElement('div');
  hero.className = 'first-run-hero';

  // ── Typewriter narrator ──────────────────────────────────────────────────
  const narratorBox = document.createElement('div');
  narratorBox.className = 'first-run-narrator';
  const narratorCursor = document.createElement('span');
  narratorCursor.className = 'first-run-narrator-cursor';
  narratorCursor.textContent = '▌';

  // ── DON'T PANIC title (hidden until narrator finishes) ───────────────────
  const title = document.createElement('h2');
  title.className = 'first-run-title hidden';
  title.innerHTML = `DON'T <span class="panic-word">PANIC</span>`;

  const subtitle = document.createElement('p');
  subtitle.className = 'first-run-subtitle hidden';
  subtitle.textContent = 'The P.A.N.D.A. Conversation Editor';

  const intro = document.createElement('p');
  intro.className = 'first-run-intro hidden';
  intro.textContent = 'This improbably useful console helps you map branching dialogue, wire preconditions, tune replies, validate the logic, and export ready-to-ship XML — all without fumbling through string tables by hand.';

  const subcopy = document.createElement('p');
  subcopy.className = 'first-run-subcopy hidden';
  subcopy.textContent = 'It won\'t make you a towel, but it will make your conversation packs considerably less likely to implode.';

  // ── CTA buttons ──────────────────────────────────────────────────────────
  const ctas = document.createElement('div');
  ctas.className = 'first-run-cta-row hidden';

  const blankBtn = document.createElement('button');
  blankBtn.className = 'btn btn-primary';
  setButtonContent(blankBtn, 'add', 'Create Blank Project');
  blankBtn.onclick = () => createBlankProject();

  const importBtn = document.createElement('button');
  importBtn.className = 'btn';
  setButtonContent(importBtn, 'import', 'Import XML');
  importBtn.onclick = () => importFromXml();

  const sampleBtn = document.createElement('button');
  sampleBtn.className = 'btn';
  setButtonContent(sampleBtn, 'open', 'Open Sample Pack');
  sampleBtn.onclick = () => loadSampleProject();

  ctas.append(blankBtn, importBtn, sampleBtn);

  // ── Skip button ──────────────────────────────────────────────────────────
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'first-run-skip-btn';
  skipBtn.textContent = 'Skip intro →';

  // ── Checklist ────────────────────────────────────────────────────────────
  const checklistWrap = document.createElement('div');
  checklistWrap.className = 'first-run-checklist hidden';

  const checklistTitle = document.createElement('div');
  checklistTitle.className = 'first-run-checklist-title';
  checklistTitle.textContent = 'Core flight checklist';
  checklistWrap.appendChild(checklistTitle);

  const checklist = document.createElement('ul');
  checklist.className = 'first-run-checklist-list';
  CHECKLIST_ITEMS.forEach((item, index) => {
    const entry = document.createElement('li');
    entry.style.setProperty('--check-index', String(index));
    const icon = document.createElement('span');
    icon.className = 'first-run-check-icon';
    icon.appendChild(createIcon('success'));
    const label = document.createElement('span');
    label.textContent = item;
    entry.append(icon, label);
    checklist.appendChild(entry);
  });
  checklistWrap.appendChild(checklist);

  hero.append(narratorBox, title, subtitle, intro, subcopy, ctas, checklistWrap, skipBtn);

  // ── Orbit visualisation ──────────────────────────────────────────────────
  const orbit = document.createElement('div');
  orbit.className = 'first-run-orbit';
  orbit.setAttribute('aria-hidden', 'true');
  orbit.innerHTML = `
    <div class="first-run-orbit-ring ring-a"></div>
    <div class="first-run-orbit-ring ring-b"></div>
    <div class="first-run-orbit-ring ring-c"></div>
    <div class="first-run-orbit-core"></div>
    <div class="first-run-orbit-core-label">42</div>
    <div class="first-run-orbit-dust dust-a"></div>
    <div class="first-run-orbit-dust dust-b"></div>
    <div class="first-run-orbit-dust dust-c"></div>
    <div class="first-run-orbit-sigil">P.A.N.D.A.</div>
  `;

  shell.append(hero, orbit);
  container.replaceChildren(shell);

  // ── Typewriter animation ─────────────────────────────────────────────────
  let cancelled = false;

  function revealContent(): void {
    narratorBox.classList.add('narrator-done');
    title.classList.remove('hidden');
    title.classList.add('reveal');
    subtitle.classList.remove('hidden');
    subtitle.classList.add('reveal');
    skipBtn.hidden = true;

    setTimeout(() => {
      if (cancelled) return;
      intro.classList.remove('hidden');
      intro.classList.add('reveal');
      subcopy.classList.remove('hidden');
      subcopy.classList.add('reveal');
    }, 400);

    setTimeout(() => {
      if (cancelled) return;
      ctas.classList.remove('hidden');
      ctas.classList.add('reveal');
      checklistWrap.classList.remove('hidden');
      checklistWrap.classList.add('reveal');
    }, 800);
  }

  skipBtn.onclick = () => {
    cancelled = true;
    narratorBox.textContent = '';
    narratorBox.classList.add('narrator-done');
    revealContent();
  };

  async function typewriterSequence(): Promise<void> {
    for (const line of NARRATOR_LINES) {
      if (cancelled) return;

      const lineEl = document.createElement('p');
      lineEl.className = 'first-run-narrator-line';
      narratorBox.appendChild(lineEl);
      narratorBox.appendChild(narratorCursor);

      for (let i = 0; i < line.length; i++) {
        if (cancelled) return;
        lineEl.textContent = line.slice(0, i + 1);
        await delay(22 + Math.random() * 18);
      }

      narratorCursor.remove();
      await delay(900);
    }

    if (!cancelled) {
      revealContent();
    }
  }

  typewriterSequence();
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createOnboardingNudge(options: OnboardingCardOptions): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `onboarding-nudge${options.compact ? ' compact' : ''}`;

  const title = document.createElement('div');
  title.className = 'onboarding-nudge-title';
  title.textContent = options.title;

  const body = document.createElement('div');
  body.className = 'onboarding-nudge-body';
  body.textContent = options.body;

  const actions = document.createElement('div');
  actions.className = 'onboarding-nudge-actions';

  const blankBtn = document.createElement('button');
  blankBtn.className = 'btn btn-sm btn-primary';
  setButtonContent(blankBtn, 'add', 'Blank Project');
  blankBtn.onclick = () => createBlankProject();

  const sampleBtn = document.createElement('button');
  sampleBtn.className = 'btn btn-sm';
  setButtonContent(sampleBtn, 'open', 'Sample Pack');
  sampleBtn.onclick = () => loadSampleProject();

  const importBtn = document.createElement('button');
  importBtn.className = 'btn btn-sm';
  setButtonContent(importBtn, 'import', 'Import XML');
  importBtn.onclick = () => importFromXml();

  actions.append(blankBtn, sampleBtn, importBtn);
  wrapper.append(title, body, actions);

  return wrapper;
}
