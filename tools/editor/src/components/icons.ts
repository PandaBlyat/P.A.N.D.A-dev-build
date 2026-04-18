const SVG_NS = 'http://www.w3.org/2000/svg';

type IconDef = {
  viewBox?: string;
  paths: Array<Record<string, string>>;
};

export type IconName =
  | 'brand'
  | 'open'
  | 'import'
  | 'save'
  | 'export'
  | 'xml'
  | 'strings'
  | 'undo'
  | 'redo'
  | 'locate'
  | 'duplicate'
  | 'delete'
  | 'success'
  | 'check'
  | 'warning'
  | 'error'
  | 'close'
  | 'add'
  | 'share'
  | 'download'
  | 'database'
  | 'help'
  | 'support'
  | 'eye'
  | 'play'
  | 'restart'
  | 'clock'
  | 'user'
  | 'star'
  | 'trophy'
  | 'flame'
  | 'shield'
  | 'target'
  | 'medal'
  | 'bug'
  | 'sparkle'
  | 'map'
  | 'upvote';

const BASE_ICON_ATTRS = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'stroke-width': '2.2',
};

const ICONS: Record<IconName, IconDef> = {
  brand: {
    paths: [
      // Face (larger circle)
      { tag: 'circle', cx: '12', cy: '12', r: '11', stroke: 'currentColor', 'stroke-width': '2' },
      // Left ear (larger, positioned outward)
      { tag: 'circle', cx: '5.5', cy: '4.5', r: '3.5', fill: 'currentColor', stroke: 'none' },
      // Right ear
      { tag: 'circle', cx: '18.5', cy: '4.5', r: '3.5', fill: 'currentColor', stroke: 'none' },
      // Left eye patch
      { tag: 'ellipse', cx: '8', cy: '11', rx: '2.5', ry: '3.2', fill: 'currentColor', stroke: 'none', transform: 'rotate(-15 8 11)' },
      // Right eye patch
      { tag: 'ellipse', cx: '16', cy: '11', rx: '2.5', ry: '3.2', fill: 'currentColor', stroke: 'none', transform: 'rotate(15 16 11)' },
      // Left eye highlight
      { tag: 'circle', cx: '8.6', cy: '10.3', r: '0.9', fill: 'white', stroke: 'none' },
      // Right eye highlight
      { tag: 'circle', cx: '15.4', cy: '10.3', r: '0.9', fill: 'white', stroke: 'none' },
      // Nose
      { tag: 'ellipse', cx: '12', cy: '14.5', rx: '1.8', ry: '1.2', fill: 'currentColor', stroke: 'none' },
      // Mouth
      { tag: 'path', d: 'M9.5 16.8 Q12 19, 14.5 16.8', stroke: 'currentColor', 'stroke-width': '1.8', fill: 'none' },
    ],
  },
  open: {
    paths: [
      { tag: 'path', d: 'M2 7.5h6.5l2.5 2.5h9.5v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z' },
      { tag: 'path', d: 'M2 7.5V6a2 2 0 0 1 2-2h6l2.5 2.5H19a2 2 0 0 1 2 2v1' },
    ],
  },
  import: {
    paths: [
      { tag: 'path', d: 'M12 2v13' },
      { tag: 'path', d: 'm7 7 5-5 5 5' },
      { tag: 'path', d: 'M4 16.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' },
    ],
  },
  save: {
    paths: [
      { tag: 'path', d: 'M4 3h13l3.5 3.5V21H4z' },
      { tag: 'path', d: 'M7 3v6.5h10' },
      { tag: 'path', d: 'M7 20v-7.5h10V20' },
    ],
  },
  export: {
    paths: [
      { tag: 'path', d: 'M12 16V3' },
      { tag: 'path', d: 'm7 11 5 5 5-5' },
      { tag: 'path', d: 'M4 17v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' },
    ],
  },
  xml: {
    paths: [
      { tag: 'path', d: 'm7.5 6.5-5.5 5.5 5.5 5.5' },
      { tag: 'path', d: 'm16.5 6.5 5.5 5.5-5.5 5.5' },
      { tag: 'path', d: 'm15 4.5-6 15' },
    ],
  },
  strings: {
    paths: [
      { tag: 'path', d: 'M5 6h14' },
      { tag: 'path', d: 'M5 12h14' },
      { tag: 'path', d: 'M5 18h10' },
      { tag: 'circle', cx: '3.5', cy: '6', r: '1.8', fill: 'currentColor', stroke: 'none' },
      { tag: 'circle', cx: '3.5', cy: '12', r: '1.8', fill: 'currentColor', stroke: 'none' },
      { tag: 'circle', cx: '3.5', cy: '18', r: '1.8', fill: 'currentColor', stroke: 'none' },
    ],
  },
  undo: {
    paths: [
      { tag: 'path', d: 'M9.5 5.5 4 11l5.5 5.5' },
      { tag: 'path', d: 'M20.5 17.5a8.5 8.5 0 0 0-8.5-8.5H4' },
    ],
  },
  redo: {
    paths: [
      { tag: 'path', d: 'm14.5 5.5 5.5 5.5-5.5 5.5' },
      { tag: 'path', d: 'M3.5 17.5a8.5 8.5 0 0 1 8.5-8.5h8.5' },
    ],
  },
  locate: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '4.5' },
      { tag: 'path', d: 'M12 2v3.5' },
      { tag: 'path', d: 'M12 18.5V22' },
      { tag: 'path', d: 'M2 12h3.5' },
      { tag: 'path', d: 'M18.5 12H22' },
    ],
  },
  duplicate: {
    paths: [
      { tag: 'rect', x: '7', y: '7', width: '13', height: '13', rx: '2.5' },
      { tag: 'path', d: 'M5 16.5h-1A2.5 2.5 0 0 1 1.5 14V4A2.5 2.5 0 0 1 4 1.5h10A2.5 2.5 0 0 1 16.5 4v1' },
    ],
  },
  delete: {
    paths: [
      { tag: 'path', d: 'M3 7h18' },
      { tag: 'path', d: 'M8.5 7V4a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 4v3' },
      { tag: 'path', d: 'M6.5 7.5 7.5 20a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2l1-12.5' },
      { tag: 'path', d: 'M9.5 10.5v6.5' },
      { tag: 'path', d: 'M14.5 10.5v6.5' },
    ],
  },
  success: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10.5' },
      { tag: 'path', d: 'm7 12.5 3.5 3.5 6.5-6.5' },
    ],
  },
  check: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10.5' },
      { tag: 'path', d: 'm7 12.5 3.5 3.5 6.5-6.5' },
    ],
  },
  warning: {
    paths: [
      { tag: 'path', d: 'M12 3 22.5 20H1.5z' },
      { tag: 'path', d: 'M12 9v5.5' },
      { tag: 'circle', cx: '12', cy: '17.5', r: '1.3', fill: 'currentColor', stroke: 'none' },
    ],
  },
  error: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10.5' },
      { tag: 'path', d: 'm8 8 8 8' },
      { tag: 'path', d: 'm16 8-8 8' },
    ],
  },
  close: {
    paths: [
      { tag: 'path', d: 'm5.5 5.5 13 13' },
      { tag: 'path', d: 'M18.5 5.5l-13 13' },
    ],
  },
  add: {
    paths: [
      { tag: 'path', d: 'M12 3v18' },
      { tag: 'path', d: 'M3 12h18' },
    ],
  },
  share: {
    paths: [
      { tag: 'path', d: 'M12 16.5V7.5' },
      { tag: 'path', d: 'm8 11.5 4-4 4 4' },
      { tag: 'path', d: 'M5 18.5A6 6 0 0 1 3 13a6.5 6.5 0 0 1 6.5-6.5h1.5' },
      { tag: 'path', d: 'M19 18.5A6 6 0 0 0 21 13a6.5 6.5 0 0 0-6.5-6.5H13' },
      { tag: 'path', d: 'M7.5 22h9' },
    ],
  },
  download: {
    paths: [
      { tag: 'path', d: 'M12 8v9' },
      { tag: 'path', d: 'm8 13.5 4 4 4-4' },
      { tag: 'path', d: 'M5 18.5A6 6 0 0 1 3 13a6.5 6.5 0 0 1 6.5-6.5h1.5' },
      { tag: 'path', d: 'M19 18.5A6 6 0 0 0 21 13a6.5 6.5 0 0 0-6.5-6.5H13' },
    ],
  },
  database: {
    paths: [
      { tag: 'ellipse', cx: '12', cy: '4.5', rx: '9.5', ry: '4' },
      { tag: 'path', d: 'M2.5 4.5v5.5c0 2.2 4.3 4 9.5 4s9.5-1.8 9.5-4V4.5' },
      { tag: 'path', d: 'M2.5 10v5.5c0 2.2 4.3 4 9.5 4s9.5-1.8 9.5-4V10' },
    ],
  },
  help: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10.5' },
      { tag: 'path', d: 'M9 9.5a3.5 3.5 0 0 1 6 1.3c0 2.5-4 3-4 3' },
      { tag: 'circle', cx: '12', cy: '18', r: '1.3', fill: 'currentColor', stroke: 'none' },
    ],
  },
  support: {
    paths: [
      { tag: 'path', d: 'M12 21s-8-5-10-10.5C0.5 7 3 3.5 7 3.5c2.5 0 4 1.5 5 3 1-1.5 2.5-3 5-3 4 0 6 3.5 4.5 7.5-1.5 4-2.5 6-4 7.5' },
      { tag: 'path', d: 'M20 3.5v4.5' },
      { tag: 'path', d: 'M17.5 5.5h5' },
      { tag: 'path', d: 'M5 3v4' },
    ],
  },
  eye: {
    paths: [
      { tag: 'path', d: 'M0.5 12S5.5 2 12 2s11.5 10 11.5 10S18.5 22 12 22 0.5 12 0.5 12z' },
      { tag: 'circle', cx: '12', cy: '12', r: '4.5' },
    ],
  },
  play: {
    paths: [
      { tag: 'path', d: 'M6 3v18l15-9z', fill: 'currentColor', stroke: 'none' },
    ],
  },
  restart: {
    paths: [
      { tag: 'path', d: 'M1.5 12A10.5 10.5 0 0 1 19.5 4V1.5' },
      { tag: 'path', d: 'M22.5 12a10.5 10.5 0 0 1-18 8v2.5' },
      { tag: 'path', d: 'M19.5 4.5h-4.5v4.5' },
      { tag: 'path', d: 'M4.5 19.5H9V15' },
    ],
  },
  clock: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10.5' },
      { tag: 'path', d: 'M12 6v6.5l4.5 4.5' },
    ],
  },
  user: {
    paths: [
      { tag: 'circle', cx: '12', cy: '6.5', r: '5.5' },
      { tag: 'path', d: 'M2.5 21.5c0-5.5 5-8.5 9.5-8.5s9.5 3 9.5 8.5' },
    ],
  },
  star: {
    paths: [
      { tag: 'path', d: 'M12 1.5l3.5 7.5 7.5 1-5.5 5 1.5 7.5-7-4-7 4 1.5-7.5-5.5-5 7.5-1z', fill: 'currentColor', 'stroke-width': '0' },
    ],
  },
  trophy: {
    paths: [
      { tag: 'path', d: 'M6.5 2.5h11v7.5a5.5 5.5 0 0 1-11 0z' },
      { tag: 'path', d: 'M17.5 5h3.5a2 2 0 0 1 0 4h-3.5' },
      { tag: 'path', d: 'M6.5 5H3a2 2 0 0 0 0 4h3.5' },
      { tag: 'path', d: 'M12 14.5v4.5' },
      { tag: 'path', d: 'M6.5 22h11' },
      { tag: 'path', d: 'M9.5 18.5h5' },
    ],
  },
  flame: {
    paths: [
      { tag: 'path', d: 'M12 1c0 5-5 7-5 12.5a5 5 0 0 0 10 0c0-5.5-5-7.5-5-12.5z', fill: 'currentColor', 'stroke-width': '0' },
      { tag: 'path', d: 'M12 23a7.5 7.5 0 0 1-7.5-7.5c0-4 2-6 4-9 1 3 4 4 4 7a3.5 3.5 0 0 0 7 0c0-3-1.5-5-2.5-7 1.5 3 3 5.5 3 9A7.5 7.5 0 0 1 12 23z' },
    ],
  },
  shield: {
    paths: [
      { tag: 'path', d: 'M12 1.5 2.5 6.5v6.5c0 5.5 4.5 9.5 9.5 10.5 5-1 9.5-5 9.5-10.5V6.5z' },
      { tag: 'path', d: 'm7.5 11.5 3.5 3.5 6.5-6.5' },
    ],
  },
  target: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10.5' },
      { tag: 'circle', cx: '12', cy: '12', r: '6.5' },
      { tag: 'circle', cx: '12', cy: '12', r: '2.2', fill: 'currentColor', stroke: 'none' },
    ],
  },
  medal: {
    paths: [
      { tag: 'path', d: 'M7 2h10l-2.5 7.5h-5z' },
      { tag: 'circle', cx: '12', cy: '15.5', r: '6.5' },
      { tag: 'path', d: 'm9 14.5 2.5 2.5 4.5-4.5' },
    ],
  },
  bug: {
    paths: [
      { tag: 'path', d: 'M6.5 8.5a5.5 5.5 0 0 1 11 0v7.5a5.5 5.5 0 0 1-11 0z' },
      { tag: 'path', d: 'M9 4 5.5 1.5' },
      { tag: 'path', d: 'm15 4 3.5-2.5' },
      { tag: 'path', d: 'M2 10h4.5' },
      { tag: 'path', d: 'M17.5 10H22' },
      { tag: 'path', d: 'M2 16h4.5' },
      { tag: 'path', d: 'M17.5 16H22' },
      { tag: 'path', d: 'M12 8.5v11.5' },
      { tag: 'path', d: 'M8 12h8' },
    ],
  },
  sparkle: {
    paths: [
      { tag: 'path', d: 'M12 0.5l2.5 7 7 1-5.5 5 1.5 7.5-5.5-3.5-5.5 3.5 1.5-7.5-5.5-5 7-1z', fill: 'currentColor', 'stroke-width': '0' },
      { tag: 'path', d: 'M20 14l1.5 4 4 1-3 2-1.5 3.5-1-3.5-3-2 4-1z', fill: 'currentColor', 'stroke-width': '0' },
      { tag: 'path', d: 'M2 16l1.5 3.5 3.5.5-2.5 2-1 3-.5-3-2.5-2 3.5-.5z', fill: 'currentColor', 'stroke-width': '0' },
    ],
  },
  map: {
    paths: [
      { tag: 'polygon', points: '1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6' },
      { tag: 'line', x1: '8', y1: '2', x2: '8', y2: '18' },
      { tag: 'line', x1: '16', y1: '6', x2: '16', y2: '22' },
    ],
  },
  upvote: {
    paths: [
      { tag: 'path', d: 'M12 19V6' },
      { tag: 'path', d: 'M5 12l7-7 7 7' },
    ],
  },
};

export function createIcon(name: IconName): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'ui-icon';
  span.setAttribute('aria-hidden', 'true');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', ICONS[name].viewBox ?? '0 0 24 24');
  svg.setAttribute('fill', 'none');

  for (const pathDef of ICONS[name].paths) {
    const { tag, ...attrs } = pathDef;
    const node = document.createElementNS(SVG_NS, tag);
    const finalAttrs = {
      ...BASE_ICON_ATTRS,
      ...attrs,
    };
    Object.entries(finalAttrs).forEach(([attr, value]) => node.setAttribute(attr, value));
    svg.appendChild(node);
  }

  span.appendChild(svg);
  return span;
}

export function createControlContent(icon: IconName, label: string): HTMLSpanElement {
  const content = document.createElement('span');
  content.className = 'ui-control-content';

  const labelEl = document.createElement('span');
  labelEl.className = 'ui-control-label';
  labelEl.textContent = label;

  content.append(createIcon(icon), labelEl);
  return content;
}

export function setButtonContent(button: HTMLButtonElement, icon: IconName, label: string): HTMLButtonElement {
  button.textContent = '';
  button.appendChild(createControlContent(icon, label));
  return button;
}

export function createBadge(icon: IconName, label: string, tone: 'neutral' | 'success' | 'warning' | 'danger' = 'neutral'): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = `ui-badge ui-badge-${tone}`;
  badge.appendChild(createControlContent(icon, label));
  return badge;
}

export function createEmptyState(icon: IconName, title: string, hint: string): HTMLDivElement {
  const empty = document.createElement('div');
  empty.className = 'empty-state';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'empty-state-icon';
  iconWrap.appendChild(createIcon(icon));

  const titleEl = document.createElement('div');
  titleEl.className = 'empty-state-text';
  titleEl.textContent = title;

  const hintEl = document.createElement('div');
  hintEl.className = 'empty-state-hint';
  hintEl.textContent = hint;

  empty.append(iconWrap, titleEl, hintEl);
  return empty;
}
