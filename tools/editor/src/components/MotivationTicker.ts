const DEFAULT_TICKER_INTERVAL_MS = 12000;

export const narratorMessages = [
  'A calm voice notes that progress is still progress, even when accompanied by mild confusion and suspicious amounts of coffee.',
  'The shipboard narrator would like to remind you that every tidy flow chart is just chaos wearing a name badge.',
  'Somewhere, improbability is doing its best work. You may as well continue editing while it is distracted.',
  'This is the sort of steady forward motion historians later describe as inevitable, mostly because they skip the awkward bits.',
  'The panel lights suggest confidence. This is not the same as confidence, but it photographs similarly.',
  'A reassuring voice from nowhere observes that the universe remains large, indifferent, and oddly supportive of good version control.',
] as const;

let tickerRoot: HTMLElement | null = null;
let tickerTrack: HTMLDivElement | null = null;
let currentMessageIndex = 0;
let renderedMessageIndex: number | null = null;
let rotationTimer: number | null = null;

export function renderMotivationTicker(container: HTMLElement): void {
  const root = getTickerRoot();
  container.appendChild(root);
  ensureTickerTimer();
}

function getTickerRoot(): HTMLElement {
  if (tickerRoot) {
    return tickerRoot;
  }

  const root = document.createElement('section');
  root.className = 'motivation-ticker';
  root.setAttribute('aria-label', 'Narrator ticker');

  const label = document.createElement('span');
  label.className = 'motivation-ticker-label';
  label.textContent = 'Narrator';

  const viewport = document.createElement('div');
  viewport.className = 'motivation-ticker-viewport';
  viewport.setAttribute('aria-live', 'polite');
  viewport.setAttribute('aria-atomic', 'true');

  const track = document.createElement('div');
  track.className = 'motivation-ticker-track';
  viewport.appendChild(track);

  root.append(label, viewport);

  tickerRoot = root;
  tickerTrack = track;
  updateTickerMessage();
  return root;
}

function updateTickerMessage(): void {
  if (!tickerTrack) {
    return;
  }

  if (renderedMessageIndex === currentMessageIndex) {
    return;
  }

  tickerTrack.textContent = narratorMessages[currentMessageIndex];
  tickerTrack.classList.remove('is-animating');
  void tickerTrack.offsetWidth;
  tickerTrack.classList.add('is-animating');
  renderedMessageIndex = currentMessageIndex;
}

function ensureTickerTimer(): void {
  if (rotationTimer != null || narratorMessages.length <= 1) {
    return;
  }

  rotationTimer = window.setInterval(() => {
    currentMessageIndex = (currentMessageIndex + 1) % narratorMessages.length;
    updateTickerMessage();
  }, DEFAULT_TICKER_INTERVAL_MS);
}
