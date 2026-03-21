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

/*
 * The intro is structured in narrative "phases", each containing lines
 * delivered in the typewriter, punctuated by dramatic pauses.
 *
 * Phase 1 – The Opening  (cosmic hook, sets the tone)
 * Phase 2 – The Problem   (why the Zone needs this)
 * Phase 3 – The Solution  (enter P.A.N.D.A.)
 * Phase 4 – The Invite    (you, specifically, are brilliant)
 * Phase 5 – The Payoff    (DON'T PANIC reveal)
 */

type NarratorPhase = {
  lines: string[];
  /** ms to hold after the last line before moving on */
  holdAfter?: number;
  /** optional CSS class toggled on the shell during this phase */
  shellClass?: string;
};

const NARRATOR_PHASES: NarratorPhase[] = [
  {
    lines: [
      'It is an important and popular fact that things are not always what they seem.',
      'For instance, on the planet Earth, a video game called S.T.A.L.K.E.R. Anomaly was long considered merely a game, when in fact, it was something more altogether.',
      'And for the longest time NPC-Player dialogues have been mostly task driven, or just general flavour dialogues.',
    ],
    holdAfter: 1200,
    shellClass: 'phase-opening',
  },
  {
    lines: [
      'This was, by any reasonable standard, a catastrophe.',
      'An entire A-life system at our dysposal for new non-combat gameplay opportunities wasted. Entire factions with the conversational range of a damp teabag.',
      'Modders tried to fix this, naturally. By diving into XML string tables by hand and keeping track of multiple files at once.',
      'Most went quietly mad. Some were never heard from again.',
    ],
    holdAfter: 1400,
    shellClass: 'phase-problem',
  },
  {
    lines: [
      'Well..no more! Panda is here.',
      'PANDA mod takes advantage of A-life systems into a framework we can use for full branching conversations. And this editor makes the process far easier. (hopefully)',
    ],
    holdAfter: 1200,
    shellClass: 'phase-solution',
  },
  {
    lines: [
      'Now. If you are reading this, it means you are precisely the sort of wonderfully improbable person who wants to make the Zone a more talkative/immersive place.',
      'This puts you in extremely exclusive company. Galactically speaking, you are indeed a GOAT.',
      'So take a moment. Breathe, take your time and remember, above all else, the two most important words in any language, on any planet, in any dimension.......',
    ],
    holdAfter: 2000,
    shellClass: 'phase-invite',
  },
];

export function shouldShowFirstRunExperience(): boolean {
  return !hasDraft();
}

export function renderFirstRunExperience(container: HTMLElement): void {
  const shell = document.createElement('section');
  shell.className = 'first-run-shell';

  const hero = document.createElement('div');
  hero.className = 'first-run-hero';

  // ── Phase indicator (subtle dots showing progress) ─────────────────────
  const phaseIndicator = document.createElement('div');
  phaseIndicator.className = 'first-run-phase-indicator';
  for (let i = 0; i < NARRATOR_PHASES.length + 1; i++) {
    const dot = document.createElement('span');
    dot.className = 'phase-dot';
    if (i === 0) dot.classList.add('active');
    phaseIndicator.appendChild(dot);
  }

  // ── Typewriter narrator ──────────────────────────────────────────────────
  const narratorBox = document.createElement('div');
  narratorBox.className = 'first-run-narrator';
  const narratorCursor = document.createElement('span');
  narratorCursor.className = 'first-run-narrator-cursor';
  narratorCursor.textContent = '▌';

  // ── Chapter label (shows phase name during narration) ──────────────────
  const chapterLabel = document.createElement('div');
  chapterLabel.className = 'first-run-chapter-label';

  // ── DON'T PANIC title (hidden until narrator finishes) ───────────────────
  const title = document.createElement('h2');
  title.className = 'first-run-title hidden';
  title.innerHTML = `<span class="dont-word">DON'T</span> <span class="panic-word">PANIC</span>`;

  const subtitle = document.createElement('p');
  subtitle.className = 'first-run-subtitle hidden';
  subtitle.textContent = 'The P.A.N.D.A. Conversation Editor';

  const tagline = document.createElement('p');
  tagline.className = 'first-run-tagline hidden';
  tagline.textContent = 'The most improbably useful dialogue editor this side of the Horsehead Nebula. *NOW WITH DATABASE SUPPORT!';

  const intro = document.createElement('p');
  intro.className = 'first-run-intro hidden';
  intro.textContent = 'Map branching conversations. Wire preconditions. Tune replies. Validate logic. Export game-ready XML. All without fumbling through string tables by hand — which, as anyone who has tried it will tell you, is only marginally more fun than being hit over the head with a slice of lemon wrapped around a large gold brick.';

  const subcopy = document.createElement('p');
  subcopy.className = 'first-run-subcopy hidden';
  subcopy.textContent = 'It won\'t make you a towel, but it will make your conversation packs considerably less likely to implode. Which is, on balance, preferable.';

  // ── CTA buttons ──────────────────────────────────────────────────────────
  const ctas = document.createElement('div');
  ctas.className = 'first-run-cta-row hidden';

  const ctaLabel = document.createElement('p');
  ctaLabel.className = 'first-run-cta-label';
  ctaLabel.textContent = 'So — where shall we begin?';

  const blankBtn = document.createElement('button');
  blankBtn.className = 'btn btn-primary';
  setButtonContent(blankBtn, 'add', 'Blank Project');
  blankBtn.onclick = () => createBlankProject();

  const sampleBtn = document.createElement('button');
  sampleBtn.className = 'btn';
  setButtonContent(sampleBtn, 'open', 'Sample Pack');
  sampleBtn.onclick = () => loadSampleProject();

  const importBtn = document.createElement('button');
  importBtn.className = 'btn';
  setButtonContent(importBtn, 'import', 'Import XML');
  importBtn.onclick = () => importFromXml();

  ctas.append(ctaLabel, blankBtn, sampleBtn, importBtn);

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

  hero.append(phaseIndicator, chapterLabel, narratorBox, title, subtitle, tagline, intro, subcopy, ctas, checklistWrap, skipBtn);

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
    <div class="first-run-orbit-quote"></div>
  `;

  shell.append(hero, orbit);
  container.replaceChildren(shell);

  // ── Typewriter animation ─────────────────────────────────────────────────
  let cancelled = false;

  const PHASE_LABELS = ['Chapter I — Genesis', 'Chapter II — The Problem', 'Chapter III — The Solution', 'Chapter IV — You'];
  const ORBIT_QUOTES = [
    'Space is big.',
    'Really big.',
    '"Time is an illusion.\nLunchtime doubly so."',
    '',
  ];

  function setPhaseIndicator(index: number): void {
    phaseIndicator.querySelectorAll('.phase-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i <= index);
      dot.classList.toggle('current', i === index);
    });
  }

  function setOrbitQuote(text: string): void {
    const quoteEl = orbit.querySelector('.first-run-orbit-quote');
    if (quoteEl) {
      quoteEl.classList.remove('visible');
      if (text) {
        setTimeout(() => {
          quoteEl.textContent = text;
          quoteEl.classList.add('visible');
        }, 300);
      }
    }
  }

  function revealContent(): void {
    narratorBox.classList.add('narrator-done');
    chapterLabel.classList.add('narrator-done');
    shell.classList.add('phase-finale');

    // Dramatic staggered reveal
    title.classList.remove('hidden');
    title.classList.add('reveal');
    skipBtn.hidden = true;

    setPhaseIndicator(NARRATOR_PHASES.length);
    setOrbitQuote('');

    setTimeout(() => {
      if (cancelled) return;
      subtitle.classList.remove('hidden');
      subtitle.classList.add('reveal');
      tagline.classList.remove('hidden');
      tagline.classList.add('reveal');
    }, 600);

    setTimeout(() => {
      if (cancelled) return;
      intro.classList.remove('hidden');
      intro.classList.add('reveal');
    }, 1000);

    setTimeout(() => {
      if (cancelled) return;
      subcopy.classList.remove('hidden');
      subcopy.classList.add('reveal');
    }, 1300);

    setTimeout(() => {
      if (cancelled) return;
      ctas.classList.remove('hidden');
      ctas.classList.add('reveal');
      checklistWrap.classList.remove('hidden');
      checklistWrap.classList.add('reveal');
    }, 1600);
  }

  skipBtn.onclick = () => {
    cancelled = true;
    narratorBox.textContent = '';
    narratorBox.classList.add('narrator-done');
    chapterLabel.classList.add('narrator-done');
    // Clear any phase classes
    NARRATOR_PHASES.forEach(p => {
      if (p.shellClass) shell.classList.remove(p.shellClass);
    });
    revealContent();
  };

  async function typewriterSequence(): Promise<void> {
    for (let phaseIdx = 0; phaseIdx < NARRATOR_PHASES.length; phaseIdx++) {
      const phase = NARRATOR_PHASES[phaseIdx];
      if (cancelled) return;

      // Phase transition: clear previous, set new phase
      if (phaseIdx > 0) {
        const prevPhase = NARRATOR_PHASES[phaseIdx - 1];
        if (prevPhase.shellClass) shell.classList.remove(prevPhase.shellClass);

        // Fade out old lines
        narratorBox.classList.add('narrator-fading');
        await delay(500);
        if (cancelled) return;

        // Clear old lines
        narratorBox.querySelectorAll('.first-run-narrator-line').forEach(el => el.remove());
        narratorBox.classList.remove('narrator-fading');
      }

      // Activate new phase
      if (phase.shellClass) shell.classList.add(phase.shellClass);
      setPhaseIndicator(phaseIdx);

      // Show chapter label
      chapterLabel.textContent = PHASE_LABELS[phaseIdx] || '';
      chapterLabel.classList.add('visible');

      // Show orbit quote for this phase
      setOrbitQuote(ORBIT_QUOTES[phaseIdx] || '');

      await delay(400);
      if (cancelled) return;

      // Type each line in this phase
      for (const line of phase.lines) {
        if (cancelled) return;

        const lineEl = document.createElement('p');
        lineEl.className = 'first-run-narrator-line';
        narratorBox.appendChild(lineEl);
        narratorBox.appendChild(narratorCursor);

        for (let i = 0; i < line.length; i++) {
          if (cancelled) return;
          lineEl.textContent = line.slice(0, i + 1);
          await delay(18 + Math.random() * 16);
        }

        narratorCursor.remove();
        await delay(800);
      }

      // Hold after phase
      if (phase.holdAfter) {
        await delay(phase.holdAfter);
      }

      // Fade out chapter label between phases
      chapterLabel.classList.remove('visible');
      await delay(300);
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
