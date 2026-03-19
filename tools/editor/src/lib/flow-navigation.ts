export interface FlowCenterRequest {
  conversationId: number;
  turnNumber?: number | null;
  fit?: boolean;
}

export interface FlowViewportApi {
  centerTurn(turnNumber: number, options?: { animate?: boolean }): void;
  fitContent(options?: { animate?: boolean }): void;
  resetView(options?: { animate?: boolean }): void;
}

let activeFlow: { conversationId: number; api: FlowViewportApi } | null = null;
let pendingRequest: FlowCenterRequest | null = null;

export function setActiveFlowViewport(conversationId: number, api: FlowViewportApi): void {
  activeFlow = { conversationId, api };

  if (pendingRequest?.conversationId !== conversationId) return;
  consumePendingRequest();
}


export function requestFlowCenter(request: FlowCenterRequest): void {
  pendingRequest = request;

  if (activeFlow?.conversationId !== request.conversationId) return;
  consumePendingRequest();
}

function consumePendingRequest(): void {
  if (!activeFlow || !pendingRequest || activeFlow.conversationId !== pendingRequest.conversationId) return;

  const request = pendingRequest;
  pendingRequest = null;

  if (request.turnNumber != null) {
    activeFlow.api.centerTurn(request.turnNumber);
    return;
  }

  if (request.fit) {
    activeFlow.api.fitContent();
    return;
  }

  activeFlow.api.resetView();
}
