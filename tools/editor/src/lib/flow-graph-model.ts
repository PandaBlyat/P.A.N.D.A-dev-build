import type { Conversation, Choice, Turn } from './types';
import type { FlowDensity } from './state';
import { estimateFlowNodeHeight, getFlowNodeLayout } from './flow-layout';
import { parseOutcomeResumeTurnNumbers } from './outcome-branching';

export type FlowViewport = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type FlowGraphEdge = {
  sourceTurnNumber: number;
  sourceChoiceIndex: number;
  targetTurnNumber: number;
  kind: 'continue' | 'pause-success' | 'pause-fail';
};

export type FlowGraphNode = {
  turnNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FlowGraphModel = {
  conversationId: number;
  turnByNumber: Map<number, Turn>;
  choiceByKey: Map<string, Choice>;
  nodes: Map<number, FlowGraphNode>;
  edges: FlowGraphEdge[];
  neighbors: Map<number, Set<number>>;
  bounds: { width: number; height: number };
};

export function buildFlowGraphModel(
  conversation: Conversation,
  density: FlowDensity,
  _factionColor: string,
): FlowGraphModel {
  const turnByNumber = new Map<number, Turn>();
  const choiceByKey = new Map<string, Choice>();
  const nodes = new Map<number, FlowGraphNode>();
  const edges: FlowGraphEdge[] = [];
  const neighbors = new Map<number, Set<number>>();
  const layout = getFlowNodeLayout(density);

  let maxX = 0;
  let maxY = 0;

  for (const turn of conversation.turns) {
    turnByNumber.set(turn.turnNumber, turn);
    const width = layout.width;
    const height = estimateFlowNodeHeight(turn, density);
    nodes.set(turn.turnNumber, {
      turnNumber: turn.turnNumber,
      x: turn.position.x,
      y: turn.position.y,
      width,
      height,
    });
    maxX = Math.max(maxX, turn.position.x + width);
    maxY = Math.max(maxY, turn.position.y + height);
    for (const choice of turn.choices) {
      choiceByKey.set(`${turn.turnNumber}:${choice.index}`, choice);
      addChoiceEdges(edges, neighbors, turn.turnNumber, choice);
    }
  }

  return {
    conversationId: conversation.id,
    turnByNumber,
    choiceByKey,
    nodes,
    edges,
    neighbors,
    bounds: {
      width: Math.max(1400, maxX + 120),
      height: Math.max(900, maxY + 120),
    },
  };
}

export function getVisibleFlowItems(
  model: FlowGraphModel,
  viewport: FlowViewport,
  keepMounted: ReadonlySet<number> = new Set(),
): { turnNumbers: Set<number>; edgeKeys: Set<string> } {
  const overscan = getFlowVisibilityOverscan(viewport);
  const paddedViewport = {
    left: viewport.left - overscan,
    top: viewport.top - overscan,
    right: viewport.right + overscan,
    bottom: viewport.bottom + overscan,
  };
  const turnNumbers = new Set<number>();
  for (const [turnNumber, node] of model.nodes) {
    if (keepMounted.has(turnNumber) || rectsIntersect(node, paddedViewport)) {
      turnNumbers.add(turnNumber);
    }
  }

  const edgeKeys = new Set<string>();
  for (const edge of model.edges) {
    if (turnNumbers.has(edge.sourceTurnNumber) || turnNumbers.has(edge.targetTurnNumber)) {
      edgeKeys.add(getFlowGraphEdgeKey(edge));
    }
  }

  return {
    turnNumbers,
    edgeKeys,
  };
}

export function getFlowVisibilityOverscan(viewport: FlowViewport): number {
  const viewportWidth = Math.max(0, viewport.right - viewport.left);
  const viewportHeight = Math.max(0, viewport.bottom - viewport.top);
  const viewportSpan = Math.max(viewportWidth, viewportHeight);
  return Math.round(Math.max(900, Math.min(1800, viewportSpan * 0.55)));
}

function rectsIntersect(
  node: FlowGraphNode,
  viewport: FlowViewport,
): boolean {
  return node.x <= viewport.right
    && node.x + node.width >= viewport.left
    && node.y <= viewport.bottom
    && node.y + node.height >= viewport.top;
}

export function getFlowGraphEdgeKey(edge: FlowGraphEdge): string {
  return `${edge.sourceTurnNumber}:${edge.sourceChoiceIndex}:${edge.targetTurnNumber}:${edge.kind}`;
}

export function getEdgePath(source: { x: number; y: number }, target: { x: number; y: number }, laneOffset: number): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const lane = laneOffset * 20;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx >= absDy) {
    const forward = dx >= 0 ? 1 : -1;
    const spread = Math.min(Math.max(absDx * 0.34, 34), 120);
    const cross = Math.min(Math.max(absDy * 0.2, 8), 42) * Math.sign(dy || lane || 1);
    return `M${source.x},${source.y} C${source.x + forward * spread},${source.y + lane + cross} ${target.x - forward * (spread + 24)},${target.y + lane - cross} ${target.x},${target.y}`;
  }
  const vertical = dy >= 0 ? 1 : -1;
  const horizontal = dx >= 0 ? 1 : -1;
  const side = Math.min(Math.max(absDx * 0.45, 36), 76) * horizontal;
  const arc = Math.min(Math.max(absDy * 0.3, 32), 84) * vertical;
  return `M${source.x},${source.y} C${source.x + side + lane},${source.y + arc * 0.45} ${target.x - side},${target.y - arc * 0.45 + lane} ${target.x},${target.y}`;
}

function addChoiceEdges(edges: FlowGraphEdge[], neighbors: Map<number, Set<number>>, sourceTurnNumber: number, choice: Choice): void {
  if (choice.continueTo != null) {
    addEdge(edges, neighbors, sourceTurnNumber, choice.index, choice.continueTo, 'continue');
  }

  for (const outcome of choice.outcomes) {
    const resumeTargets = parseOutcomeResumeTurnNumbers(outcome);
    if (!resumeTargets) continue;
    if (resumeTargets.successTurn != null) addEdge(edges, neighbors, sourceTurnNumber, choice.index, resumeTargets.successTurn, 'pause-success');
    if (resumeTargets.failTurn != null) addEdge(edges, neighbors, sourceTurnNumber, choice.index, resumeTargets.failTurn, 'pause-fail');
  }
}

function addEdge(
  edges: FlowGraphEdge[],
  neighbors: Map<number, Set<number>>,
  sourceTurnNumber: number,
  sourceChoiceIndex: number,
  targetTurnNumber: number,
  kind: FlowGraphEdge['kind'],
): void {
  edges.push({ sourceTurnNumber, sourceChoiceIndex, targetTurnNumber, kind });
  if (!neighbors.has(sourceTurnNumber)) neighbors.set(sourceTurnNumber, new Set());
  if (!neighbors.has(targetTurnNumber)) neighbors.set(targetTurnNumber, new Set());
  neighbors.get(sourceTurnNumber)!.add(targetTurnNumber);
  neighbors.get(targetTurnNumber)!.add(sourceTurnNumber);
}
