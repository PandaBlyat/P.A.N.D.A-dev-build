const TICKER_SCROLL_SPEED_PX_PER_SECOND = 122;
const TICKER_RESTART_GAP_PX = 48;

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
  'It is a well-known scientific fact that the exact moment you are perfectly satisfied with a dialogue tree is precisely three seconds before you realize you left out the main character.',
  'A passing comet briefly considered your workflow and decided it was none of its business, which is more restraint than most developers manage.',
  'The shipboard systems confirm that what you are doing is technically progress, in the same way that drifting sideways counts as navigation.',
  'Somewhere in the Andromeda galaxy, a committee has spent centuries achieving less than you have in the last hour. They are considered highly successful.',
  'The universe would like to clarify that your current confusion is not a bug, but a deeply entrenched feature of existence.',
  'A faint chime indicates that something has been successfully compiled. No one is entirely sure what.',
  'There are entire civilizations built on less stable logical foundations than your current dialogue tree. They tend not to last long.',
  'The probability of this working first try was calculated at approximately one in several million. Congratulations on contributing to statistical consistency.',
  'A small, polite alarm reminds you that naming variables after how you feel is rarely considered best practice, though it is emotionally honest.',
  'Somewhere, a version of you has already fixed this issue. Unfortunately, that version refused to document anything.',
  'The interface continues to respond with quiet optimism, which is impressive given what it has seen.',
  'A distant star flickers in what can only be described as mild disapproval of your indentation.',
  'The system gently encourages you to keep going, largely because stopping now would make all of this even harder to justify.',
  'It has been noted that your current approach resembles a plan. This is considered encouraging.',
  'In the grand scheme of things, your latest error is insignificant. In the immediate scheme of things, it is extremely irritating.',
  'The Guide would like to point out that most great achievements begin as a series of increasingly confident guesses.',
  'A quiet voice observes that deleting everything and starting again is always an option, though rarely the correct one.',
  'The structural integrity of your logic is holding, which places it comfortably above average for the known universe.',
  'Somewhere, a machine designed to solve all problems has encountered your code and decided to take a short break instead.',
  'Your current level of focus has been upgraded to “suspiciously competent,” a state known to last approximately twelve minutes.',
  'The software notes that everything is behaving exactly as expected, which is to say, unpredictably.',
  'A passing satellite briefly picked up your signal and classified it as art.',
  'The Guide reassures you that confusion is merely understanding waiting for better documentation.',
  'There is a growing sense that you might actually know what you are doing. This feeling will pass.',
  'A minor fluctuation in reality suggests that your latest fix may have worked. Further observation is recommended before celebrating.',
  'The system logs indicate steady progress, interspersed with moments of existential reconsideration.',
  'Somewhere in deep space, an ancient archive has recorded your current efforts under “ambitious.”',
  'The panel displays remain calm, which is statistically unlikely given your recent decisions.',
  'A soft tone indicates that something important has happened. Identifying what it was is left as an exercise.',
  'Your workflow has achieved a delicate balance between structure and improvisation, much like most successful accidents.',
  'The Guide notes that perseverance is often indistinguishable from stubbornness until it works.',
  'A nearby process has quietly given up, though it is trying not to make a scene about it.',
  'The system would like to remind you that complexity is just simplicity that has had too much time to think.',
  'There is a strong possibility that this will all make sense later. This possibility remains unverified.',
  'A distant echo suggests that someone, somewhere, has solved this problem before. They are not available for comment.',
  'Your current trajectory is technically forward, which is more than can be said for most debugging sessions.',
  'The Guide considers your current effort to be a bold experiment in applied persistence.',
  'A brief moment of clarity has been detected. Please enjoy it before it becomes context-dependent.',
  'The system is pleased to report that nothing has catastrophically failed in the last few minutes. We shall see what happens within next few.',
  'Somewhere, a highly advanced intelligence has reviewed your approach and described it as “Meh.”',
  'The interface continues to cooperate, largely out of curiosity about what you will try next.',
  'A quiet notification reminds you that progress is often just failure that has been reorganized more convincingly.',
  'The Guide observes that every complex system eventually becomes a story you tell yourself to stay calm.',
  'A low hum suggests that the software is working very hard to keep everything looking intentional.',
  'Your latest change has altered reality in subtle ways, none of which are immediately helpful.',
  'The system has detected confidence. Verification is pending.',
  'A small indicator light flickers with what might be encouragement, or possibly a loose connection.',
  'Somewhere, a parallel version of this project is going much worse. This is considered reassuring.',
  'The Guide gently notes that understanding will arrive shortly after you stop needing it.',
  'A routine check confirms that everything is still technically under control, though definitions may vary.',
  'The text input boxes would like to thank you for your continued input. (i dont get it)'
] as const;

let tickerRoot: HTMLElement | null = null;
let tickerViewport: HTMLDivElement | null = null;
let tickerTrack: HTMLDivElement | null = null;
let tickerCopy: HTMLSpanElement | null = null;
let tickerReducedMotionMediaQuery: MediaQueryList | null = null;
let tickerAnimationFrame: number | null = null;
let lastAnimationTimestamp: number | null = null;
let tickerOffsetPx = 0;
let tickerMessageWidthPx = 0;

let currentMessageIndex = Math.floor(Math.random() * narratorMessages.length);
let renderedMessageIndex: number | null = null;

/**
 * Mount the ticker into its container exactly once. Safe to call again with
 * the same container — it becomes a no-op if the element is already present.
 * The ticker manages its own animation lifecycle independently of the app
 * render cycle; the only external influence on it is the --accent CSS variable
 * (faction theme colour) inherited from a parent element.
 */
export function mountMotivationTicker(container: HTMLElement): void {
  const root = getTickerRoot();
  if (!container.contains(root)) {
    container.appendChild(root);
  }
  ensureTickerAnimation();
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

  const copy = document.createElement('span');
  copy.className = 'motivation-ticker-copy';

  track.appendChild(copy);
  viewport.appendChild(track);
  root.append(viewport, label);

  tickerRoot = root;
  tickerViewport = viewport;
  tickerTrack = track;
  tickerCopy = copy;
  observeReducedMotionPreference();
  return root;
}

function updateTickerMessage(messageIndex = currentMessageIndex): void {
  applyTickerMessage(messageIndex);
  resetTickerPosition();
  startTickerAnimation();
}

function observeReducedMotionPreference(): void {
  if (tickerReducedMotionMediaQuery || typeof window.matchMedia !== 'function') {
    return;
  }

  tickerReducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  tickerReducedMotionMediaQuery.addEventListener('change', handleReducedMotionChange);
}

function handleReducedMotionChange(): void {
  resetTickerPosition();
  startTickerAnimation();
}

function applyTickerMessage(messageIndex: number): void {
  if (!tickerCopy) {
    return;
  }

  tickerCopy.textContent = narratorMessages[messageIndex];
  renderedMessageIndex = messageIndex;
  currentMessageIndex = messageIndex;
}

function resetTickerPosition(): void {
  if (!tickerTrack || !tickerViewport || !tickerCopy) {
    return;
  }

  tickerMessageWidthPx = tickerCopy.getBoundingClientRect().width;
  tickerOffsetPx = prefersReducedMotion() ? 0 : tickerViewport.clientWidth;
  tickerTrack.style.transform = `translate3d(${tickerOffsetPx}px, 0, 0)`;
}

function startTickerAnimation(): void {
  stopTickerAnimation();

  if (!tickerTrack || prefersReducedMotion()) {
    if (tickerTrack) {
      tickerTrack.style.transform = 'translate3d(0, 0, 0)';
    }
    return;
  }

  if (tickerMessageWidthPx <= 0) {
    resetTickerPosition();
  }

  if (tickerMessageWidthPx <= 0) {
    return;
  }

  const tick = (timestamp: number): void => {
    if (!tickerTrack) {
      tickerAnimationFrame = null;
      return;
    }

    if (lastAnimationTimestamp == null) {
      lastAnimationTimestamp = timestamp;
    }

    const elapsedMs = timestamp - lastAnimationTimestamp;
    lastAnimationTimestamp = timestamp;
    tickerOffsetPx -= (TICKER_SCROLL_SPEED_PX_PER_SECOND * elapsedMs) / 1000;

    if (tickerOffsetPx + tickerMessageWidthPx <= -TICKER_RESTART_GAP_PX) {
      const nextMessageIndex = getNextRandomMessageIndex();
      applyTickerMessage(nextMessageIndex);
      resetTickerPosition();
      lastAnimationTimestamp = timestamp;
    } else {
      tickerTrack.style.transform = `translate3d(${tickerOffsetPx}px, 0, 0)`;
    }

    tickerAnimationFrame = window.requestAnimationFrame(tick);
  };

  tickerAnimationFrame = window.requestAnimationFrame(tick);
}

function stopTickerAnimation(): void {
  if (tickerAnimationFrame != null) {
    window.cancelAnimationFrame(tickerAnimationFrame);
    tickerAnimationFrame = null;
  }
  lastAnimationTimestamp = null;
}

function prefersReducedMotion(): boolean {
  return tickerReducedMotionMediaQuery?.matches ?? false;
}

function ensureTickerAnimation(): void {
  if (renderedMessageIndex == null) {
    updateTickerMessage(currentMessageIndex);
    return;
  }

  if (tickerAnimationFrame == null) {
    startTickerAnimation();
  }
}

function getNextRandomMessageIndex(): number {
  if (narratorMessages.length <= 1) {
    return currentMessageIndex;
  }

  let randomIndex = Math.floor(Math.random() * narratorMessages.length);
  while (randomIndex === currentMessageIndex) {
    randomIndex = Math.floor(Math.random() * narratorMessages.length);
  }

  return randomIndex;
}
