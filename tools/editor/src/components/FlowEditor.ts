// P.A.N.D.A. Conversation Editor — Visual Flow Editor (Center Panel)

import { store } from '../lib/state';
import { setActiveFlowViewport, type FlowViewportApi } from '../lib/flow-navigation';
import { createTurnDisplayLabeler } from '../lib/turn-labels';
import type { Choice, Conversation, Turn } from '../lib/types';
import type { FlowDensity } from '../lib/state';

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
  kind: EdgeKind;
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

type ConnectionPreview = {
  sourceTurnNumber: number;
  sourceChoiceIndex: number;
  cursor: { x: number; y: number };
};

type NodeLayout = {
  width: number;
  messageChars: number;
  previewLines: number;
  minHeight: number;
};

const NODE_LAYOUTS: Record<FlowDensity, NodeLayout> = {
  compact: { width: 210, messageChars: 52, previewLines: 1, minHeight: 106 },
  standard: { width: 260, messageChars: 100, previewLines: 1, minHeight: 140 },
  detailed: { width: 320, messageChars: 180, previewLines: 3, minHeight: 200 },
};

/** Default branch color palette — automatically assigned by turn index. */
const BRANCH_PALETTE = [
  '#5eaa3a', // green (default accent)
  '#4a90d9', // blue
  '#d4783a', // orange
  '#9b59b6', // purple
  '#e0c040', // gold
  '#3abfbf', // teal
  '#d95b5b', // rose
  '#7ec850', // lime
];
const CONTENT_PADDING = 120;
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
  const density = state.flowDensity;
  const layout = NODE_LAYOUTS[density];

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

  const conversationId = conv.id;
  const turnLabels = createTurnDisplayLabeler(conv);
  const existingView = viewStateByConversation.get(conversationId);
  const viewState: ViewState = existingView ? { ...existingView } : { ...DEFAULT_VIEW_STATE };
  const bounds = calculateContentBounds(conv, density);
  const edges = buildEdgeDescriptors(conv, state.selectedTurnNumber, state.selectedChoiceIndex);
  const nodeElements = new Map<number, HTMLElement>();

  const shell = document.createElement('div');
  shell.className = `flow-shell density-${density}`;

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
  svg.appendChild(createMarkerDefs());

  let viewAdjusted = false;
  let connectionPreview: ConnectionPreview | null = null;

  const zoomValue = document.createElement('span');
  zoomValue.className = 'flow-zoom-value';

  const minimapViewport = document.createElement('div');
  minimapViewport.className = 'flow-minimap-viewport';

  const minimapNodes = document.createElement('div');
  minimapNodes.className = 'flow-minimap-nodes';

  content.appendChild(svg);

  for (const turn of conv.turns) {
    const node = renderTurnNode({
      conv,
      turn,
      selected: state.selectedTurnNumber === turn.turnNumber,
      edges,
      density,
      viewState,
      turnLabels,
      onPreviewPosition: (previewPositions) => draw(previewPositions),
      onChoicePortDragStart: (choiceIndex, event) => {
        store.selectTurn(turn.turnNumber);
        store.selectChoice(choiceIndex);
        startConnectionDrag(turn.turnNumber, choiceIndex, event);
      },
    });
    nodeElements.set(turn.turnNumber, node);
    content.appendChild(node);

    const miniNode = document.createElement('button');
    miniNode.type = 'button';
    miniNode.className = 'flow-minimap-node' + (state.selectedTurnNumber === turn.turnNumber ? ' selected' : '');
    miniNode.style.left = `${(turn.position.x / bounds.width) * 100}%`;
    miniNode.style.top = `${(turn.position.y / bounds.height) * 100}%`;
    miniNode.title = `Center ${turnLabels.getLongLabel(turn.turnNumber)}`;
    miniNode.onclick = (e) => {
      e.stopPropagation();
      store.selectTurn(turn.turnNumber);
      centerTurn(turn.turnNumber);
    };
    minimapNodes.appendChild(miniNode);
  }

  const draw = (positionOverrides?: TurnPositionMap): void => {
    drawEdges({
      svg,
      conv,
      edges,
      nodeElements,
      positionOverrides,
      preview: connectionPreview,
      turnLabels,
    });
  };

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
    viewStateByConversation.set(conversationId, { ...viewState });
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

    centerWorldPoint(targetTurn.position.x + layout.width / 2, targetTurn.position.y + getNodeHeight(targetTurn, density) / 2, animate);
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

  function startConnectionDrag(sourceTurnNumber: number, sourceChoiceIndex: number, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    connectionPreview = {
      sourceTurnNumber,
      sourceChoiceIndex,
      cursor: viewportToWorldPoint(canvas, viewState, event.clientX, event.clientY),
    };
    draw();

    const onMove = (moveEvent: MouseEvent) => {
      connectionPreview = {
        sourceTurnNumber,
        sourceChoiceIndex,
        cursor: viewportToWorldPoint(canvas, viewState, moveEvent.clientX, moveEvent.clientY),
      };
      draw();
    };

    const onUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      const targetNode = (upEvent.target as HTMLElement | null)?.closest('.turn-node') as HTMLElement | null;
      if (targetNode) {
        const targetTurn = Number(targetNode.dataset.turnNumber);
        if (!Number.isNaN(targetTurn) && targetTurn !== sourceTurnNumber) {
          store.connectChoiceToTurn(conversationId, sourceTurnNumber, sourceChoiceIndex, targetTurn);
        }
      }

      connectionPreview = null;
      draw();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  const viewportApi: FlowViewportApi = {
    centerTurn: (turnNumber, options) => centerTurn(turnNumber, options?.animate ?? true),
    fitContent: (options) => fitContent(options?.animate ?? true),
    resetView: (options) => resetView(options?.animate ?? true),
  };

  setActiveFlowViewport(conversationId, viewportApi);

  wireCanvasInteractions({
    canvas,
    viewState,
    applyView,
    onBackgroundClick: () => store.selectTurn(null),
  });

  draw();
  applyView();

  requestAnimationFrame(() => {
    draw();
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

function calculateContentBounds(conv: Conversation, density: FlowDensity): ContentBounds {
  const layout = NODE_LAYOUTS[density];

  if (conv.turns.length === 0) {
    return {
      width: 400,
      height: 300,
    };
  }

  let maxX = 0;
  let maxY = 0;

  for (const turn of conv.turns) {
    maxX = Math.max(maxX, turn.position.x + layout.width);
    maxY = Math.max(maxY, turn.position.y + getNodeHeight(turn, density));
  }

  return {
    width: Math.max(420, maxX + CONTENT_PADDING),
    height: Math.max(320, maxY + CONTENT_PADDING),
  };
}

function getBranchColor(turn: Turn, turnIndex: number): string {
  return turn.color || BRANCH_PALETTE[turnIndex % BRANCH_PALETTE.length];
}

function renderTurnNode(options: {
  conv: Conversation;
  turn: Turn;
  selected: boolean;
  edges: EdgeDescriptor[];
  density: FlowDensity;
  viewState: ViewState;
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>;
  onPreviewPosition: (positions?: TurnPositionMap) => void;
  onChoicePortDragStart: (choiceIndex: number, event: MouseEvent) => void;
}): HTMLElement {
  const { conv, turn, selected, edges, density, viewState, turnLabels, onPreviewPosition, onChoicePortDragStart } = options;
  const state = store.get();
  const layout = NODE_LAYOUTS[density];
  const hasWarning = turn.choices.some(c => !c.text && !c.reply);
  const isPathActive = edges.some(edge => edge.highlight === 'active' && (edge.sourceTurnNumber === turn.turnNumber || edge.targetTurnNumber === turn.turnNumber));
  const turnIndex = conv.turns.indexOf(turn);
  const branchColor = getBranchColor(turn, turnIndex);

  const node = document.createElement('div');
  node.className = 'turn-node'
    + (selected ? ' selected' : '')
    + (hasWarning ? ' has-warning' : '')
    + (isPathActive ? ' path-active' : '');
  node.dataset.turnNumber = String(turn.turnNumber);
  node.style.left = `${turn.position.x}px`;
  node.style.top = `${turn.position.y}px`;
  node.style.width = `${layout.width}px`;
  node.style.setProperty('--branch-color', branchColor);
  node.style.setProperty('--branch-glow', branchColor + '40');
  node.onclick = (e) => {
    e.stopPropagation();
    store.selectTurn(turn.turnNumber);
  };

  let dragPosition: { x: number; y: number } | null = null;

  node.onmousedown = (e) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.turn-choice-item, .choice-output-port, .turn-input-port, .turn-label-input, .turn-color-input')) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = turn.position.x;
    const origY = turn.position.y;
    e.preventDefault();
    e.stopPropagation();

    const onMove = (ev: MouseEvent) => {
      const nextPosition = {
        x: Math.max(0, origX + (ev.clientX - startX) / viewState.zoom),
        y: Math.max(0, origY + (ev.clientY - startY) / viewState.zoom),
      };
      dragPosition = nextPosition;
      node.style.left = `${nextPosition.x}px`;
      node.style.top = `${nextPosition.y}px`;
      onPreviewPosition(new Map([[turn.turnNumber, nextPosition]]));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      onPreviewPosition();
      if (!dragPosition) return;
      store.updateTurnPosition(conv.id, turn.turnNumber, dragPosition);
      dragPosition = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const inputPort = document.createElement('button');
  inputPort.type = 'button';
  inputPort.className = 'turn-input-port';
  inputPort.title = `Incoming connections for ${turnLabels.getLongLabel(turn.turnNumber)}`;
  inputPort.style.background = `linear-gradient(180deg, ${branchColor}cc, ${branchColor}99)`;
  inputPort.onclick = (event) => {
    event.stopPropagation();
    store.selectTurn(turn.turnNumber);
  };
  node.appendChild(inputPort);

  // ── Header ──
  const header = document.createElement('div');
  header.className = 'turn-header';

  // Editable label: click to rename
  const labelSpan = document.createElement('span');
  labelSpan.className = 'turn-label';
  labelSpan.textContent = turnLabels.getLongLabel(turn.turnNumber);
  labelSpan.title = 'Click to rename this branch';
  labelSpan.style.cursor = 'pointer';
  labelSpan.onclick = (e) => {
    e.stopPropagation();
    labelSpan.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'turn-label-input';
    input.value = turn.customLabel || '';
    input.placeholder = `Branch ${turn.turnNumber}`;
    input.maxLength = 32;
    const commitEdit = () => {
      store.setTurnCustomLabel(conv.id, turn.turnNumber, input.value);
    };
    input.onblur = commitEdit;
    input.onkeydown = (ke) => {
      if (ke.key === 'Enter') { commitEdit(); }
      if (ke.key === 'Escape') { input.value = turn.customLabel || ''; input.blur(); }
      ke.stopPropagation();
    };
    header.insertBefore(input, labelSpan.nextSibling);
    input.focus();
    input.select();
  };
  header.appendChild(labelSpan);

  // Color picker (small dot, click to change branch color)
  const colorDot = document.createElement('input');
  colorDot.type = 'color';
  colorDot.className = 'turn-color-input';
  colorDot.value = branchColor;
  colorDot.title = 'Change branch color';
  colorDot.onchange = (e) => {
    e.stopPropagation();
    store.setTurnColor(conv.id, turn.turnNumber, colorDot.value);
  };
  colorDot.onclick = (e) => e.stopPropagation();
  header.appendChild(colorDot);

  const stats = document.createElement('span');
  stats.className = 'turn-stats';
  const outgoingCount = turn.choices.filter(choice => choice.continueTo != null || hasPauseOutcome(choice)).length;
  stats.textContent = `${turn.choices.length}C · ${outgoingCount}L`;
  header.appendChild(stats);

  if (turn.turnNumber > 1) {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-sm';
    delBtn.textContent = '×';
    delBtn.title = 'Delete turn';
    delBtn.style.color = 'var(--danger)';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      store.deleteTurn(conv.id, turn.turnNumber);
    };
    header.appendChild(delBtn);
  }
  node.appendChild(header);

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'turn-body';

  // Opening message (NPC message)
  if (turn.openingMessage && density !== 'compact') {
    const msg = document.createElement('div');
    msg.className = 'turn-message turn-npc-message';
    msg.textContent = truncate(turn.openingMessage, layout.messageChars);
    body.appendChild(msg);
  }

  // ── Choices ──
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

    const port = document.createElement('button');
    port.type = 'button';
    port.className = 'choice-output-port';
    port.dataset.choicePort = String(choice.index);
    port.title = choice.continueTo != null
      ? `Drag to change destination for Choice ${choice.index}`
      : `Drag to connect Choice ${choice.index} to another turn`;
    port.style.background = `linear-gradient(180deg, ${branchColor}cc, ${branchColor}80)`;
    port.onmousedown = (event) => onChoicePortDragStart(choice.index, event);

    const num = document.createElement('span');
    num.className = 'choice-number';
    num.textContent = String(choice.index);

    // Player dialogue text
    const preview = document.createElement('span');
    preview.className = 'choice-preview';
    preview.textContent = choice.text || '(empty)';
    preview.style.setProperty('-webkit-line-clamp', String(layout.previewLines));

    item.append(port, num, preview);

    // Badges
    if (choice.continueTo != null) {
      const badge = document.createElement('span');
      badge.className = 'choice-cont-badge';
      badge.textContent = turnLabels.getCompactLabel(choice.continueTo);
      // Color the badge to match the destination branch
      const targetTurn = conv.turns.find(t => t.turnNumber === choice.continueTo);
      if (targetTurn) {
        const targetIndex = conv.turns.indexOf(targetTurn);
        const targetColor = getBranchColor(targetTurn, targetIndex);
        badge.style.setProperty('--badge-branch-color', targetColor);
      }
      item.appendChild(badge);
    }

    if (hasPauseOutcome(choice)) {
      const pauseBadge = document.createElement('span');
      pauseBadge.className = 'choice-branch-badge';
      pauseBadge.textContent = 'pause';
      item.appendChild(pauseBadge);
    }

    // Outcomes count (standard/detailed only)
    if (density !== 'compact' && choice.outcomes.length > 0) {
      const outBadge = document.createElement('span');
      outBadge.className = 'choice-outcome-badge';
      outBadge.textContent = `${choice.outcomes.length} out`;
      item.appendChild(outBadge);
    }

    choicesList.appendChild(item);

    // NPC Reply — show below player choice in standard/detailed modes
    if (choice.reply && density !== 'compact') {
      const replyRow = document.createElement('li');
      replyRow.className = 'turn-npc-reply';
      replyRow.onclick = (e) => {
        e.stopPropagation();
        store.selectTurn(turn.turnNumber);
        store.selectChoice(choice.index);
      };
      const replyIcon = document.createElement('span');
      replyIcon.className = 'npc-reply-icon';
      replyIcon.textContent = 'NPC';
      const replyText = document.createElement('span');
      replyText.className = 'npc-reply-text';
      replyText.textContent = truncate(choice.reply, density === 'detailed' ? layout.messageChars : 60);
      replyRow.append(replyIcon, replyText);
      choicesList.appendChild(replyRow);
    }
  }
  body.appendChild(choicesList);

  // ── Footer info (detailed mode) ──
  if (density === 'detailed') {
    const footer = document.createElement('div');
    footer.className = 'turn-footer';
    const precondCount = conv.preconditions.length;
    const totalOutcomes = turn.choices.reduce((s, c) => s + c.outcomes.length, 0);
    footer.textContent = `${turn.choices.length} choice${turn.choices.length !== 1 ? 's' : ''} · ${outgoingCount} link${outgoingCount !== 1 ? 's' : ''} · ${totalOutcomes} outcome${totalOutcomes !== 1 ? 's' : ''}`;
    if (turn.turnNumber === 1 && precondCount > 0) {
      footer.textContent += ` · ${precondCount} precond`;
    }
    body.appendChild(footer);
  }

  node.appendChild(body);
  return node;
}

function drawEdges(options: {
  svg: SVGSVGElement;
  conv: Conversation;
  edges: EdgeDescriptor[];
  nodeElements: Map<number, HTMLElement>;
  positionOverrides?: TurnPositionMap;
  preview: ConnectionPreview | null;
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>;
}): void {
  const { svg, conv, edges, nodeElements, positionOverrides, preview, turnLabels } = options;
  const defs = svg.querySelector('defs');
  svg.replaceChildren();
  if (defs) svg.appendChild(defs);

  for (const edge of edges) {
    const sourceTurn = conv.turns.find(turn => turn.turnNumber === edge.sourceTurnNumber);
    const targetTurn = conv.turns.find(turn => turn.turnNumber === edge.targetTurnNumber);
    if (!sourceTurn || !targetTurn) continue;

    const sourceAnchor = getChoiceAnchor(edge.sourceTurnNumber, edge.sourceChoiceIndex, conv, nodeElements, positionOverrides);
    const targetAnchor = getTurnInputAnchor(edge.targetTurnNumber, conv, nodeElements, positionOverrides);
    if (!sourceAnchor || !targetAnchor) continue;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', `flow-edge ${edge.highlight !== 'normal' ? `is-${edge.highlight}` : ''}`.trim());

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', buildEdgePath(sourceAnchor, targetAnchor, edge.offsetIndex));
    path.setAttribute('stroke', edge.color);
    path.setAttribute('class', `flow-edge-path ${edge.pathClassName} ${edge.highlight !== 'normal' ? `is-${edge.highlight}` : ''}`.trim());
    path.setAttribute('marker-end', `url(#marker-${edge.kind})`);
    path.dataset.sourceTurnNumber = String(edge.sourceTurnNumber);
    path.dataset.sourceChoiceIndex = String(edge.sourceChoiceIndex);
    path.dataset.targetTurnNumber = String(edge.targetTurnNumber);
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = edge.kind === 'continue'
      ? `Choice ${edge.sourceChoiceIndex} → ${turnLabels.getLongLabel(edge.targetTurnNumber)} (click to select, right-click to disconnect)`
      : `Pause branch from Choice ${edge.sourceChoiceIndex} to ${turnLabels.getLongLabel(edge.targetTurnNumber)}`;
    path.appendChild(title);
    path.onclick = (event) => {
      event.stopPropagation();
      store.selectTurn(edge.sourceTurnNumber);
      store.selectChoice(edge.sourceChoiceIndex);
    };
    path.oncontextmenu = (event) => {
      if (edge.kind !== 'continue') return;
      event.preventDefault();
      store.clearChoiceContinuation(conv.id, edge.sourceTurnNumber, edge.sourceChoiceIndex);
    };
    group.appendChild(path);

    const labelAnchor = getLabelAnchor(sourceAnchor, targetAnchor, edge.offsetIndex);
    const labelButton = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelButton.setAttribute('x', String(labelAnchor.x));
    labelButton.setAttribute('y', String(labelAnchor.y));
    labelButton.setAttribute('text-anchor', 'middle');
    labelButton.setAttribute('class', `flow-edge-label ${edge.textClassName} ${edge.highlight !== 'normal' ? `is-${edge.highlight}` : ''}`.trim());
    labelButton.textContent = edge.label;
    labelButton.onclick = (event) => {
      event.stopPropagation();
      store.selectTurn(edge.sourceTurnNumber);
      store.selectChoice(edge.sourceChoiceIndex);
    };
    group.appendChild(labelButton);

    svg.appendChild(group);
  }

  if (preview) {
    const sourceAnchor = getChoiceAnchor(preview.sourceTurnNumber, preview.sourceChoiceIndex, conv, nodeElements, positionOverrides);
    if (sourceAnchor) {
      const previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      previewPath.setAttribute('d', buildEdgePath(sourceAnchor, preview.cursor, 0));
      previewPath.setAttribute('class', 'flow-edge-path edge-preview');
      previewPath.setAttribute('marker-end', 'url(#marker-continue)');
      svg.appendChild(previewPath);
    }
  }
}

/**
 * Compute the offset of `element` relative to `ancestor` using getBoundingClientRect.
 * This is more reliable than walking the offsetParent chain, which can misfire when
 * CSS transforms, grid/flex layout, or nested positioning contexts are involved.
 */
function getPortOffsetInNode(port: HTMLElement, node: HTMLElement): { left: number; top: number; width: number; height: number } {
  const nodeRect = node.getBoundingClientRect();
  const portRect = port.getBoundingClientRect();

  // Both rects are in screen pixels (scaled by any CSS transform).
  // Dividing by the node's scale factor converts back to the node's own coordinate space.
  const scaleX = nodeRect.width > 0 ? nodeRect.width / node.offsetWidth : 1;
  const scaleY = nodeRect.height > 0 ? nodeRect.height / node.offsetHeight : 1;

  return {
    left: (portRect.left - nodeRect.left) / scaleX,
    top: (portRect.top - nodeRect.top) / scaleY,
    width: portRect.width / scaleX,
    height: portRect.height / scaleY,
  };
}

function getChoiceAnchor(
  turnNumber: number,
  choiceIndex: number,
  conv: Conversation,
  nodeElements: Map<number, HTMLElement>,
  positionOverrides?: TurnPositionMap,
): { x: number; y: number } | null {
  const turn = conv.turns.find(item => item.turnNumber === turnNumber);
  const node = nodeElements.get(turnNumber);
  const port = node?.querySelector(`[data-choice-port="${choiceIndex}"]`) as HTMLElement | null;
  if (!turn || !node || !port) return null;
  const position = positionOverrides?.get(turnNumber) ?? turn.position;
  const offset = getPortOffsetInNode(port, node);
  return {
    x: position.x + offset.left + offset.width / 2,
    y: position.y + offset.top + offset.height / 2,
  };
}

function getTurnInputAnchor(
  turnNumber: number,
  conv: Conversation,
  nodeElements: Map<number, HTMLElement>,
  positionOverrides?: TurnPositionMap,
): { x: number; y: number } | null {
  const turn = conv.turns.find(item => item.turnNumber === turnNumber);
  const node = nodeElements.get(turnNumber);
  const port = node?.querySelector('.turn-input-port') as HTMLElement | null;
  if (!turn || !node || !port) return null;
  const position = positionOverrides?.get(turnNumber) ?? turn.position;
  const offset = getPortOffsetInNode(port, node);
  return {
    x: position.x + offset.left + offset.width / 2,
    y: position.y + offset.top + offset.height / 2,
  };
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
        const pairKey = `${turn.turnNumber}:${target.turnNumber}:${target.kind}`;
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
          kind: target.kind,
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

function getNodeHeight(turn: Turn, density: FlowDensity): number {
  const layout = NODE_LAYOUTS[density];
  const choiceHeight = density === 'detailed' ? 38 : 34;
  let height = 52 + turn.choices.length * choiceHeight;

  // Opening message
  if (turn.openingMessage && density !== 'compact') {
    height += density === 'detailed' ? 50 : 34;
  }

  // NPC replies (shown in standard/detailed)
  if (density !== 'compact') {
    const repliesCount = turn.choices.filter(c => c.reply).length;
    height += repliesCount * 24;
  }

  // Footer in detailed mode
  if (density === 'detailed') {
    height += 26;
  }

  return Math.max(layout.minHeight, height);
}

function buildEdgePath(source: { x: number; y: number }, target: { x: number; y: number }, laneOffset: number): string {
  const horizontalGap = target.x - source.x;
  const lane = laneOffset * 22;

  if (horizontalGap >= 48) {
    const cp1x = source.x + Math.max(42, horizontalGap * 0.32);
    const cp2x = target.x - Math.max(42, horizontalGap * 0.32);
    return `M${source.x},${source.y} C${cp1x},${source.y + lane} ${cp2x},${target.y + lane} ${target.x},${target.y}`;
  }

  const doglegX = Math.max(source.x, target.x) + 84 + Math.abs(lane);
  const midY = source.y < target.y ? Math.min(source.y, target.y) - 30 - Math.abs(lane) : Math.max(source.y, target.y) + 30 + Math.abs(lane);
  return [
    `M${source.x},${source.y}`,
    `C${source.x + 26},${source.y} ${doglegX},${source.y + lane} ${doglegX},${midY}`,
    `S${doglegX},${target.y + lane} ${target.x - 26},${target.y}`,
    `S${target.x - 12},${target.y} ${target.x},${target.y}`,
  ].join(' ');
}

function getLabelAnchor(source: { x: number; y: number }, target: { x: number; y: number }, offsetIndex: number): { x: number; y: number } {
  return {
    x: source.x + (target.x - source.x) / 2,
    y: source.y + (target.y - source.y) / 2 + offsetIndex * 14 - 10,
  };
}

function createMarkerDefs(): SVGDefsElement {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.appendChild(createMarker('marker-continue', '#5eaa3a'));
  defs.appendChild(createMarker('marker-pause-success', '#5eaa3a'));
  defs.appendChild(createMarker('marker-pause-fail', '#c44040'));
  return defs;
}

function createMarker(id: string, color: string): SVGMarkerElement {
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '7');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('orient', 'auto-start-reverse');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  path.setAttribute('fill', color);
  marker.appendChild(path);
  return marker;
}

function viewportToWorldPoint(canvas: HTMLElement, viewState: ViewState, clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - viewState.panX) / viewState.zoom,
    y: (clientY - rect.top - viewState.panY) / viewState.zoom,
  };
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
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
    if (target.closest('.turn-node, .flow-controls, .flow-minimap, .flow-edge')) return;

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
