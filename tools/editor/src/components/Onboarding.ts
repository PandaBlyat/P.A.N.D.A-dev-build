import { hasDraft } from '../lib/draft-storage';
import { createBlankProject, importFromXml, loadSampleProject } from '../lib/project-io';
import { createIcon, setButtonContent, type IconName } from './icons';

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


type FirstRunCta = {
  title: string;
  description: string;
  icon: IconName;
  tone: 'blank' | 'sample' | 'import';
  actionLabel: string;
  onClick: () => void;
};

const FIRST_RUN_CTAS: FirstRunCta[] = [
  {
    title: 'Start Blank Project',
    description: 'Spin up a clean dialogue workspace and start sketching encounters, branches, and logic from zero.',
    icon: 'add',
    tone: 'blank',
    actionLabel: 'Deploy Workspace',
    onClick: () => createBlankProject(),
  },
  {
    title: 'Sample Pack',
    description: 'Load a ready-made conversation set to inspect structure, pacing, and branching patterns in the editor.',
    icon: 'open',
    tone: 'sample',
    actionLabel: 'Open Sample Pack',
    onClick: () => loadSampleProject(),
  },
  {
    title: 'Import XML',
    description: 'Bring existing conversation files aboard and convert them into an editable mission board immediately.',
    icon: 'import',
    tone: 'import',
    actionLabel: 'Import Transmission',
    onClick: () => importFromXml(),
  },
];

/*
 * The intro is structured in narrative "phases", each containing lines
 * delivered in the typewriter, punctuated by dramatic pauses.
 */

type NarratorPhase = {
  lines: string[];
  holdAfter?: number;
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
      'This puts you in extremely exclusive company. Galactically speaking, you are indeed one of the good ones and my favorite (dont tell the others).',
      'So take a moment. Breathe... take your time and REMEMBER, above all else, the two most important words in the english language.......',
    ],
    holdAfter: 2000,
    shellClass: 'phase-invite',
  },
];

const PHASE_LABELS = ['Chapter I — Genesis', 'Chapter II — The Problem', 'Chapter III — The Solution', 'Chapter IV — You'];

export function shouldShowFirstRunExperience(): boolean {
  return !hasDraft();
}

export function renderFirstRunExperience(container: HTMLElement): void {
  const shell = document.createElement('section');
  shell.className = 'first-run-shell';

  const hero = document.createElement('div');
  hero.className = 'first-run-hero';

  const phaseIndicator = document.createElement('div');
  phaseIndicator.className = 'first-run-phase-indicator';
  for (let i = 0; i < NARRATOR_PHASES.length + 1; i++) {
    const dot = document.createElement('span');
    dot.className = 'phase-dot';
    if (i === 0) dot.classList.add('active');
    phaseIndicator.appendChild(dot);
  }

  const chapterLabel = document.createElement('div');
  chapterLabel.className = 'first-run-chapter-label';

  const narratorBox = document.createElement('div');
  narratorBox.className = 'first-run-narrator';
  const narratorCursor = document.createElement('span');
  narratorCursor.className = 'first-run-narrator-cursor';
  narratorCursor.textContent = '▌';

  const destination = document.createElement('div');
  destination.className = 'first-run-destination';

  const brandPanel = document.createElement('div');
  brandPanel.className = 'first-run-brand-panel hidden';

  const brandEmblem = document.createElement('div');
  brandEmblem.className = 'first-run-brand-emblem';
  brandEmblem.appendChild(createIcon('brand'));

  const brandCopy = document.createElement('div');
  brandCopy.className = 'first-run-brand-copy';

  const subtitle = document.createElement('p');
  subtitle.className = 'first-run-subtitle hidden';
  subtitle.textContent = 'The P.A.N.D.A. Conversation Editor';

  const title = document.createElement('h2');
  title.className = 'first-run-title hidden';
  title.innerHTML = `<span class="dont-word">DON'T</span> <span class="panic-word">PANIC</span>`;

  const tagline = document.createElement('p');
  tagline.className = 'first-run-tagline hidden';
  tagline.textContent = 'The most improbably useful dialogue editor this side of the Horsehead Nebula. *NOW WITH DATABASE SUPPORT!';

  brandCopy.append(subtitle, title, tagline);
  brandPanel.append(brandEmblem, brandCopy);

  const missionPanel = document.createElement('section');
  missionPanel.className = 'first-run-mission-panel hidden';

  const missionEyebrow = document.createElement('p');
  missionEyebrow.className = 'first-run-panel-eyebrow';
  missionEyebrow.textContent = 'Mission briefing';

  const intro = document.createElement('p');
  intro.className = 'first-run-intro hidden';
  intro.textContent = 'Map branching conversations. Wire preconditions. Tune replies. Validate logic. Export game-ready XML. All without fumbling through string tables by hand — which, as anyone who has tried it will tell you, is only marginally more fun than being hit over the head with a slice of lemon wrapped around a large gold brick.';

  const subcopy = document.createElement('p');
  subcopy.className = 'first-run-subcopy hidden';
  subcopy.textContent = "It won't make you a towel, but it will get you straight into a blank project once you are ready to start. Which is, on balance, preferable.";

  missionPanel.append(missionEyebrow, intro, subcopy);

  const ctas = document.createElement('div');
  ctas.className = 'first-run-cta-row hidden';

  const ctaLabel = document.createElement('p');
  ctaLabel.className = 'first-run-cta-label';
  ctaLabel.textContent = 'Choose your insertion point';

  const ctaDescription = document.createElement('p');
  ctaDescription.className = 'first-run-cta-description';
  ctaDescription.textContent = 'Ready to build? Start fresh, dissect an example, or uplink an existing XML payload.';

  ctas.append(ctaLabel, ctaDescription);
  FIRST_RUN_CTAS.forEach(card => {
    ctas.appendChild(createFirstRunCtaCard(card));
  });

  destination.append(brandPanel, missionPanel, ctas);

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'first-run-skip-btn';
  skipBtn.textContent = 'Skip intro →';

  const checklistWrap = document.createElement('div');
  checklistWrap.className = 'first-run-checklist hidden';

  const checklistBand = document.createElement('div');
  checklistBand.className = 'first-run-checklist-band';

  const checklistTitle = document.createElement('div');
  checklistTitle.className = 'first-run-checklist-title';
  checklistTitle.textContent = 'Zone uplink checklist';

  const checklistLead = document.createElement('p');
  checklistLead.className = 'first-run-checklist-lead';
  checklistLead.textContent = 'Everything you need to go from first contact to export-ready branching dialogue, laid out as a final systems pass.';

  checklistBand.append(checklistTitle, checklistLead);
  checklistWrap.appendChild(checklistBand);

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

  hero.append(phaseIndicator, chapterLabel, narratorBox, destination, checklistWrap, skipBtn);
  shell.appendChild(hero);
  container.replaceChildren(shell);

  let cancelled = false;

  function setPhaseIndicator(index: number): void {
    phaseIndicator.querySelectorAll('.phase-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i <= index);
      dot.classList.toggle('current', i === index);
    });
  }

  function revealContent(): void {
    narratorBox.classList.add('narrator-done');
    chapterLabel.classList.add('narrator-done');
    shell.classList.add('phase-finale');

    brandPanel.classList.remove('hidden');
    brandPanel.classList.add('reveal');
    title.classList.remove('hidden');
    title.classList.add('reveal');
    skipBtn.hidden = true;

    setPhaseIndicator(NARRATOR_PHASES.length);

    setTimeout(() => {
      if (cancelled) return;
      subtitle.classList.remove('hidden');
      subtitle.classList.add('reveal');
      tagline.classList.remove('hidden');
      tagline.classList.add('reveal');
    }, 250);

    setTimeout(() => {
      if (cancelled) return;
      missionPanel.classList.remove('hidden');
      missionPanel.classList.add('reveal');
      intro.classList.remove('hidden');
      intro.classList.add('reveal');
    }, 520);

    setTimeout(() => {
      if (cancelled) return;
      subcopy.classList.remove('hidden');
      subcopy.classList.add('reveal');
    }, 760);

    setTimeout(() => {
      if (cancelled) return;
      ctas.classList.remove('hidden');
      ctas.classList.add('reveal');
    }, 980);

    setTimeout(() => {
      if (cancelled) return;
      checklistWrap.classList.remove('hidden');
      checklistWrap.classList.add('reveal');
    }, 1180);
  }

  skipBtn.onclick = () => {
    cancelled = true;
    narratorBox.textContent = '';
    narratorBox.classList.add('narrator-done');
    chapterLabel.classList.add('narrator-done');
    NARRATOR_PHASES.forEach(phase => {
      if (phase.shellClass) shell.classList.remove(phase.shellClass);
    });
    // Reveal everything immediately without timeouts (revealContent uses
    // setTimeout callbacks gated by `cancelled`, so they'd all be skipped).
    shell.classList.add('phase-finale');
    setPhaseIndicator(NARRATOR_PHASES.length);
    skipBtn.hidden = true;
    for (const el of [brandPanel, title, subtitle, tagline, missionPanel, intro, subcopy, ctas, checklistWrap]) {
      el.classList.remove('hidden');
      el.classList.add('reveal');
    }
  };

  async function typewriterSequence(): Promise<void> {
    for (let phaseIdx = 0; phaseIdx < NARRATOR_PHASES.length; phaseIdx++) {
      const phase = NARRATOR_PHASES[phaseIdx];
      if (cancelled) return;

      if (phaseIdx > 0) {
        const prevPhase = NARRATOR_PHASES[phaseIdx - 1];
        if (prevPhase.shellClass) shell.classList.remove(prevPhase.shellClass);

        narratorBox.classList.add('narrator-fading');
        await delay(500);
        if (cancelled) return;

        narratorBox.querySelectorAll('.first-run-narrator-line').forEach(el => el.remove());
        narratorBox.classList.remove('narrator-fading');
      }

      if (phase.shellClass) shell.classList.add(phase.shellClass);
      setPhaseIndicator(phaseIdx);

      chapterLabel.textContent = PHASE_LABELS[phaseIdx] || '';
      chapterLabel.classList.add('visible');

      await delay(250);
      if (cancelled) return;

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

      if (phase.holdAfter) {
        await delay(phase.holdAfter);
      }

      chapterLabel.classList.remove('visible');
      await delay(300);
    }

    if (!cancelled) {
      revealContent();
    }
  }

  typewriterSequence();
}

function createFirstRunCtaCard(options: FirstRunCta): HTMLElement {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `first-run-cta-card first-run-cta-card-${options.tone}`;
  card.onclick = options.onClick;

  const iconWrap = document.createElement('span');
  iconWrap.className = 'first-run-cta-card-icon';
  iconWrap.appendChild(createIcon(options.icon));

  const content = document.createElement('span');
  content.className = 'first-run-cta-card-content';

  const title = document.createElement('span');
  title.className = 'first-run-cta-card-title';
  title.textContent = options.title;

  const description = document.createElement('span');
  description.className = 'first-run-cta-card-description';
  description.textContent = options.description;

  const action = document.createElement('span');
  action.className = 'first-run-cta-card-action';
  action.textContent = options.actionLabel;

  content.append(title, description, action);
  card.append(iconWrap, content);

  return card;
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
