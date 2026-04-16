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
  | 'sparkle';

const BASE_ICON_ATTRS = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'stroke-width': '2.2',
};

const ICONS: Record<IconName, IconDef> = {
  // Panda brand icon
  brand: {
    paths: [
      // Face outline (circle)
      { tag: 'circle', cx: '12', cy: '12', r: '10', stroke: 'currentColor', 'stroke-width': '2' },
      // Left ear
      { tag: 'circle', cx: '6', cy: '5', r: '3', fill: 'currentColor', stroke: 'none' },
      // Right ear
      { tag: 'circle', cx: '18', cy: '5', r: '3', fill: 'currentColor', stroke: 'none' },
      // Left eye patch (dark oval)
      { tag: 'ellipse', cx: '8.5', cy: '11', rx: '2.2', ry: '2.8', fill: 'currentColor', stroke: 'none', transform: 'rotate(-15 8.5 11)' },
      // Right eye patch
      { tag: 'ellipse', cx: '15.5', cy: '11', rx: '2.2', ry: '2.8', fill: 'currentColor', stroke: 'none', transform: 'rotate(15 15.5 11)' },
      // Left eye (white highlight)
      { tag: 'circle', cx: '9', cy: '10.5', r: '0.8', fill: 'white', stroke: 'none' },
      // Right eye (white highlight)
      { tag: 'circle', cx: '15', cy: '10.5', r: '0.8', fill: 'white', stroke: 'none' },
      // Nose (small oval)
      { tag: 'ellipse', cx: '12', cy: '14', rx: '1.5', ry: '1', fill: 'currentColor', stroke: 'none' },
      // Mouth (smile arc)
      { tag: 'path', d: 'M10 16 Q12 18, 14 16', stroke: 'currentColor', 'stroke-width': '1.8', fill: 'none' },
    ],
  },
  open: {
    paths: [
      { tag: 'path', d: 'M2.5 7.5h6l2.5 2.5H21v8.5a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2z' },
      { tag: 'path', d: 'M2.5 7.5v-1.5a2 2 0 0 1 2-2h5.5l2.5 2.5H19a2 2 0 0 1 2 2v1' },
    ],
  },
  import: {
    paths: [
      { tag: 'path', d: 'M12 2.5v12' },
      { tag: 'path', d: 'm7.5 7 4.5-4.5 4.5 4.5' },
      { tag: 'path', d: 'M4.5 16v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V16' },
    ],
  },
  save: {
    paths: [
      { tag: 'path', d: 'M4.5 3.5h12.5l3 3V20.5h-15.5z' },
      { tag: 'path', d: 'M7.5 3.5v6h9' },
      { tag: 'path', d: 'M7.5 19.5v-7h9v7' },
    ],
  },
  export: {
    paths: [
      { tag: 'path', d: 'M12 15.5V3.5' },
      { tag: 'path', d: 'm7.5 11.5 4.5 4 4.5-4' },
      { tag: 'path', d: 'M4.5 16.5v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.5' },
    ],
  },
  xml: {
    paths: [
      { tag: 'path', d: 'm8 7-5 5 5 5' },
      { tag: 'path', d: 'm16 7 5 5-5 5' },
      { tag: 'path', d: 'm14.5 5-5 14' },
    ],
  },
  strings: {
    paths: [
      { tag: 'path', d: 'M5.5 6.5h13' },
      { tag: 'path', d: 'M5.5 12h13' },
      { tag: 'path', d: 'M5.5 17.5h9' },
      { tag: 'circle', cx: '4', cy: '6.5', r: '1.5', fill: 'currentColor', stroke: 'none' },
      { tag: 'circle', cx: '4', cy: '12', r: '1.5', fill: 'currentColor', stroke: 'none' },
      { tag: 'circle', cx: '4', cy: '17.5', r: '1.5', fill: 'currentColor', stroke: 'none' },
    ],
  },
  undo: {
    paths: [
      { tag: 'path', d: 'M9 6 4 11l5 5' },
      { tag: 'path', d: 'M20 17a8 8 0 0 0-8-8H4' },
    ],
  },
  redo: {
    paths: [
      { tag: 'path', d: 'm15 6 5 5-5 5' },
      { tag: 'path', d: 'M4 17a8 8 0 0 1 8-8h8' },
    ],
  },
  locate: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '4' },
      { tag: 'path', d: 'M12 2.5v3' },
      { tag: 'path', d: 'M12 18.5V21.5' },
      { tag: 'path', d: 'M2.5 12h3' },
      { tag: 'path', d: 'M18.5 12h3' },
    ],
  },
  duplicate: {
    paths: [
      { tag: 'rect', x: '7.5', y: '7.5', width: '12', height: '12', rx: '2.2' },
      { tag: 'path', d: 'M5.5 16H4.5a2.5 2.5 0 0 1-2.5-2.5V4.5A2.5 2.5 0 0 1 4.5 2h9A2.5 2.5 0 0 1 16 4.5v1' },
    ],
  },
  delete: {
    paths: [
      { tag: 'path', d: 'M3.5 7h17' },
      { tag: 'path', d: 'M8.5 7V4.5A1.5 1.5 0 0 1 10 3h4a1.5 1.5 0 0 1 1.5 1.5V7' },
      { tag: 'path', d: 'M6.5 7.5 7.5 19.5a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2l1-12' },
      { tag: 'path', d: 'M9.5 10.5v6' },
      { tag: 'path', d: 'M14.5 10.5v6' },
    ],
  },
  success: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10' },
      { tag: 'path', d: 'm7.5 12.5 3 3 6-6' },
    ],
  },
  check: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10' },
      { tag: 'path', d: 'm7.5 12.5 3 3 6-6' },
    ],
  },
  warning: {
    paths: [
      { tag: 'path', d: 'M12 3.5 22 19.5H2z' },
      { tag: 'path', d: 'M12 9v5' },
      { tag: 'circle', cx: '12', cy: '17', r: '1.2', fill: 'currentColor', stroke: 'none' },
    ],
  },
  error: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10' },
      { tag: 'path', d: 'm8.5 8.5 7 7' },
      { tag: 'path', d: 'm15.5 8.5-7 7' },
    ],
  },
  close: {
    paths: [
      { tag: 'path', d: 'm6 6 12 12' },
      { tag: 'path', d: 'M18 6 6 18' },
    ],
  },
  add: {
    paths: [
      { tag: 'path', d: 'M12 3.5v17' },
      { tag: 'path', d: 'M3.5 12h17' },
    ],
  },
  share: {
    paths: [
      { tag: 'path', d: 'M12 16V8' },
      { tag: 'path', d: 'm8.5 11.5 3.5-3.5 3.5 3.5' },
      { tag: 'path', d: 'M5.5 18A5.5 5.5 0 0 1 3.5 13a6 6 0 0 1 6-6h1' },
      { tag: 'path', d: 'M18.5 18A5.5 5.5 0 0 0 20.5 13a6 6 0 0 0-6-6h-1' },
      { tag: 'path', d: 'M8 21h8' },
    ],
  },
  download: {
    paths: [
      { tag: 'path', d: 'M12 8.5v8' },
      { tag: 'path', d: 'm8.5 13.5 3.5 3 3.5-3' },
      { tag: 'path', d: 'M5.5 18A5.5 5.5 0 0 1 3.5 13a6 6 0 0 1 6-6h1' },
      { tag: 'path', d: 'M18.5 18A5.5 5.5 0 0 0 20.5 13a6 6 0 0 0-6-6h-1' },
    ],
  },
  database: {
    paths: [
      { tag: 'ellipse', cx: '12', cy: '5', rx: '9', ry: '3.5' },
      { tag: 'path', d: 'M3 5v5c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5V5' },
      { tag: 'path', d: 'M3 10v5c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5V10' },
    ],
  },
  help: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10' },
      { tag: 'path', d: 'M9.5 9.5a3 3 0 0 1 5.5 1.3c0 2.2-3.5 2.7-3.5 2.7' },
      { tag: 'circle', cx: '12', cy: '17.5', r: '1.2', fill: 'currentColor', stroke: 'none' },
    ],
  },
  support: {
    paths: [
      { tag: 'path', d: 'M12 20.5s-7.5-4.5-9.5-9.5C.5 7.5 2.8 4.5 6.5 4.5c2.3 0 3.5 1.3 4.5 2.8 1-1.5 2.2-2.8 4.5-2.8 3.7 0 5.7 3 4.3 6.8C18 12.8 17 15 15.5 16.5' },
      { tag: 'path', d: 'M19 4v4' },
      { tag: 'path', d: 'M17 6h4' },
      { tag: 'path', d: 'M5.5 3.5v3.5' },
    ],
  },
  eye: {
    paths: [
      { tag: 'path', d: 'M1 12s4.5-9 11-9 11 9 11 9-4.5 9-11 9-11-9-11-9z' },
      { tag: 'circle', cx: '12', cy: '12', r: '4' },
    ],
  },
  play: {
    paths: [
      { tag: 'path', d: 'M6.5 3.5v17l14-8.5z', fill: 'currentColor', stroke: 'none' },
    ],
  },
  restart: {
    paths: [
      { tag: 'path', d: 'M2 12a10 10 0 0 1 17-7.5V2' },
      { tag: 'path', d: 'M22 12a10 10 0 0 1-17 7.5V22' },
      { tag: 'path', d: 'M19 5h-4v4' },
      { tag: 'path', d: 'M5 19h4v-4' },
    ],
  },
  clock: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10' },
      { tag: 'path', d: 'M12 6v6l4 4' },
    ],
  },
  user: {
    paths: [
      { tag: 'circle', cx: '12', cy: '7', r: '5' },
      { tag: 'path', d: 'M3 21c0-5 4.5-8 9-8s9 3 9 8' },
    ],
  },
  star: {
    paths: [
      { tag: 'path', d: 'M12 2l3.2 6.8L22 9.5l-5 4.8 1.2 7.2-6.2-3.5-6.2 3.5 1.2-7.2-5-4.8 6.8-1.5z', fill: 'currentColor', 'stroke-width': '0' },
    ],
  },
  trophy: {
    paths: [
      { tag: 'path', d: 'M7 3h10v7a5 5 0 0 1-10 0z' },
      { tag: 'path', d: 'M17 5h3a2 2 0 0 1 0 4h-3' },
      { tag: 'path', d: 'M7 5H4a2 2 0 0 0 0 4h3' },
      { tag: 'path', d: 'M12 14v4' },
      { tag: 'path', d: 'M7 21h10' },
      { tag: 'path', d: 'M10 18h4' },
    ],
  },
  flame: {
    paths: [
      { tag: 'path', d: 'M12 1.5c0 4.5-4.5 6.5-4.5 11.5a4.5 4.5 0 0 0 9 0c0-5-4.5-7-4.5-11.5z', fill: 'currentColor', 'stroke-width': '0' },
      { tag: 'path', d: 'M12 22.5a7 7 0 0 1-7-7c0-3.5 2-5.5 3.5-8 1 2.5 3.5 3.5 3.5 6a3.5 3.5 0 0 0 7 0c0-2.5-1.5-4-2.5-6 1.5 2.5 2.5 5 2.5 8a7 7 0 0 1-7 7z' },
    ],
  },
  shield: {
    paths: [
      { tag: 'path', d: 'M12 2 3 6.5v6c0 5 4 9 9 10 5-1 9-5 9-10v-6z' },
      { tag: 'path', d: 'm8 12 3 3 6-6' },
    ],
  },
  target: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '10' },
      { tag: 'circle', cx: '12', cy: '12', r: '6' },
      { tag: 'circle', cx: '12', cy: '12', r: '2', fill: 'currentColor', stroke: 'none' },
    ],
  },
  medal: {
    paths: [
      { tag: 'path', d: 'M7.5 2.5h9l-2.5 7h-4z' },
      { tag: 'circle', cx: '12', cy: '15', r: '6' },
      { tag: 'path', d: 'm9.5 14 2 2 4-4' },
    ],
  },
  bug: {
    paths: [
      { tag: 'path', d: 'M7 8.5a5 5 0 0 1 10 0v7a5 5 0 0 1-10 0z' },
      { tag: 'path', d: 'M9 4.5 6 2' },
      { tag: 'path', d: 'm15 4.5 3-2.5' },
      { tag: 'path', d: 'M2.5 10h4' },
      { tag: 'path', d: 'M17.5 10h4' },
      { tag: 'path', d: 'M2.5 16h4' },
      { tag: 'path', d: 'M17.5 16h4' },
      { tag: 'path', d: 'M12 8.5v11' },
      { tag: 'path', d: 'M8.5 12h7' },
    ],
  },
  sparkle: {
    paths: [
      { tag: 'path', d: 'M12 1l2 6 6 .5-4.5 4 1.5 6.5-5-3-5 3 1.5-6.5-4.5-4 6-.5z', fill: 'currentColor', 'stroke-width': '0' },
      { tag: 'path', d: 'M19.5 14l1.5 3.5 3.5.5-2.5 1.5-1.5 3-1-3-2.5-1.5 3.5-.5z', fill: 'currentColor', 'stroke-width': '0' },
      { tag: 'path', d: 'M2.5 16l1 3 3 .5-2 1.5-1 3-.5-3-2-1.5 3-.5z', fill: 'currentColor', 'stroke-width': '0' },
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
