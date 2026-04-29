// P.A.N.D.A. Conversation Editor — Visual Flow Editor (Center Panel)

import { store, type StateChange } from '../lib/state';
import { requestFlowCenter, setActiveFlowViewport, type FlowViewportApi } from '../lib/flow-navigation';
import { createTurnDisplayLabeler } from '../lib/turn-labels';
import { createOnboardingNudge } from './Onboarding';
import { FACTION_COLORS } from '../lib/faction-colors';
import { estimateFlowNodeHeight, FLOW_DEFAULT_TURN_POSITION, FLOW_WORKSPACE_MIN_HEIGHT, FLOW_WORKSPACE_MIN_WIDTH, getFlowNodeLayout } from '../lib/flow-layout';
import { buildFlowGraphModel, getFlowVisibilityOverscan, type FlowGraphModel, type FlowGraphNode, type FlowViewport } from '../lib/flow-graph-model';
import { createIcon } from './icons';
import { createFlowCursorSystem, type FlowCursorSystem } from './FlowCursor';
import { createCatalogPickerPanelEditor } from './CatalogPickerPanel';
import type { Choice, Conversation, ConversationChannel, FlowAnnotation, FlowLineAnnotation, FlowLineSetAnnotation, FlowNoteAnnotation, Outcome, PreconditionEntry, SimplePrecondition, Turn } from '../lib/types';
import { getConversationFaction } from '../lib/types';
import type { BranchInlinePanelState, FlowDensity } from '../lib/state';
import type { CommandSchema } from '../lib/schema';
import { OUTCOME_SCHEMAS, PRECONDITION_SCHEMAS } from '../lib/schema';
import { measurePerf, recordPerf } from '../lib/perf';
import { setBeginnerTooltip } from '../lib/beginner-tooltips';
import { createCollabPresenceLayer } from './CollabPresenceLayer';
import { sendCollabCursorPing } from '../lib/collab-session';
import { STORY_NPC_OPTIONS } from '../lib/generated/story-npc-catalog';
import { renderBranchInlinePanel } from './BranchInlinePanel';
import { parseOutcomeResumeTurnNumbers } from '../lib/outcome-branching';
import { collectSegmentStartTurns as collectBranchSegmentStartTurns } from '../lib/branch-segments';

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
  bend: number;
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
type FlowAnnotationTool = 'select' | 'draw' | 'text';
type BranchAuthorMenuKind = 'start' | 'conditions' | 'outcomes' | 'next';
type BranchAuthorPopupScope = {
  turnNumber: number;
  choiceIndex: number | null;
};

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
const BRANCH_INLINE_PANEL_WIDTH = 920;
const BRANCH_INLINE_PANEL_HEIGHTS: Record<BranchInlinePanelState['mode'], number> = {
  dialogue: 420,
  preconditions: 620,
  outcomes: 620,
  continuation: 540,
};
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
const FLOW_ANNOTATION_COLORS = ['#ffd84d', '#7ce2ff', '#66d17a', '#ff7a7a', '#d990ff', '#ffffff'];
const viewStateByConversation = new Map<number, ViewState>();
let activeAnnotationTool: FlowAnnotationTool = 'select';
let activeAnnotationColor = FLOW_ANNOTATION_COLORS[0];
let activeDrawSet: { conversationId: number; annotationId: string } | null = null;
let pendingFocusAnnotationId: string | null = null;
let activeBranchAuthorPopup: {
  element: HTMLElement;
  trigger: HTMLElement;
  cleanup: () => void;
  scope: BranchAuthorPopupScope;
} | null = null;
let branchInlineModalRestoreFocus: HTMLElement | null = null;

function openBranchInlinePanelWithFocus(trigger: HTMLElement | null, panel: BranchInlinePanelState): void {
  branchInlineModalRestoreFocus = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  store.openBranchInlinePanel(panel);
}

function closeBranchInlinePanelModal(): void {
  const restoreTarget = branchInlineModalRestoreFocus;
  branchInlineModalRestoreFocus = null;
  store.flushPendingTextEdits();
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  store.closeBranchInlinePanel();
  requestAnimationFrame(() => {
    if (restoreTarget?.isConnected) restoreTarget.focus();
  });
}

function syncAnnotationToolUi(canvas: HTMLElement | null, tool: FlowAnnotationTool): void {
  canvas?.classList.toggle('is-annotating', tool !== 'select');
  canvas?.classList.toggle('is-drawing-annotation', tool === 'draw');
  if (canvas) dispatchCursorState(canvas, 'drawing', tool === 'draw');
  document.querySelectorAll<HTMLButtonElement>('.flow-annotation-tool').forEach((button) => {
    const active = button.dataset.annotationTool === tool;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

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

export function resetFlowViewState(conversationId: number): void {
  viewStateByConversation.delete(conversationId);
}

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
  if (
    activeBranchAuthorPopup
    && (
      activeBranchAuthorPopup.scope.turnNumber !== nextSelected
      || (
        activeBranchAuthorPopup.scope.choiceIndex != null
        && activeBranchAuthorPopup.scope.choiceIndex !== nextChoiceIndex
      )
    )
  ) {
    closeBranchAuthorPopup();
  }

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
  redrawLiveEdges(liveFlow);
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
    liveFlow.edges = buildEdgeDescriptors(conv, state.selectedTurnNumber, state.selectedChoiceIndex, liveFlow.factionColor);
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
    syncLiveViewportVisibility(liveFlow);
    return true;
  }

  return false;
}

function edgeKey(edge: EdgeDescriptor): string {
  return edgeKeyFromParts(edge.sourceTurnNumber, edge.sourceChoiceIndex, edge.targetTurnNumber, edge.kind);
}

function edgeKeyFromParts(sourceTurnNumber: number, sourceChoiceIndex: number, targetTurnNumber: number, kind: EdgeKind): string {
  return `${sourceTurnNumber}:${sourceChoiceIndex}:${targetTurnNumber}:${kind}`;
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

  let controlsWidth = 188; // index + authoring chips + connector handle
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

function memoKey(convId: number, projectRevision: number, density: FlowDensity, branchInlinePanel: BranchInlinePanelState | null): string {
  const inlineKey = branchInlinePanel
    ? `${branchInlinePanel.turnNumber}:${branchInlinePanel.choiceIndex ?? 'opener'}:${branchInlinePanel.mode}:${branchInlinePanel.selectedOutcomeIndex ?? 'none'}`
    : 'none';
  return `${convId}:${projectRevision}:${density}:${inlineKey}`;
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
  closeBranchAuthorPopup();
  flowCursorSystem?.destroy();
  flowCursorSystem = null;

  let conv = store.getSelectedConversation();
  const state = store.get();
  if (!conv && state.project.conversations.length > 0) {
    store.selectConversation(state.project.conversations[0]!.id);
    return;
  }
  const density = getEffectiveFlowDensity(state.flowDensity);
  const isMobileViewport = isCompactViewport();
  const mobilePerformanceMode = isMobileViewport;

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
  const mk = memoKey(conversationId, state.projectRevision, density, state.branchInlinePanel);

  const turnLabels = memoLabeler?.key === mk ? memoLabeler.labeler : createTurnDisplayLabeler(conv);
  memoLabeler = { key: mk, labeler: turnLabels };

  const existingView = viewStateByConversation.get(conversationId);
  const viewState: ViewState = existingView ? { ...existingView } : { ...DEFAULT_VIEW_STATE };

  const bounds = memoBounds?.key === mk ? memoBounds.bounds : calculateContentBounds(conv, density, state.branchInlinePanel);
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
  if (mobilePerformanceMode) shellClasses.push('is-mobile-performance');
  if (graphSize !== 'normal') shellClasses.push('is-large-graph');
  if (graphSize !== 'normal') shellClasses.push('is-perf-mode');
  if (graphSize === 'huge') shellClasses.push('is-huge-graph');
  shell.className = shellClasses.join(' ');

  const canvas = document.createElement('div');
  canvas.className = 'flow-canvas';
  canvas.classList.toggle('is-annotating', activeAnnotationTool !== 'select');
  canvas.classList.toggle('is-drawing-annotation', activeAnnotationTool === 'draw');
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
        if (mobilePerformanceMode) requestAnimationFrame(() => applyView());
      }, releaseDelayMs);
      return;
    }
    shell.classList.remove('is-interacting');
    if (mobilePerformanceMode) requestAnimationFrame(() => applyView());
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

  const segmentStartTurns = collectBranchSegmentStartTurns(conv);
  for (const turn of conv.turns) {
    const node = renderTurnNode({
      conv,
      turn,
      selected: state.selectedTurnNumber === turn.turnNumber,
      branchInlinePanel: state.branchInlinePanel,
      segmentStartTurns,
      edges,
      density,
      viewState,
      turnLabels,
      mobilePerformanceMode,
      onPreviewPosition: (previewPositions, affectedTurnNumbers, redrawEdges) => draw(previewPositions, affectedTurnNumbers, redrawEdges),
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
  const annotationLayer = createFlowAnnotationLayer({
    conv,
    bounds,
    canvas,
    content,
    getTool: () => activeAnnotationTool,
    setTool: (tool) => {
      if (tool !== 'draw') activeDrawSet = null;
      activeAnnotationTool = tool;
      syncAnnotationToolUi(canvas, activeAnnotationTool);
    },
    getColor: () => activeAnnotationColor,
  });
  content.appendChild(annotationLayer);
  const collabLayer = createCollabPresenceLayer(conv);
  if (collabLayer) {
    content.appendChild(collabLayer);
  }

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
          renderPackets: !mobilePerformanceMode && graphSize === 'normal',
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
      renderPacket: !mobilePerformanceMode && graphSize === 'normal',
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

  const setAnnotationTool = (tool: FlowAnnotationTool): FlowAnnotationTool => {
    const nextTool = activeAnnotationTool === tool ? 'select' : tool;
    if (nextTool !== 'draw') activeDrawSet = null;
    if (nextTool === 'draw' && activeAnnotationTool !== 'draw') activeDrawSet = null;
    activeAnnotationTool = nextTool;
    syncAnnotationToolUi(canvas, activeAnnotationTool);
    return activeAnnotationTool;
  };

  const controls = renderControls({
    customCursorEnabled: state.customCursorEnabled,
    cursorSize: state.cursorSize,
    mobilePerformanceMode,
    zoomValue,
    activeAnnotationTool,
    onSetAnnotationTool: (tool) => setAnnotationTool(tool),
    onZoomIn: () => zoomAtViewportPoint(canvas, viewState, 1.12, canvas.clientWidth / 2, canvas.clientHeight / 2, applyView),
    onZoomOut: () => zoomAtViewportPoint(canvas, viewState, 1 / 1.12, canvas.clientWidth / 2, canvas.clientHeight / 2, applyView),
    onFit: () => fitContent(),
    onReset: () => resetView(),
    onAddBranch: () => {
      store.addTurn(conversationId);
      requestAnimationFrame(() => {
        const createdTurn = store.getSelectedTurn();
        if (createdTurn) focusTurn(createdTurn.turnNumber, { center: true });
      });
    },
    onSetCursorEnabled: (enabled) => store.setCustomCursorEnabled(enabled),
    onSetCursorSize: (size) => store.setCursorSize(size),
  });


  canvas.appendChild(content);
  canvas.addEventListener('pointermove', (event) => {
    sendCollabCursorPing(viewportToWorldPoint(canvas, viewState, event.clientX, event.clientY));
  });
  shell.appendChild(canvas);
  shell.appendChild(controls);
  const branchModal = renderBranchInlineModalOverlay({
    conv,
    branchInlinePanel: state.branchInlinePanel,
    turnLabels,
  });
  if (branchModal) shell.appendChild(branchModal);
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
  let lastViewportSyncAt = 0;

  const applyView = (): void => {
    // Snap pan to physical device pixels to prevent subpixel blurriness.
    // Keep zoom separate from translate so Chromium can rasterize branch text
    // at the final zoom level instead of blurring it inside a transformed layer.
    const dpr = window.devicePixelRatio || 1;
    const snapX = Math.round(viewState.panX * dpr) / dpr;
    const snapY = Math.round(viewState.panY * dpr) / dpr;
    const depthBlur = !mobilePerformanceMode && viewState.zoom <= DEPTH_OF_FIELD_ZOOM_THRESHOLD;
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
    const now = performance.now();
    const interacting = shell.classList.contains('is-interacting');
    const syncInterval = mobilePerformanceMode ? 120 : 80;
    if (!interacting || now - lastViewportSyncAt >= syncInterval) {
      lastViewportSyncAt = now;
      syncViewportVisibility({
        canvas,
        viewState,
        graphModel,
        occlusionEnabled: store.get().flowOcclusionEnabled,
        nodeElements,
        edgeElements,
        selectedTurnNumber: store.get().selectedTurnNumber,
        selectedChoiceIndex: store.get().selectedChoiceIndex,
      });
    }
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

  if (pendingFocusAnnotationId) {
    const focusId = pendingFocusAnnotationId;
    pendingFocusAnnotationId = null;
    requestAnimationFrame(() => {
      const note = annotationLayer.querySelector(`[data-annotation-id="${CSS.escape(focusId)}"] textarea`) as HTMLTextAreaElement | null;
      note?.focus();
      note?.select();
    });
  }

  if (!mobilePerformanceMode) {
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
    dispatchCursorState(canvas, 'drawing', activeAnnotationTool === 'draw');
  }

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

function renderBranchInlineModalOverlay(options: {
  conv: Conversation;
  branchInlinePanel: BranchInlinePanelState | null;
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>;
}): HTMLElement | null {
  const { conv, branchInlinePanel, turnLabels } = options;
  if (!branchInlinePanel) return null;
  if (branchInlinePanel.conversationId !== conv.id) {
    requestAnimationFrame(() => store.closeBranchInlinePanel());
    return null;
  }

  const turn = conv.turns.find((candidate) => candidate.turnNumber === branchInlinePanel.turnNumber);
  if (!turn) {
    requestAnimationFrame(() => store.closeBranchInlinePanel());
    return null;
  }
  const choice = branchInlinePanel.choiceIndex == null
    ? null
    : turn.choices.find((candidate) => candidate.index === branchInlinePanel.choiceIndex) ?? null;
  if (branchInlinePanel.choiceIndex != null && !choice) {
    requestAnimationFrame(() => store.closeBranchInlinePanel());
    return null;
  }

  const overlay = document.createElement('div');
  overlay.className = 'branch-inline-modal-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.onclick = (event) => event.stopPropagation();

  const modal = document.createElement('div');
  modal.className = 'branch-inline-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Branch editor');
  modal.onclick = (event) => event.stopPropagation();
  modal.onkeydown = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    store.flushPendingTextEdits();
    closeBranchInlinePanelModal();
  };

  modal.appendChild(renderBranchInlinePanel({
    conv,
    turn,
    choice,
    mode: branchInlinePanel.mode,
    selectedOutcomeIndex: branchInlinePanel.selectedOutcomeIndex ?? null,
    turnLabels,
    onClose: closeBranchInlinePanelModal,
  }));
  overlay.appendChild(modal);

  requestAnimationFrame(() => {
    const closeButton = modal.querySelector<HTMLElement>('.branch-inline-close');
    closeButton?.scrollIntoView({ block: 'nearest' });
    const focusTarget = modal.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]:not([tabindex="-1"])');
    focusTarget?.focus();
  });

  return overlay;
}

function renderControls(options: {
  customCursorEnabled: boolean;
  cursorSize: number;
  mobilePerformanceMode: boolean;
  zoomValue: HTMLElement;
  activeAnnotationTool: FlowAnnotationTool;
  onSetAnnotationTool: (tool: FlowAnnotationTool) => FlowAnnotationTool;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onAddBranch: () => void;
  onSetCursorEnabled: (enabled: boolean) => void;
  onSetCursorSize: (size: number) => void;
}): HTMLElement {
  const state = store.get();
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

  const undo = document.createElement('button');
  undo.type = 'button';
  undo.className = 'btn-sm flow-icon-button';
  undo.appendChild(createIcon('undo'));
  undo.title = 'Undo last change (Ctrl+Z)';
  undo.setAttribute('aria-label', 'Undo');
  undo.disabled = state.undoStack.length === 0;
  setBeginnerTooltip(undo, 'toolbar-undo');
  undo.onclick = () => store.undo();

  const redo = document.createElement('button');
  redo.type = 'button';
  redo.className = 'btn-sm flow-icon-button';
  redo.appendChild(createIcon('redo'));
  redo.title = 'Redo last undone change (Ctrl+Y)';
  redo.setAttribute('aria-label', 'Redo');
  redo.disabled = state.redoStack.length === 0;
  setBeginnerTooltip(redo, 'toolbar-redo');
  redo.onclick = () => store.redo();

  const addBranch = document.createElement('button');
  addBranch.type = 'button';
  addBranch.className = 'btn-sm flow-icon-button';
  addBranch.appendChild(createIcon('add'));
  addBranch.title = 'Add new empty branch';
  addBranch.setAttribute('aria-label', 'Add new empty branch');
  addBranch.onclick = options.onAddBranch;

  const annotationButtons: HTMLButtonElement[] = [];
  const setAnnotationTool = (tool: FlowAnnotationTool): void => {
    const nextTool = options.onSetAnnotationTool(tool);
    annotationButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.annotationTool === nextTool);
      button.setAttribute('aria-pressed', button.dataset.annotationTool === nextTool ? 'true' : 'false');
    });
  };

  const drawButton = document.createElement('button');
  drawButton.type = 'button';
  drawButton.className = 'btn-sm flow-icon-button flow-annotation-tool';
  drawButton.dataset.annotationTool = 'draw';
  drawButton.appendChild(createIcon('draw'));
  drawButton.title = 'Draw markup line on flow';
  drawButton.setAttribute('aria-label', 'Draw markup line');
  drawButton.setAttribute('aria-pressed', options.activeAnnotationTool === 'draw' ? 'true' : 'false');
  drawButton.classList.toggle('is-active', options.activeAnnotationTool === 'draw');
  drawButton.onclick = () => setAnnotationTool('draw');
  annotationButtons.push(drawButton);

  const textButton = document.createElement('button');
  textButton.type = 'button';
  textButton.className = 'btn-sm flow-icon-button flow-annotation-tool';
  textButton.dataset.annotationTool = 'text';
  textButton.appendChild(createIcon('comment'));
  textButton.title = 'Add comment note to flow';
  textButton.setAttribute('aria-label', 'Add comment note');
  textButton.setAttribute('aria-pressed', options.activeAnnotationTool === 'text' ? 'true' : 'false');
  textButton.classList.toggle('is-active', options.activeAnnotationTool === 'text');
  textButton.onclick = () => setAnnotationTool('text');
  annotationButtons.push(textButton);

  const annotationColor = document.createElement('input');
  annotationColor.type = 'color';
  annotationColor.className = 'flow-annotation-color';
  annotationColor.value = activeAnnotationColor;
  annotationColor.title = 'Markup color';
  annotationColor.setAttribute('aria-label', 'Markup color');
  annotationColor.oninput = () => {
    activeAnnotationColor = annotationColor.value;
  };

  const clearAnnotations = document.createElement('button');
  clearAnnotations.type = 'button';
  clearAnnotations.className = 'btn-sm flow-annotation-clear';
  clearAnnotations.textContent = 'Clear Marks';
  clearAnnotations.title = 'Remove all flow markup and comments';
  clearAnnotations.disabled = !(store.getSelectedConversation()?.flowAnnotations?.length);
  clearAnnotations.onclick = () => {
    const selected = store.getSelectedConversation();
    if (!selected?.flowAnnotations?.length) return;
    if (!window.confirm('Remove all flow drawings and comments?')) return;
    store.clearFlowAnnotations(selected.id);
  };

  const authorMode = document.createElement('button');
  authorMode.type = 'button';
  authorMode.className = 'btn-sm flow-mode-toggle';
  authorMode.textContent = state.advancedMode ? 'Advanced On' : 'Advanced mode';
  authorMode.title = state.advancedMode
    ? 'Show full technical controls'
    : 'Enable advanced mode to show properties panel and technical controls';
  authorMode.setAttribute('aria-pressed', state.advancedMode ? 'true' : 'false');
  authorMode.classList.toggle('is-active', state.advancedMode);
  authorMode.onclick = () => store.toggleAdvancedMode();

  const densitySelect = document.createElement('select');
  densitySelect.className = 'flow-density-select';
  densitySelect.title = 'Adjust how much information each turn card shows in the flow editor.';
  setBeginnerTooltip(densitySelect, 'toolbar-density');
  const densityOptions: FlowDensity[] = ['compact', 'standard', 'detailed'];
  for (const density of densityOptions) {
    const option = document.createElement('option');
    option.value = density;
    option.textContent = density[0].toUpperCase() + density.slice(1);
    option.selected = density === state.flowDensity;
    densitySelect.appendChild(option);
  }
  densitySelect.onchange = () => store.setFlowDensity(densitySelect.value as FlowDensity);

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

  if (options.mobilePerformanceMode) {
    controls.append(zoomOut, zoomIn, undo, redo, addBranch, drawButton, textButton, annotationColor, fit, authorMode, densitySelect);
    return controls;
  }

  controls.append(zoomOut, options.zoomValue, zoomIn, undo, redo, addBranch, drawButton, textButton, annotationColor, clearAnnotations, fit, reset, authorMode, densitySelect, cursorToggle, sizeInput);
  return controls;
}

function createFlowAnnotationLayer(options: {
  conv: Conversation;
  bounds: ContentBounds;
  canvas: HTMLElement;
  content: HTMLElement;
  getTool: () => FlowAnnotationTool;
  setTool: (tool: FlowAnnotationTool) => void;
  getColor: () => string;
}): HTMLElement {
  const { conv, bounds, canvas, content, getTool, setTool, getColor } = options;
  const layer = document.createElement('div');
  layer.className = 'flow-annotation-layer';
  layer.style.width = `${bounds.width}px`;
  layer.style.height = `${bounds.height}px`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('flow-annotation-svg');
  svg.setAttribute('width', String(bounds.width));
  svg.setAttribute('height', String(bounds.height));

  for (const annotation of conv.flowAnnotations ?? []) {
    if (annotation.type === 'line') {
      renderLineAnnotation(svg, layer, conv.id, annotation);
    } else if (annotation.type === 'line-set') {
      renderLineSetAnnotation(svg, layer, conv.id, annotation);
    }
  }

  layer.appendChild(svg);

  for (const annotation of conv.flowAnnotations ?? []) {
    if (annotation.type === 'note') {
      layer.appendChild(renderNoteAnnotation(conv.id, annotation, content));
    }
  }

  let activeLine: { pointerId: number; points: Array<{ x: number; y: number }>; path: SVGPathElement } | null = null;

  const updatePreviewPath = (): void => {
    if (!activeLine) return;
    activeLine.path.setAttribute('d', pointsToPath(activeLine.points));
  };

  const finishLine = (): void => {
    if (!activeLine) return;
    const line = activeLine;
    activeLine = null;
    line.path.remove();
    if (line.points.length < 2) return;
    const distance = Math.hypot(
      line.points[line.points.length - 1].x - line.points[0].x,
      line.points[line.points.length - 1].y - line.points[0].y,
    );
    if (distance < 6) return;
    addLineToActiveDrawSet(conv.id, getColor(), line.points);
  };

  layer.onpointerdown = (event) => {
    const tool = getTool();
    if (tool === 'select') return;
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | SVGElement;
    if (target.closest('.flow-annotation-note, .flow-annotation-delete')) return;

    event.preventDefault();
    event.stopPropagation();
    const point = clientToFlowContentPoint(content, event.clientX, event.clientY);

    if (tool === 'text') {
      const id = createAnnotationId();
      pendingFocusAnnotationId = id;
      setTool('select');
      store.addFlowAnnotation(conv.id, {
        id,
        type: 'note',
        color: getColor(),
        x: Math.round(point.x),
        y: Math.round(point.y),
        text: '',
        createdAt: new Date().toISOString(),
      });
      return;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'flow-annotation-line flow-annotation-line-preview');
    path.style.setProperty('--annotation-color', getColor());
    svg.appendChild(path);
    activeLine = {
      pointerId: event.pointerId,
      points: [point],
      path,
    };
    layer.setPointerCapture(event.pointerId);
    canvas.classList.add('is-annotating-active');
    updatePreviewPath();
  };

  layer.onpointermove = (event) => {
    if (!activeLine || event.pointerId !== activeLine.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = clientToFlowContentPoint(content, event.clientX, event.clientY);
    const previous = activeLine.points[activeLine.points.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < 4) return;
    activeLine.points.push(point);
    updatePreviewPath();
  };

  const cancelLine = (event?: PointerEvent): void => {
    if (event && activeLine && event.pointerId !== activeLine.pointerId) return;
    if (event && layer.hasPointerCapture(event.pointerId)) {
      layer.releasePointerCapture(event.pointerId);
    }
    activeLine?.path.remove();
    activeLine = null;
    canvas.classList.remove('is-annotating-active');
  };

  layer.onpointerup = (event) => {
    if (!activeLine || event.pointerId !== activeLine.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (layer.hasPointerCapture(event.pointerId)) {
      layer.releasePointerCapture(event.pointerId);
    }
    canvas.classList.remove('is-annotating-active');
    finishLine();
  };
  layer.onpointercancel = cancelLine;

  return layer;
}

function addLineToActiveDrawSet(conversationId: number, color: string, points: Array<{ x: number; y: number }>): void {
  const rounded = points.map(point => ({ x: Math.round(point.x), y: Math.round(point.y) }));
  const selected = store.get().project.conversations.find(item => item.id === conversationId);
  const existing = activeDrawSet?.conversationId === conversationId
    ? selected?.flowAnnotations?.find((annotation): annotation is FlowLineSetAnnotation => annotation.id === activeDrawSet?.annotationId && annotation.type === 'line-set')
    : null;

  if (existing) {
    store.updateFlowAnnotation(conversationId, existing.id, {
      lines: [...existing.lines, rounded],
    } as Partial<FlowAnnotation>);
    return;
  }

  const annotationId = createAnnotationId();
  activeDrawSet = { conversationId, annotationId };
  store.addFlowAnnotation(conversationId, {
    id: annotationId,
    type: 'line-set',
    color,
    lines: [rounded],
    createdAt: new Date().toISOString(),
  });
}

function renderLineAnnotation(svg: SVGSVGElement, layer: HTMLElement, conversationId: number, annotation: FlowLineAnnotation): void {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('class', 'flow-annotation-line');
  path.setAttribute('d', pointsToPath(annotation.points));
  path.style.setProperty('--annotation-color', annotation.color);
  svg.appendChild(path);

  const lastPoint = annotation.points[annotation.points.length - 1];
  if (!lastPoint) return;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'flow-annotation-delete flow-annotation-line-delete';
  remove.textContent = 'x';
  remove.title = 'Delete drawing';
  remove.style.left = `${lastPoint.x}px`;
  remove.style.top = `${lastPoint.y}px`;
  remove.style.setProperty('--annotation-color', annotation.color);
  remove.onpointerdown = (event) => event.stopPropagation();
  remove.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    store.deleteFlowAnnotation(conversationId, annotation.id);
  };
  layer.appendChild(remove);
}

function renderLineSetAnnotation(svg: SVGSVGElement, layer: HTMLElement, conversationId: number, annotation: FlowLineSetAnnotation): void {
  for (const line of annotation.lines) {
    if (line.length < 2) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'flow-annotation-line');
    path.setAttribute('d', pointsToPath(line));
    path.style.setProperty('--annotation-color', annotation.color);
    svg.appendChild(path);
  }

  const anchor = getLineSetDeleteAnchor(annotation);
  if (!anchor) return;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'flow-annotation-delete flow-annotation-line-delete';
  remove.textContent = 'x';
  remove.title = 'Delete drawing set';
  remove.style.left = `${anchor.x}px`;
  remove.style.top = `${anchor.y}px`;
  remove.style.setProperty('--annotation-color', annotation.color);
  remove.onpointerdown = (event) => event.stopPropagation();
  remove.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (activeDrawSet?.annotationId === annotation.id) activeDrawSet = null;
    store.deleteFlowAnnotation(conversationId, annotation.id);
  };
  layer.appendChild(remove);
}

function getLineSetDeleteAnchor(annotation: FlowLineSetAnnotation): { x: number; y: number } | null {
  const points = annotation.lines.flat();
  if (points.length === 0) return null;
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  return { x: maxX + 10, y: Math.max(0, minY - 10) };
}

function renderNoteAnnotation(
  conversationId: number,
  annotation: FlowNoteAnnotation,
  content: HTMLElement,
): HTMLElement {
  const note = document.createElement('div');
  note.className = 'flow-annotation-note';
  note.dataset.annotationId = annotation.id;
  note.style.left = `${annotation.x}px`;
  note.style.top = `${annotation.y}px`;
  note.style.setProperty('--annotation-color', annotation.color);

  const header = document.createElement('div');
  header.className = 'flow-annotation-note-header';
  const swatch = document.createElement('span');
  swatch.className = 'flow-annotation-note-swatch';
  const label = document.createElement('span');
  label.textContent = 'Comment';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'flow-annotation-delete';
  remove.textContent = 'x';
  remove.title = 'Delete comment';
  remove.onpointerdown = (event) => event.stopPropagation();
  remove.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    store.deleteFlowAnnotation(conversationId, annotation.id);
  };
  header.append(swatch, label, remove);

  const textarea = document.createElement('textarea');
  textarea.className = 'flow-annotation-note-input';
  textarea.value = annotation.text;
  textarea.placeholder = 'Comment';
  textarea.rows = 3;
  textarea.onpointerdown = (event) => event.stopPropagation();
  textarea.oninput = () => autosizeAnnotationTextarea(textarea);
  textarea.onkeydown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      textarea.blur();
    }
    if (event.key === 'Escape') {
      textarea.value = annotation.text;
      textarea.blur();
    }
  };
  textarea.onblur = () => {
    const nextText = textarea.value.trim();
    if (!nextText) {
      store.deleteFlowAnnotation(conversationId, annotation.id);
      return;
    }
    if (nextText !== annotation.text) {
      store.updateFlowAnnotation(conversationId, annotation.id, { text: nextText } as Partial<FlowAnnotation>);
    }
  };

  let drag: { pointerId: number; startX: number; startY: number; originX: number; originY: number } | null = null;
  header.onpointerdown = (event) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    event.stopPropagation();
    const point = clientToFlowContentPoint(content, event.clientX, event.clientY);
    drag = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      originX: annotation.x,
      originY: annotation.y,
    };
    header.setPointerCapture(event.pointerId);
    note.classList.add('is-dragging');
  };
  header.onpointermove = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = clientToFlowContentPoint(content, event.clientX, event.clientY);
    const x = Math.max(0, Math.round(drag.originX + point.x - drag.startX));
    const y = Math.max(0, Math.round(drag.originY + point.y - drag.startY));
    note.style.left = `${x}px`;
    note.style.top = `${y}px`;
  };
  const finishDrag = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = clientToFlowContentPoint(content, event.clientX, event.clientY);
    const x = Math.max(0, Math.round(drag.originX + point.x - drag.startX));
    const y = Math.max(0, Math.round(drag.originY + point.y - drag.startY));
    drag = null;
    note.classList.remove('is-dragging');
    if (header.hasPointerCapture(event.pointerId)) {
      header.releasePointerCapture(event.pointerId);
    }
    if (x !== annotation.x || y !== annotation.y) {
      store.updateFlowAnnotation(conversationId, annotation.id, { x, y } as Partial<FlowAnnotation>);
    }
  };
  header.onpointerup = finishDrag;
  header.onpointercancel = finishDrag;

  note.append(header, textarea);
  requestAnimationFrame(() => autosizeAnnotationTextarea(textarea));
  return note;
}

function pointsToPath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${Math.round(point.x)},${Math.round(point.y)}`).join(' ');
}

function createAnnotationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function autosizeAnnotationTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(180, Math.max(54, textarea.scrollHeight))}px`;
}

function calculateContentBounds(conv: Conversation, density: FlowDensity, branchInlinePanel: BranchInlinePanelState | null = null): ContentBounds {
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

  for (const annotation of conv.flowAnnotations ?? []) {
    if (annotation.type === 'line') {
      for (const point of annotation.points) {
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
      continue;
    }
    if (annotation.type === 'line-set') {
      for (const point of annotation.lines.flat()) {
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
      continue;
    }
    maxX = Math.max(maxX, annotation.x + 220);
    maxY = Math.max(maxY, annotation.y + 140);
  }

  const defaultLayout = getFlowNodeLayout(density);
  const centeredMinWidth = Math.ceil((FLOW_DEFAULT_TURN_POSITION.x + defaultLayout.width / 2) * 2);
  const centeredMinHeight = Math.ceil((FLOW_DEFAULT_TURN_POSITION.y + defaultLayout.minHeight / 2) * 2);

  return {
    width: Math.max(FLOW_WORKSPACE_MIN_WIDTH, centeredMinWidth, maxX + CONTENT_PADDING),
    height: Math.max(FLOW_WORKSPACE_MIN_HEIGHT, centeredMinHeight, maxY + CONTENT_PADDING),
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
  branchInlinePanel: BranchInlinePanelState | null;
  segmentStartTurns: ReadonlySet<number>;
  edges: EdgeDescriptor[];
  density: FlowDensity;
  viewState: ViewState;
  mobilePerformanceMode: boolean;
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>;
  onPreviewPosition: (positions?: TurnPositionMap, affectedTurnNumbers?: ReadonlySet<number>, redrawEdges?: boolean) => void;
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
    branchInlinePanel,
    segmentStartTurns,
    edges,
    density,
    viewState,
    mobilePerformanceMode,
    turnLabels,
    onPreviewPosition,
    onChoicePortDragStart,
    onCreateConnectedTurn,
    onFocusTurn,
    onKeyboardShortcut,
    onDragStateChange,
  } = options;
  const state = store.get();
  const isAdvancedMode = state.advancedMode;
  const canPasteTurn = store.hasCopiedTurn(conv.id);
  const layout = getFlowNodeLayout(density);
  const hasWarning = turn.choices.some(c => !c.text && !c.reply);
  const isPathActive = edges.some(edge => edge.highlight === 'active' && (edge.sourceTurnNumber === turn.turnNumber || edge.targetTurnNumber === turn.turnNumber));
  const turnIndex = conv.turns.indexOf(turn);
  const factionColor = FACTION_COLORS[getConversationFaction(conv, state.project.faction)];
  const branchColor = getBranchColor(turn, turnIndex, factionColor);
  const nodeWidth = getFlowNodeWidth(turn, turnLabels.getLongLabel(turn.turnNumber), density);
  const inlinePanelActive = Boolean(
    branchInlinePanel
    && branchInlinePanel.conversationId === conv.id
    && branchInlinePanel.turnNumber === turn.turnNumber,
  );
  const showOpener = segmentStartTurns.has(turn.turnNumber);

  const node = document.createElement('div');

  node.className = 'turn-node'
    + (selected ? ' selected' : '')
    + (inlinePanelActive ? ' has-inline-panel' : '')
    + (hasWarning ? ' has-warning' : '')
    + (isPathActive ? ' path-active' : '')
    + (turn.turnNumber === 1 ? ' is-starter-turn' : '');
  node.dataset.turnNumber = String(turn.turnNumber);
  node.tabIndex = 0;
  node.setAttribute('role', 'button');
  node.setAttribute('aria-label', buildTurnAriaLabel(turn, turnLabels, showOpener));
  node.setAttribute('aria-pressed', selected ? 'true' : 'false');
  setBeginnerTooltip(node, 'flow-turn-node');
  node.style.left = `${turn.position.x}px`;
  node.style.top = `${turn.position.y}px`;
  node.style.width = selected ? `${Math.max(nodeWidth, 520)}px` : `${nodeWidth}px`;
  node.style.setProperty('--branch-color', branchColor);
  node.style.setProperty('--branch-glow', branchColor + '40');
  node.style.setProperty('--starter-branch-color', factionColor);
  node.style.setProperty('--starter-branch-glow', `${factionColor}40`);
  node.addEventListener('pointerdown', (event) => {
    const target = event.target as HTMLElement | null;
    const actionEl = target?.closest('[data-branch-inline-action]') as HTMLElement | null;
    if (!actionEl || !node.contains(actionEl)) return;

    const action = actionEl.dataset.branchInlineAction;
    const choiceIndex = actionEl.dataset.choiceIndex ? Number.parseInt(actionEl.dataset.choiceIndex, 10) : null;
    if (action !== 'opener' && (choiceIndex == null || Number.isNaN(choiceIndex))) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    store.batch(() => {
      store.selectTurn(turn.turnNumber);
      if (choiceIndex != null && !Number.isNaN(choiceIndex)) {
        store.selectChoice(choiceIndex);
      }
      openBranchInlinePanelWithFocus(actionEl, {
        conversationId: conv.id,
        turnNumber: turn.turnNumber,
        choiceIndex: action === 'opener' ? null : choiceIndex,
        mode: action === 'outcomes' ? 'outcomes' : 'dialogue',
        selectedOutcomeIndex: action === 'outcomes'
          ? (turn.choices.find(candidate => candidate.index === choiceIndex)?.outcomes.length ? 0 : null)
          : null,
      });
    });
  }, { capture: true });
  node.onclick = (e) => {
    e.stopPropagation();
    const currentState = store.get();
    if (currentState.selectedTurnNumber === turn.turnNumber && currentState.selectedChoiceIndex == null) {
      closeBranchAuthorPopup();
      store.clearSelection();
      return;
    }
    store.selectTurn(turn.turnNumber);
  };
  node.onkeydown = (event) => {
    if (event.target !== node) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const currentState = store.get();
      if (currentState.selectedTurnNumber === turn.turnNumber && currentState.selectedChoiceIndex == null) {
        closeBranchAuthorPopup();
        store.clearSelection();
      } else {
        store.selectTurn(turn.turnNumber);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeBranchAuthorPopup();
      store.clearSelection();
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      const currentState = store.get();
      if (currentState.selectedTurnNumber === turn.turnNumber && currentState.selectedChoiceIndex != null) {
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
    if (target.closest('.turn-choice-item, .choice-output-port, .turn-input-port, .turn-label, .turn-label-input, .turn-color-input, .turn-actions, .branch-inline-trigger, button, input, select, textarea')) return;

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
      if (!mobilePerformanceMode) {
        node.style.setProperty('--drag-tilt-x', `${tiltX.toFixed(2)}deg`);
        node.style.setProperty('--drag-tilt-y', `${tiltY.toFixed(2)}deg`);
      }
      node.classList.add('is-dragging-node');

      lastMoveAt = now;
      lastClientX = ev.clientX;
      lastClientY = ev.clientY;
      onPreviewPosition(new Map([[turn.turnNumber, nextPosition]]), new Set([turn.turnNumber]), !(mobilePerformanceMode && ev.pointerType === 'touch'));
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
  const startLabelEdit = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
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
  labelSpan.onpointerdown = startLabelEdit;
  labelSpan.onclick = startLabelEdit;
  header.appendChild(labelSpan);

  const channelToggle = createFlowChannelToggle({
    current: normalizeChannel(turn.channel, normalizeChannel(conv.initialChannel, 'pda')),
    onChange: (channel) => setTurnChannelFromFlow(conv, turn, channel),
    compact: true,
  });
  header.appendChild(channelToggle);

  const outgoingCount = turn.choices.filter(choice => choice.continueTo != null || hasPauseOutcome(choice)).length;
  if (isAdvancedMode) {
  const startMenuButton = createBranchAuthorChip(turn.turnNumber === 1 ? 'Start' : 'Mode', 'Open branch start/channel menu', (trigger) => {
    store.selectTurn(turn.turnNumber);
    showBranchAuthorPopup(trigger, {
      kind: 'start',
      conv,
      turn,
      turnLabels,
    });
  });
  header.appendChild(startMenuButton);

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
  stats.textContent = `${turn.choices.length}C · ${outgoingCount}L`;
  header.appendChild(stats);

  if ((turn.preconditions ?? []).length > 0) {
    const branchCondBadge = document.createElement('button');
    branchCondBadge.type = 'button';
    branchCondBadge.className = 'choice-branch-badge branch-cond-summary';
    branchCondBadge.textContent = `${turn.preconditions.length} cond`;
    branchCondBadge.title = 'Open branch conditions menu';
    branchCondBadge.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      store.selectTurn(turn.turnNumber);
      showBranchAuthorPopup(branchCondBadge, {
        kind: 'conditions',
        conv,
        turn,
        turnLabels,
      });
    };
    header.appendChild(branchCondBadge);
  }
  }

  if (isAdvancedMode) {
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
    delBtn.textContent = 'X';
    delBtn.style.color = 'var(--danger)';
    setBeginnerTooltip(delBtn, 'flow-turn-actions');
    delBtn.onclick = (e) => {
      e.stopPropagation();
      store.deleteTurn(conv.id, turn.turnNumber);
    };
    turnActions.appendChild(delBtn);
  }
  header.appendChild(turnActions);
  }

  if (!isAdvancedMode && turn.turnNumber > 1) {
    const compactDelete = document.createElement('button');
    compactDelete.type = 'button';
    compactDelete.className = 'turn-compact-delete';
    compactDelete.textContent = 'Ã—';
    compactDelete.title = 'Delete branch';
    compactDelete.textContent = 'X';
    compactDelete.setAttribute('aria-label', `Delete branch ${turn.turnNumber}`);
    compactDelete.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      store.deleteTurn(conv.id, turn.turnNumber);
    };
    header.appendChild(compactDelete);
  }
  node.appendChild(header);

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'turn-body';

  if (showOpener && (density !== 'compact' || selected || inlinePanelActive)) {
    const openerCard = document.createElement('div');
    openerCard.className = 'branch-opener-card branch-inline-trigger';
    openerCard.dataset.branchInlineAction = 'opener';
    openerCard.tabIndex = 0;
    openerCard.title = 'Open NPC opener editor';
    const openOpenerPanel = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      store.batch(() => {
        store.selectTurn(turn.turnNumber);
        openBranchInlinePanelWithFocus(openerCard, {
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: null,
          mode: 'dialogue',
        });
      });
    };
    openerCard.onkeydown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openOpenerPanel(event);
    };
    const openerLabel = document.createElement('span');
    openerLabel.className = 'branch-opener-label';
    openerLabel.textContent = 'Opener';
    const openerText = document.createElement('span');
    openerText.className = 'branch-opener-text';
    openerText.textContent = truncate(turn.openingMessage || 'NPC opener message', layout.messageChars);
    const openerEdit = document.createElement('button');
    openerEdit.type = 'button';
    openerEdit.className = 'branch-inline-edit-btn';
    openerEdit.dataset.branchInlineAction = 'opener';
    openerEdit.textContent = 'Edit';
    openerCard.append(openerLabel, openerText, openerEdit);
    body.appendChild(openerCard);
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
        openBranchInlinePanelWithFocus(item, {
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          mode: 'dialogue',
        });
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

    const editChoiceButton = document.createElement('button');
    editChoiceButton.type = 'button';
    editChoiceButton.className = 'branch-inline-edit-btn';
    editChoiceButton.dataset.branchInlineAction = 'choice';
    editChoiceButton.dataset.choiceIndex = String(choice.index);
    editChoiceButton.textContent = 'Edit';
    editChoiceButton.title = `Edit Choice ${choice.index} below this branch`;
    const openChoicePanel = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      store.batch(() => {
        store.selectTurn(turn.turnNumber);
        store.selectChoice(choice.index);
        openBranchInlinePanelWithFocus(editChoiceButton, {
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          mode: 'dialogue',
        });
      });
    };
    editChoiceButton.onpointerdown = openChoicePanel;
    editChoiceButton.onclick = openChoicePanel;
    item.appendChild(editChoiceButton);

    const deleteChoiceButton = document.createElement('button');
    deleteChoiceButton.type = 'button';
    deleteChoiceButton.className = 'choice-compact-delete';
    deleteChoiceButton.textContent = 'X';
    deleteChoiceButton.title = `Delete Choice ${choice.index}`;
    deleteChoiceButton.setAttribute('aria-label', `Delete Choice ${choice.index}`);
    deleteChoiceButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      store.deleteChoice(conv.id, turn.turnNumber, choice.index);
    };
    item.appendChild(deleteChoiceButton);

    const outcomesButton = document.createElement('button');
    outcomesButton.type = 'button';
    outcomesButton.className = 'branch-inline-edit-btn branch-inline-outcomes-btn';
    outcomesButton.dataset.branchInlineAction = 'outcomes';
    outcomesButton.dataset.choiceIndex = String(choice.index);
    outcomesButton.textContent = choice.outcomes.length > 0 ? `Outcomes (${choice.outcomes.length})` : 'Outcomes';
    outcomesButton.title = `Edit outcomes for Choice ${choice.index}`;
    const openOutcomesPanel = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      store.batch(() => {
        store.selectTurn(turn.turnNumber);
        store.selectChoice(choice.index);
        openBranchInlinePanelWithFocus(outcomesButton, {
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: choice.index,
          mode: 'outcomes',
          selectedOutcomeIndex: choice.outcomes.length > 0 ? 0 : null,
        });
      });
    };
    outcomesButton.onpointerdown = openOutcomesPanel;
    outcomesButton.onclick = openOutcomesPanel;
    item.appendChild(outcomesButton);

    // Badges
    const effectiveTurnChannel = normalizeChannel(turn.channel, 'pda');
    const effectiveChoiceChannel = normalizeChannel(choice.channel, effectiveTurnChannel);

    if (isAdvancedMode && choice.continueTo != null) {
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

    if (isAdvancedMode && hasPauseOutcome(choice)) {
      const pauseBadge = document.createElement('span');
      pauseBadge.className = 'choice-branch-badge';
      pauseBadge.textContent = 'branch';
      pauseBadge.title = 'Outcome adds success/fail branch targets';
      item.appendChild(pauseBadge);
    }

    if (isAdvancedMode && (choice.preconditions ?? []).length > 0) {
      const precondBadge = document.createElement('span');
      precondBadge.className = 'choice-branch-badge';
      precondBadge.textContent = `${choice.preconditions.length} cond`;
      precondBadge.title = `${choice.preconditions.length} choice precondition${choice.preconditions.length === 1 ? '' : 's'} (open conditions menu)`;
      precondBadge.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        store.batch(() => {
          store.selectTurn(turn.turnNumber);
          store.selectChoice(choice.index);
        });
        showBranchAuthorPopup(precondBadge, {
          kind: 'conditions',
          conv,
          turn,
          choice,
          turnLabels,
        });
      };
      item.appendChild(precondBadge);
    }

    if (isAdvancedMode) {
      const choiceChannelBadge = document.createElement('span');
      choiceChannelBadge.className = 'flow-channel-badge';
      choiceChannelBadge.textContent = channelBadgeLabel(effectiveChoiceChannel);
      choiceChannelBadge.title = `Choice visibility: ${choiceChannelBadge.textContent}`;
      item.appendChild(choiceChannelBadge);
    }

    // Outcomes count (standard/detailed only)
    if (isAdvancedMode && density !== 'compact' && choice.outcomes.length > 0) {
      const outBadge = document.createElement('span');
      outBadge.className = 'choice-outcome-badge';
      outBadge.textContent = `${choice.outcomes.length} out`;
      outBadge.title = 'Open outcomes menu';
      outBadge.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        store.batch(() => {
          store.selectTurn(turn.turnNumber);
          store.selectChoice(choice.index);
          openBranchInlinePanelWithFocus(outBadge, {
            conversationId: conv.id,
            turnNumber: turn.turnNumber,
            choiceIndex: choice.index,
            mode: 'outcomes',
            selectedOutcomeIndex: 0,
          });
        });
      };
      item.appendChild(outBadge);
    }

    if (isAdvancedMode) {
    const authorActions = document.createElement('span');
    authorActions.className = 'choice-author-actions';
    authorActions.append(
      createChoiceAuthorAction('Next', 'Open continuation and NPC handoff menu', (trigger) => {
        store.batch(() => {
          store.selectTurn(turn.turnNumber);
          store.selectChoice(choice.index);
          openBranchInlinePanelWithFocus(trigger, {
            conversationId: conv.id,
            turnNumber: turn.turnNumber,
            choiceIndex: choice.index,
            mode: 'continuation',
          });
        });
      }),
      createChoiceAuthorAction('Rules', 'Open choice conditions menu', (trigger) => {
        store.batch(() => {
          store.selectTurn(turn.turnNumber);
          store.selectChoice(choice.index);
        });
        showBranchAuthorPopup(trigger, {
          kind: 'conditions',
          conv,
          turn,
          choice,
          turnLabels,
        });
      }),
      createChoiceAuthorAction('Effects', 'Open choice outcomes menu', (trigger) => {
        store.batch(() => {
          store.selectTurn(turn.turnNumber);
          store.selectChoice(choice.index);
          openBranchInlinePanelWithFocus(trigger, {
            conversationId: conv.id,
            turnNumber: turn.turnNumber,
            choiceIndex: choice.index,
            mode: 'outcomes',
            selectedOutcomeIndex: 0,
          });
        });
      }),
    );
    item.appendChild(authorActions);
    }

    if (!linkPointsBehind) {
      item.appendChild(port);
    }
    choicesList.appendChild(item);

    // NPC Reply — show below player choice in standard/detailed modes
    if ((choice.reply && density !== 'compact') || choiceActive) {
      const replyRow = document.createElement('li');
      replyRow.className = `turn-npc-reply${choiceActive ? ' is-editing' : ''}`;
      replyRow.dataset.choiceIndex = String(choice.index);
      replyRow.onclick = (e) => {
        e.stopPropagation();
        store.batch(() => {
          store.selectTurn(turn.turnNumber);
          store.selectChoice(choice.index);
          openBranchInlinePanelWithFocus(replyRow, {
            conversationId: conv.id,
            turnNumber: turn.turnNumber,
            choiceIndex: choice.index,
            mode: 'dialogue',
          });
        });
      };
      const replyIcon = document.createElement('span');
      replyIcon.className = 'npc-reply-icon';
      replyIcon.textContent = 'NPC';
      const replyText = choiceActive
        ? createInlineTextInput({
          className: 'npc-reply-text flow-inline-choice-reply',
          value: choice.reply,
          placeholder: 'NPC reply',
          onCommit: (value) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { reply: value }),
        })
        : document.createElement('span');
      replyText.className = choiceActive ? replyText.className : 'npc-reply-text';
      if (!choiceActive) {
        replyText.textContent = truncate(choice.reply, density === 'detailed' ? layout.messageChars : 60);
      }
      replyRow.append(replyIcon, replyText);
      choicesList.appendChild(replyRow);
    }
  }
  if (turn.choices.length < 4) {
    const addChoiceRow = document.createElement('li');
    addChoiceRow.className = 'turn-choice-add-row';
    const addChoiceButton = document.createElement('button');
    addChoiceButton.type = 'button';
    addChoiceButton.className = 'turn-choice-add-button';
    addChoiceButton.textContent = '+';
    addChoiceButton.title = 'Add player dialogue choice';
    addChoiceButton.setAttribute('aria-label', 'Add player dialogue choice');
    addChoiceButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextChoiceIndex = turn.choices.length + 1;
      store.batch(() => {
        store.addChoice(conv.id, turn.turnNumber);
        store.selectTurn(turn.turnNumber);
        store.selectChoice(nextChoiceIndex);
        openBranchInlinePanelWithFocus(addChoiceButton, {
          conversationId: conv.id,
          turnNumber: turn.turnNumber,
          choiceIndex: nextChoiceIndex,
          mode: 'dialogue',
        });
      });
    };
    addChoiceRow.appendChild(addChoiceButton);
    choicesList.appendChild(addChoiceRow);
  }
  body.appendChild(choicesList);

  // ── Footer info (detailed mode) ──
  if (isAdvancedMode && density === 'detailed') {
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

function createInlineTextInput(options: {
  className: string;
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
}): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = options.className;
  input.value = options.value;
  input.placeholder = options.placeholder;
  wireInlineEditorEvents(input, options.onCommit);
  return input;
}

function createInlineTextEditor(options: {
  className: string;
  label: string;
  value: string;
  placeholder: string;
  multiline: boolean;
  onCommit: (value: string) => void;
}): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = `flow-inline-editor ${options.className}`;
  const label = document.createElement('span');
  label.className = 'flow-inline-editor-label';
  label.textContent = options.label;
  const control = options.multiline ? document.createElement('textarea') : document.createElement('input');
  control.className = 'flow-inline-editor-control';
  control.value = options.value;
  control.placeholder = options.placeholder;
  if (control instanceof HTMLInputElement) control.type = 'text';
  wireInlineEditorEvents(control, options.onCommit);
  wrap.append(label, control);
  return wrap;
}

function wireInlineEditorEvents(
  control: HTMLInputElement | HTMLTextAreaElement,
  onCommit: (value: string) => void,
): void {
  let initialValue = control.value;
  const commit = (): void => {
    if (control.value === initialValue) return;
    initialValue = control.value;
    onCommit(control.value);
  };
  control.onpointerdown = (event) => event.stopPropagation();
  control.onclick = (event) => event.stopPropagation();
  control.onkeydown = (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      control.value = initialValue;
      control.blur();
    }
    if (event.key === 'Enter' && (control instanceof HTMLInputElement || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      commit();
      control.blur();
    }
  };
  control.onblur = commit;
}

function createFlowChannelToggle(options: {
  current: 'pda' | 'f2f';
  onChange: (channel: 'pda' | 'f2f') => void;
  compact?: boolean;
}): HTMLElement {
  const row = document.createElement('span');
  row.className = `flow-channel-toggle${options.compact ? ' is-compact' : ''}`;
  for (const channel of ['pda', 'f2f'] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `flow-channel-toggle-btn${options.current === channel ? ' is-active' : ''}`;
    button.textContent = channelBadgeLabel(channel);
    button.setAttribute('aria-pressed', options.current === channel ? 'true' : 'false');
    button.title = `Set branch channel to ${channelBadgeLabel(channel)}`;
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (options.current !== channel) options.onChange(channel);
    };
    row.appendChild(button);
  }
  return row;
}

function setTurnChannelFromFlow(conv: Conversation, turn: Turn, channel: 'pda' | 'f2f'): void {
  if (turn.turnNumber === 1) {
    store.setConversationInitialChannel(conv.id, channel);
    return;
  }
  store.updateTurn(conv.id, turn.turnNumber, {
    channel,
    ...(channel === 'pda' ? { pda_entry: true, f2f_entry: false } : { f2f_entry: true, pda_entry: false }),
  });
}

function createBranchAuthorChip(
  label: string,
  title: string,
  onClick: (trigger: HTMLButtonElement) => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'branch-author-chip';
  button.textContent = label;
  button.title = title;
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick(button);
  };
  return button;
}

function createChoiceAuthorAction(
  label: string,
  title: string,
  onClick: (trigger: HTMLButtonElement) => void,
  disabled = false,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'choice-author-action';
  button.textContent = label;
  button.title = title;
  button.disabled = disabled;
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!button.disabled) onClick(button);
  };
  return button;
}

function showBranchAuthorPopup(
  trigger: HTMLElement,
  options: {
    kind: BranchAuthorMenuKind;
    conv: Conversation;
    turn: Turn;
    choice?: Choice;
    turnLabels: ReturnType<typeof createTurnDisplayLabeler>;
  },
): void {
  closeBranchAuthorPopup();

  const panel = document.createElement('div');
  panel.className = 'branch-author-popup';
  panel.onpointerdown = (event) => event.stopPropagation();
  panel.onclick = (event) => event.stopPropagation();

  const header = document.createElement('div');
  header.className = 'branch-author-popup-header';
  const title = document.createElement('div');
  title.className = 'branch-author-popup-title';
  title.textContent = getAuthorPopupTitle(options.kind, options.turn, options.choice, options.turnLabels);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'branch-author-popup-close';
  close.textContent = '×';
  close.title = 'Close menu';
  close.onclick = () => closeBranchAuthorPopup();
  header.append(title, close);
  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'branch-author-popup-body';
  if (options.kind === 'start') {
    renderStartAuthorMenu(body, options.conv, options.turn);
  } else if (options.kind === 'conditions') {
    renderConditionsAuthorMenu(body, options.conv, options.turn, options.choice);
  } else if (options.kind === 'outcomes') {
    renderOutcomesAuthorMenu(body, options.conv, options.turn, options.choice);
  } else {
    renderNextAuthorMenu(body, options.conv, options.turn, options.choice, options.turnLabels);
  }
  panel.appendChild(body);

  document.body.appendChild(panel);

  const position = (): void => {
    if (!panel.isConnected || !trigger.isConnected) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 10;
    const width = panel.offsetWidth || 360;
    const height = panel.offsetHeight || 420;
    let left = rect.right + gap;
    if (left + width > window.innerWidth - gap) {
      left = Math.max(gap, rect.left - width - gap);
    }
    let top = Math.max(gap, rect.top - 12);
    if (top + height > window.innerHeight - gap) {
      top = Math.max(gap, window.innerHeight - height - gap);
    }
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };

  const handlePointer = (event: MouseEvent): void => {
    const target = event.target as Node | null;
    if (target && (panel.contains(target) || trigger.contains(target))) return;
    closeBranchAuthorPopup();
  };
  const handleKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') closeBranchAuthorPopup();
  };
  const cleanup = (): void => {
    panel.remove();
    window.removeEventListener('resize', position);
    document.removeEventListener('mousedown', handlePointer, true);
    document.removeEventListener('keydown', handleKey, true);
  };

  activeBranchAuthorPopup = {
    element: panel,
    trigger,
    cleanup,
    scope: { turnNumber: options.turn.turnNumber, choiceIndex: options.choice?.index ?? null },
  };
  position();
  window.addEventListener('resize', position);
  setTimeout(() => {
    document.addEventListener('mousedown', handlePointer, true);
    document.addEventListener('keydown', handleKey, true);
  }, 0);
}

function closeBranchAuthorPopup(): void {
  if (!activeBranchAuthorPopup) return;
  const popup = activeBranchAuthorPopup;
  activeBranchAuthorPopup = null;
  popup.cleanup();
}

function getAuthorPopupTitle(
  kind: BranchAuthorMenuKind,
  turn: Turn,
  choice: Choice | undefined,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): string {
  const scope = choice ? `${turnLabels.getLongLabel(turn.turnNumber)} / C${choice.index}` : turnLabels.getLongLabel(turn.turnNumber);
  if (kind === 'start') return `${scope} Start`;
  if (kind === 'conditions') return `${scope} Conditions`;
  if (kind === 'outcomes') return `${scope} Outcomes`;
  return `${scope} Next`;
}

function renderStartAuthorMenu(container: HTMLElement, conv: Conversation, turn: Turn): void {
  const channel = normalizeChannel(turn.channel, normalizeChannel(conv.initialChannel, 'pda'));
  container.appendChild(createAuthorMenuSection('Branch channel', [
    createFlowChannelToggle({
      current: channel,
      onChange: (nextChannel) => setTurnChannelFromFlow(conv, turn, nextChannel),
    }),
    createAuthorHint(turn.turnNumber === 1
      ? 'Root branch controls story start mode and first branch channel.'
      : 'Branch channel controls whether this scene plays on PDA or face-to-face.'),
  ]));

  const segmentStarts = collectBranchSegmentStartTurns(conv);
  const entrySummary = document.createElement('div');
  entrySummary.className = 'branch-author-summary';
  entrySummary.textContent = segmentStarts.has(turn.turnNumber)
    ? `Entry segment: ${channelBadgeLabel(channel)} opener active`
    : `Continuation segment: inherits ${channelBadgeLabel(channel)} flow`;
  container.appendChild(entrySummary);

  if (turn.turnNumber === 1) {
    const rootMode = normalizeChannel(conv.startMode ?? conv.initialChannel, channel);
    container.appendChild(createAuthorMenuSection('Root start mode', [
      createFlowChannelToggle({
        current: rootMode,
        onChange: (nextChannel) => store.setConversationInitialChannel(conv.id, nextChannel),
      }),
    ]));
  }
}

function renderConditionsAuthorMenu(container: HTMLElement, conv: Conversation, turn: Turn, choice?: Choice): void {
  const entries = choice ? (choice.preconditions ?? []) : (turn.preconditions ?? []);
  const updateEntries = (nextEntries: PreconditionEntry[]): void => {
    if (choice) {
      store.updateChoice(conv.id, turn.turnNumber, choice.index, { preconditions: nextEntries });
      return;
    }
    store.updateTurn(conv.id, turn.turnNumber, { preconditions: nextEntries });
  };

  const quick = document.createElement('div');
  quick.className = 'branch-author-card-grid';
  const quickRules: Array<{ title: string; body: string; entry: SimplePrecondition }> = choice
    ? [
      { title: 'Needs 1000 RU', body: 'Choice visible when player has money.', entry: { type: 'simple', command: 'req_money', params: ['1000'] } },
      { title: 'Needs medkit', body: 'Choice visible when player has item.', entry: { type: 'simple', command: 'req_has_item', params: ['medkit'] } },
      { title: 'Friendly NPC', body: 'Choice visible for friendly current NPC.', entry: { type: 'simple', command: 'req_npc_friendly', params: [] } },
    ]
    : [
      { title: 'Friendly NPC', body: 'Branch can run for non-hostile NPC.', entry: { type: 'simple', command: 'req_npc_friendly', params: [] } },
      { title: 'Same faction NPC', body: 'Branch gates to story faction NPC.', entry: { type: 'simple', command: 'req_npc_faction', params: [getConversationFaction(conv)] } },
      { title: 'Named NPC', body: 'Branch gates to story NPC id.', entry: { type: 'simple', command: 'req_story_npc', params: [''] } },
    ];
  for (const rule of quickRules) {
    quick.appendChild(createAuthorShortcutButton(rule.title, rule.body, () => updateEntries([...entries, rule.entry])));
  }
  container.appendChild(createAuthorMenuSection('Quick checks', [quick]));

  container.appendChild(renderCommandSummaryList({
    emptyText: choice ? 'No choice checks.' : 'No branch checks.',
    entries,
    getLabel: (entry) => formatPreconditionEntry(entry),
    onRemove: (index) => updateEntries(entries.filter((_, idx) => idx !== index)),
  }));

  container.appendChild(createSchemaPicker({
    title: 'All preconditions',
    schemas: PRECONDITION_SCHEMAS.filter((schema) => !schema.pickerHidden),
    onPick: (schema) => updateEntries([...entries, createSimplePrecondition(schema)]),
  }));
}

function renderOutcomesAuthorMenu(container: HTMLElement, conv: Conversation, turn: Turn, choice?: Choice): void {
  if (!choice) {
    container.appendChild(createAuthorHint('Select choice row before adding outcomes.'));
    return;
  }
  const outcomes = choice.outcomes ?? [];
  const appendOutcome = (outcome: Outcome): void => {
    store.appendOutcomeToChoice(conv.id, turn.turnNumber, choice.index, outcome);
  };
  const updateOutcomes = (nextOutcomes: Outcome[]): void => {
    store.updateChoice(conv.id, turn.turnNumber, choice.index, { outcomes: nextOutcomes });
  };

  const quick = document.createElement('div');
  quick.className = 'branch-author-card-grid';
  const quickOutcomes: Array<{ title: string; body: string; outcome: Outcome }> = [
    { title: 'Give 500 RU', body: 'Reward player money.', outcome: { command: 'reward_money', params: ['500'] } },
    { title: 'Give medkit', body: 'Put medkit in inventory.', outcome: { command: 'give_item', params: ['medkit'] } },
    { title: 'Improve goodwill', body: 'Add faction goodwill.', outcome: { command: 'reward_gw', params: ['50', getConversationFaction(conv)] } },
    { title: 'Watch location', body: 'Mark Cordon location.', outcome: { command: 'watch_location', params: ['%cordon_panda_st_key%', '85'] } },
  ];
  for (const outcome of quickOutcomes) {
    quick.appendChild(createAuthorShortcutButton(outcome.title, outcome.body, () => appendOutcome(outcome.outcome)));
  }
  container.appendChild(createAuthorMenuSection('Quick outcomes', [quick]));

  container.appendChild(renderCommandSummaryList({
    emptyText: 'No outcomes.',
    entries: outcomes,
    getLabel: (outcome) => formatOutcomeEntry(outcome),
    onRemove: (index) => updateOutcomes(outcomes.filter((_, idx) => idx !== index)),
  }));

  container.appendChild(createSchemaPicker({
    title: 'All outcomes',
    schemas: OUTCOME_SCHEMAS,
    onPick: (schema) => appendOutcome(createOutcome(schema)),
  }));
}

function renderNextAuthorMenu(
  container: HTMLElement,
  conv: Conversation,
  turn: Turn,
  choice: Choice | undefined,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
): void {
  if (!choice) {
    container.appendChild(createAuthorHint('Select choice row before editing next branch.'));
    return;
  }

  const currentChannel = normalizeChannel(choice.continueChannel ?? choice.continue_channel, normalizeChannel(turn.channel, 'pda'));
  const summary = document.createElement('div');
  summary.className = 'branch-author-summary';
  summary.textContent = choice.continueTo == null
    ? 'Ends here'
    : `Continues ${channelBadgeLabel(currentChannel)} to ${turnLabels.getLongLabel(choice.continueTo)}`;
  container.appendChild(summary);

  const nextActions = document.createElement('div');
  nextActions.className = 'branch-author-action-row';
  for (const channel of ['pda', 'f2f'] as const) {
    nextActions.appendChild(createAuthorPopupButton(`Next ${channelBadgeLabel(channel)}`, () => {
      const createdTurnNumber = store.ensureChoiceContinuationTurn(conv.id, turn.turnNumber, choice.index, channel);
      if (createdTurnNumber != null) {
        requestFlowCenter({ conversationId: conv.id, turnNumber: createdTurnNumber });
      }
    }));
  }
  nextActions.appendChild(createAuthorPopupButton('End here', () => store.clearChoiceContinuation(conv.id, turn.turnNumber, choice.index), choice.continueTo == null));
  container.appendChild(createAuthorMenuSection('Next action', [nextActions]));

  const linkList = document.createElement('div');
  linkList.className = 'branch-link-list';
  const endLink = createBranchLinkButton('End story here', choice.continueTo == null, () => {
    store.clearChoiceContinuation(conv.id, turn.turnNumber, choice.index);
  });
  linkList.appendChild(endLink);
  for (const candidate of conv.turns) {
    if (candidate.turnNumber === turn.turnNumber) continue;
    linkList.appendChild(createBranchLinkButton(
      turnLabels.getLongLabel(candidate.turnNumber),
      choice.continueTo === candidate.turnNumber,
      () => store.connectChoiceToTurn(conv.id, turn.turnNumber, choice.index, candidate.turnNumber),
    ));
  }
  container.appendChild(createAuthorMenuSection('Link existing branch', [linkList]));

  const npcField = document.createElement('div');
  npcField.className = 'branch-author-field';
  const npcLabel = document.createElement('label');
  npcLabel.textContent = 'Hand off to NPC';
  const npcPicker = createCatalogPickerPanelEditor(
    choice.cont_npc_id ?? '',
    (value) => store.updateChoice(conv.id, turn.turnNumber, choice.index, { cont_npc_id: value.trim() || undefined }),
    `flow-${conv.id}-${turn.turnNumber}-${choice.index}-cont-npc`,
    {
      title: 'NPC Handoff Catalog',
      subtitle: 'Pick NPC who delivers next branch.',
      searchPlaceholder: 'Search NPC id, faction, level, or role...',
      emptyLabel: 'Same NPC continues',
      browseLabel: 'Browse NPC catalog',
      options: STORY_NPC_OPTIONS,
      facets: [
        { label: 'Faction', allLabel: 'All factions', field: 'faction', keywordIndex: 0 },
        { label: 'Level', allLabel: 'All levels', field: 'level', keywordIndex: 1 },
        { label: 'Role', allLabel: 'All roles', field: 'role', keywordIndex: 2 },
      ],
      richRows: true,
    },
  );
  npcField.append(npcLabel, npcPicker);
  container.appendChild(npcField);
}

function createBranchLinkButton(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `branch-link-button${active ? ' is-active' : ''}`;
  button.textContent = label;
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };
  return button;
}

function createAuthorMenuSection(title: string, children: HTMLElement[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'branch-author-section';
  const header = document.createElement('div');
  header.className = 'branch-author-section-title';
  header.textContent = title;
  section.appendChild(header);
  section.append(...children);
  return section;
}

function createAuthorHint(text: string): HTMLElement {
  const hint = document.createElement('div');
  hint.className = 'branch-author-hint';
  hint.textContent = text;
  return hint;
}

function createAuthorShortcutButton(title: string, body: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'branch-author-card';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const span = document.createElement('span');
  span.textContent = body;
  button.append(strong, span);
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };
  return button;
}

function createAuthorPopupButton(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-sm branch-author-popup-action';
  button.textContent = label;
  button.disabled = disabled;
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };
  return button;
}

function renderCommandSummaryList<T>(options: {
  emptyText: string;
  entries: T[];
  getLabel: (entry: T) => string;
  onRemove: (index: number) => void;
}): HTMLElement {
  const list = document.createElement('div');
  list.className = 'branch-author-command-list';
  if (options.entries.length === 0) {
    list.appendChild(createAuthorHint(options.emptyText));
    return list;
  }
  options.entries.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'branch-author-command-row';
    const label = document.createElement('span');
    label.textContent = options.getLabel(entry);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'branch-author-remove';
    remove.textContent = '×';
    remove.title = 'Remove';
    remove.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.onRemove(index);
    };
    row.append(label, remove);
    list.appendChild(row);
  });
  return list;
}

function createSchemaPicker(options: {
  title: string;
  schemas: CommandSchema[];
  onPick: (schema: CommandSchema) => void;
}): HTMLElement {
  const wrapper = document.createElement('section');
  wrapper.className = 'branch-author-section branch-author-schema-picker';
  const title = document.createElement('div');
  title.className = 'branch-author-section-title';
  title.textContent = options.title;
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'branch-author-search';
  search.placeholder = 'Search commands...';
  const results = document.createElement('div');
  results.className = 'branch-author-schema-results';

  const render = (): void => {
    results.innerHTML = '';
    const filter = search.value.trim().toLowerCase();
    const filtered = options.schemas
      .filter((schema) => !filter
        || schema.name.toLowerCase().includes(filter)
        || schema.label.toLowerCase().includes(filter)
        || schema.category.toLowerCase().includes(filter))
      .slice(0, 90);
    for (const schema of filtered) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'branch-author-schema-option';
      button.innerHTML = `<strong>${schema.label}</strong><span>${schema.name}</span>`;
      button.title = schema.description;
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onPick(schema);
      };
      results.appendChild(button);
    }
    if (filtered.length === 0) results.appendChild(createAuthorHint('No matching commands.'));
  };

  search.oninput = render;
  wrapper.append(title, search, results);
  render();
  return wrapper;
}

function createSimplePrecondition(schema: CommandSchema): SimplePrecondition {
  return {
    type: 'simple',
    command: schema.name,
    params: schema.params.map((param) => param.placeholder ?? ''),
  };
}

function createOutcome(schema: CommandSchema): Outcome {
  return {
    command: schema.name,
    params: schema.params.map((param) => param.placeholder ?? ''),
  };
}

function formatPreconditionEntry(entry: PreconditionEntry): string {
  if (entry.type === 'simple') {
    const schema = PRECONDITION_SCHEMAS.find((candidate) => candidate.name === entry.command);
    return formatCommandSummary(schema?.label ?? entry.command, entry.params);
  }
  if (entry.type === 'not') return 'NOT group';
  if (entry.type === 'any') return `ANY (${entry.options.length})`;
  return entry.raw || 'Invalid precondition';
}

function formatOutcomeEntry(outcome: Outcome): string {
  const schema = OUTCOME_SCHEMAS.find((candidate) => candidate.name === outcome.command);
  return formatCommandSummary(schema?.label ?? outcome.command, outcome.params);
}

function formatCommandSummary(label: string, params: string[]): string {
  const filled = params.filter((param) => param.trim().length > 0);
  if (filled.length === 0) return label;
  return `${label}: ${filled.join(' : ')}`;
}

function buildTurnAriaLabel(
  turn: Turn,
  turnLabels: ReturnType<typeof createTurnDisplayLabeler>,
  showOpener = true,
): string {
  const opening = showOpener && turn.openingMessage ? ` Opening message: ${truncate(turn.openingMessage, 80)}.` : '';
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
  button.onpointerdown = (event) => {
    event.stopPropagation();
  };
  button.onclick = (event) => {
    event.preventDefault();
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
  renderPackets?: boolean;
}): void {
  const { svg, conv, edges, nodeElements, edgeElements, positionOverrides, turnLabels, factionColor, onlyTurnNumbers, renderPackets = true } = options;
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
    const pathD = buildEdgePath(sourceAnchor, targetAnchor, edge.offsetIndex, edge.bend);
    const labelAnchor = getLabelAnchor(sourceAnchor, targetAnchor, edge.offsetIndex, edge.bend);
    const handleAnchor = getBendHandleAnchor(sourceAnchor, targetAnchor, edge.offsetIndex, edge.bend);
    const showBendHandle = edge.kind === 'continue' && edge.highlight === 'active';
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
      if (packet && renderPackets) {
        packet.setAttribute('d', pathD);
        packet.setAttribute('class', `flow-edge-packet ${edge.pathClassName}${highlightSuffix}`);
      } else if (packet && !renderPackets) {
        packet.remove();
      }
      const label = existing.querySelector('.flow-edge-label') as SVGTextElement | null;
      if (label) {
        label.setAttribute('x', String(labelAnchor.x));
        label.setAttribute('y', String(labelAnchor.y));
        label.setAttribute('class', `flow-edge-label ${edge.textClassName}${highlightSuffix}`);
      }
      syncBendHandle(existing, {
        svg,
        conv,
        edge,
        sourceAnchor,
        targetAnchor,
        labelAnchor,
        handleAnchor,
        pathD,
        show: showBendHandle,
        renderPackets,
      });
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

      if (renderPackets) {
        const packetPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        packetPath.setAttribute('d', pathD);
        packetPath.setAttribute('class', `flow-edge-packet ${edge.pathClassName}${highlightSuffix}`);
        packetPath.style.setProperty('--flow-edge-color', edge.color);
        packetPath.setAttribute('aria-hidden', 'true');
        group.appendChild(packetPath);
      }

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

      syncBendHandle(group, {
        svg,
        conv,
        edge,
        sourceAnchor,
        targetAnchor,
        labelAnchor,
        handleAnchor,
        pathD,
        show: showBendHandle,
        renderPackets,
      });

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
    renderPackets: getFlowGraphSize(conv.turns.length, flow.edges.length) === 'normal',
  });
}

function syncBendHandle(group: SVGGElement, options: {
  svg: SVGSVGElement;
  conv: Conversation;
  edge: EdgeDescriptor;
  sourceAnchor: { x: number; y: number };
  targetAnchor: { x: number; y: number };
  labelAnchor: { x: number; y: number };
  handleAnchor: { x: number; y: number };
  pathD: string;
  show: boolean;
  renderPackets: boolean;
}): void {
  const { svg, conv, edge, sourceAnchor, targetAnchor, handleAnchor, show, renderPackets } = options;
  let handle = group.querySelector('.flow-edge-bend-handle') as SVGCircleElement | null;
  if (!show) {
    handle?.remove();
    return;
  }
  if (!handle) {
    handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handle.setAttribute('r', '7');
    handle.setAttribute('tabindex', '0');
    handle.setAttribute('role', 'slider');
    handle.setAttribute('aria-label', 'Adjust flow line bend. Drag, use arrow keys, hold Alt for fine step, or double-click to reset.');
    handle.classList.add('flow-edge-bend-handle');
    handle.style.setProperty('--flow-edge-color', edge.color);
    group.appendChild(handle);
  }
  handle.setAttribute('cx', String(handleAnchor.x));
  handle.setAttribute('cy', String(handleAnchor.y));
  handle.setAttribute('aria-valuenow', String(Math.round(edge.bend * 10) / 10));
  handle.setAttribute('aria-valuemin', '-320');
  handle.setAttribute('aria-valuemax', '320');

  const redrawLocal = (bend: number): void => {
    edge.bend = bend;
    const pathD = buildEdgePath(sourceAnchor, targetAnchor, edge.offsetIndex, bend);
    const labelAnchor = getLabelAnchor(sourceAnchor, targetAnchor, edge.offsetIndex, bend);
    const nextHandleAnchor = getBendHandleAnchor(sourceAnchor, targetAnchor, edge.offsetIndex, bend);
    const path = group.querySelector('.flow-edge-path') as SVGPathElement | null;
    const packet = group.querySelector('.flow-edge-packet') as SVGPathElement | null;
    const label = group.querySelector('.flow-edge-label') as SVGTextElement | null;
    path?.setAttribute('d', pathD);
    if (packet && renderPackets) packet.setAttribute('d', pathD);
    label?.setAttribute('x', String(labelAnchor.x));
    label?.setAttribute('y', String(labelAnchor.y));
    handle?.setAttribute('cx', String(nextHandleAnchor.x));
    handle?.setAttribute('cy', String(nextHandleAnchor.y));
    handle?.setAttribute('aria-valuenow', String(Math.round(bend * 10) / 10));
  };

  handle.onpointerdown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    let nextBend = edge.bend;
    handle?.setPointerCapture(pointerId);
    group.classList.add('is-bending');

    const onMove = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      nextBend = getBendFromPointer(svg, sourceAnchor, targetAnchor, edge.offsetIndex, moveEvent);
      redrawLocal(nextBend);
    };

    const onUp = (upEvent: PointerEvent): void => {
      if (upEvent.pointerId !== pointerId) return;
      upEvent.preventDefault();
      upEvent.stopPropagation();
      group.classList.remove('is-bending');
      if (handle?.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      store.updateFlowEdgeBend(conv.id, edgeKey(edge), nextBend);
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  };

  handle.onkeydown = (event) => {
    const keyDirection = event.key === 'ArrowUp' || event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
        ? -1
        : 0;
    if (keyDirection === 0 && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    event.stopPropagation();

    const step = event.altKey ? 1 : event.shiftKey ? 16 : 4;
    const nextBend = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? (edge.bend >= 0 ? 320 : -320)
        : clamp(edge.bend + keyDirection * step, -320, 320);
    redrawLocal(nextBend);
    store.updateFlowEdgeBend(conv.id, edgeKey(edge), nextBend);
  };

  handle.ondblclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    redrawLocal(0);
    store.updateFlowEdgeBend(conv.id, edgeKey(edge), 0);
  };
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
  const opening = node.querySelector('.branch-opener-text, .turn-npc-message');
  if (opening) {
    opening.textContent = truncate(turn.openingMessage ?? '', layout.messageChars);
  }
  node.classList.toggle('has-warning', hasWarning);
  node.setAttribute('aria-label', buildTurnAriaLabel(turn, turnLabels));
  node.style.width = node.classList.contains('has-inline-panel')
    ? `${BRANCH_INLINE_PANEL_WIDTH}px`
    : `${getFlowNodeWidth(turn, turnLabels.getLongLabel(turn.turnNumber), density)}px`;
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
    occlusionEnabled: store.get().flowOcclusionEnabled,
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
  occlusionEnabled: boolean;
  nodeElements: Map<number, HTMLElement>;
  edgeElements: Map<string, SVGGElement>;
  selectedTurnNumber: number | null;
  selectedChoiceIndex: number | null;
}): void {
  const { canvas, viewState, graphModel, occlusionEnabled, nodeElements, edgeElements, selectedTurnNumber, selectedChoiceIndex } = options;
  if (!occlusionEnabled) {
    for (const node of nodeElements.values()) {
      node.style.visibility = '';
      node.style.pointerEvents = '';
    }
    for (const edge of edgeElements.values()) {
      edge.style.display = '';
    }
    return;
  }
  const keepMounted = new Set<number>();
  if (selectedTurnNumber != null) keepMounted.add(selectedTurnNumber);
  if (selectedTurnNumber != null && selectedChoiceIndex != null) {
    for (const edge of graphModel.edges) {
      if (edge.sourceTurnNumber === selectedTurnNumber && edge.sourceChoiceIndex === selectedChoiceIndex) {
        keepMounted.add(edge.targetTurnNumber);
      }
    }
  }
  const viewport: FlowViewport = {
    left: (0 - viewState.panX) / viewState.zoom,
    top: (0 - viewState.panY) / viewState.zoom,
    right: (canvas.clientWidth - viewState.panX) / viewState.zoom,
    bottom: (canvas.clientHeight - viewState.panY) / viewState.zoom,
  };
  const overscan = getFlowVisibilityOverscan(viewport);
  const paddedViewport = padFlowViewport(viewport, overscan);
  const visibleTurnNumbers = new Set<number>();
  for (const [turnNumber, node] of nodeElements) {
    const graphNode = graphModel.nodes.get(turnNumber);
    if (keepMounted.has(turnNumber) || flowRectsIntersect(getDomBackedNodeRect(node, graphNode), paddedViewport)) {
      visibleTurnNumbers.add(turnNumber);
    }
  }
  const visibleEdgeKeys = new Set<string>();
  for (const edge of graphModel.edges) {
    if (visibleTurnNumbers.has(edge.sourceTurnNumber) || visibleTurnNumbers.has(edge.targetTurnNumber)) {
      visibleEdgeKeys.add(edgeKeyFromParts(edge.sourceTurnNumber, edge.sourceChoiceIndex, edge.targetTurnNumber, edge.kind));
    }
  }
  for (const [turnNumber, node] of nodeElements) {
    const isVisible = visibleTurnNumbers.has(turnNumber);
    node.style.visibility = isVisible ? '' : 'hidden';
    node.style.pointerEvents = isVisible ? '' : 'none';
  }
  for (const [key, edge] of edgeElements) {
    edge.style.display = visibleEdgeKeys.has(key) ? '' : 'none';
  }
}

function padFlowViewport(viewport: FlowViewport, overscan: number): FlowViewport {
  return {
    left: viewport.left - overscan,
    top: viewport.top - overscan,
    right: viewport.right + overscan,
    bottom: viewport.bottom + overscan,
  };
}

function getDomBackedNodeRect(node: HTMLElement, graphNode?: FlowGraphNode): FlowGraphNode {
  const left = Number.parseFloat(node.style.left) || graphNode?.x || 0;
  const top = Number.parseFloat(node.style.top) || graphNode?.y || 0;
  return {
    turnNumber: graphNode?.turnNumber ?? Number.parseInt(node.dataset.turnNumber ?? '0', 10),
    x: left,
    y: top,
    width: node.offsetWidth || graphNode?.width || 0,
    height: node.offsetHeight || graphNode?.height || 0,
  };
}

function flowRectsIntersect(node: FlowGraphNode, viewport: FlowViewport): boolean {
  return node.x <= viewport.right
    && node.x + node.width >= viewport.left
    && node.y <= viewport.bottom
    && node.y + node.height >= viewport.top;
}

function drawConnectionPreview(options: {
  svg: SVGSVGElement;
  conv: Conversation;
  nodeElements: Map<number, HTMLElement>;
  positionOverrides?: TurnPositionMap;
  preview: ConnectionPreview | null;
  factionColor: string;
  renderPacket?: boolean;
}): void {
  const { svg, conv, nodeElements, positionOverrides, preview, factionColor, renderPacket = true } = options;
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

  if (renderPacket) {
    const previewPacket = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    previewPacket.setAttribute('d', buildEdgePath(sourceAnchor, previewTarget, 0));
    previewPacket.setAttribute('class', `flow-edge-packet flow-edge-preview-packet edge-preview${preview.invalidTarget ? ' edge-preview-invalid' : ''}`);
    previewPacket.style.setProperty('--flow-edge-color', previewColor);
    previewPacket.setAttribute('aria-hidden', 'true');
    svg.appendChild(previewPacket);
  }
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
        const key = edgeKeyFromParts(turn.turnNumber, choice.index, target.turnNumber, target.kind);

        edges.push({
          sourceTurnNumber: turn.turnNumber,
          sourceChoiceIndex: choice.index,
          targetTurnNumber: target.turnNumber,
          label: target.label,
          color: targetBranchColor,
          pathClassName: `edge-${target.kind}`,
          textClassName: `edge-label-${target.kind}`,
          offsetIndex: spreadOffset(offsetIndex),
          bend: conv.flowEdgeBends?.[key] ?? 0,
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
  const validTurnNumbers = new Set(conv.turns.map(turn => turn.turnNumber));

  if (choice.continueTo != null) {
    targets.push({
      turnNumber: choice.continueTo,
      label: `C${choice.index}`,
      kind: 'continue',
    });
  }

  for (const outcome of choice.outcomes) {
    const resumeTargets = parseOutcomeResumeTurnNumbers(outcome);
    if (!resumeTargets) continue;

    if (resumeTargets.successTurn != null && validTurnNumbers.has(resumeTargets.successTurn)) {
      targets.push({
        turnNumber: resumeTargets.successTurn,
        label: 'ok',
        kind: 'pause-success',
      });
    }

    if (resumeTargets.failTurn != null && validTurnNumbers.has(resumeTargets.failTurn)) {
      targets.push({
        turnNumber: resumeTargets.failTurn,
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
  return choice.outcomes.some(outcome => parseOutcomeResumeTurnNumbers(outcome) != null);
}

function buildEdgePath(source: { x: number; y: number }, target: { x: number; y: number }, laneOffset: number, bend = 0): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const lane = laneOffset * 20 + bend;
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

function getLabelAnchor(source: { x: number; y: number }, target: { x: number; y: number }, offsetIndex: number, bend = 0): { x: number; y: number } {
  const normal = getEdgeNormal(source, target);
  return {
    x: source.x + (target.x - source.x) / 2 + normal.x * bend,
    y: source.y + (target.y - source.y) / 2 + offsetIndex * 14 - 10 + normal.y * bend,
  };
}

function getBendHandleAnchor(source: { x: number; y: number }, target: { x: number; y: number }, offsetIndex: number, bend = 0): { x: number; y: number } {
  const normal = getEdgeNormal(source, target);
  const baseLane = offsetIndex * 20;
  return {
    x: source.x + (target.x - source.x) / 2 + normal.x * (baseLane + bend),
    y: source.y + (target.y - source.y) / 2 + normal.y * (baseLane + bend),
  };
}

function getBendFromPointer(
  svg: SVGSVGElement,
  source: { x: number; y: number },
  target: { x: number; y: number },
  offsetIndex: number,
  event: PointerEvent,
): number {
  const point = clientToSvgPoint(svg, event.clientX, event.clientY);
  const normal = getEdgeNormal(source, target);
  const midX = source.x + (target.x - source.x) / 2;
  const midY = source.y + (target.y - source.y) / 2;
  const projected = (point.x - midX) * normal.x + (point.y - midY) * normal.y;
  return clamp(projected - offsetIndex * 20, -320, 320);
}

function getEdgeNormal(source: { x: number; y: number }, target: { x: number; y: number }): { x: number; y: number } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return { x: 0, y: 1 };
  return { x: -dy / length, y: dx / length };
}

function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const width = Number(svg.getAttribute('width')) || svg.clientWidth || rect.width || 1;
  const height = Number(svg.getAttribute('height')) || svg.clientHeight || rect.height || 1;
  return {
    x: (clientX - rect.left) * (width / Math.max(1, rect.width)),
    y: (clientY - rect.top) * (height / Math.max(1, rect.height)),
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

function clientToFlowContentPoint(content: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = content.getBoundingClientRect();
  const scaleX = rect.width > 0 ? content.offsetWidth / rect.width : 1;
  const scaleY = rect.height > 0 ? content.offsetHeight / rect.height : 1;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
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

function dispatchCursorState(canvas: HTMLElement, kind: 'panning' | 'dragging' | 'linking' | 'drawing', active: boolean): void {
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
    const target = event.target as HTMLElement | null;
    if (target?.closest('.branch-inline-panel, .command-picker-panel, .catalog-picker-panel, .item-picker-panel')) {
      return;
    }
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
