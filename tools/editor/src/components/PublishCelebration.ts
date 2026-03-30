import { createIcon } from './icons';

const CELEBRATION_CONTAINER_ID = 'publish-celebration-container';
const CELEBRATION_FADE_MS = 420;

type PublishCelebrationTier = 'small' | 'medium' | 'large';

export type PublishCelebrationOptions = {
  title: string;
  publishXp: number;
  bonusXp?: number;
  totalXp?: number;
  qualityStars: number;
  qualityMultiplier: number;
  branchCount: number;
  complexityLabel: string;
  isUpdate?: boolean;
};

let containerEl: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (containerEl && document.body.contains(containerEl)) return containerEl;

  containerEl = document.createElement('div');
  containerEl.id = CELEBRATION_CONTAINER_ID;
  containerEl.className = 'publish-celebration-container';
  document.body.appendChild(containerEl);
  return containerEl;
}

function formatMultiplier(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function resolveTier(options: PublishCelebrationOptions): PublishCelebrationTier {
  const totalXp = options.totalXp ?? options.publishXp + (options.bonusXp ?? 0);

  if (options.publishXp >= 140 || options.qualityMultiplier >= 2 || totalXp >= 180 || options.branchCount >= 8) {
    return 'large';
  }
  if (options.publishXp >= 90 || options.qualityMultiplier > 1 || totalXp >= 110 || options.branchCount >= 4) {
    return 'medium';
  }
  return 'small';
}

function getHeadline(options: PublishCelebrationOptions, tier: PublishCelebrationTier): string {
  if (options.isUpdate) {
    return tier === 'large' ? 'Signal Overhauled' : 'Signal Updated';
  }
  if (tier === 'large') return 'Zonewide Broadcast';
  if (tier === 'medium') return 'Signal Amplified';
  return 'Signal Published';
}

function getSubtitle(options: PublishCelebrationOptions): string {
  const storyLabel = options.title.trim() || 'Untitled';
  return `${storyLabel} went live with ${options.branchCount} branches, ${options.qualityStars}-star quality, and a ${options.complexityLabel.toLowerCase()} publish profile.`;
}

function getParticleCount(tier: PublishCelebrationTier): number {
  if (tier === 'large') return 22;
  if (tier === 'medium') return 16;
  return 10;
}

function buildParticle(index: number, total: number, tier: PublishCelebrationTier): HTMLElement {
  const particle = document.createElement('span');
  particle.className = 'publish-particle';

  const baseDistance = tier === 'large' ? 190 : tier === 'medium' ? 158 : 126;
  const angle = (360 / total) * index + (Math.random() * 14 - 7);
  const distance = baseDistance + Math.random() * (tier === 'large' ? 44 : 26);
  const delay = Math.floor(Math.random() * 110);
  const scale = (0.85 + Math.random() * 0.65).toFixed(2);

  particle.style.setProperty('--angle', `${angle}deg`);
  particle.style.setProperty('--distance', `${distance}px`);
  particle.style.setProperty('--delay', `${delay}ms`);
  particle.style.setProperty('--scale', scale);
  particle.style.setProperty('--stretch', `${18 + Math.random() * 16}px`);

  return particle;
}

export function showPublishCelebration(options: PublishCelebrationOptions): void {
  const container = getContainer();
  const tier = resolveTier(options);
  const totalXp = options.totalXp ?? options.publishXp + (options.bonusXp ?? 0);

  const celebration = document.createElement('div');
  celebration.className = `publish-celebration publish-celebration-${tier}`;
  celebration.setAttribute('aria-hidden', 'true');

  const ringOne = document.createElement('span');
  ringOne.className = 'publish-celebration-ring';
  const ringTwo = document.createElement('span');
  ringTwo.className = 'publish-celebration-ring publish-celebration-ring-secondary';
  celebration.append(ringOne, ringTwo);

  const particleCount = getParticleCount(tier);
  for (let index = 0; index < particleCount; index += 1) {
    celebration.appendChild(buildParticle(index, particleCount, tier));
  }

  const card = document.createElement('div');
  card.className = 'publish-celebration-card';

  const core = document.createElement('div');
  core.className = 'publish-celebration-core';

  const badge = document.createElement('div');
  badge.className = 'publish-celebration-badge';
  badge.appendChild(createIcon(tier === 'large' ? 'trophy' : 'sparkle'));

  const textWrap = document.createElement('div');
  textWrap.className = 'publish-celebration-text';

  const title = document.createElement('div');
  title.className = 'publish-celebration-title';
  title.textContent = getHeadline(options, tier);

  const subtitle = document.createElement('div');
  subtitle.className = 'publish-celebration-subtitle';
  subtitle.textContent = getSubtitle(options);

  const xpPill = document.createElement('div');
  xpPill.className = 'publish-celebration-xp';
  const xpValue = document.createElement('strong');
  xpValue.textContent = `+${totalXp.toLocaleString()} XP`;
  const xpLabel = document.createElement('span');
  xpLabel.textContent = options.bonusXp && options.bonusXp > 0 ? 'Publish + bonus payout' : 'Publish payout';
  xpPill.append(xpValue, xpLabel);

  const meta = document.createElement('div');
  meta.className = 'publish-celebration-meta';

  const qualityPill = document.createElement('span');
  qualityPill.className = 'publish-celebration-pill';
  qualityPill.textContent = `${options.qualityStars}-star quality x${formatMultiplier(options.qualityMultiplier)}`;

  const complexityPill = document.createElement('span');
  complexityPill.className = 'publish-celebration-pill';
  complexityPill.textContent = `${options.complexityLabel} publish`;

  meta.append(qualityPill, complexityPill);

  if (options.bonusXp && options.bonusXp > 0) {
    const bonusPill = document.createElement('span');
    bonusPill.className = 'publish-celebration-pill publish-celebration-pill-accent';
    bonusPill.textContent = `+${options.bonusXp.toLocaleString()} bonus XP`;
    meta.appendChild(bonusPill);
  }

  textWrap.append(title, subtitle, xpPill, meta);
  core.append(badge, textWrap);
  card.appendChild(core);
  celebration.appendChild(card);
  container.appendChild(celebration);

  requestAnimationFrame(() => celebration.classList.add('is-visible'));

  const visibleDuration = tier === 'large' ? 3000 : tier === 'medium' ? 2500 : 2200;
  setTimeout(() => {
    celebration.classList.remove('is-visible');
    celebration.classList.add('is-exit');
    setTimeout(() => celebration.remove(), CELEBRATION_FADE_MS);
  }, visibleDuration);
}
