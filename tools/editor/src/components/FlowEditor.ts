// P.A.N.D.A. Conversation Editor — Visual Flow Editor (Center Panel)

import { store } from '../lib/state';
import { setActiveFlowViewport, type FlowViewportApi } from '../lib/flow-navigation';
import type { Choice, Conversation, Turn } from '../lib/types';

type TurnPositionMap = Map<number, { x: number; y: number }>;
type EdgeKind = 'continue' | 'pause-success' | 'pause-fail';
type HighlightState = 'normal' | 'active' | 'muted';

type EdgeDescriptor = {
  sourceTurnNumber: number;
  sourceChoiceIndex: number;
  targetTurnNumber: number;
  label: string;
  color: string;
  pathClassName: string;
  textClassName: string;
  offsetIndex: number;
  highlight: HighlightState;
};

type ContentBounds = {
  width: number;
  height: number;
};

type ViewState = {
  panX: number;
  panY: number;
  zoom: number;
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 160;
const CONTENT_PADDING = 80;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.8;
const DEFAULT_VIEW_STATE: ViewState = {
  panX: 40,
  panY: 40,
  zoom: 1,
};
const viewStateByConversation = new Map<number, ViewState>();

export function renderFlowEditor(container: HTMLElement): void {
  const conv = store.getSelectedConversation();
  const state = store.get();

  if (!conv) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#9655;</div>
        <div class="empty-state-text">Select a conversation</div>
        <div class="empty-state-hint">Choose from the list on the left, or create a new one.</div>
      </div>
    `;
    return;
  }

  const existingView = viewStateByConversation.get(conv.id);
  const viewState: ViewState = existingView ? { ...existingView } : { ...DEFAULT_VIEW_STATE };
  const bounds = calculateContentBounds(conv);
  const edges = buildEdgeDescriptors(conv, state.selectedTurnNumber, state.selectedChoiceIndex);

  const shell = document.createElement('div');
  shell.className = 'flow-shell';

  const canvas = document.createElement('div');
  canvas.className = 'flow-canvas';

  const content = document.createElement('div');
  content.className = 'flow-content';
  content.style.width = `${bounds.width}px`;
  content.style.height = `${bounds.height}px`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('flow-edges');
  svg.setAttribute('width', String(bounds.width));
  svg.setAttribute('height', String(bounds.height));

  let viewAdjusted = false;

  const zoomValue = document.createElement('span');
  zoomValue.className = 'flow-zoom-value';

  const minimapViewport = document.createElement('div');
  minimapViewport.className = 'flow-minimap-viewport';

  const minimapNodes = document.createElement('div');
  minimapNodes.className = 'flow-minimap-nodes';

  drawEdges(svg, conv, edges);
  content.appendChild(svg);

  for (const turn of conv.turns) {
    const node = renderTurnNode(
      conv,
      turn,
      state.selectedTurnNumber === turn.turnNumber,
      svg,
      viewState,
      edges,
    );
    content.appendChild(node);

    const miniNode = document.createElement('button');
    miniNode.type = 'button';
    miniNode.className = 'flow-minimap-node' + (state.selectedTurnNumber === turn.turnNumber ? ' selected' : '');
    miniNode.style.left = `${(turn.position.x / bounds.width) * 100}%`;
    miniNode.style.top = `${(turn.position.y / bounds.height) * 100}%`;
    miniNode.title = `Center Turn ${turn.turnNumber}`;
    miniNode.onclick = (e) => {
      e.stopPropagation();
      store.selectTurn(turn.turnNumber);
      centerTurn(turn.turnNumber);
    };
    minimapNodes.appendChild(miniNode);
  }

  const controls = renderControls({
    zoomValue,
    onZoomIn: () => zoomAtViewportPoint(canvas, viewState, 1.12, canvas.clientWidth / 2, canvas.clientHeight / 2, applyView),
    onZoomOut: () => zoomAtViewportPoint(canvas, viewState, 1 / 1.12, canvas.clientWidth / 2, canvas.clientHeight / 2, applyView),
    onFit: () => fitContent(),
    onReset: () => resetView(),
  });

  const minimap = renderMinimap({
    viewport: minimapViewport,
    nodes: minimapNodes,
    bounds,
    onNavigate: (event) => {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const targetWorldX = ((event.clientX - rect.left) / rect.width) * bounds.width;
      const targetWorldY = ((event.clientY - rect.top) / rect.height) * bounds.height;
      centerWorldPoint(targetWorldX, targetWorldY);
    },
    onFit: () => fitContent(),
  });

  canvas.appendChild(content);
  shell.appendChild(canvas);
  shell.appendChild(controls);
  shell.appendChild(minimap);
  container.appendChild(shell);

  const applyView = (): void => {
    content.style.transform = `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`;
    zoomValue.textContent = `${Math.round(viewState.zoom * 100)}%`;
    updateMinimapViewport(bounds, canvas, viewState, minimapViewport);
    viewStateByConversation.set(conv.id, { ...viewState });
  };

  const centerWorldPoint = (worldX: number, worldY: number, animate = true): void => {
    const nextPanX = canvas.clientWidth / 2 - worldX * viewState.zoom;
    const nextPanY = canvas.clientHeight / 2 - worldY * viewState.zoom;

    viewAdjusted = true;

    if (animate) {
      content.classList.add('animated-view');
      window.setTimeout(() => content.classList.remove('animated-view'), 180);
    }

    viewState.panX = nextPanX;
    viewState.panY = nextPanY;
    applyView();
  };

  const centerTurn = (turnNumber: number, animate = true): void => {
    const targetTurn = conv.turns.find(item => item.turnNumber === turnNumber);
    if (!targetTurn) return;

    centerWorldPoint(targetTurn.position.x + NODE_WIDTH / 2, targetTurn.position.y + NODE_HEIGHT / 2, animate);
  };

  const fitContent = (animate = true): void => {
    viewAdjusted = true;
    const availableWidth = Math.max(canvas.clientWidth - 40, 240);
    const availableHeight = Math.max(canvas.clientHeight - 40, 180);
    const zoom = clamp(Math.min(availableWidth / bounds.width, availableHeight / bounds.height), MIN_ZOOM, MAX_ZOOM);

    viewState.zoom = zoom;
    viewState.panX = (canvas.clientWidth - bounds.width * zoom) / 2;
    viewState.panY = (canvas.clientHeight - bounds.height * zoom) / 2;

    if (animate) {
      content.classList.add('animated-view');
      window.setTimeout(() => content.classList.remove('animated-view'), 180);
    }

    applyView();
  };

  const resetView = (animate = true): void => {
    viewAdjusted = true;

    if (animate) {
      content.classList.add('animated-view');
      window.setTimeout(() => content.classList.remove('animated-view'), 180);
    }

    viewState.panX = DEFAULT_VIEW_STATE.panX;
    viewState.panY = DEFAULT_VIEW_STATE.panY;
    viewState.zoom = DEFAULT_VIEW_STATE.zoom;
    applyView();
  };

  const viewportApi: FlowViewportApi = {
    centerTurn: (turnNumber, options) => centerTurn(turnNumber, options?.animate ?? true),
    fitContent: (options) => fitContent(options?.animate ?? true),
    resetView: (options) => resetView(options?.animate ?? true),
  };

  setActiveFlowViewport(conv.id, viewportApi);

  wireCanvasInteractions({
    canvas,
    viewState,
    applyView,
    onBackgroundClick: () => store.selectTurn(null),
  });

  applyView();

  requestAnimationFrame(() => {
    if (!existingView && !viewAdjusted) {
      fitContent(false);
      return;
    }
    applyView();
  });
}

function renderControls(options: {
  zoomValue: HTMLElement;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}): HTMLElement {
  const controls = document.createElement('div');
  controls.className = 'flow-controls';

  const zoomOut = document.createElement('button');
  zoomOut.type = 'button';
  zoomOut.className = 'btn-sm';
  zoomOut.textContent = '−';
  zoomOut.title = 'Zoom out';
  zoomOut.onclick = options.onZoomOut;

  const zoomIn = document.createElement('button');
  zoomIn.type = 'button';
  zoomIn.className = 'btn-sm';
  zoomIn.textContent = '+';
  zoomIn.title = 'Zoom in';
  zoomIn.onclick = options.onZoomIn;

  const fit = document.createElement('button');
  fit.type = 'button';
  fit.className = 'btn-sm';
  fit.textContent = 'Fit';
  fit.title = 'Fit conversation to viewport';
  fit.onclick = options.onFit;

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'btn-sm';
  reset.textContent = 'Reset';
  reset.title = 'Reset pan and zoom';
  reset.onclick = options.onReset;

  controls.append(zoomOut, options.zoomValue, zoomIn, fit, reset);
  return controls;
}

function renderMinimap(options: {
  viewport: HTMLElement;
  nodes: HTMLElement;
  bounds: ContentBounds;
  onNavigate: (event: MouseEvent) => void;
  onFit: () => void;
}): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'flow-minimap';

  const header = document.createElement('div');
  header.className = 'flow-minimap-header';

  const title = document.createElement('span');
  title.textContent = 'Overview';

  const fitButton = document.createElement('button');
  fitButton.type = 'button';
  fitButton.className = 'btn-sm';
  fitButton.textContent = 'Fit';
  fitButton.title = 'Fit content to view';
  fitButton.onclick = options.onFit;

  header.append(title, fitButton);

  const body = document.createElement('button');
  body.type = 'button';
  body.className = 'flow-minimap-body';
  body.onclick = options.onNavigate;

  const frame = document.createElement('div');
  frame.className = 'flow-minimap-frame';
  frame.style.aspectRatio = `${Math.max(options.bounds.width, 1)} / ${Math.max(options.bounds.height, 1)}`;
  frame.append(options.nodes, options.viewport);
  body.appendChild(frame);

  panel.append(header, body);
  return panel;
}

function calculateContentBounds(conv: Conversation): ContentBounds {
  if (conv.turns.length === 0) {
    return {
      width: 400,
      height: 300,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = 0;
  let maxY = 0;

  for (const turn of conv.turns) {
    minX = Math.min(minX, turn.position.x);
    minY = Math.min(minY, turn.position.y);
    maxX = Math.max(maxX, turn.position.x + NODE_WIDTH);
    maxY = Math.max(maxY, turn.position.y + NODE_HEIGHT);
  }

  return {
    width: Math.max(400, maxX + CONTENT_PADDING),
    height: Math.max(300, maxY + CONTENT_PADDING),
  };
}

function renderTurnNode(
  conv: Conversation,
  turn: Turn,
  selected: boolean,
  edgeLayer: SVGSVGElement,
  viewState: ViewState,
  edges: EdgeDescriptor[],
): HTMLElement {
  const state = store.get();
  const hasWarning = turn.choices.some(c => !c.text && !c.reply);
  const isPathActive = edges.some(edge => edge.highlight === 'active' && (edge.sourceTurnNumber === turn.turnNumber || edge.targetTurnNumber === turn.turnNumber));
  const node = document.createElement('div');
  node.className = 'turn-node'
    + (selected ? ' selected' : '')
    + (hasWarning ? ' has-warning' : '')
    + (isPathActive ? ' path-active' : '');
  node.style.left = `${turn.position.x}px`;
  node.style.top = `${turn.position.y}px`;
  node.onclick = (e) => {
    e.stopPropagation();
    store.selectTurn(turn.turnNumber);
  };

  let dragPosition: { x: number; y: number } | null = null;

  node.onmousedown = (e) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.turn-choice-item')) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = turn.position.x;
    const origY = turn.position.y;
    const transientPositions: TurnPositionMap = new Map();
    e.preventDefault();
    e.stopPropagation();

    const onMove = (ev: MouseEvent) => {
      const nextPosition = {
        x: Math.max(0, origX + (ev.clientX - startX) / viewState.zoom),
        y: Math.max(0, origY + (ev.clientY - startY) / viewState.zoom),
      };

      dragPosition = nextPosition;
      transientPositions.set(turn.turnNumber, nextPosition);
      node.style.left = `${nextPosition.x}px`;
      node.style.top = `${nextPosition.y}px`;
      drawEdges(edgeLayer, conv, edges, transientPositions);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      if (!dragPosition) return;
      store.updateTurnPosition(conv.id, turn.turnNumber, dragPosition);
      dragPosition = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const header = document.createElement('div');
  header.className = 'turn-header';
  const label = document.createElement('span');
  label.className = 'turn-label';
  label.textContent = `Turn ${turn.turnNumber}`;
  header.appendChild(label);

  if (turn.turnNumber > 1) {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-sm';
    delBtn.textContent = '\u00d7';
    delBtn.title = 'Delete turn';
    delBtn.style.color = 'var(--danger)';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      store.deleteTurn(conv.id, turn.turnNumber);
    };
    header.appendChild(delBtn);
  }
  node.appendChild(header);

  const body = document.createElement('div');
  body.className = 'turn-body';

  if (turn.turnNumber === 1 && turn.openingMessage) {
    const msg = document.createElement('div');
    msg.className = 'turn-message';
    msg.textContent = turn.openingMessage.substring(0, 80) + (turn.openingMessage.length > 80 ? '...' : '');
    body.appendChild(msg);
  }

  const choicesList = document.createElement('ul');
  choicesList.className = 'turn-choices-list';
  for (const choice of turn.choices) {
    const item = document.createElement('li');
    const choiceActive = selected && state.selectedChoiceIndex === choice.index;
    item.className = 'turn-choice-item' + (choiceActive ? ' selected' : '');
    item.onclick = (e) => {
      e.stopPropagation();
      store.selectTurn(turn.turnNumber);
      store.selectChoice(choice.index);
    };

    const num = document.createElement('span');
    num.className = 'choice-number';
    num.textContent = String(choice.index);

    const preview = document.createElement('span');
    preview.className = 'choice-preview';
    preview.textContent = choice.text || '(empty)';

    item.append(num, preview);

    if (choice.continueTo != null) {
      const badge = document.createElement('span');
      badge.className = 'choice-cont-badge';
      badge.textContent = `T${choice.continueTo}`;
      item.appendChild(badge);
    }

    if (hasPauseOutcome(choice)) {
      const pauseBadge = document.createElement('span');
      pauseBadge.className = 'choice-branch-badge';
      pauseBadge.textContent = 'pause';
      item.appendChild(pauseBadge);
    }

    choicesList.appendChild(item);
  }
  body.appendChild(choicesList);

  node.appendChild(body);
  return node;
}

function getTurnPosition(turn: Turn, positionOverrides?: TurnPositionMap): { x: number; y: number } {
  return positionOverrides?.get(turn.turnNumber) ?? turn.position;
}

function drawEdges(
  svg: SVGSVGElement,
  conv: Conversation,
  edges: EdgeDescriptor[],
  positionOverrides?: TurnPositionMap,
): void {
  svg.replaceChildren();

  for (const edge of edges) {
    const sourceTurn = conv.turns.find(turn => turn.turnNumber === edge.sourceTurnNumber);
    const targetTurn = conv.turns.find(turn => turn.turnNumber === edge.targetTurnNumber);
    if (!sourceTurn || !targetTurn) continue;

    const sourcePosition = getTurnPosition(sourceTurn, positionOverrides);
    const targetPosition = getTurnPosition(targetTurn, positionOverrides);
    const x1 = sourcePosition.x + NODE_WIDTH;
    const y1 = sourcePosition.y + 40 + edge.sourceChoiceIndex * 25;
    const x2 = targetPosition.x;
    const y2 = targetPosition.y + 34;
    const dx = x2 - x1;
    const midX = x1 + dx / 2;
    const verticalOffset = edge.offsetIndex * 18;
    const controlX = midX;
    const pathData = `M${x1},${y1} C${controlX},${y1 + verticalOffset} ${controlX},${y2 + verticalOffset} ${x2},${y2}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', edge.color);
    path.setAttribute('class', `flow-edge-path ${edge.pathClassName} ${edge.highlight !== 'normal' ? `is-${edge.highlight}` : ''}`.trim());
    svg.appendChild(path);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(midX));
    label.setAttribute('y', String((y1 + y2) / 2 + verticalOffset - 8));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', `flow-edge-label ${edge.textClassName} ${edge.highlight !== 'normal' ? `is-${edge.highlight}` : ''}`.trim());
    label.textContent = edge.label;
    svg.appendChild(label);
  }
}

function buildEdgeDescriptors(
  conv: Conversation,
  selectedTurnNumber: number | null,
  selectedChoiceIndex: number | null,
): EdgeDescriptor[] {
  const edges: EdgeDescriptor[] = [];
  const pairCounts = new Map<string, number>();

  for (const turn of conv.turns) {
    for (const choice of turn.choices) {
      const targets = getChoiceTargets(choice);
      for (const target of targets) {
        const pairKey = `${turn.turnNumber}:${target.turnNumber}`;
        const offsetIndex = pairCounts.get(pairKey) ?? 0;
        pairCounts.set(pairKey, offsetIndex + 1);

        edges.push({
          sourceTurnNumber: turn.turnNumber,
          sourceChoiceIndex: choice.index,
          targetTurnNumber: target.turnNumber,
          label: target.label,
          color: target.color,
          pathClassName: `edge-${target.kind}`,
          textClassName: `edge-label-${target.kind}`,
          offsetIndex: spreadOffset(offsetIndex),
          highlight: getEdgeHighlightState(turn.turnNumber, choice.index, target.turnNumber, selectedTurnNumber, selectedChoiceIndex),
        });
      }
    }
  }

  return edges;
}

function getChoiceTargets(choice: Choice): Array<{ turnNumber: number; label: string; color: string; kind: EdgeKind }> {
  const targets: Array<{ turnNumber: number; label: string; color: string; kind: EdgeKind }> = [];

  if (choice.continueTo != null) {
    targets.push({
      turnNumber: choice.continueTo,
      label: `C${choice.index}`,
      color: 'var(--edge-color)',
      kind: 'continue',
    });
  }

  for (const outcome of choice.outcomes) {
    if (outcome.command !== 'pause_job') continue;

    const successTurn = parseInt(outcome.params[1], 10);
    const failTurn = parseInt(outcome.params[2], 10);

    if (!Number.isNaN(successTurn)) {
      targets.push({
        turnNumber: successTurn,
        label: 'ok',
        color: 'var(--accent)',
        kind: 'pause-success',
      });
    }

    if (!Number.isNaN(failTurn)) {
      targets.push({
        turnNumber: failTurn,
        label: 'fail',
        color: 'var(--danger)',
        kind: 'pause-fail',
      });
    }
  }

  return targets;
}

function getEdgeHighlightState(
  sourceTurnNumber: number,
  sourceChoiceIndex: number,
  targetTurnNumber: number,
  selectedTurnNumber: number | null,
  selectedChoiceIndex: number | null,
): HighlightState {
  if (selectedTurnNumber == null) return 'normal';

  if (selectedChoiceIndex != null) {
    return sourceTurnNumber === selectedTurnNumber && sourceChoiceIndex === selectedChoiceIndex ? 'active' : 'muted';
  }

  return sourceTurnNumber === selectedTurnNumber || targetTurnNumber === selectedTurnNumber ? 'active' : 'muted';
}

function hasPauseOutcome(choice: Choice): boolean {
  return choice.outcomes.some(outcome => outcome.command === 'pause_job');
}

function wireCanvasInteractions(options: {
  canvas: HTMLElement;
  viewState: ViewState;
  applyView: () => void;
  onBackgroundClick: () => void;
}): void {
  const { canvas, viewState, applyView, onBackgroundClick } = options;

  canvas.onmousedown = (event) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 && event.button !== 1) return;
    if (target.closest('.turn-node, .flow-controls, .flow-minimap')) return;

    const startPanX = event.clientX;
    const startPanY = event.clientY;
    const originPanX = viewState.panX;
    const originPanY = viewState.panY;
    let moved = false;

    canvas.classList.add('is-panning');
    event.preventDefault();

    const onMove = (moveEvent: MouseEvent) => {
      moved = true;
      viewState.panX = originPanX + (moveEvent.clientX - startPanX);
      viewState.panY = originPanY + (moveEvent.clientY - startPanY);
      applyView();
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      canvas.classList.remove('is-panning');
      if (!moved) onBackgroundClick();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  canvas.onwheel = (event) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 1 / 1.1 : 1.1;
    const rect = canvas.getBoundingClientRect();
    zoomAtViewportPoint(canvas, viewState, factor, event.clientX - rect.left, event.clientY - rect.top, applyView);
  };
}

function zoomAtViewportPoint(
  canvas: HTMLElement,
  viewState: ViewState,
  factor: number,
  offsetX: number,
  offsetY: number,
  applyView: () => void,
): void {
  const nextZoom = clamp(viewState.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  if (nextZoom === viewState.zoom) return;

  const worldX = (offsetX - viewState.panX) / viewState.zoom;
  const worldY = (offsetY - viewState.panY) / viewState.zoom;

  viewState.zoom = nextZoom;
  viewState.panX = offsetX - worldX * nextZoom;
  viewState.panY = offsetY - worldY * nextZoom;
  applyView();
}

function updateMinimapViewport(
  bounds: ContentBounds,
  canvas: HTMLElement,
  viewState: ViewState,
  minimapViewport: HTMLElement,
): void {
  const worldLeft = Math.max(0, -viewState.panX / viewState.zoom);
  const worldTop = Math.max(0, -viewState.panY / viewState.zoom);
  const worldWidth = Math.min(bounds.width, canvas.clientWidth / viewState.zoom);
  const worldHeight = Math.min(bounds.height, canvas.clientHeight / viewState.zoom);

  minimapViewport.style.left = `${(worldLeft / bounds.width) * 100}%`;
  minimapViewport.style.top = `${(worldTop / bounds.height) * 100}%`;
  minimapViewport.style.width = `${(worldWidth / bounds.width) * 100}%`;
  minimapViewport.style.height = `${(worldHeight / bounds.height) * 100}%`;
}

function spreadOffset(index: number): number {
  if (index === 0) return 0;
  const magnitude = Math.ceil(index / 2);
  return index % 2 === 0 ? magnitude : -magnitude;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
