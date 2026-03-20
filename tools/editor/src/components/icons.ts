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
  | 'warning'
  | 'error'
  | 'close'
  | 'add'
  | 'share'
  | 'download'
  | 'database';

const BASE_ICON_ATTRS = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'stroke-width': '1.8',
};

const ICONS: Record<IconName, IconDef> = {
  brand: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '9', stroke: 'currentColor', 'stroke-width': '1.6' },
      { tag: 'path', d: 'M8 10.5c1.1-2 2.8-3 4-3s2.9 1 4 3' },
      { tag: 'circle', cx: '9.4', cy: '9.7', r: '0.8', fill: 'currentColor', stroke: 'none' },
      { tag: 'circle', cx: '14.6', cy: '9.7', r: '0.8', fill: 'currentColor', stroke: 'none' },
      { tag: 'path', d: 'M8.3 13.7c1.1 1.7 2.4 2.6 3.7 2.6s2.6-.9 3.7-2.6' },
      { tag: 'path', d: 'M7.5 6.5 6 4.3 3.8 6.1 5.2 8.3' },
      { tag: 'path', d: 'M16.5 6.5 18 4.3l2.2 1.8-1.4 2.2' },
    ],
  },
  open: {
    paths: [
      { tag: 'path', d: 'M3.5 7.5h5l2 2h10v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z' },
      { tag: 'path', d: 'M3.5 7.5v-1a2 2 0 0 1 2-2h4.6l2 2H18.5a2 2 0 0 1 2 2v1' },
    ],
  },
  import: {
    paths: [
      { tag: 'path', d: 'M12 4v10' },
      { tag: 'path', d: 'm8.5 7.5 3.5-3.5 3.5 3.5' },
      { tag: 'path', d: 'M5 15.5v1.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5' },
    ],
  },
  save: {
    paths: [
      { tag: 'path', d: 'M5.5 4.5h11l2 2v13h-13z' },
      { tag: 'path', d: 'M8 4.5v5h8' },
      { tag: 'path', d: 'M8 18v-5.5h8V18' },
    ],
  },
  export: {
    paths: [
      { tag: 'path', d: 'M12 14V4' },
      { tag: 'path', d: 'm8.5 10.5 3.5 3.5 3.5-3.5' },
      { tag: 'path', d: 'M5 15.5v1.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5' },
    ],
  },
  xml: {
    paths: [
      { tag: 'path', d: 'm9 8-4 4 4 4' },
      { tag: 'path', d: 'm15 8 4 4-4 4' },
      { tag: 'path', d: 'm13.5 6-3 12' },
    ],
  },
  strings: {
    paths: [
      { tag: 'path', d: 'M6 7.5h12' },
      { tag: 'path', d: 'M6 12h12' },
      { tag: 'path', d: 'M6 16.5h8' },
      { tag: 'circle', cx: '5', cy: '7.5', r: '1', fill: 'currentColor', stroke: 'none' },
      { tag: 'circle', cx: '5', cy: '12', r: '1', fill: 'currentColor', stroke: 'none' },
      { tag: 'circle', cx: '5', cy: '16.5', r: '1', fill: 'currentColor', stroke: 'none' },
    ],
  },
  undo: {
    paths: [
      { tag: 'path', d: 'M9 7 5 11l4 4' },
      { tag: 'path', d: 'M19 17a7 7 0 0 0-7-7H5' },
    ],
  },
  redo: {
    paths: [
      { tag: 'path', d: 'm15 7 4 4-4 4' },
      { tag: 'path', d: 'M5 17a7 7 0 0 1 7-7h7' },
    ],
  },
  locate: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '3' },
      { tag: 'path', d: 'M12 4v2.5' },
      { tag: 'path', d: 'M12 17.5V20' },
      { tag: 'path', d: 'M4 12h2.5' },
      { tag: 'path', d: 'M17.5 12H20' },
    ],
  },
  duplicate: {
    paths: [
      { tag: 'rect', x: '8', y: '8', width: '10', height: '10', rx: '1.8' },
      { tag: 'path', d: 'M6.5 15.5h-1A2.5 2.5 0 0 1 3 13V5.5A2.5 2.5 0 0 1 5.5 3H13a2.5 2.5 0 0 1 2.5 2.5v1' },
    ],
  },
  delete: {
    paths: [
      { tag: 'path', d: 'M5 7h14' },
      { tag: 'path', d: 'M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7' },
      { tag: 'path', d: 'M7 7.5 8 18a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-10.5' },
      { tag: 'path', d: 'M10 10.5v5' },
      { tag: 'path', d: 'M14 10.5v5' },
    ],
  },
  success: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '8' },
      { tag: 'path', d: 'm8.5 12.3 2.2 2.2 4.8-5.1' },
    ],
  },
  warning: {
    paths: [
      { tag: 'path', d: 'M12 4.5 20 18H4z' },
      { tag: 'path', d: 'M12 9v4.2' },
      { tag: 'circle', cx: '12', cy: '16', r: '0.8', fill: 'currentColor', stroke: 'none' },
    ],
  },
  error: {
    paths: [
      { tag: 'circle', cx: '12', cy: '12', r: '8' },
      { tag: 'path', d: 'm9.2 9.2 5.6 5.6' },
      { tag: 'path', d: 'm14.8 9.2-5.6 5.6' },
    ],
  },
  close: {
    paths: [
      { tag: 'path', d: 'm7 7 10 10' },
      { tag: 'path', d: 'M17 7 7 17' },
    ],
  },
  add: {
    paths: [
      { tag: 'path', d: 'M12 5v14' },
      { tag: 'path', d: 'M5 12h14' },
    ],
  },
  share: {
    // Cloud upload icon
    paths: [
      { tag: 'path', d: 'M12 15V8' },
      { tag: 'path', d: 'm9 11 3-3 3 3' },
      { tag: 'path', d: 'M6.5 17A4.5 4.5 0 0 1 4 13a5 5 0 0 1 5-5h.5' },
      { tag: 'path', d: 'M17.5 17A4.5 4.5 0 0 0 20 13a5 5 0 0 0-5-5h-.5' },
      { tag: 'path', d: 'M8.5 19h7' },
    ],
  },
  download: {
    // Cloud download icon
    paths: [
      { tag: 'path', d: 'M12 9v7' },
      { tag: 'path', d: 'm9 13 3 3 3-3' },
      { tag: 'path', d: 'M6.5 17A4.5 4.5 0 0 1 4 13a5 5 0 0 1 5-5h.5' },
      { tag: 'path', d: 'M17.5 17A4.5 4.5 0 0 0 20 13a5 5 0 0 0-5-5h-.5' },
    ],
  },
  database: {
    // Cylinder stack (database) icon
    paths: [
      { tag: 'ellipse', cx: '12', cy: '6', rx: '8', ry: '3' },
      { tag: 'path', d: 'M4 6v4c0 1.66 3.58 3 8 3s8-1.34 8-3V6' },
      { tag: 'path', d: 'M4 10v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4' },
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
