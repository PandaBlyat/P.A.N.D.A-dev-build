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
  'stroke-width': '2',               // increased from 1.8 for bolder, larger feel
};

const ICONS: Record<IconName, IconDef> = {
  brand: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '9.5', stroke: 'currentColor', 'stroke-width': '1.8' },
      { tag: 'path', d: 'M7.5 10c1.3-2.2 3-3.5 4.5-3.5s3.2 1.3 4.5 3.5' },
      { tag: 'circle', cx: '9', cy: '9.5', r: '1', fill: 'currentColor', stroke: 'none' },
      { tag: 'circle', cx: '15', cy: '9.5', r: '1', fill: 'currentColor', stroke: 'none' },
      { tag: 'path', d: 'M7.8 14c1.2 1.8 2.6 2.8 4.2 2.8s3-1 4.2-2.8' },
      { tag: 'path', d: 'M7 6 5.2 3.8 3 5.6l1.5 2.4' },
      { tag: 'path', d: 'M17 6l1.8-2.2 2.2 1.8-1.5 2.4' },
    ],
  },
  open: {
    paths: [
      { tag: 'path', d: 'M3 7.5h5.5l2.2 2.2H20v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
      { tag: 'path', d: 'M3 7.5v-1a2 2 0 0 1 2-2h5l2.2 2.2H18a2 2 0 0 1 2 2v1' },
    ],
  },
  import: {
    paths: [
      { tag: 'path', d: 'M12 3v11' },
      { tag: 'path', d: 'm8 7 4-4 4 4' },
      { tag: 'path', d: 'M5 15.5v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2' },
    ],
  },
  save: {
    paths: [
      { tag: 'path', d: 'M5 4h12l2.5 2.5V20H5z' },
      { tag: 'path', d: 'M8 4v5.5h8' },
      { tag: 'path', d: 'M8 19v-6h8v6' },
    ],
  },
  export: {
    paths: [
      { tag: 'path', d: 'M12 15V4' },
      { tag: 'path', d: 'm8 11 4 4 4-4' },
      { tag: 'path', d: 'M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2' },
    ],
  },
  xml: {
    paths: [
      { tag: 'path', d: 'm8.5 7.5-4.5 4.5 4.5 4.5' },
      { tag: 'path', d: 'm15.5 7.5 4.5 4.5-4.5 4.5' },
      { tag: 'path', d: 'm14 5.5-4 13' },
    ],
  },
  strings: {
    paths: [
      { tag: 'path', d: 'M6 7h12' },
      { tag: 'path', d: 'M6 12h12' },
      { tag: 'path', d: 'M6 17h8' },
      { tag: 'circle', cx: '4.5', cy: '7', r: '1.2', fill: 'currentColor', stroke: 'none' },
      { tag: 'circle', cx: '4.5', cy: '12', r: '1.2', fill: 'currentColor', stroke: 'none' },
      { tag: 'circle', cx: '4.5', cy: '17', r: '1.2', fill: 'currentColor', stroke: 'none' },
    ],
  },
  undo: {
    paths: [
      { tag: 'path', d: 'M9 6.5 4.5 11 9 15.5' },
      { tag: 'path', d: 'M19.5 17a7.5 7.5 0 0 0-7.5-7.5H4.5' },
    ],
  },
  redo: {
    paths: [
      { tag: 'path', d: 'm15 6.5 4.5 4.5L15 15.5' },
      { tag: 'path', d: 'M4.5 17a7.5 7.5 0 0 1 7.5-7.5h7.5' },
    ],
  },
  locate: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '3.5' },
      { tag: 'path', d: 'M12 3v2.5' },
      { tag: 'path', d: 'M12 18.5V21' },
      { tag: 'path', d: 'M3 12h2.5' },
      { tag: 'path', d: 'M18.5 12H21' },
    ],
  },
  duplicate: {
    paths: [
      { tag: 'rect', x: '8', y: '8', width: '11', height: '11', rx: '2' },
      { tag: 'path', d: 'M6 16H5a2.5 2.5 0 0 1-2.5-2.5V5A2.5 2.5 0 0 1 5 2.5h8.5A2.5 2.5 0 0 1 16 5v1' },
    ],
  },
  delete: {
    paths: [
      { tag: 'path', d: 'M4 7h16' },
      { tag: 'path', d: 'M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2' },
      { tag: 'path', d: 'M7 7.5 8 19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-11.5' },
      { tag: 'path', d: 'M10 10v6' },
      { tag: 'path', d: 'M14 10v6' },
    ],
  },
  success: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '9' },
      { tag: 'path', d: 'm8 12.5 2.5 2.5 5.5-5.5' },
    ],
  },
  check: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '9' },
      { tag: 'path', d: 'm8 12.5 2.5 2.5 5.5-5.5' },
    ],
  },
  warning: {
    paths: [
      { tag: 'path', d: 'M12 4 21 19H3z' },
      { tag: 'path', d: 'M12 9v4.5' },
      { tag: 'circle', cx: '12', cy: '16.5', r: '1', fill: 'currentColor', stroke: 'none' },
    ],
  },
  error: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '9' },
      { tag: 'path', d: 'm9 9 6 6' },
      { tag: 'path', d: 'm15 9-6 6' },
    ],
  },
  close: {
    paths: [
      { tag: 'path', d: 'm6.5 6.5 11 11' },
      { tag: 'path', d: 'M17.5 6.5l-11 11' },
    ],
  },
  add: {
    paths: [
      { tag: 'path', d: 'M12 4v16' },
      { tag: 'path', d: 'M4 12h16' },
    ],
  },
  share: {
    paths: [
      { tag: 'path', d: 'M12 15.5V8' },
      { tag: 'path', d: 'm9 11 3-3 3 3' },
      { tag: 'path', d: 'M6 17.5A5 5 0 0 1 4 13a5.5 5.5 0 0 1 5.5-5.5h.8' },
      { tag: 'path', d: 'M18 17.5A5 5 0 0 0 20 13a5.5 5.5 0 0 0-5.5-5.5h-.8' },
      { tag: 'path', d: 'M8 20h8' },
    ],
  },
  download: {
    paths: [
      { tag: 'path', d: 'M12 9v7.5' },
      { tag: 'path', d: 'm9 13.5 3 3 3-3' },
      { tag: 'path', d: 'M6 17.5A5 5 0 0 1 4 13a5.5 5.5 0 0 1 5.5-5.5h.8' },
      { tag: 'path', d: 'M18 17.5A5 5 0 0 0 20 13a5.5 5.5 0 0 0-5.5-5.5h-.8' },
    ],
  },
  database: {
    paths: [
      { tag: 'ellipse', cx: '12', cy: '5.5', rx: '8.5', ry: '3' },
      { tag: 'path', d: 'M3.5 5.5v4.5c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3V5.5' },
      { tag: 'path', d: 'M3.5 10v4.5c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3V10' },
    ],
  },
  help: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '9.5' },
      { tag: 'path', d: 'M9.5 9.5a2.8 2.8 0 0 1 5 1.3c0 2-3 2.5-3 2.5' },
      { tag: 'circle', cx: '12', cy: '17', r: '1', fill: 'currentColor', stroke: 'none' },
    ],
  },
  support: {
    paths: [
      { tag: 'path', d: 'M12 20s-7-4-8.8-8.8C1.5 7.8 3.5 5 6.8 5c2 0 3.3 1.2 4.2 2.5C12 6.2 13.3 5 15.2 5c3.3 0 5.3 2.8 4 6.2C17.5 13 16.5 15 15 16.5' },
      { tag: 'path', d: 'M18.5 4.5v3.5' },
      { tag: 'path', d: 'M16.8 6.2h3.5' },
      { tag: 'path', d: 'M6 3.5v3' },
    ],
  },
  eye: {
    paths: [
      { tag: 'path', d: 'M1 12s4-8.5 11-8.5S23 12 23 12s-4 8.5-11 8.5S1 12 1 12z' },
      { tag: 'circle', cx: '12', cy: '12', r: '3.5' },
    ],
  },
  play: {
    paths: [
      { tag: 'path', d: 'M7 4v16l12-8z', fill: 'currentColor', stroke: 'none' },
    ],
  },
  restart: {
    paths: [
      { tag: 'path', d: 'M2.5 12a9.5 9.5 0 0 1 16-7.1V2.5' },
      { tag: 'path', d: 'M21.5 12a9.5 9.5 0 0 1-16 7.1v2.4' },
      { tag: 'path', d: 'M18.5 5H15v3.5' },
      { tag: 'path', d: 'M5.5 19H9v-3.5' },
    ],
  },
  clock: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '9.5' },
      { tag: 'path', d: 'M12 6.5v5.5l3.5 3.5' },
    ],
  },
  user: {
    paths: [
      { tag: 'circle', cx: '12', cy: '7.5', r: '4.5' },
      { tag: 'path', d: 'M3.5 20.5c0-4.5 4-7.5 8.5-7.5s8.5 3 8.5 7.5' },
    ],
  },
  star: {
    paths: [
      { tag: 'path', d: 'M12 2.5l2.8 6 6.2.5-4.5 4.3 1.2 6.2-5.7-3.2-5.7 3.2 1.2-6.2-4.5-4.3 6.2-.5z', fill: 'currentColor', 'stroke-width': '0' },
    ],
  },
  trophy: {
    paths: [
      { tag: 'path', d: 'M7.5 3.5h9v6.5a4.5 4.5 0 0 1-9 0z' },
      { tag: 'path', d: 'M16.5 5.5h2.5a2 2 0 0 1 0 4h-2.5' },
      { tag: 'path', d: 'M7.5 5.5H5a2 2 0 0 0 0 4h2.5' },
      { tag: 'path', d: 'M12 14.5v3' },
      { tag: 'path', d: 'M7.5 20.5h9' },
      { tag: 'path', d: 'M10 17.5h4' },
    ],
  },
  flame: {
    paths: [
      { tag: 'path', d: 'M12 2c0 4-4 6-4 10.5a4.5 4.5 0 0 0 9 0c0-4.5-4-6.5-4-10.5z', fill: 'currentColor', 'stroke-width': '0' },
      { tag: 'path', d: 'M12 22a6.5 6.5 0 0 1-6.5-6.5c0-3 2-5 3-7.5 1 2 3 3 3 5.5a3.5 3.5 0 0 0 7 0c0-2.5-1-3.5-2-5.5 1 2 2 4.5 2 7.5a6.5 6.5 0 0 1-6.5 6.5z' },
    ],
  },
  shield: {
    paths: [
      { tag: 'path', d: 'M12 2.5 3.5 6.5v5.5c0 4.5 3.5 8.5 8.5 9.5 5-1 8.5-5 8.5-9.5V6.5z' },
      { tag: 'path', d: 'm8.5 11.5 2.5 2.5 5-5' },
    ],
  },
  target: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '9.5' },
      { tag: 'circle', cx: '12', cy: '12', r: '5.5' },
      { tag: 'circle', cx: '12', cy: '12', r: '1.8', fill: 'currentColor', stroke: 'none' },
    ],
  },
  medal: {
    paths: [
      { tag: 'path', d: 'M8 3h8l-2 6.5h-4z' },
      { tag: 'circle', cx: '12', cy: '14.5', r: '5.5' },
      { tag: 'path', d: 'm10 13.5 1.5 1.5 3-3' },
    ],
  },
  bug: {
    paths: [
      { tag: 'path', d: 'M7.5 8.5a4.5 4.5 0 0 1 9 0v6.5a4.5 4.5 0 0 1-9 0z' },
      { tag: 'path', d: 'M9 5 6.5 3' },
      { tag: 'path', d: 'm15 5 2.5-2' },
      { tag: 'path', d: 'M3.5 10h3.5' },
      { tag: 'path', d: 'M17 10h3.5' },
      { tag: 'path', d: 'M3.5 15.5h3.5' },
      { tag: 'path', d: 'M17 15.5h3.5' },
      { tag: 'path', d: 'M12 8.5v10' },
      { tag: 'path', d: 'M9 12h6' },
    ],
  },
  sparkle: {
    paths: [
      { tag: 'path', d: 'M12 1.5l1.8 5 5.2.5-3.8 3.5 1 5.5-4.2-2.7-4.2 2.7 1-5.5-3.8-3.5 5.2-.5z', fill: 'currentColor', 'stroke-width': '0' },
      { tag: 'path', d: 'M19 13.5l1.2 3 3 .8-2.5 1.2-1.2 2.8-1-2.8-2.5-1.2 3-.8z', fill: 'currentColor', 'stroke-width': '0' },
      { tag: 'path', d: 'M3 15.5l1 2.5 2.5.8-2 1-1 2.5-.8-2.5-2-1 2.5-.8z', fill: 'currentColor', 'stroke-width': '0' },
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
