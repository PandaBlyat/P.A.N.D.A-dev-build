import type { Choice, Conversation } from './types';

type EdgeKind = 'continue' | 'pause-success' | 'pause-fail';

type GraphEdge = {
  sourceTurnNumber: number;
  targetTurnNumber: number;
  choiceIndex: number;
  kind: EdgeKind;
};

type TurnLabelInfo = {
  path: string | null;
  long: string;
  short: string;
};

type TurnLabelMap = Map<number, TurnLabelInfo>;

const EDGE_KIND_ORDER: Record<EdgeKind, number> = {
  continue: 0,
  'pause-success': 1,
  'pause-fail': 2,
};

function compareEdges(a: GraphEdge, b: GraphEdge): number {
  return a.sourceTurnNumber - b.sourceTurnNumber
    || a.choiceIndex - b.choiceIndex
    || EDGE_KIND_ORDER[a.kind] - EDGE_KIND_ORDER[b.kind]
    || a.targetTurnNumber - b.targetTurnNumber;
}

function parsePauseTurnNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getChoiceTargets(choice: Choice): Array<{ turnNumber: number; kind: EdgeKind }> {
  const targets: Array<{ turnNumber: number; kind: EdgeKind }> = [];

  if (choice.continueTo != null) {
    targets.push({ turnNumber: choice.continueTo, kind: 'continue' });
  }

  for (const outcome of choice.outcomes) {
    if (outcome.command !== 'pause_job') continue;

    const successTurn = parsePauseTurnNumber(outcome.params[1]);
    if (successTurn != null) {
      targets.push({ turnNumber: successTurn, kind: 'pause-success' });
    }

    const failTurn = parsePauseTurnNumber(outcome.params[2]);
    if (failTurn != null) {
      targets.push({ turnNumber: failTurn, kind: 'pause-fail' });
    }
  }

  return targets;
}

function buildGraphEdges(conversation: Conversation): GraphEdge[] {
  const turnNumbers = new Set(conversation.turns.map(turn => turn.turnNumber));
  const edges: GraphEdge[] = [];

  for (const turn of conversation.turns) {
    for (const choice of turn.choices) {
      for (const target of getChoiceTargets(choice)) {
        if (!turnNumbers.has(target.turnNumber)) continue;
        edges.push({
          sourceTurnNumber: turn.turnNumber,
          targetTurnNumber: target.turnNumber,
          choiceIndex: choice.index,
          kind: target.kind,
        });
      }
    }
  }

  return edges.sort(compareEdges);
}

function getConversationRootLabel(conversation: Conversation): string {
  const label = conversation.label.trim();
  return label === '' ? `Conversation ${conversation.id}` : label;
}

function buildTurnLabelMap(conversation: Conversation): TurnLabelMap {
  const labels: TurnLabelMap = new Map();
  const turnsById = new Map(conversation.turns.map(turn => [turn.turnNumber, turn]));
  const rootLabel = getConversationRootLabel(conversation);

  for (const turn of conversation.turns) {
    labels.set(turn.turnNumber, {
      path: null,
      long: turn.turnNumber === 1 ? rootLabel : `Branch ${turn.turnNumber}`,
      short: turn.turnNumber === 1 ? rootLabel : `B${turn.turnNumber}`,
    });
  }

  if (!turnsById.has(1)) return labels;

  const outgoing = new Map<number, GraphEdge[]>();
  for (const edge of buildGraphEdges(conversation)) {
    const sourceEdges = outgoing.get(edge.sourceTurnNumber) ?? [];
    sourceEdges.push(edge);
    outgoing.set(edge.sourceTurnNumber, sourceEdges);
  }

  const visited = new Set<number>([1]);
  const queue: number[] = [1];
  const primaryEdgeByTurn = new Map<number, GraphEdge>();

  while (queue.length > 0) {
    const turnNumber = queue.shift();
    if (turnNumber == null) continue;

    const edges = [...(outgoing.get(turnNumber) ?? [])].sort(compareEdges);
    for (const edge of edges) {
      if (visited.has(edge.targetTurnNumber)) continue;
      // Use the first stable BFS path as the presentation-only primary branch for
      // turns with multiple incoming edges so labels stay deterministic.
      visited.add(edge.targetTurnNumber);
      primaryEdgeByTurn.set(edge.targetTurnNumber, edge);
      queue.push(edge.targetTurnNumber);
    }
  }

  const primaryChildren = new Map<number, GraphEdge[]>();
  for (const edge of primaryEdgeByTurn.values()) {
    const children = primaryChildren.get(edge.sourceTurnNumber) ?? [];
    children.push(edge);
    primaryChildren.set(edge.sourceTurnNumber, children);
  }

  labels.set(1, {
    path: '1',
    long: rootLabel,
    short: rootLabel,
  });

  const assignPaths = (turnNumber: number, parentPath: string): void => {
    const children = [...(primaryChildren.get(turnNumber) ?? [])].sort(compareEdges);
    children.forEach((edge, index) => {
      const path = `${parentPath}.${index + 1}`;
      labels.set(edge.targetTurnNumber, {
        path,
        long: `Branch ${path}`,
        short: `B${path}`,
      });
      assignPaths(edge.targetTurnNumber, path);
    });
  };

  assignPaths(1, '1');
  return labels;
}

export function createTurnDisplayLabeler(conversation: Conversation): {
  getLongLabel: (turnNumber: number) => string;
  getCompactLabel: (turnNumber: number) => string;
  getDisplayLabel: (turnNumber: number) => string;
  getShortLabel: (turnNumber: number) => string;
  getPath: (turnNumber: number) => string | null;
} {
  const labels = buildTurnLabelMap(conversation);
  const customLabels = new Map<number, string>();
  for (const turn of conversation.turns) {
    if (turn.customLabel) customLabels.set(turn.turnNumber, turn.customLabel);
  }

  const rootLabel = getConversationRootLabel(conversation);

  const getLongLabel = (turnNumber: number): string => {
    const custom = customLabels.get(turnNumber);
    if (custom) return custom;
    if (turnNumber === 1) return rootLabel;
    return labels.get(turnNumber)?.long ?? `Branch ${turnNumber}`;
  };
  const getCompactLabel = (turnNumber: number): string => {
    const custom = customLabels.get(turnNumber);
    if (custom) return custom.length > 8 ? custom.slice(0, 7) + '…' : custom;
    if (turnNumber === 1) return rootLabel.length > 8 ? rootLabel.slice(0, 7) + '…' : rootLabel;
    return labels.get(turnNumber)?.short ?? `B${turnNumber}`;
  };

  return {
    getLongLabel,
    getCompactLabel,
    getDisplayLabel: getLongLabel,
    getShortLabel: getCompactLabel,
    getPath: (turnNumber) => labels.get(turnNumber)?.path ?? null,
  };
}

export function getTurnDisplayLabel(conversation: Conversation, turnNumber: number): string {
  return createTurnDisplayLabeler(conversation).getDisplayLabel(turnNumber);
}

export function getTurnShortDisplayLabel(conversation: Conversation, turnNumber: number): string {
  return createTurnDisplayLabeler(conversation).getShortLabel(turnNumber);
}
