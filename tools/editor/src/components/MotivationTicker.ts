const DEFAULT_TICKER_INTERVAL_MS = 60000;
const TICKER_SCROLL_SPEED_PX_PER_SECOND = 72;
const TICKER_MIN_DURATION_MS = 12000;


export const narratorMessages = [
  'A calm voice notes that progress is still progress, even when accompanied by mild confusion and suspicious amounts of coffee.',
  'The shipboard narrator would like to remind you that every tidy flow chart is just chaos wearing a name badge.',
  'Somewhere, improbability is doing its best work. You may as well continue editing while it is distracted.',
  'This is the sort of steady forward motion historians later describe as inevitable, mostly because they skip the awkward bits.',
  'The panel lights suggest confidence. This is not the same as confidence, but it photographs similarly.',
  'A reassuring voice from nowhere observes that the universe remains large, indifferent, and oddly supportive of good version control.',
  'The Encyclopedia Galactica defines the word hubris as attempting to construct a fifty-node dialogue matrix without pressing save. The Guide simply defines it as amusing.',
  'In many of the more relaxed civilizations of the Outer Eastern Rim, mapping out human conversation is considered a form of mild, socially acceptable torture.',
  'You are attempting to simulate a rational conversation. A bold choice, considering most biological lifeforms have not quite figured out how to do this in real life yet.',
  'Space is big. You just will not believe how vastly, hugely, mind-bogglingly big it is. Your current logic error, by comparison, is incredibly small, yet somehow infinitely more annoying.',
  'The structural complexity of your current project has just surpassed that of a Vogon tax return. Please proceed with extreme caution and a towel.',
  'Any sudden, inexplicable logic errors are likely the result of a localized improbability field, or possibly just a missing comma. The Universe makes no distinction.',
  'It is a curious fact that no matter how carefully you design a branching narrative, someone will inevitably try to click an option that simply says Window.',
  'You have successfully created an infinite dialogue loop. This is a perfectly symmetrical waste of time, widely celebrated in the poetry of the Betelgeuse system.',
  'The interface is designed to be entirely user-friendly. In this context, friendly merely means it will not actively try to bite you, which is a staggering improvement over earlier versions.',
  'Please remain calm. The large, friendly letters generally associated with this sort of thing are currently out for cleaning, but the sentiment remains firmly in place.',
  'A sophisticated algorithm has determined that you are about to have a brilliant creative breakthrough. The algorithm is currently drunk, but it means well.',
  'If you find yourself staring blankly at the screen, rest assured that this is a recognized meditative practice on Alpha Centauri, where it is known as Waiting for the Compiler.',
  'The Guide notes that arranging little colored boxes with lines between them is currently the seventh most popular way to avoid thinking about the inevitable heat death of the universe.',
  'The hyper-intelligent pan-dimensional beings who originally commissioned this software would like to apologize for the inconvenience.',
  'You are currently making choices. This is largely considered a bad move in the broader galactic scheme, but you seem to be enjoying it, so carry on.',
  'A gentle reminder from the shipboard computer that slamming your head against the keyboard generates a string of characters that is rarely compiled successfully.',
  'The Sirius Cybernetics Corporation defines a successful user experience as one that ends with only minor sobbing.',
  'Inserting a Babel fish into your audio port will not make your dialogue any better, but it will certainly confuse the fish.',
  'If your logic branches cross over each other three more times, you will legally summon a minor deity of bureaucracy.',
  'A supercomputer once spent seven and a half million years calculating the perfect dialogue response, only to output the word potato.',
  'Time is an illusion. Software release deadlines are doubly so.',
  'There is an art to creating dialogue trees. It consists of throwing your ideas at the screen and missing the ground entirely.',
  'The editor is currently synthesizing a fluid that is almost, but not quite, entirely unlike productivity.',
  'The official galactic assessment of your latest narrative update has been formally upgraded from Harmless to Mostly Harmless.',
  'It is highly recommended that you do not think too hard about how the variable flags resolve, lest your brain quietly migrate to your left ear.',
  'Remember to always know where your towel is, especially when attempting to debug a conditional logic gate.',
  'The answer to the ultimate question of life, the universe, and this specific dialogue branch is currently throwing a null pointer exception.',
  'In an infinite multiverse, there is theoretically a universe where this software works exactly as intended. We currently do not live in it.',
  'The pan-dimensional mice observing your progress are generally unimpressed with your use of boolean operators.',
  'Your latest conversation path is currently ranking just below Vogon poetry in terms of emotional damage caused to the reader.',
  'Pushing buttons and hoping something wonderful happens is the foundation of all modern galactic engineering.',
  'A nearby potted petunia was recently heard thinking, Oh no, not another infinite loop.',
  'The Guide considers saving your work every five minutes to be a sign of weak moral character, but suggests you do it anyway.',
  'At this exact moment, a small moon in the Pleiades system is collapsing. Your missing text string is entirely unrelated, but still unfortunate.',
  'Anyone who is capable of getting themselves made President should on no account be allowed to write branching dialogue.',
  'Please do not press that button again. The shipboard computer is getting a headache.',
  'You may notice a slight humming noise. This is the sound of the software pretending it knows exactly what you are doing.',
  'It is a well-known scientific fact that the exact moment you are perfectly satisfied with a dialogue tree is precisely three seconds before you realize you left out the main character.'
] as const;

let tickerRoot: HTMLElement | null = null;
let tickerViewport: HTMLDivElement | null = null;
let tickerTrack: HTMLDivElement | null = null;
let tickerResizeObserver: ResizeObserver | null = null;
let tickerAnimation: Animation | null = null;

// Starts on a random message instead of index 0
let currentMessageIndex = Math.floor(Math.random() * narratorMessages.length);
let renderedMessageIndex: number | null = null;
let rotationTimer: number | null = null;
let pendingAnimFrame: number | null = null;

/**
 * Mount the ticker into its container exactly once. Safe to call again with
 * the same container — it becomes a no-op if the element is already present.
 * The ticker manages its own rotation timer independently of the app render
 * cycle; the only external influence on it is the --accent CSS variable
 * (faction theme colour) inherited from a parent element.
 */
export function mountMotivationTicker(container: HTMLElement): void {
  const root = getTickerRoot();
  if (!container.contains(root)) {
    container.appendChild(root);
  }
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
  tickerViewport = viewport;
  tickerTrack = track;
  observeTickerLayout();
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
  renderedMessageIndex = currentMessageIndex;
  scheduleTickerAnimationRefresh();
}

function observeTickerLayout(): void {
  if (!tickerRoot || tickerResizeObserver) {
    return;
  }

  tickerResizeObserver = new ResizeObserver(() => {
    scheduleTickerAnimationRefresh();
  });

  tickerResizeObserver.observe(tickerRoot);
}

function scheduleTickerAnimationRefresh(): void {
  if (pendingAnimFrame != null) {
    cancelAnimationFrame(pendingAnimFrame);
  }

  pendingAnimFrame = requestAnimationFrame(() => {
    pendingAnimFrame = null;
    refreshTickerAnimation();
  });
}

function refreshTickerAnimation(): void {
  if (!tickerTrack || !tickerViewport) {
    return;
  }

  tickerAnimation?.cancel();
  tickerAnimation = null;

  const viewportWidth = tickerViewport.clientWidth;
  const trackWidth = tickerTrack.scrollWidth;

  if (viewportWidth <= 0 || trackWidth <= 0) {
    tickerTrack.classList.remove('is-animating');
    tickerTrack.style.removeProperty('--ticker-start-x');
    tickerTrack.style.removeProperty('--ticker-end-x');
    tickerTrack.style.removeProperty('--ticker-duration');
    return;
  }

  const startX = -trackWidth;
  const endX = viewportWidth;
  const durationMs = Math.max(
    TICKER_MIN_DURATION_MS,
    Math.round(((trackWidth + viewportWidth) / TICKER_SCROLL_SPEED_PX_PER_SECOND) * 1000)
  );

  tickerTrack.style.setProperty('--ticker-start-x', `${startX}px`);
  tickerTrack.style.setProperty('--ticker-end-x', `${endX}px`);
  tickerTrack.style.setProperty('--ticker-duration', `${durationMs}ms`);
  tickerTrack.classList.remove('is-animating');

  requestAnimationFrame(() => {
    if (!tickerTrack) {
      return;
    }

    tickerTrack.classList.add('is-animating');
    tickerAnimation = tickerTrack.getAnimations()[0] ?? null;
  });
}

function ensureTickerTimer(): void {
  if (rotationTimer != null || narratorMessages.length <= 1) {
    return;
  }

  rotationTimer = window.setInterval(() => {
    let randomIndex = Math.floor(Math.random() * narratorMessages.length);
    
    // Make sure we never show the exact same message twice in a row
    while (randomIndex === currentMessageIndex) {
      randomIndex = Math.floor(Math.random() * narratorMessages.length);
    }
    
    currentMessageIndex = randomIndex;
    updateTickerMessage();
  }, DEFAULT_TICKER_INTERVAL_MS);
}
