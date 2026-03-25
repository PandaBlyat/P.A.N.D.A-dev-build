import type { Turn } from './types';
import type { FlowDensity } from './state';

export type FlowNodeLayout = {
  width: number;
  messageChars: number;
  previewLines: number;
  minHeight: number;
};

export type FlowAutoLayoutSpacing = {
  canvasPaddingX: number;
  canvasPaddingY: number;
  horizontalGutter: number;
  siblingGap: number;
  branchGroupGap: number;
};

export const FLOW_WORKSPACE_MIN_WIDTH = 1400;
export const FLOW_WORKSPACE_MIN_HEIGHT = 900;

export const FLOW_DEFAULT_TURN_POSITION = {
  x: 640,
  y: 360,
} as const;

const FLOW_NODE_LAYOUTS: Record<FlowDensity, FlowNodeLayout> = {
  compact: { width: 210, messageChars: 52, previewLines: 1, minHeight: 106 },
  standard: { width: 260, messageChars: 100, previewLines: 1, minHeight: 140 },
  detailed: { width: 320, messageChars: 180, previewLines: 3, minHeight: 200 },
};

const FLOW_AUTO_LAYOUT_SPACING: Record<FlowDensity, FlowAutoLayoutSpacing> = {
  compact: { canvasPaddingX: 20, canvasPaddingY: 20, horizontalGutter: 72, siblingGap: 28, branchGroupGap: 72 },
  standard: { canvasPaddingX: 20, canvasPaddingY: 20, horizontalGutter: 84, siblingGap: 36, branchGroupGap: 92 },
  detailed: { canvasPaddingX: 20, canvasPaddingY: 20, horizontalGutter: 104, siblingGap: 48, branchGroupGap: 120 },
};

export function getFlowNodeLayout(density: FlowDensity): FlowNodeLayout {
  return FLOW_NODE_LAYOUTS[density];
}

export function getFlowAutoLayoutSpacing(density: FlowDensity): FlowAutoLayoutSpacing {
  return FLOW_AUTO_LAYOUT_SPACING[density];
}

export function estimateFlowNodeHeight(turn: Turn, density: FlowDensity): number {
  const layout = getFlowNodeLayout(density);
  const choiceHeight = density === 'detailed' ? 38 : 34;
  let height = 52 + turn.choices.length * choiceHeight;

  if (turn.openingMessage && density !== 'compact') {
    height += density === 'detailed' ? 50 : 34;
  }

  if (density !== 'compact') {
    const repliesCount = turn.choices.filter(choice => choice.reply).length;
    height += repliesCount * 24;
  }

  if (density === 'detailed') {
    height += 26;
  }

  return Math.max(layout.minHeight, height);
}

export function getDefaultFlowTurnPosition(turnNumber: number): { x: number; y: number } {
  if (turnNumber <= 1) {
    return { ...FLOW_DEFAULT_TURN_POSITION };
  }

  return {
    x: FLOW_DEFAULT_TURN_POSITION.x + (turnNumber - 1) * 300,
    y: FLOW_DEFAULT_TURN_POSITION.y,
  };
}
