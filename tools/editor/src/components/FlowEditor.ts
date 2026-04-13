// P.A.N.D.A. Conversation Editor — Visual Flow Editor (Center Panel)

import { store, type StateChange } from '../lib/state';
import { requestFlowCenter, setActiveFlowViewport, type FlowViewportApi } from '../lib/flow-navigation';
import { createTurnDisplayLabeler } from '../lib/turn-labels';
import { createOnboardingNudge } from './Onboarding';
import { FACTION_COLORS } from '../lib/faction-colors';
import { estimateFlowNodeHeight, FLOW_WORKSPACE_MIN_HEIGHT, FLOW_WORKSPACE_MIN_WIDTH, getFlowNodeLayout } from '../lib/flow-layout';
import { buildFlowGraphModel, getVisibleFlowItems, type FlowGraphModel } from '../lib/flow-graph-model';
import { createIcon } from './icons';
import { createFlowCursorSystem, type FlowCursorSystem } from './FlowCursor';
import type { Choice, Conversation, ConversationChannel, Turn } from '../lib/types';
import { getConversationFaction } from '../lib/types';
import type { FlowDensity } from '../lib/state';
import { measurePerf, recordPerf } from '../lib/perf';
import { setBeginnerTooltip } from '../lib/beginner-tooltips';

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
  hoveredTargetTurnNumber: number | null;
  hoveredTargetPortTurnNumber: number | null;
  invalidTarget: boolean;
};

type FlowGraphSize = 'normal' | 'large' | 'huge';

declare global {
  interface Window {
    PANDA_FEATURE_FLAGS?: {
      cursorTelemetry?: boolean;
    };
  }
}

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
const CONNECTION_DROP_RADIUS = 42;
const CONNECTION_SNAP_RADIUS = 18;
const EDGE_MIN_CLEARANCE = 24;
const DEPTH_OF_FIELD_ZOOM_THRESHOLD = 0.62;
const LARGE_GRAPH_TURN_THRESHOLD = 10;
const LARGE_GRAPH_EDGE_THRESHOLD = 14;
const HUGE_GRAPH_TURN_THRESHOLD = 20;
const HUGE_GRAPH_EDGE_THRESHOLD = 28;
const DEFAULT_VIEW_STATE: ViewState = {
  panX: 40,
  panY: 40,
  zoom: 1,
};
const MOBILE_VIEWPORT_QUERY = '(max-width: 760px)';
const viewStateByConversation = new Map<number, ViewState>();

// ── Live flow editor state for incremental updates ──
type LiveFlowState = {
  conversationId: number;
  projectRevision: number;
  nodeElements: Map<number, HTMLElement>;
  edgeElements: Map<string, SVGGElement>;
  edges: EdgeDescriptor[];
  svg: SVGSVGElement;
  selectedTurnNumber: number | null;
  selectedChoiceIndex: number | null;
  conv: Conversation;
  factionColor: string;
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>;
  portOffsetCache: Map<string, { left: number; top: number; width: number; height: number }>;
  canvas: HTMLElement;
  viewState: ViewState;
  density: FlowDensity;
  graphModel: FlowGraphModel;
};
let liveFlow: LiveFlowState | null = null;
let flowCursorSystem: FlowCursorSystem | null = null;

/**
 * Fast-path: update only selection-related visuals without rebuilding DOM.
 * Returns true if the fast path was taken, false if a full render is needed.
 */
export function updateFlowSelection(): boolean {
  if (!liveFlow) return false;
  const state = store.get();
  const conv = store.getSelectedConversation();
  if (!conv || conv.id !== liveFlow.conversationId) return false;

  // If structure changed, we need a full rebuild
  if (state.projectRevision !== liveFlow.projectRevision) return false;

  const nextSelected = state.selectedTurnNumber;
  const nextChoiceIndex = state.selectedChoiceIndex;

  liveFlow.selectedTurnNumber = nextSelected;
  liveFlow.selectedChoiceIndex = nextChoiceIndex;

  // Update turn node classes
  for (const [turnNumber, node] of liveFlow.nodeElements) {
    const isSelected = turnNumber === nextSelected;
    node.classList.toggle('selected', isSelected);
    node.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

    // Update choice item selection
    const choiceItems = node.querySelectorAll('.turn-choice-item');
    for (const item of choiceItems) {
      const choiceIndex = parseInt((item as HTMLElement).querySelector('.choice-number')?.textContent ?? '-1', 10);
      (item as HTMLElement).classList.toggle('selected', isSelected && choiceIndex === nextChoiceIndex);
    }
  }

  // Update edge highlights
  const activeTurnNumbers = new Set<number>();
  for (const edge of liveFlow.edges) {
    const newHighlight = getEdgeHighlightState(
      edge.sourceTurnNumber, edge.sourceChoiceIndex, edge.targetTurnNumber,
      nextSelected, nextChoiceIndex,
    );
    if (newHighlight === 'active') {
      activeTurnNumbers.add(edge.sourceTurnNumber);
      activeTurnNumbers.add(edge.targetTurnNumber);
    }
    const key = edgeKey(edge);
    const group = liveFlow.edgeElements.get(key);
    if (group) {
      group.classList.toggle('is-active', newHighlight === 'active');
      group.classList.toggle('is-muted', newHighlight === 'muted');
      const path = group.querySelector('.flow-edge-path');
      if (path) {
        path.classList.toggle('is-active', newHighlight === 'active');
        path.classList.toggle('is-muted', newHighlight === 'muted');
      }
      const packet = group.querySelector('.flow-edge-packet');
      if (packet) {
        packet.classList.toggle('is-active', newHighlight === 'active');
        packet.classList.toggle('is-muted', newHighlight === 'muted');
      }
      const label = group.querySelector('.flow-edge-label');
      if (label) {
        label.classList.toggle('is-active', newHighlight === 'active');
        label.classList.toggle('is-muted', newHighlight === 'muted');
      }
    }
    edge.highlight = newHighlight;
  }

  // Update path-active on turn nodes
  for (const [turnNumber, node] of liveFlow.nodeElements) {
    node.classList.toggle('path-active', activeTurnNumbers.has(turnNumber));
  }
  syncLiveViewportVisibility(liveFlow);

  return true;
}

export function mountFlowEditor(container: HTMLElement): void {
  renderFlowEditor(container);
}

export function syncFlowEditor(change: StateChange): boolean {
  if (!liveFlow) return false;
  const state = store.get();
  const conv = store.getSelectedConversation();
  if (!conv || conv.id !== liveFlow.conversationId) return false;

  const kind = change.flow?.kind ?? change.reason;
  if (kind === 'validation') return true;
  if (kind === 'selection') return updateFlowSelection();

  if (kind === 'position') {
    liveFlow.projectRevision = state.projectRevision;
    for (const turn of conv.turns) {
      const node = liveFlow.nodeElements.get(turn.turnNumber);
      if (!node) continue;
      node.style.left = `${turn.position.x}px`;
      node.style.top = `${turn.position.y}px`;
    }
    liveFlow.graphModel = buildFlowGraphModel(conv, liveFlow.density, liveFlow.factionColor);
    redrawLiveEdges(liveFlow);
    syncLiveViewportVisibility(liveFlow);
    return true;
  }

  if (kind === 'text-content') {
    liveFlow.projectRevision = state.projectRevision;
    liveFlow.turnLabels = createTurnDisplayLabeler(conv);
    for (const turn of conv.turns) {
      const node = liveFlow.nodeElements.get(turn.turnNumber);
      if (!node) continue;
      patchTurnNodeText(node, conv, turn, liveFlow.density, liveFlow.turnLabels);
    }
    redrawLiveEdges(liveFlow);
    syncLiveViewportVisibility(liveFlow);
    return true;
  }

  if (kind === 'settings' && !change.projectChanged) {
    flowCursorSystem?.updateSettings({
      enabled: state.customCursorEnabled,
      animationIntensity: state.cursorAnimationIntensity,
      size: state.cursorSize,
    });
    return true;
  }

  return false;
}

function edgeKey(edge: EdgeDescriptor): string {
  return `${edge.sourceTurnNumber}:${edge.sourceChoiceIndex}:${edge.targetTurnNumber}:${edge.kind}`;
}

function indexEdgeElements(svg: SVGSVGElement, map: Map<string, SVGGElement>): void {
  map.clear();
  for (const group of svg.querySelectorAll('.flow-edge')) {
    const path = group.querySelector('.flow-edge-path') as SVGPathElement | null;
    if (!path) continue;
    const src = path.dataset.sourceTurnNumber;
    const ci = path.dataset.sourceChoiceIndex;
    const tgt = path.dataset.targetTurnNumber;
    const kind = path.classList.contains('edge-continue') ? 'continue'
      : path.classList.contains('edge-pause-success') ? 'pause-success'
      : path.classList.contains('edge-pause-fail') ? 'pause-fail'
      : 'continue';
    if (src && ci && tgt) {
      map.set(`${src}:${ci}:${tgt}:${kind}`, group as SVGGElement);
    }
  }
}

function getFlowNodeWidthForLabel(label: string, density: FlowDensity): number {
  const layout = getFlowNodeLayout(density);
  const normalizedLength = label.trim().length;
  if (normalizedLength === 0) return layout.width;

  const freeCharacters = density === 'compact' ? 14 : density === 'standard' ? 18 : 22;
  const characterWidth = density === 'compact' ? 5.8 : density === 'standard' ? 6.6 : 7.2;
  const maxExtraWidth = density === 'compact' ? 120 : density === 'standard' ? 180 : 220;
  const extraWidth = Math.max(0, normalizedLength - freeCharacters) * characterWidth;
  return Math.round(layout.width + Math.min(maxExtraWidth, extraWidth));
}

function estimateChoiceRowWidth(choice: Choice, density: FlowDensity): number {
  const previewLength = Math.max(7, choice.text.trim().length || 0);
  const previewFreeChars = density === 'compact' ? 16 : density === 'standard' ? 22 : 28;
  const previewCharWidth = density === 'compact' ? 5.2 : density === 'standard' ? 5.8 : 6.4;
  const previewExtraWidth = Math.max(0, previewLength - previewFreeChars) * previewCharWidth;
  const previewWidthCap = density === 'compact' ? 120 : density === 'standard' ? 190 : 240;

  let controlsWidth = 88; // index + add-branch + connector handle
  if (choice.continueTo != null) controlsWidth += 104; // unlink + handoff badge
  controlsWidth += 48; // choice channel badge
  if (hasPauseOutcome(choice)) controlsWidth += 42;
  if (density !== 'compact' && choice.outcomes.length > 0) controlsWidth += 52;

  return controlsWidth + Math.min(previewExtraWidth, previewWidthCap);
}

function getFlowNodeWidth(turn: Turn, turnLabel: string, density: FlowDensity): number {
  const labelWidth = getFlowNodeWidthForLabel(turnLabel, density);
  if (turn.choices.length === 0) return labelWidth;

  const widestChoice = turn.choices.reduce((maxWidth, choice) => {
    return Math.max(maxWidth, estimateChoiceRowWidth(choice, density));
  }, 0);

  // Include body padding + a small safety buffer so badges stay within the card edge.
  return Math.round(Math.max(labelWidth, widestChoice + 30));
}

// ── Memoization caches ──
let memoEdges: { key: string; edges: EdgeDescriptor[] } | null = null;
let memoBounds: { key: string; bounds: ContentBounds } | null = null;
let memoLabeler: { key: string; labeler: ReturnType<typeof createTurnDisplayLabeler> } | null = null;

function memoKey(convId: number, projectRevision: number, density: FlowDensity): string {
  return `${convId}:${projectRevision}:${density}`;
}

function getFlowGraphSize(turnCount: number, edgeCount: number): FlowGraphSize {
  if (turnCount >= HUGE_GRAPH_TURN_THRESHOLD || edgeCount >= HUGE_GRAPH_EDGE_THRESHOLD) {
    return 'huge';
  }
  if (turnCount >= LARGE_GRAPH_TURN_THRESHOLD || edgeCount >= LARGE_GRAPH_EDGE_THRESHOLD) {
    return 'large';
  }
  return 'normal';
}

export function renderFlowEditor(container: HTMLElement): void {
  flowCursorSystem?.destroy();
  flowCursorSystem = null;

  const conv = store.getSelectedConversation();
  const state = store.get();
  const density = getEffectiveFlowDensity(state.flowDensity);
  const isMobileViewport = isCompactViewport();

  // Full rebuild invalidates cached port offsets
  invalidatePortOffsetCache();

  if (!conv) {
    liveFlow = null;
    container.replaceChildren(createOnboardingNudge({
      title: 'No flow to render',
      body: 'Start the onboarding flow to create a blank project, import XML, or open the sample story pack, then branches and links will appear here.',
    }));
    return;
  }

  const renderStart = performance.now();

  const conversationId = conv.id;
  const mk = memoKey(conversationId, state.projectRevision, density);

  const turnLabels = memoLabeler?.key === mk ? memoLabeler.labeler : createTurnDisplayLabeler(conv);
  memoLabeler = { key: mk, labeler: turnLabels };

  const existingView = viewStateByConversation.get(conversationId);
  const viewState: ViewState = existingView ? { ...existingView } : { ...DEFAULT_VIEW_STATE };

  const bounds = memoBounds?.key === mk ? memoBounds.bounds : calculateContentBounds(conv, density);
  memoBounds = { key: mk, bounds };

  const factionColor = FACTION_COLORS[getConversationFaction(conv, state.project.faction)];
  const graphModel = buildFlowGraphModel(conv, density, factionColor);

  // Reuse cached structural edges; only recompute highlight state
  let edges: EdgeDescriptor[];
  if (memoEdges?.key === mk) {
    edges = memoEdges.edges;
    for (const edge of edges) {
      edge.highlight = getEdgeHighlightState(edge.sourceTurnNumber, edge.sourceChoiceIndex, edge.targetTurnNumber, state.selectedTurnNumber, state.selectedChoiceIndex);
    }
  } else {
    edges = buildEdgeDescriptors(conv, state.selectedTurnNumber, state.selectedChoiceIndex, factionColor);
    memoEdges = { key: mk, edges };
  }
  const graphSize = getFlowGraphSize(conv.turns.length, edges.length);
  const nodeElements = new Map<number, HTMLElement>();
  const edgeElements = new Map<string, SVGGElement>();

  const shell = document.createElement('div');
  const shellClasses = ['flow-shell', `density-${density}`];
  if (isMobileViewport) shellClasses.push('flow-shell-mobile');
  if (graphSize !== 'normal') shellClasses.push('is-large-graph');
  if (graphSize !== 'normal') shellClasses.push('is-perf-mode');
  if (graphSize === 'huge') shellClasses.push('is-huge-graph');
  shell.className = shellClasses.join(' ');

  const canvas = document.createElement('div');
  canvas.className = 'flow-canvas';
  canvas.setAttribute('role', 'region');
  canvas.setAttribute('aria-label', `Story ${conv.id} flow graph`);
  setBeginnerTooltip(canvas, 'flow-canvas');

  const content = document.createElement('div');
  content.className = 'flow-content';
  content.setAttribute('role', 'list');
  content.setAttribute('aria-label', 'Story turns');
  content.style.width = `${bounds.width}px`;
  content.style.height = `${bounds.height}px`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('flow-edges');
  svg.setAttribute('width', String(bounds.width));
  svg.setAttribute('height', String(bounds.height));
  svg.appendChild(createMarkerDefs());
  const previewSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  previewSvg.classList.add('flow-edges', 'flow-edges-preview');
  previewSvg.setAttribute('width', String(bounds.width));
  previewSvg.setAttribute('height', String(bounds.height));
  previewSvg.appendChild(createMarkerDefs());

  let viewAdjusted = false;
  let connectionPreview: ConnectionPreview | null = null;
  let interactionReleaseTimer: number | null = null;

  const setInteractionActive = (active: boolean, releaseDelayMs = 0): void => {
    if (interactionReleaseTimer) {
      window.clearTimeout(interactionReleaseTimer);
      interactionReleaseTimer = null;
    }
    if (active) {
      shell.classList.add('is-interacting');
      return;
    }
    if (releaseDelayMs > 0) {
      interactionReleaseTimer = window.setTimeout(() => {
        interactionReleaseTimer = null;
        shell.classList.remove('is-interacting');
      }, releaseDelayMs);
      return;
    }
    shell.classList.remove('is-interacting');
  };

  const updateConnectionTargetHighlights = (): void => {
    for (const [turnNumber, node] of nodeElements) {
      const isSource = connectionPreview?.sourceTurnNumber === turnNumber;
      const isHoveredTarget = connectionPreview?.hoveredTargetTurnNumber === turnNumber;
      const isHoveredPort = connectionPreview?.hoveredTargetPortTurnNumber === turnNumber;
      const inputPort = node.querySelector('.turn-input-port');
      const sourcePort = node.querySelector(`[data-choice-port="${connectionPreview?.sourceChoiceIndex ?? -1}"]`);
      node.classList.toggle('connection-source', Boolean(isSource));
      node.classList.toggle('connection-target-active', isHoveredTarget);
      inputPort?.classList.toggle('connection-target-active', isHoveredPort);
      inputPort?.classList.toggle('connection-target-invalid', isHoveredTarget && Boolean(connectionPreview?.invalidTarget));
      sourcePort?.classList.toggle('connection-source-active', Boolean(isSource && connectionPreview));
    }
  };

  const zoomValue = document.createElement('span');
  zoomValue.className = 'flow-zoom-value';

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
      onPreviewPosition: (previewPositions, affectedTurnNumbers) => draw(previewPositions, affectedTurnNumbers),
      onChoicePortDragStart: (choiceIndex, event) => {
        store.batch(() => {
          store.selectTurn(turn.turnNumber);
          store.selectChoice(choiceIndex);
        });
        startConnectionDrag(turn.turnNumber, choiceIndex, event);
      },
      onCreateConnectedTurn: (choiceIndex) => {
        const createdTurnNumber = store.createConnectedTurn(conversationId, turn.turnNumber, choiceIndex);
        if (createdTurnNumber != null) {
          requestFlowCenter({ conversationId, turnNumber: createdTurnNumber });
        }
      },
      onFocusTurn: (turnNumber) => focusTurn(turnNumber, { center: true }),
      onKeyboardShortcut: (turnNumber, key) => handleTurnShortcut(turnNumber, key),
      onDragStateChange: (active) => {
        dispatchCursorState(canvas, 'dragging', active);
        setInteractionActive(active);
      },
    });
    nodeElements.set(turn.turnNumber, node);
    content.appendChild(node);

  }
  content.appendChild(previewSvg);

  let drawFrame = 0;
  let pendingPositionOverrides: TurnPositionMap | undefined;
  let pendingAffectedTurnNumbers: ReadonlySet<number> | undefined;
  let pendingEdgeRedraw = true;

  const runDraw = (): void => {
    drawFrame = 0;
    updateConnectionTargetHighlights();
    if (pendingEdgeRedraw) {
      measurePerf('flow.edgeDraw', () => {
        drawEdges({
          svg,
          conv,
          edges,
          nodeElements,
          edgeElements,
          positionOverrides: pendingPositionOverrides,
          turnLabels,
          factionColor,
          onlyTurnNumbers: pendingAffectedTurnNumbers,
        });
      }, {
        turnCount: conv.turns.length,
        edgeCount: edges.length,
        graphSize,
      });
    }
    drawConnectionPreview({
      svg: previewSvg,
      conv,
      nodeElements,
      positionOverrides: pendingPositionOverrides,
      preview: connectionPreview,
      factionColor,
    });
    pendingAffectedTurnNumbers = undefined;
    pendingEdgeRedraw = true;
  };

  const draw = (
    positionOverrides?: TurnPositionMap,
    affectedTurnNumbers?: ReadonlySet<number>,
    redrawEdges = true,
  ): void => {
    pendingPositionOverrides = positionOverrides;
    pendingAffectedTurnNumbers = affectedTurnNumbers;
    pendingEdgeRedraw = redrawEdges;
    if (drawFrame !== 0) return;
    drawFrame = window.requestAnimationFrame(runDraw);
  };

  const controls = renderControls({
    customCursorEnabled: state.customCursorEnabled,
    cursorSize: state.cursorSize,
    zoomValue,
    onZoomIn: () => zoomAtViewportPoint(canvas, viewState, 1.12, canvas.clientWidth / 2, canvas.clientHeight / 2, applyView),
    onZoomOut: () => zoomAtViewportPoint(canvas, viewState, 1 / 1.12, canvas.clientWidth / 2, canvas.clientHeight / 2, applyView),
    onFit: () => fitContent(),
    onReset: () => resetView(),
    onSetCursorEnabled: (enabled) => store.setCustomCursorEnabled(enabled),
    onSetCursorSize: (size) => store.setCursorSize(size),
  });


  canvas.appendChild(content);
  shell.appendChild(canvas);
  shell.appendChild(controls);
  container.appendChild(shell);

  const focusTurn = (turnNumber: number, options: { center?: boolean } = {}): void => {
    const node = nodeElements.get(turnNumber);
    if (!node) return;
    node.focus();
    if (options.center) centerTurn(turnNumber, false);
  };

  const handleTurnShortcut = (turnNumber: number, key: string): void => {
    const currentState = store.get();
    const focusedTurn = conv.turns.find(item => item.turnNumber === turnNumber);
    if (!focusedTurn) return;

    if (key === 'add-turn') {
      store.addTurn(conversationId);
      requestAnimationFrame(() => {
        const createdTurn = store.getSelectedTurn();
        if (createdTurn) focusTurn(createdTurn.turnNumber, { center: true });
      });
      return;
    }

    if (key === 'add-choice') {
      store.batch(() => {
        store.addChoice(conversationId, turnNumber);
        store.selectTurn(turnNumber);
        const updatedTurn = store.getSelectedTurn() ?? focusedTurn;
        if (updatedTurn.choices.length > 0) {
          store.selectChoice(updatedTurn.choices[updatedTurn.choices.length - 1]?.index ?? null);
        }
      });
      requestAnimationFrame(() => focusTurn(turnNumber));
      return;
    }

    if (key === 'duplicate-turn') {
      const duplicatedTurnNumber = store.duplicateTurn(conversationId, turnNumber);
      if (duplicatedTurnNumber != null) {
        requestAnimationFrame(() => focusTurn(duplicatedTurnNumber, { center: true }));
      }
      return;
    }

    if (key === 'copy-turn') {
      store.copyTurn(conversationId, turnNumber);
      requestAnimationFrame(() => focusTurn(turnNumber));
      return;
    }

    if (key === 'paste-turn') {
      const pastedTurnNumber = store.pasteTurn(conversationId, turnNumber);
      if (pastedTurnNumber != null) {
        requestAnimationFrame(() => focusTurn(pastedTurnNumber, { center: true }));
      }
      return;
    }

    if (key === 'disconnect-branch') {
      const choiceIndex = currentState.selectedTurnNumber === turnNumber
        ? (currentState.selectedChoiceIndex ?? focusedTurn.choices[0]?.index ?? null)
        : (focusedTurn.choices[0]?.index ?? null);
      if (choiceIndex != null) {
        store.batch(() => {
          store.clearChoiceContinuation(conversationId, turnNumber, choiceIndex);
          store.selectTurn(turnNumber);
          store.selectChoice(choiceIndex);
        });
        requestAnimationFrame(() => focusTurn(turnNumber));
      }
      return;
    }

    if (key === 'connect-branch'
      && currentState.selectedTurnNumber != null
      && currentState.selectedChoiceIndex != null
      && currentState.selectedTurnNumber !== turnNumber) {
      store.connectChoiceToTurn(
        conversationId,
        currentState.selectedTurnNumber,
        currentState.selectedChoiceIndex,
        turnNumber,
      );
      requestAnimationFrame(() => focusTurn(turnNumber));
    }
  };

  let lastAppliedPanX: number | null = null;
  let lastAppliedPanY: number | null = null;
  let lastAppliedZoom: number | null = null;
  let lastDepthBlur: boolean | null = null;

  const applyView = (): void => {
    // Snap pan to physical device pixels to prevent subpixel blurriness.
    // Keep zoom separate from translate so Chromium can rasterize branch text
    // at the final zoom level instead of blurring it inside a transformed layer.
    const dpr = window.devicePixelRatio || 1;
    const snapX = Math.round(viewState.panX * dpr) / dpr;
    const snapY = Math.round(viewState.panY * dpr) / dpr;
    const depthBlur = viewState.zoom <= DEPTH_OF_FIELD_ZOOM_THRESHOLD;
    if (lastAppliedPanX !== snapX || lastAppliedPanY !== snapY) {
      content.style.transform = `translate3d(${snapX}px, ${snapY}px, 0)`;
      lastAppliedPanX = snapX;
      lastAppliedPanY = snapY;
    }
    if (lastAppliedZoom !== viewState.zoom) {
      content.style.zoom = String(viewState.zoom);
      zoomValue.textContent = `${Math.round(viewState.zoom * 100)}%`;
      lastAppliedZoom = viewState.zoom;
    }
    if (lastDepthBlur !== depthBlur) {
      canvas.classList.toggle('is-depth-blur', depthBlur);
      lastDepthBlur = depthBlur;
    }
    viewStateByConversation.set(conversationId, { ...viewState });
    syncViewportVisibility({
      canvas,
      viewState,
      graphModel,
      nodeElements,
      edgeElements,
      selectedTurnNumber: store.get().selectedTurnNumber,
      selectedChoiceIndex: store.get().selectedChoiceIndex,
    });
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
    const targetLabel = turnLabels.getLongLabel(targetTurn.turnNumber);
    centerWorldPoint(
      targetTurn.position.x + getFlowNodeWidth(targetTurn, targetLabel, density) / 2,
      targetTurn.position.y + estimateFlowNodeHeight(targetTurn, density) / 2,
      animate,
    );
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

  function startConnectionDrag(sourceTurnNumber: number, sourceChoiceIndex: number, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const sourcePort = event.currentTarget as HTMLElement | null;
    const pointerId = event.pointerId;
    const sourceNode = sourcePort?.closest('.turn-node') as HTMLElement | null;
    const sourceConversation = store.get().project.conversations.find(conversation => conversation.id === conversationId);
    const sourceChoice = sourceConversation?.turns
      .find((turn) => turn.turnNumber === sourceTurnNumber)
      ?.choices.find((choice) => choice.index === sourceChoiceIndex);
    type InputPortCandidate = { turnNumber: number; port: HTMLElement; x: number; y: number };
    let inputPortCandidates: InputPortCandidate[] = [];
    const getInputPortCenter = (port: HTMLElement): { x: number; y: number } => {
      const rect = port.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const refreshInputPortCandidates = (): void => {
      inputPortCandidates = [];
      for (const node of nodeElements.values()) {
        const turnNumber = Number(node.dataset.turnNumber);
        if (Number.isNaN(turnNumber)) continue;
        const port = node.querySelector('.turn-input-port') as HTMLElement | null;
        if (!port) continue;
        const center = getInputPortCenter(port);
        inputPortCandidates.push({ turnNumber, port, x: center.x, y: center.y });
      }
    };
    const getClosestInputPort = (clientX: number, clientY: number, restrictToTurn?: number): { turnNumber: number; port: HTMLElement; distance: number } | null => {
      let best: { turnNumber: number; port: HTMLElement; distance: number } | null = null;
      const candidates = restrictToTurn != null
        ? inputPortCandidates.filter(candidate => candidate.turnNumber === restrictToTurn)
        : inputPortCandidates;
      for (const candidate of candidates) {
        const distance = Math.hypot(candidate.x - clientX, candidate.y - clientY);
        if (!best || distance < best.distance) {
          best = { turnNumber: candidate.turnNumber, port: candidate.port, distance };
        }
      }
      return best;
    };
    const getHoveredTarget = (clientX: number, clientY: number): {
      targetTurnNumber: number | null;
      hoveredPortTurnNumber: number | null;
      invalidTarget: boolean;
      previewCursor: { x: number; y: number };
    } => {
      const rawElement = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      const hoveredPort = rawElement?.closest('.turn-input-port') as HTMLElement | null;
      const hoveredNode = rawElement?.closest('.turn-node') as HTMLElement | null;
      const hoveredNodeTurn = hoveredNode ? Number(hoveredNode.dataset.turnNumber) : null;
      const directPortTurn = hoveredPort ? Number((hoveredPort.closest('.turn-node') as HTMLElement | null)?.dataset.turnNumber) : null;
      const initialNearest = directPortTurn != null && !Number.isNaN(directPortTurn)
        ? getClosestInputPort(clientX, clientY, directPortTurn)
        : hoveredNodeTurn != null && !Number.isNaN(hoveredNodeTurn)
          ? getClosestInputPort(clientX, clientY, hoveredNodeTurn)
          : getClosestInputPort(clientX, clientY);
      const nearest = initialNearest?.distance != null && initialNearest.distance <= CONNECTION_DROP_RADIUS
        ? initialNearest
        : null;
      const candidateTurn = nearest?.turnNumber ?? null;
      const invalidFromHoverNode = hoveredNodeTurn === sourceTurnNumber;
      const invalidTarget = candidateTurn === sourceTurnNumber || invalidFromHoverNode;
      const shouldSnapToPort = Boolean(nearest && nearest.distance <= CONNECTION_SNAP_RADIUS && !invalidTarget);
      const previewViewportPoint = shouldSnapToPort && nearest
        ? getInputPortCenter(nearest.port)
        : { x: clientX, y: clientY };
      const previewCursor = viewportToWorldPoint(canvas, viewState, previewViewportPoint.x, previewViewportPoint.y);
      return {
        targetTurnNumber: invalidTarget ? null : candidateTurn,
        hoveredPortTurnNumber: nearest?.turnNumber ?? null,
        invalidTarget,
        previewCursor,
      };
    };

    const updatePreview = (clientX: number, clientY: number): void => {
      const hovered = getHoveredTarget(clientX, clientY);
      connectionPreview = {
        sourceTurnNumber,
        sourceChoiceIndex,
        cursor: hovered.previewCursor,
        hoveredTargetTurnNumber: hovered.targetTurnNumber,
        hoveredTargetPortTurnNumber: hovered.hoveredPortTurnNumber,
        invalidTarget: hovered.invalidTarget,
      };
      draw(undefined, undefined, false);
    };

    const finishConnectionDrag = (targetTurnNumber: number | null = null): void => {
      sourcePort?.removeEventListener('pointermove', onMove);
      sourcePort?.removeEventListener('pointerup', onUp);
      sourcePort?.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('keydown', onKeyDown, true);
      if (sourcePort?.hasPointerCapture(pointerId)) {
        sourcePort.releasePointerCapture(pointerId);
      }
      sourceNode?.classList.remove('connection-source');
      dispatchCursorState(canvas, 'linking', false);
      setInteractionActive(false, 120);

      if (targetTurnNumber != null) {
        store.connectChoiceToTurn(conversationId, sourceTurnNumber, sourceChoiceIndex, targetTurnNumber);
      } else if (sourceChoice?.continueTo != null) {
        store.clearChoiceContinuation(conversationId, sourceTurnNumber, sourceChoiceIndex);
      }

      connectionPreview = null;
      draw(undefined, undefined, false);
    };

    const onMove = (moveEvent: PointerEvent) => {
      updatePreview(moveEvent.clientX, moveEvent.clientY);
    };

    const onUp = (upEvent: PointerEvent) => {
      const targetTurnNumber = connectionPreview?.hoveredTargetTurnNumber
        ?? getHoveredTarget(upEvent.clientX, upEvent.clientY).targetTurnNumber;
      finishConnectionDrag(targetTurnNumber);
    };
    const onCancel = () => finishConnectionDrag();

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Escape') return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      finishConnectionDrag();
    };

    refreshInputPortCandidates();
    updatePreview(event.clientX, event.clientY);
    sourcePort?.setPointerCapture(pointerId);
    sourceNode?.classList.add('connection-source');
    dispatchCursorState(canvas, 'linking', true);
    setInteractionActive(true);
    sourcePort?.addEventListener('pointermove', onMove);
    sourcePort?.addEventListener('pointerup', onUp);
    sourcePort?.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKeyDown, true);
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
    onBackgroundClick: () => store.clearSelection(),
    onInteractionStateChange: setInteractionActive,
  });

  flowCursorSystem = createFlowCursorSystem({
    canvas,
    settings: {
      enabled: state.customCursorEnabled,
      animationIntensity: state.cursorAnimationIntensity,
      size: state.cursorSize,
    },
    telemetry: (event, payload) => {
      if (window.PANDA_FEATURE_FLAGS?.cursorTelemetry !== true) return;
      window.dispatchEvent(new CustomEvent('panda:cursor-telemetry', { detail: { event, ...payload } }));
    },
  });

  runDraw();
  applyView();

  // Populate live flow state for incremental selection updates
  liveFlow = {
    conversationId,
    projectRevision: state.projectRevision,
    nodeElements,
    edgeElements,
    edges,
    svg,
    selectedTurnNumber: state.selectedTurnNumber,
    selectedChoiceIndex: state.selectedChoiceIndex,
    conv,
    factionColor,
    turnLabels,
    portOffsetCache: new Map(),
    canvas,
    viewState,
    density,
    graphModel,
  };

  requestAnimationFrame(() => {
    runDraw();
    if (!existingView && !viewAdjusted) {
      fitContent(false);
      return;
    }
    applyView();
  });

  recordPerf('flow.render', performance.now() - renderStart, {
    turnCount: conv.turns.length,
    edgeCount: edges.length,
    graphSize,
    density,
  });
}

function isCompactViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}

function getEffectiveFlowDensity(preferredDensity: FlowDensity): FlowDensity {
  return isCompactViewport() ? 'compact' : preferredDensity;
}

function renderControls(options: {
  customCursorEnabled: boolean;
  cursorSize: number;
  zoomValue: HTMLElement;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onSetCursorEnabled: (enabled: boolean) => void;
  onSetCursorSize: (size: number) => void;
}): HTMLElement {
  const controls = document.createElement('div');
  controls.className = 'flow-controls';

  const zoomOut = document.createElement('button');
  zoomOut.type = 'button';
  zoomOut.className = 'btn-sm';
  zoomOut.textContent = '−';
  zoomOut.title = 'Zoom out';
  setBeginnerTooltip(zoomOut, 'flow-zoom');
  zoomOut.onclick = options.onZoomOut;

  const zoomIn = document.createElement('button');
  zoomIn.type = 'button';
  zoomIn.className = 'btn-sm';
  zoomIn.textContent = '+';
  zoomIn.title = 'Zoom in';
  setBeginnerTooltip(zoomIn, 'flow-zoom');
  zoomIn.onclick = options.onZoomIn;

  const fit = document.createElement('button');
  fit.type = 'button';
  fit.className = 'btn-sm';
  fit.textContent = 'Fit';
  fit.title = 'Fit conversation to viewport';
  setBeginnerTooltip(fit, 'flow-fit');
  fit.onclick = options.onFit;

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'btn-sm';
  reset.textContent = 'Reset';
  reset.title = 'Reset pan and zoom';
  setBeginnerTooltip(reset, 'flow-reset');
  reset.onclick = options.onReset;

  const cursorToggle = document.createElement('label');
  cursorToggle.className = 'flow-cursor-setting';
  const cursorToggleInput = document.createElement('input');
  cursorToggleInput.type = 'checkbox';
  cursorToggleInput.checked = options.customCursorEnabled;
  cursorToggleInput.onchange = () => options.onSetCursorEnabled(cursorToggleInput.checked);
  const cursorToggleLabel = document.createElement('span');
  cursorToggleLabel.textContent = 'Cursor';
  cursorToggle.append(cursorToggleInput, cursorToggleLabel);


  const sizeInput = document.createElement('input');
  sizeInput.className = 'flow-cursor-size';
  sizeInput.type = 'range';
  sizeInput.min = '12';
  sizeInput.max = '28';
  sizeInput.value = String(options.cursorSize);
  sizeInput.title = 'Cursor size';
  sizeInput.oninput = () => options.onSetCursorSize(Number(sizeInput.value));

  controls.append(zoomOut, options.zoomValue, zoomIn, fit, reset, cursorToggle, sizeInput);
  return controls;
}

function calculateContentBounds(conv: Conversation, density: FlowDensity): ContentBounds {
  const turnLabels = createTurnDisplayLabeler(conv);

  if (conv.turns.length === 0) {
    return {
      width: FLOW_WORKSPACE_MIN_WIDTH,
      height: FLOW_WORKSPACE_MIN_HEIGHT,
    };
  }

  let maxX = 0;
  let maxY = 0;

  for (const turn of conv.turns) {
    const turnWidth = getFlowNodeWidth(turn, turnLabels.getLongLabel(turn.turnNumber), density);
    maxX = Math.max(maxX, turn.position.x + turnWidth);
    maxY = Math.max(maxY, turn.position.y + estimateFlowNodeHeight(turn, density));
  }

  return {
    width: Math.max(FLOW_WORKSPACE_MIN_WIDTH, maxX + CONTENT_PADDING),
    height: Math.max(FLOW_WORKSPACE_MIN_HEIGHT, maxY + CONTENT_PADDING),
  };
}

function getBranchColor(turn: Turn, turnIndex: number, factionColor?: string): string {
  if (turn.color) return turn.color;
  if (turnIndex === 0 && factionColor) return factionColor;
  return BRANCH_PALETTE[turnIndex % BRANCH_PALETTE.length];
}

function getChoiceBranchColor(
  conv: Conversation,
  choice: Choice,
  parentBranchColor: string,
  factionColor: string,
): string {
  const choiceTargets = getChoiceTargets(choice, conv);
  const preferredTarget = choiceTargets.find(target => target.kind === 'continue') ?? choiceTargets[0];
  if (!preferredTarget) return parentBranchColor;
  return getTurnBranchColor(conv, preferredTarget.turnNumber, factionColor) ?? parentBranchColor;
}

function renderTurnNode(options: {
  conv: Conversation;
  turn: Turn;
  selected: boolean;
  edges: EdgeDescriptor[];
  density: FlowDensity;
  viewState: ViewState;
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>;
  onPreviewPosition: (positions?: TurnPositionMap, affectedTurnNumbers?: ReadonlySet<number>) => void;
  onChoicePortDragStart: (choiceIndex: number, event: PointerEvent) => void;
  onCreateConnectedTurn: (choiceIndex: number) => void;
  onFocusTurn: (turnNumber: number) => void;
  onKeyboardShortcut: (turnNumber: number, key: 'add-turn' | 'add-choice' | 'duplicate-turn' | 'copy-turn' | 'paste-turn' | 'connect-branch' | 'disconnect-branch') => void;
  onDragStateChange: (active: boolean) => void;
}): HTMLElement {
  const {
    conv,
    turn,
    selected,
    edges,
    density,
    viewState,
    turnLabels,
    onPreviewPosition,
    onChoicePortDragStart,
    onCreateConnectedTurn,
    onFocusTurn,
    onKeyboardShortcut,
    onDragStateChange,
  } = options;
  const state = store.get();
  const canPasteTurn = store.hasCopiedTurn(conv.id);
  const layout = getFlowNodeLayout(density);
  const hasWarning = turn.choices.some(c => !c.text && !c.reply);
  const isPathActive = edges.some(edge => edge.highlight === 'active' && (edge.sourceTurnNumber === turn.turnNumber || edge.targetTurnNumber === turn.turnNumber));
  const turnIndex = conv.turns.indexOf(turn);
  const factionColor = FACTION_COLORS[getConversationFaction(conv, state.project.faction)];
  const branchColor = getBranchColor(turn, turnIndex, factionColor);
  const nodeWidth = getFlowNodeWidth(turn, turnLabels.getLongLabel(turn.turnNumber), density);

  const node = document.createElement('div');

  node.className = 'turn-node'
    + (selected ? ' selected' : '')
    + (hasWarning ? ' has-warning' : '')
    + (isPathActive ? ' path-active' : '')
    + (turn.turnNumber === 1 ? ' is-starter-turn' : '');
  node.dataset.turnNumber = String(turn.turnNumber);
  node.tabIndex = 0;
  node.setAttribute('role', 'button');
  node.setAttribute('aria-label', buildTurnAriaLabel(turn, turnLabels));
  node.setAttribute('aria-pressed', selected ? 'true' : 'false');
  setBeginnerTooltip(node, 'flow-turn-node');
  node.style.left = `${turn.position.x}px`;
  node.style.top = `${turn.position.y}px`;
  node.style.width = `${nodeWidth}px`;
  node.style.setProperty('--branch-color', branchColor);
  node.style.setProperty('--branch-glow', branchColor + '40');
  node.style.setProperty('--starter-branch-color', factionColor);
  node.style.setProperty('--starter-branch-glow', `${factionColor}40`);
  node.onclick = (e) => {
    e.stopPropagation();
    store.selectTurn(turn.turnNumber);
  };
  node.onkeydown = (event) => {
    if (event.target !== node) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      store.selectTurn(turn.turnNumber);
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      const currentState = store.get();
      if (currentState.selectedTurnNumber === turn.turnNumber && currentState.selectedChoiceIndex != null && turn.choices.length > 1) {
        store.deleteChoice(conv.id, turn.turnNumber, currentState.selectedChoiceIndex);
      } else if (turn.turnNumber > 1) {
        store.deleteTurn(conv.id, turn.turnNumber);
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      const shortcut = event.key.toLowerCase();
      if (shortcut === 'd') {
        event.preventDefault();
        onKeyboardShortcut(turn.turnNumber, 'duplicate-turn');
        return;
      }
      if (shortcut === 'c') {
        event.preventDefault();
        onKeyboardShortcut(turn.turnNumber, 'copy-turn');
        return;
      }
      if (shortcut === 'v') {
        event.preventDefault();
        onKeyboardShortcut(turn.turnNumber, 'paste-turn');
        return;
      }
    }

    if (event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const shortcut = event.key.toLowerCase();
      if (shortcut === 't') {
        event.preventDefault();
        onKeyboardShortcut(turn.turnNumber, 'add-turn');
        return;
      }
      if (shortcut === 'c') {
        event.preventDefault();
        onKeyboardShortcut(turn.turnNumber, 'add-choice');
        return;
      }
      if (shortcut === 'l') {
        event.preventDefault();
        onKeyboardShortcut(turn.turnNumber, 'connect-branch');
        return;
      }
      if (shortcut === 'd') {
        event.preventDefault();
        onKeyboardShortcut(turn.turnNumber, 'disconnect-branch');
        return;
      }
    }

    const direction = getArrowDirection(event.key);
    if (!direction) return;

    const nextTurn = findNearestTurn(conv.turns, turn.turnNumber, direction);
    if (!nextTurn) return;
    event.preventDefault();
    onFocusTurn(nextTurn.turnNumber);
  };

  let dragPosition: { x: number; y: number } | null = null;

  node.onpointerdown = (e) => {
    if (e.button !== 0 || e.pointerType === 'touch' && !e.isPrimary) return;
    const target = e.target as HTMLElement;
    if (target.closest('.turn-choice-item, .choice-output-port, .turn-input-port, .turn-label-input, .turn-color-input')) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = turn.position.x;
    const origY = turn.position.y;
    const pointerId = e.pointerId;
    e.preventDefault();
    e.stopPropagation();
    node.setPointerCapture(pointerId);

    let lastMoveAt = performance.now();
    let lastClientX = startX;
    let lastClientY = startY;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      onDragStateChange(true);
      const nextPosition = {
        x: Math.max(0, origX + (ev.clientX - startX) / viewState.zoom),
        y: Math.max(0, origY + (ev.clientY - startY) / viewState.zoom),
      };
      dragPosition = nextPosition;
      node.style.left = `${nextPosition.x}px`;
      node.style.top = `${nextPosition.y}px`;

      const now = performance.now();
      const elapsed = Math.max(8, now - lastMoveAt);
      const velocityX = (ev.clientX - lastClientX) / elapsed;
      const velocityY = (ev.clientY - lastClientY) / elapsed;
      const tiltY = clamp(velocityX * 14, -3.2, 3.2);
      const tiltX = clamp(-velocityY * 14, -3.2, 3.2);
      node.style.setProperty('--drag-tilt-x', `${tiltX.toFixed(2)}deg`);
      node.style.setProperty('--drag-tilt-y', `${tiltY.toFixed(2)}deg`);
      node.classList.add('is-dragging-node');

      lastMoveAt = now;
      lastClientX = ev.clientX;
      lastClientY = ev.clientY;
      onPreviewPosition(new Map([[turn.turnNumber, nextPosition]]), new Set([turn.turnNumber]));
    };

    const onUp = () => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
      if (node.hasPointerCapture(pointerId)) {
        node.releasePointerCapture(pointerId);
      }
      onDragStateChange(false);
      onPreviewPosition();
      node.classList.remove('is-dragging-node');
      node.style.removeProperty('--drag-tilt-x');
      node.style.removeProperty('--drag-tilt-y');
      if (!dragPosition) return;
      store.updateTurnPosition(conv.id, turn.turnNumber, dragPosition);
      dragPosition = null;
    };

    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onUp);
  };

  const inputPort = document.createElement('button');
  inputPort.type = 'button';
  inputPort.className = 'turn-input-port';
  inputPort.title = `Incoming connections for ${turnLabels.getLongLabel(turn.turnNumber)}. Drop a dragged choice here to connect it, or press Escape to cancel the drag.`;
  inputPort.setAttribute('aria-label', `Incoming connections for ${turnLabels.getLongLabel(turn.turnNumber)}. Drag a choice connector here to link it, then release to connect or press Escape to cancel.`);
  setBeginnerTooltip(inputPort, 'flow-input-port');
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
  labelSpan.title = 'Click to rename this turn';
  labelSpan.style.cursor = 'pointer';
  setBeginnerTooltip(labelSpan, 'flow-turn-label');
  labelSpan.onclick = (e) => {
    e.stopPropagation();
    labelSpan.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'turn-label-input';
    input.value = turn.customLabel || '';
    input.placeholder = turn.turnNumber === 1
      ? (conv.label.trim() || `Story ${conv.id}`)
      : `Branch ${turn.turnNumber}`;
    input.maxLength = 32;
    let hasCommitted = false;
    const commitEdit = (options: { immediate?: boolean } = {}) => {
      if (hasCommitted) return;
      hasCommitted = true;
      if (options.immediate) {
        input.dataset.allowImmediateRender = 'true';
      }
      store.setTurnCustomLabel(conv.id, turn.turnNumber, input.value);
    };
    input.onblur = () => commitEdit();
    input.onkeydown = (ke) => {
      if (ke.key === 'Enter') {
        ke.preventDefault();
        commitEdit({ immediate: true });
        input.blur();
      }
      if (ke.key === 'Escape') {
        input.value = turn.customLabel || '';
        input.blur();
      }
      ke.stopPropagation();
    };
    header.insertBefore(input, labelSpan.nextSibling);
    input.focus();
    input.select();
  };
  header.appendChild(labelSpan);

  const turnChannelBadge = document.createElement('span');
  turnChannelBadge.className = 'flow-channel-badge';
  turnChannelBadge.textContent = channelBadgeLabel(normalizeChannel(turn.channel, 'pda'));
  turnChannelBadge.title = `Turn visibility: ${turnChannelBadge.textContent}`;
  header.appendChild(turnChannelBadge);

  // Color picker (small dot, click to change branch color)
  const colorDot = document.createElement('input');
  colorDot.type = 'color';
  colorDot.className = 'turn-color-input';
  colorDot.value = branchColor;
  colorDot.title = 'Change branch color';
  setBeginnerTooltip(colorDot, 'flow-turn-color');
  const applyTurnColor = (event: Event) => {
    event.stopPropagation();
    store.setTurnColor(conv.id, turn.turnNumber, colorDot.value);
  };
  colorDot.onchange = applyTurnColor;
  colorDot.onclick = (e) => e.stopPropagation();
  header.appendChild(colorDot);

  const stats = document.createElement('span');
  stats.className = 'turn-stats';
  const outgoingCount = turn.choices.filter(choice => choice.continueTo != null || hasPauseOutcome(choice)).length;
  stats.textContent = `${turn.choices.length}C · ${outgoingCount}L`;
  header.appendChild(stats);

  const turnActions = document.createElement('div');
  turnActions.className = 'turn-actions';

  const duplicateBtn = createTurnActionButton('Duplicate turn', () => {
    onKeyboardShortcut(turn.turnNumber, 'duplicate-turn');
  });
  setBeginnerTooltip(duplicateBtn, 'flow-turn-actions');
  duplicateBtn.appendChild(createIcon('duplicate'));
  turnActions.appendChild(duplicateBtn);

  const copyBtn = createTurnActionButton('Copy turn', () => {
    onKeyboardShortcut(turn.turnNumber, 'copy-turn');
  }, 'Copy');
  setBeginnerTooltip(copyBtn, 'flow-turn-actions');
  turnActions.appendChild(copyBtn);

  const pasteBtn = createTurnActionButton('Paste copied turn after this one', () => {
    onKeyboardShortcut(turn.turnNumber, 'paste-turn');
  }, 'Paste');
  setBeginnerTooltip(pasteBtn, 'flow-turn-actions');
  pasteBtn.disabled = !canPasteTurn;
  turnActions.appendChild(pasteBtn);

  if (turn.turnNumber > 1) {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon btn-sm';
    delBtn.textContent = '×';
    delBtn.title = 'Delete turn';
    delBtn.style.color = 'var(--danger)';
    setBeginnerTooltip(delBtn, 'flow-turn-actions');
    delBtn.onclick = (e) => {
      e.stopPropagation();
      store.deleteTurn(conv.id, turn.turnNumber);
    };
    turnActions.appendChild(delBtn);
  }
  header.appendChild(turnActions);
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
    const choiceBranchColor = getChoiceBranchColor(conv, choice, branchColor, factionColor);
    const item = document.createElement('li');
    item.setAttribute('role', 'group');
    item.setAttribute('aria-label', `Choice ${choice.index}`);
    const choiceActive = selected && state.selectedChoiceIndex === choice.index;
    item.className = 'turn-choice-item' + (choiceActive ? ' selected' : '');
    item.dataset.choiceIndex = String(choice.index);
    item.style.setProperty('--choice-branch-color', choiceBranchColor);
    item.style.setProperty('--choice-branch-glow', `${choiceBranchColor}40`);
    setBeginnerTooltip(item, 'flow-choice-row');
    item.onclick = (e) => {
      e.stopPropagation();
      store.batch(() => {
        store.selectTurn(turn.turnNumber);
        store.selectChoice(choice.index);
      });
    };

    const continuationTarget = choice.continueTo == null
      ? null
      : conv.turns.find(candidate => candidate.turnNumber === choice.continueTo) ?? null;
    const linkPointsBehind = Boolean(
      continuationTarget
      && continuationTarget.position.x < turn.position.x,
    );

    const port = document.createElement('button');
    port.type = 'button';
    port.className = `choice-output-port${linkPointsBehind ? ' choice-output-port-left' : ''}`;
    port.dataset.choicePort = String(choice.index);
    port.setAttribute('aria-label', choice.continueTo != null
      ? `Connection handle for choice ${choice.index}. Drag to retarget this link, double-click to create a new connected turn, or use the unlink button to disconnect.`
      : `Connection handle for choice ${choice.index}. Drag to connect it to another turn, or double-click to create a new connected turn.`);
    setBeginnerTooltip(port, 'flow-output-port');
    port.title = choice.continueTo != null
      ? `Drag to change the destination for Choice ${choice.index}. Double-click to create a new connected turn, or use Unlink to disconnect. Press Escape to cancel a drag.`
      : `Drag to connect Choice ${choice.index} to another turn. Double-click to create a new connected turn. Press Escape to cancel a drag.`;
    const portDot = document.createElement('span');
    portDot.className = 'choice-output-port-dot';
    portDot.style.background = `linear-gradient(180deg, ${choiceBranchColor}cc, ${choiceBranchColor}80)`;
    port.appendChild(portDot);
    port.onpointerdown = (event) => {
      if (event.button !== 0) return;
      onChoicePortDragStart(choice.index, event);
    };
    port.ondblclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onCreateConnectedTurn(choice.index);
    };

    const num = document.createElement('span');
    num.className = 'choice-number';
    num.textContent = String(choice.index);

    // Player dialogue text
    const preview = document.createElement('span');
    preview.className = 'choice-preview';
    preview.textContent = choice.text || '(empty)';
    preview.style.setProperty('-webkit-line-clamp', String(layout.previewLines));

    if (linkPointsBehind) {
      item.classList.add('choice-link-backward');
      item.append(port, num, preview);
    } else {
      item.append(num, preview);
    }

    // Badges
    const effectiveTurnChannel = normalizeChannel(turn.channel, 'pda');
    const effectiveChoiceChannel = normalizeChannel(choice.channel, effectiveTurnChannel);

    if (choice.continueTo != null) {
      const unlinkButton = document.createElement('button');
      unlinkButton.type = 'button';
      unlinkButton.className = 'choice-unlink-btn';
      unlinkButton.textContent = 'Unlink';
      unlinkButton.title = `Disconnect Choice ${choice.index} from ${turnLabels.getLongLabel(choice.continueTo)}`;
      unlinkButton.setAttribute('aria-label', `Disconnect choice ${choice.index} from ${turnLabels.getLongLabel(choice.continueTo)}`);
      setBeginnerTooltip(unlinkButton, 'flow-unlink');
      unlinkButton.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        store.batch(() => {
          store.clearChoiceContinuation(conv.id, turn.turnNumber, choice.index);
          store.selectTurn(turn.turnNumber);
          store.selectChoice(choice.index);
        });
      };
      item.appendChild(unlinkButton);

      const handoffBadge = document.createElement('span');
      handoffBadge.className = 'flow-channel-badge flow-channel-badge-handoff';
      const rawContinueChannel = choice.continueChannel ?? choice.continue_channel;
      const effectiveContinueChannel = normalizeChannel(rawContinueChannel, effectiveChoiceChannel);
      handoffBadge.textContent = `→${channelBadgeLabel(effectiveContinueChannel)}`;
      handoffBadge.title = `Continuation channel: ${channelBadgeLabel(effectiveContinueChannel)}`;
      item.appendChild(handoffBadge);
    }

    if (hasPauseOutcome(choice)) {
      const pauseBadge = document.createElement('span');
      pauseBadge.className = 'choice-branch-badge';
      pauseBadge.textContent = 'pause';
      item.appendChild(pauseBadge);
    }

    if ((choice.preconditions ?? []).length > 0) {
      const precondBadge = document.createElement('span');
      precondBadge.className = 'choice-branch-badge';
      precondBadge.textContent = `${choice.preconditions.length} cond`;
      precondBadge.title = `${choice.preconditions.length} choice precondition${choice.preconditions.length === 1 ? '' : 's'}`;
      item.appendChild(precondBadge);
    }

    const choiceChannelBadge = document.createElement('span');
    choiceChannelBadge.className = 'flow-channel-badge';
    choiceChannelBadge.textContent = channelBadgeLabel(effectiveChoiceChannel);
    choiceChannelBadge.title = `Choice visibility: ${choiceChannelBadge.textContent}`;
    item.appendChild(choiceChannelBadge);

    // Outcomes count (standard/detailed only)
    if (density !== 'compact' && choice.outcomes.length > 0) {
      const outBadge = document.createElement('span');
      outBadge.className = 'choice-outcome-badge';
      outBadge.textContent = `${choice.outcomes.length} out`;
      item.appendChild(outBadge);
    }

    const branchButton = document.createElement('button');
    branchButton.type = 'button';
    branchButton.className = 'btn-icon btn-sm';
    branchButton.textContent = '+';
    branchButton.title = `Create a new turn for Choice ${choice.index}`;
    branchButton.setAttribute('aria-label', `Create a new branch turn for choice ${choice.index}`);
    setBeginnerTooltip(branchButton, 'flow-branch-add');
    branchButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      onCreateConnectedTurn(choice.index);
    };
    item.appendChild(branchButton);

    if (!linkPointsBehind) {
      item.appendChild(port);
    }
    choicesList.appendChild(item);

    // NPC Reply — show below player choice in standard/detailed modes
    if (choice.reply && density !== 'compact') {
      const replyRow = document.createElement('li');
      replyRow.className = 'turn-npc-reply';
      replyRow.dataset.choiceIndex = String(choice.index);
      replyRow.onclick = (e) => {
        e.stopPropagation();
        store.batch(() => {
          store.selectTurn(turn.turnNumber);
          store.selectChoice(choice.index);
        });
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
    const branchPrecondCount = turn.preconditions?.length ?? 0;
    const totalOutcomes = turn.choices.reduce((s, c) => s + c.outcomes.length, 0);
    footer.textContent = `${turn.choices.length} choice${turn.choices.length !== 1 ? 's' : ''} · ${outgoingCount} link${outgoingCount !== 1 ? 's' : ''} · ${totalOutcomes} outcome${totalOutcomes !== 1 ? 's' : ''}`;
    if (turn.turnNumber === 1 && precondCount > 0) {
      footer.textContent += ` · ${precondCount} precond`;
    }
    if (branchPrecondCount > 0) {
      footer.textContent += ` · ${branchPrecondCount} branch cond`;
    }
    body.appendChild(footer);
  }

  node.appendChild(body);
  return node;
}

function buildTurnAriaLabel(
  turn: Turn,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): string {
  const opening = turn.openingMessage ? ` Opening message: ${truncate(turn.openingMessage, 80)}.` : '';
  const connectionHint = ' Drag a choice connector onto this turn to link it here, or press Escape while dragging to cancel.';
  return `${turnLabels.getLongLabel(turn.turnNumber)}. ${turn.choices.length} choice${turn.choices.length === 1 ? '' : 's'}.${opening}${connectionHint} Shift+T adds a turn, Shift+C adds a choice, Shift+L connects the selected branch here, Shift+D disconnects the current branch. Control or Command+D duplicates this turn, Control or Command+C copies it, and Control or Command+V pastes the copied turn here.`;
}

function createTurnActionButton(title: string, onClick: () => void, label?: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = label ? 'btn-sm' : 'btn-icon btn-sm';
  button.title = title;
  button.setAttribute('aria-label', title);
  if (label) button.textContent = label;
  button.onclick = (event) => {
    event.stopPropagation();
    onClick();
  };
  return button;
}

type ArrowDirection = 'left' | 'right' | 'up' | 'down';

function getArrowDirection(key: string): ArrowDirection | null {
  if (key === 'ArrowLeft') return 'left';
  if (key === 'ArrowRight') return 'right';
  if (key === 'ArrowUp') return 'up';
  if (key === 'ArrowDown') return 'down';
  return null;
}

function findNearestTurn(turns: Turn[], currentTurnNumber: number, direction: ArrowDirection): Turn | null {
  const currentTurn = turns.find((item) => item.turnNumber === currentTurnNumber);
  if (!currentTurn) return null;

  const candidates = turns
    .filter((item) => item.turnNumber !== currentTurnNumber)
    .map((item) => {
      const dx = item.position.x - currentTurn.position.x;
      const dy = item.position.y - currentTurn.position.y;
      return { item, dx, dy, score: Math.hypot(dx, dy) + (direction === 'left' || direction === 'right' ? Math.abs(dy) * 0.45 : Math.abs(dx) * 0.45) };
    })
    .filter(({ dx, dy }) => {
      if (direction === 'left') return dx < -8;
      if (direction === 'right') return dx > 8;
      if (direction === 'up') return dy < -8;
      return dy > 8;
    })
    .sort((a, b) => a.score - b.score);

  return candidates[0]?.item ?? null;
}

function drawEdges(options: {
  svg: SVGSVGElement;
  conv: Conversation;
  edges: EdgeDescriptor[];
  nodeElements: Map<number, HTMLElement>;
  edgeElements: Map<string, SVGGElement>;
  positionOverrides?: TurnPositionMap;
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>;
  factionColor: string;
  onlyTurnNumbers?: ReadonlySet<number>;
}): void {
  const { svg, conv, edges, nodeElements, edgeElements, positionOverrides, turnLabels, factionColor, onlyTurnNumbers } = options;
  const defs = svg.querySelector('defs');
  const turnsByNumber = new Map(conv.turns.map(turn => [turn.turnNumber, turn]));
  const choiceAnchorCache = new Map<string, { x: number; y: number } | null>();
  const turnInputAnchorCache = new Map<number, { x: number; y: number } | null>();

  const getCachedChoiceAnchor = (turnNumber: number, choiceIndex: number): { x: number; y: number } | null => {
    const key = `${turnNumber}:${choiceIndex}`;
    if (choiceAnchorCache.has(key)) return choiceAnchorCache.get(key) ?? null;
    const anchor = getChoiceAnchor(turnNumber, choiceIndex, conv, nodeElements, positionOverrides, turnsByNumber);
    choiceAnchorCache.set(key, anchor);
    return anchor;
  };

  const getCachedTurnInputAnchor = (turnNumber: number): { x: number; y: number } | null => {
    if (turnInputAnchorCache.has(turnNumber)) return turnInputAnchorCache.get(turnNumber) ?? null;
    const anchor = getTurnInputAnchor(turnNumber, conv, nodeElements, positionOverrides, turnsByNumber);
    turnInputAnchorCache.set(turnNumber, anchor);
    return anchor;
  };

  for (const edge of edges) {
    if (onlyTurnNumbers && !onlyTurnNumbers.has(edge.sourceTurnNumber) && !onlyTurnNumbers.has(edge.targetTurnNumber)) {
      continue;
    }
    const sourceTurn = turnsByNumber.get(edge.sourceTurnNumber);
    const targetTurn = turnsByNumber.get(edge.targetTurnNumber);
    if (!sourceTurn || !targetTurn) continue;

    const sourceAnchor = getCachedChoiceAnchor(edge.sourceTurnNumber, edge.sourceChoiceIndex);
    const targetAnchor = getCachedTurnInputAnchor(edge.targetTurnNumber);
    if (!sourceAnchor || !targetAnchor) continue;

    const key = edgeKey(edge);
    const pathD = buildEdgePath(sourceAnchor, targetAnchor, edge.offsetIndex);
    const labelAnchor = getLabelAnchor(sourceAnchor, targetAnchor, edge.offsetIndex);
    const highlightSuffix = edge.highlight !== 'normal' ? ` is-${edge.highlight}` : '';

    const existing = edgeElements.get(key);
    if (existing) {
      // Update existing group in-place (path + label position + highlight)
      existing.setAttribute('class', `flow-edge${highlightSuffix}`);
      const path = existing.querySelector('.flow-edge-path') as SVGPathElement | null;
      if (path) {
        path.setAttribute('d', pathD);
        path.setAttribute('class', `flow-edge-path ${edge.pathClassName}${highlightSuffix}`);
      }
      const packet = existing.querySelector('.flow-edge-packet') as SVGPathElement | null;
      if (packet) {
        packet.setAttribute('d', pathD);
        packet.setAttribute('class', `flow-edge-packet ${edge.pathClassName}${highlightSuffix}`);
      }
      const label = existing.querySelector('.flow-edge-label') as SVGTextElement | null;
      if (label) {
        label.setAttribute('x', String(labelAnchor.x));
        label.setAttribute('y', String(labelAnchor.y));
        label.setAttribute('class', `flow-edge-label ${edge.textClassName}${highlightSuffix}`);
      }
    } else {
      // Create new edge group
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', `flow-edge${highlightSuffix}`);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('stroke', edge.color);
      path.style.setProperty('--flow-edge-color', edge.color);
      path.setAttribute('class', `flow-edge-path ${edge.pathClassName}${highlightSuffix}`);
      path.setAttribute('marker-end', `url(#${ensureMarker(defs, edge.kind, edge.color)})`);
      path.dataset.sourceTurnNumber = String(edge.sourceTurnNumber);
      path.dataset.sourceChoiceIndex = String(edge.sourceChoiceIndex);
      path.dataset.targetTurnNumber = String(edge.targetTurnNumber);
      setBeginnerTooltip(path as unknown as HTMLElement, 'flow-edge');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = edge.kind === 'continue'
        ? `Choice ${edge.sourceChoiceIndex} → ${turnLabels.getLongLabel(edge.targetTurnNumber)} (click to select, right-click to disconnect)`
        : `Pause branch from Choice ${edge.sourceChoiceIndex} to ${turnLabels.getLongLabel(edge.targetTurnNumber)}`;
      path.appendChild(title);
      path.onclick = (event) => {
        event.stopPropagation();
        store.batch(() => {
          store.selectTurn(edge.sourceTurnNumber);
          store.selectChoice(edge.sourceChoiceIndex);
        });
      };
      path.oncontextmenu = (event) => {
        if (edge.kind !== 'continue') return;
        event.preventDefault();
        store.clearChoiceContinuation(conv.id, edge.sourceTurnNumber, edge.sourceChoiceIndex);
      };
      group.appendChild(path);

      const packetPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      packetPath.setAttribute('d', pathD);
      packetPath.setAttribute('class', `flow-edge-packet ${edge.pathClassName}${highlightSuffix}`);
      packetPath.style.setProperty('--flow-edge-color', edge.color);
      packetPath.setAttribute('aria-hidden', 'true');
      group.appendChild(packetPath);

      const labelButton = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelButton.setAttribute('x', String(labelAnchor.x));
      labelButton.setAttribute('y', String(labelAnchor.y));
      labelButton.setAttribute('text-anchor', 'middle');
      labelButton.setAttribute('class', `flow-edge-label ${edge.textClassName}${highlightSuffix}`);
      labelButton.style.setProperty('--flow-edge-color', edge.color);
      labelButton.style.setProperty('--flow-edge-label-color', edge.color);
      labelButton.textContent = edge.label;
      labelButton.onclick = (event) => {
        event.stopPropagation();
        store.batch(() => {
          store.selectTurn(edge.sourceTurnNumber);
          store.selectChoice(edge.sourceChoiceIndex);
        });
      };
      group.appendChild(labelButton);

      svg.appendChild(group);
      edgeElements.set(key, group);
    }
  }
}

function redrawLiveEdges(flow: LiveFlowState): void {
  invalidatePortOffsetCache();
  const conv = store.getSelectedConversation();
  if (!conv) return;
  drawEdges({
    svg: flow.svg,
    conv,
    edges: flow.edges,
    nodeElements: flow.nodeElements,
    edgeElements: flow.edgeElements,
    turnLabels: flow.turnLabels,
    factionColor: flow.factionColor,
  });
}

function patchTurnNodeText(
  node: HTMLElement,
  conv: Conversation,
  turn: Turn,
  density: FlowDensity,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): void {
  const layout = getFlowNodeLayout(density);
  const turnIndex = conv.turns.indexOf(turn);
  const factionColor = FACTION_COLORS[getConversationFaction(conv, store.get().project.faction)];
  const branchColor = getBranchColor(turn, turnIndex, factionColor);
  const hasWarning = turn.choices.some(choice => !choice.text && !choice.reply);
  const label = node.querySelector('.turn-label');
  if (label) label.textContent = turnLabels.getLongLabel(turn.turnNumber);
  const stats = node.querySelector('.turn-stats');
  if (stats) {
    const outgoingCount = turn.choices.filter(choice => choice.continueTo != null || hasPauseOutcome(choice)).length;
    stats.textContent = `${turn.choices.length}C · ${outgoingCount}L`;
  }
  const opening = node.querySelector('.turn-npc-message');
  if (opening) {
    opening.textContent = truncate(turn.openingMessage ?? '', layout.messageChars);
  }
  node.classList.toggle('has-warning', hasWarning);
  node.setAttribute('aria-label', buildTurnAriaLabel(turn, turnLabels));
  node.style.width = `${getFlowNodeWidth(turn, turnLabels.getLongLabel(turn.turnNumber), density)}px`;
  node.style.setProperty('--branch-color', branchColor);
  node.style.setProperty('--branch-glow', branchColor + '40');

  for (const choice of turn.choices) {
    const item = node.querySelector(`.turn-choice-item[data-choice-index="${choice.index}"]`) as HTMLElement | null;
    const preview = item?.querySelector('.choice-preview');
    if (preview) preview.textContent = choice.text || '(empty)';
    const reply = node.querySelector(`.turn-npc-reply[data-choice-index="${choice.index}"] .npc-reply-text`);
    if (reply) reply.textContent = truncate(choice.reply, density === 'detailed' ? layout.messageChars : 60);
  }
}

function syncLiveViewportVisibility(flow: LiveFlowState): void {
  syncViewportVisibility({
    canvas: flow.canvas,
    viewState: flow.viewState,
    graphModel: flow.graphModel,
    nodeElements: flow.nodeElements,
    edgeElements: flow.edgeElements,
    selectedTurnNumber: flow.selectedTurnNumber,
    selectedChoiceIndex: flow.selectedChoiceIndex,
  });
}

function syncViewportVisibility(options: {
  canvas: HTMLElement;
  viewState: ViewState;
  graphModel: FlowGraphModel;
  nodeElements: Map<number, HTMLElement>;
  edgeElements: Map<string, SVGGElement>;
  selectedTurnNumber: number | null;
  selectedChoiceIndex: number | null;
}): void {
  const { canvas, viewState, graphModel, nodeElements, edgeElements, selectedTurnNumber } = options;
  const keepMounted = new Set<number>();
  if (selectedTurnNumber != null) keepMounted.add(selectedTurnNumber);
  const viewport = {
    left: (0 - viewState.panX) / viewState.zoom,
    top: (0 - viewState.panY) / viewState.zoom,
    right: (canvas.clientWidth - viewState.panX) / viewState.zoom,
    bottom: (canvas.clientHeight - viewState.panY) / viewState.zoom,
  };
  const visible = getVisibleFlowItems(graphModel, viewport, keepMounted);
  for (const [turnNumber, node] of nodeElements) {
    const isVisible = visible.turnNumbers.has(turnNumber);
    node.style.visibility = isVisible ? '' : 'hidden';
    node.style.pointerEvents = isVisible ? '' : 'none';
  }
  for (const [key, edge] of edgeElements) {
    edge.style.display = visible.edgeKeys.has(key) ? '' : 'none';
  }
}

function drawConnectionPreview(options: {
  svg: SVGSVGElement;
  conv: Conversation;
  nodeElements: Map<number, HTMLElement>;
  positionOverrides?: TurnPositionMap;
  preview: ConnectionPreview | null;
  factionColor: string;
}): void {
  const { svg, conv, nodeElements, positionOverrides, preview, factionColor } = options;
  const defs = svg.querySelector('defs');
  const turnsByNumber = new Map(conv.turns.map(turn => [turn.turnNumber, turn]));

  svg.querySelectorAll('.edge-preview, .flow-edge-preview-packet').forEach((element) => element.remove());
  if (!preview) return;

  const sourceAnchor = getChoiceAnchor(
    preview.sourceTurnNumber,
    preview.sourceChoiceIndex,
    conv,
    nodeElements,
    positionOverrides,
    turnsByNumber,
  );
  if (!sourceAnchor) return;

  const previewTarget = preview.hoveredTargetTurnNumber != null
    ? getTurnInputAnchor(preview.hoveredTargetTurnNumber, conv, nodeElements, positionOverrides, turnsByNumber) ?? preview.cursor
    : preview.cursor;
  const previewColor = getTurnBranchColor(conv, preview.sourceTurnNumber, factionColor) ?? BRANCH_PALETTE[0];
  const previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  previewPath.setAttribute('d', buildEdgePath(sourceAnchor, previewTarget, 0));
  previewPath.setAttribute('class', `flow-edge-path edge-preview${preview.invalidTarget ? ' edge-preview-invalid' : ''}`);
  previewPath.setAttribute('stroke', previewColor);
  previewPath.style.setProperty('--flow-edge-color', previewColor);
  previewPath.setAttribute('marker-end', `url(#${ensureMarker(defs, 'continue', previewColor)})`);
  svg.appendChild(previewPath);

  const previewPacket = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  previewPacket.setAttribute('d', buildEdgePath(sourceAnchor, previewTarget, 0));
  previewPacket.setAttribute('class', `flow-edge-packet flow-edge-preview-packet edge-preview${preview.invalidTarget ? ' edge-preview-invalid' : ''}`);
  previewPacket.style.setProperty('--flow-edge-color', previewColor);
  previewPacket.setAttribute('aria-hidden', 'true');
  svg.appendChild(previewPacket);
}

/**
 * Compute the offset of `element` relative to `ancestor` using getBoundingClientRect.
 * This is more reliable than walking the offsetParent chain, which can misfire when
 * CSS transforms, grid/flex layout, or nested positioning contexts are involved.
 */
// Port offset cache — offsets within a node don't change unless node content is rebuilt
const portOffsetCache = new Map<string, { left: number; top: number; width: number; height: number }>();

function getPortOffsetInNode(port: HTMLElement, node: HTMLElement, cacheKey?: string): { left: number; top: number; width: number; height: number } {
  if (cacheKey) {
    const cached = portOffsetCache.get(cacheKey);
    if (cached) return cached;
  }

  const nodeRect = node.getBoundingClientRect();
  const portRect = port.getBoundingClientRect();

  // Both rects are in screen pixels (scaled by any CSS transform).
  // Dividing by the node's scale factor converts back to the node's own coordinate space.
  const scaleX = nodeRect.width > 0 ? nodeRect.width / node.offsetWidth : 1;
  const scaleY = nodeRect.height > 0 ? nodeRect.height / node.offsetHeight : 1;

  const result = {
    left: (portRect.left - nodeRect.left) / scaleX,
    top: (portRect.top - nodeRect.top) / scaleY,
    width: portRect.width / scaleX,
    height: portRect.height / scaleY,
  };

  if (cacheKey) {
    portOffsetCache.set(cacheKey, result);
  }
  return result;
}

function invalidatePortOffsetCache(): void {
  portOffsetCache.clear();
}

function getChoiceAnchor(
  turnNumber: number,
  choiceIndex: number,
  conv: Conversation,
  nodeElements: Map<number, HTMLElement>,
  positionOverrides?: TurnPositionMap,
  turnsByNumber?: ReadonlyMap<number, Turn>,
): { x: number; y: number } | null {
  const turn = turnsByNumber?.get(turnNumber) ?? conv.turns.find(item => item.turnNumber === turnNumber);
  const node = nodeElements.get(turnNumber);
  const port = node?.querySelector(`[data-choice-port="${choiceIndex}"]`) as HTMLElement | null;
  if (!turn || !node || !port) return null;
  const position = positionOverrides?.get(turnNumber) ?? turn.position;
  const offset = getPortOffsetInNode(port, node, `choice:${turnNumber}:${choiceIndex}`);
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
  turnsByNumber?: ReadonlyMap<number, Turn>,
): { x: number; y: number } | null {
  const turn = turnsByNumber?.get(turnNumber) ?? conv.turns.find(item => item.turnNumber === turnNumber);
  const node = nodeElements.get(turnNumber);
  const port = node?.querySelector('.turn-input-port') as HTMLElement | null;
  if (!turn || !node || !port) return null;
  const position = positionOverrides?.get(turnNumber) ?? turn.position;
  const offset = getPortOffsetInNode(port, node, `input:${turnNumber}`);
  return {
    x: position.x + offset.left + offset.width / 2,
    y: position.y + offset.top + offset.height / 2,
  };
}

function buildEdgeDescriptors(
  conv: Conversation,
  selectedTurnNumber: number | null,
  selectedChoiceIndex: number | null,
  factionColor: string,
): EdgeDescriptor[] {
  const edges: EdgeDescriptor[] = [];
  const pairCounts = new Map<string, number>();
  const turnByNumber = new Map(conv.turns.map(turn => [turn.turnNumber, turn] as const));
  const turnIndexByNumber = new Map(conv.turns.map((turn, index) => [turn.turnNumber, index] as const));

  for (const turn of conv.turns) {
    for (const choice of turn.choices) {
      const targets = getChoiceTargets(choice, conv);
      for (const target of targets) {
        const pairKey = `${turn.turnNumber}:${target.turnNumber}:${target.kind}`;
        const offsetIndex = pairCounts.get(pairKey) ?? 0;
        pairCounts.set(pairKey, offsetIndex + 1);

        const targetTurn = turnByNumber.get(target.turnNumber);
        const targetTurnIndex = turnIndexByNumber.get(target.turnNumber) ?? 0;
        const targetBranchColor = targetTurn ? getBranchColor(targetTurn, targetTurnIndex, factionColor) : factionColor;

        edges.push({
          sourceTurnNumber: turn.turnNumber,
          sourceChoiceIndex: choice.index,
          targetTurnNumber: target.turnNumber,
          label: target.label,
          color: targetBranchColor,
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

function getChoiceTargets(choice: Choice, conv: Conversation): Array<{ turnNumber: number; label: string; kind: EdgeKind }> {
  const targets: Array<{ turnNumber: number; label: string; kind: EdgeKind }> = [];

  if (choice.continueTo != null) {
    targets.push({
      turnNumber: choice.continueTo,
      label: `C${choice.index}`,
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
        kind: 'pause-success',
      });
    }

    if (!Number.isNaN(failTurn)) {
      targets.push({
        turnNumber: failTurn,
        label: 'fail',
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

function buildEdgePath(source: { x: number; y: number }, target: { x: number; y: number }, laneOffset: number): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const lane = laneOffset * 20;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const horizontalBias = absDx >= absDy;

  if (horizontalBias) {
    const forward = dx >= 0 ? 1 : -1;
    const baseSpread = clamp(absDx * 0.34, 34, 120);
    const cross = clamp(absDy * 0.2, 8, 42) * Math.sign(dy || lane || 1);
    const cp1x = source.x + forward * (baseSpread + Math.max(0, lane * 0.2));
    const cp2x = target.x - forward * (baseSpread + EDGE_MIN_CLEARANCE);
    const cp1y = source.y + lane + cross;
    const cp2y = target.y + lane - cross;
    return `M${source.x},${source.y} C${cp1x},${cp1y} ${cp2x},${cp2y} ${target.x},${target.y}`;
  }

  const verticalDirection = dy >= 0 ? 1 : -1;
  const horizontalDirection = dx >= 0 ? 1 : -1;
  const sideClearance = clamp(absDx * 0.45, EDGE_MIN_CLEARANCE + 12, 76) * horizontalDirection;
  const arcClearance = clamp(absDy * 0.3, EDGE_MIN_CLEARANCE + 8, 84) * verticalDirection;
  const cp1x = source.x + sideClearance + lane;
  const cp1y = source.y + arcClearance * 0.45;
  const cp2x = target.x - sideClearance;
  const cp2y = target.y - arcClearance * 0.45 + lane;

  return `M${source.x},${source.y} C${cp1x},${cp1y} ${cp2x},${cp2y} ${target.x},${target.y}`;
}

function getLabelAnchor(source: { x: number; y: number }, target: { x: number; y: number }, offsetIndex: number): { x: number; y: number } {
  return {
    x: source.x + (target.x - source.x) / 2,
    y: source.y + (target.y - source.y) / 2 + offsetIndex * 14 - 10,
  };
}

function createMarkerDefs(): SVGDefsElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'defs');
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

function getTurnBranchColor(conv: Conversation, turnNumber: number, factionColor?: string): string | null {
  const targetIndex = conv.turns.findIndex(turn => turn.turnNumber === turnNumber);
  if (targetIndex === -1) return null;
  const targetTurn = conv.turns[targetIndex];
  return getBranchColor(targetTurn, targetIndex, factionColor);
}

function ensureMarker(defs: SVGDefsElement | null, kind: EdgeKind, color: string): string {
  const markerId = `marker-${kind}-${color.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  if (!defs) return markerId;
  if (!defs.querySelector(`[id="${markerId}"]`)) {
    defs.appendChild(createMarker(markerId, color));
  }
  return markerId;
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

function normalizeChannel(channel: ConversationChannel | undefined, fallback: 'pda' | 'f2f'): 'pda' | 'f2f' {
  if (channel === 'pda' || channel === 'f2f') return channel;
  return fallback;
}

function channelBadgeLabel(channel: 'pda' | 'f2f'): string {
  if (channel === 'pda') return 'PDA';
  return 'F2F';
}

function dispatchCursorState(canvas: HTMLElement, kind: 'panning' | 'dragging' | 'linking', active: boolean): void {
  canvas.dispatchEvent(new CustomEvent('flow-cursor-state', { detail: { kind, active } }));
}

function wireCanvasInteractions(options: {
  canvas: HTMLElement;
  viewState: ViewState;
  applyView: () => void;
  onBackgroundClick: () => void;
  onInteractionStateChange: (active: boolean, releaseDelayMs?: number) => void;
}): void {
  const { canvas, viewState, applyView, onBackgroundClick, onInteractionStateChange } = options;

  type ActivePointer = { clientX: number; clientY: number };
  const activePointers = new Map<number, ActivePointer>();
  let panPointerId: number | null = null;
  let pinchState: {
    distance: number;
    zoom: number;
    worldX: number;
    worldY: number;
    centerX: number;
    centerY: number;
  } | null = null;
  let panFrame = 0;
  const scheduleView = (): void => {
    if (panFrame !== 0) return;
    panFrame = requestAnimationFrame(() => {
      panFrame = 0;
      applyView();
    });
  };
  const getPinchMetrics = (): { distance: number; centerX: number; centerY: number } | null => {
    if (activePointers.size < 2) return null;
    const [first, second] = [...activePointers.values()];
    if (!first || !second) return null;
    const rect = canvas.getBoundingClientRect();
    const centerClientX = (first.clientX + second.clientX) / 2;
    const centerClientY = (first.clientY + second.clientY) / 2;
    return {
      distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
      centerX: centerClientX - rect.left,
      centerY: centerClientY - rect.top,
    };
  };
  const beginPinch = (): void => {
    const metrics = getPinchMetrics();
    if (!metrics || metrics.distance === 0) return;
    pinchState = {
      distance: metrics.distance,
      zoom: viewState.zoom,
      worldX: (metrics.centerX - viewState.panX) / viewState.zoom,
      worldY: (metrics.centerY - viewState.panY) / viewState.zoom,
      centerX: metrics.centerX,
      centerY: metrics.centerY,
    };
    canvas.classList.add('is-panning');
    dispatchCursorState(canvas, 'panning', true);
    onInteractionStateChange(true);
  };
  const updatePinch = (): void => {
    if (!pinchState) return;
    const metrics = getPinchMetrics();
    if (!metrics || pinchState.distance === 0) return;
    const nextZoom = clamp(pinchState.zoom * (metrics.distance / pinchState.distance), MIN_ZOOM, MAX_ZOOM);
    viewState.zoom = nextZoom;
    viewState.panX = metrics.centerX - pinchState.worldX * nextZoom;
    viewState.panY = metrics.centerY - pinchState.worldY * nextZoom;
    pinchState.centerX = metrics.centerX;
    pinchState.centerY = metrics.centerY;
    scheduleView();
  };
  const endInteractionIfIdle = (): void => {
    if (activePointers.size > 0) return;
    if (panFrame !== 0) {
      cancelAnimationFrame(panFrame);
      panFrame = 0;
    }
    applyView();
    canvas.classList.remove('is-panning');
    dispatchCursorState(canvas, 'panning', false);
    onInteractionStateChange(false, 100);
    panPointerId = null;
    pinchState = null;
  };

  canvas.onpointerdown = (event) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 && event.button !== 1) return;
    if (target.closest('.turn-node, .flow-controls, .flow-edge')) return;

    activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    canvas.setPointerCapture(event.pointerId);

    if (activePointers.size === 2) {
      beginPinch();
      event.preventDefault();
      return;
    }

    if (activePointers.size > 1) return;
    panPointerId = event.pointerId;
    const startPanX = event.clientX;
    const startPanY = event.clientY;
    const originPanX = viewState.panX;
    const originPanY = viewState.panY;
    let moved = false;

    canvas.classList.add('is-panning');
    dispatchCursorState(canvas, 'panning', true);
    onInteractionStateChange(true);
    event.preventDefault();

    const onMove = (moveEvent: PointerEvent) => {
      const activePointer = activePointers.get(moveEvent.pointerId);
      if (!activePointer) return;
      activePointers.set(moveEvent.pointerId, { clientX: moveEvent.clientX, clientY: moveEvent.clientY });
      if (pinchState) {
        updatePinch();
        return;
      }
      if (moveEvent.pointerId !== panPointerId) return;
      moved = true;
      viewState.panX = originPanX + (moveEvent.clientX - startPanX);
      viewState.panY = originPanY + (moveEvent.clientY - startPanY);
      scheduleView();
    };

    const onUp = (upEvent: PointerEvent) => {
      activePointers.delete(upEvent.pointerId);
      if (canvas.hasPointerCapture(upEvent.pointerId)) {
        canvas.releasePointerCapture(upEvent.pointerId);
      }
      if (activePointers.size === 1 && pinchState) {
        pinchState = null;
        const [remainingId, remainingPointer] = [...activePointers.entries()][0]!;
        panPointerId = remainingId;
        viewState.panX = viewState.panX;
        viewState.panY = viewState.panY;
        moved = true;
        const resumeStartX = remainingPointer.clientX;
        const resumeStartY = remainingPointer.clientY;
        const resumeOriginX = viewState.panX;
        const resumeOriginY = viewState.panY;
        const resumeMove = (resumeEvent: PointerEvent) => {
          const current = activePointers.get(resumeEvent.pointerId);
          if (!current) return;
          activePointers.set(resumeEvent.pointerId, { clientX: resumeEvent.clientX, clientY: resumeEvent.clientY });
          if (pinchState) {
            updatePinch();
            return;
          }
          if (resumeEvent.pointerId !== panPointerId) return;
          viewState.panX = resumeOriginX + (resumeEvent.clientX - resumeStartX);
          viewState.panY = resumeOriginY + (resumeEvent.clientY - resumeStartY);
          scheduleView();
        };
        canvas.removeEventListener('pointermove', onMove);
        canvas.addEventListener('pointermove', resumeMove);
        const cleanupResume = (resumeEndEvent: PointerEvent) => {
          activePointers.delete(resumeEndEvent.pointerId);
          canvas.removeEventListener('pointermove', resumeMove);
          canvas.removeEventListener('pointerup', cleanupResume);
          canvas.removeEventListener('pointercancel', cleanupResume);
          endInteractionIfIdle();
        };
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.addEventListener('pointerup', cleanupResume);
        canvas.addEventListener('pointercancel', cleanupResume);
        return;
      }
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      endInteractionIfIdle();
      if (!moved && activePointers.size === 0) onBackgroundClick();
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
  };

  let wheelFrame = 0;
  canvas.onwheel = (event) => {
    event.preventDefault();
    onInteractionStateChange(true);
    const factor = event.deltaY > 0 ? 1 / 1.1 : 1.1;
    const rect = canvas.getBoundingClientRect();
    const ox = event.clientX - rect.left;
    const oy = event.clientY - rect.top;
    zoomAtViewportPoint(canvas, viewState, factor, ox, oy, () => {
      if (wheelFrame === 0) {
        wheelFrame = requestAnimationFrame(() => {
          wheelFrame = 0;
          applyView();
        });
      }
    });
    onInteractionStateChange(false, 120);
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

function spreadOffset(index: number): number {
  if (index === 0) return 0;
  const magnitude = Math.ceil(index / 2);
  return index % 2 === 0 ? magnitude : -magnitude;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
