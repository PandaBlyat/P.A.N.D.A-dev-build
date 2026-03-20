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
  'Edit preconditions',
  'Write a reply',
  'Link branches',
  'Validate',
  'Export XML',
];

export function shouldShowFirstRunExperience(): boolean {
  return !hasDraft();
}

export function renderFirstRunExperience(container: HTMLElement): void {
  const shell = document.createElement('section');
  shell.className = 'first-run-shell';

  const hero = document.createElement('div');
  hero.className = 'first-run-hero';

  const eyebrow = document.createElement('div');
  eyebrow.className = 'first-run-eyebrow';
  eyebrow.textContent = 'What this editor does';

  const title = document.createElement('h2');
  title.className = 'first-run-title';
  title.innerHTML = `DON’T <span>PANIC</span>`;

  const intro = document.createElement('p');
  intro.className = 'first-run-intro';
  intro.textContent = 'This improbably useful little console helps you map branching dialogue, wire preconditions, tune replies, validate the logic, and export ready-to-ship PANDA XML without fumbling through string tables by hand.';

  const subcopy = document.createElement('p');
  subcopy.className = 'first-run-subcopy';
  subcopy.textContent = 'Think of it as a hitchhiker’s guide to conversation packs: calm, illuminated, and only mildly radioactive.';

  const ctas = document.createElement('div');
  ctas.className = 'first-run-cta-row';

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

  const checklistWrap = document.createElement('div');
  checklistWrap.className = 'first-run-checklist';

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

  hero.append(eyebrow, title, intro, subcopy, ctas, checklistWrap);

  const orbit = document.createElement('div');
  orbit.className = 'first-run-orbit';
  orbit.setAttribute('aria-hidden', 'true');
  orbit.innerHTML = `
    <div class="first-run-orbit-ring ring-a"></div>
    <div class="first-run-orbit-ring ring-b"></div>
    <div class="first-run-orbit-ring ring-c"></div>
    <div class="first-run-orbit-core"></div>
    <div class="first-run-orbit-dust dust-a"></div>
    <div class="first-run-orbit-dust dust-b"></div>
  `;

  shell.append(hero, orbit);
  container.replaceChildren(shell);
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
