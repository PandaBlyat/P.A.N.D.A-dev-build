// P.A.N.D.A. Conversation Editor — Visual Flow Editor (Center Panel)

import { store } from '../lib/state';
import type { Conversation, Turn } from '../lib/types';

type TurnPositionMap = Map<number, { x: number; y: number }>;

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

  const canvas = document.createElement('div');
  canvas.className = 'flow-canvas';

  const content = document.createElement('div');
  content.className = 'flow-content';

  const bounds = calculateContentBounds(conv);
  content.style.width = `${bounds.width}px`;
  content.style.height = `${bounds.height}px`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('flow-edges');
  svg.setAttribute('width', String(bounds.width));
  svg.setAttribute('height', String(bounds.height));

  drawEdges(svg, conv);
  content.appendChild(svg);

  for (const turn of conv.turns) {
    const node = renderTurnNode(conv, turn, state.selectedTurnNumber === turn.turnNumber, svg);
    content.appendChild(node);
  }

  canvas.appendChild(content);
  container.appendChild(canvas);
}

function calculateContentBounds(conv: Conversation): { width: number; height: number } {
  const nodeWidth = 220;
  let maxRight = 0;
  let maxBottom = 0;

  for (const turn of conv.turns) {
    const right = turn.position.x + nodeWidth;
    const bottom = turn.position.y + 200;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  return {
    width: maxRight + 100,
    height: maxBottom + 100,
  };
}

function renderTurnNode(conv: Conversation, turn: Turn, selected: boolean, edgeLayer: SVGSVGElement): HTMLElement {
  const state = store.get();
  const hasWarning = turn.choices.some(c => !c.text && !c.reply);
  const node = document.createElement('div');
  node.className = 'turn-node' + (selected ? ' selected' : '') + (hasWarning ? ' has-warning' : '');
  node.style.left = `${turn.position.x}px`;
  node.style.top = `${turn.position.y}px`;
  node.onclick = (e) => {
    e.stopPropagation();
    store.selectTurn(turn.turnNumber);
  };

  let dragPosition: { x: number; y: number } | null = null;

  node.onmousedown = (e) => {
    if ((e.target as HTMLElement).closest('.turn-choice-item')) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = turn.position.x;
    const origY = turn.position.y;
    const transientPositions: TurnPositionMap = new Map();
    e.preventDefault();

    const onMove = (ev: MouseEvent) => {
      const nextPosition = {
        x: Math.max(0, origX + (ev.clientX - startX)),
        y: Math.max(0, origY + (ev.clientY - startY)),
      };

      dragPosition = nextPosition;
      transientPositions.set(turn.turnNumber, nextPosition);
      node.style.left = `${nextPosition.x}px`;
      node.style.top = `${nextPosition.y}px`;
      drawEdges(edgeLayer, conv, transientPositions);
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
    item.className = 'turn-choice-item' + (state.selectedChoiceIndex === choice.index && selected ? ' selected' : '');
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

    item.appendChild(num);
    item.appendChild(preview);

    if (choice.continueTo != null) {
      const badge = document.createElement('span');
      badge.className = 'choice-cont-badge';
      badge.textContent = `T${choice.continueTo}`;
      item.appendChild(badge);
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

function drawEdges(svg: SVGSVGElement, conv: Conversation, positionOverrides?: TurnPositionMap): void {
  svg.replaceChildren();

  for (const turn of conv.turns) {
    const sourcePosition = getTurnPosition(turn, positionOverrides);

    for (const choice of turn.choices) {
      const targets: { turnNumber: number; label: string; color: string }[] = [];

      if (choice.continueTo != null) {
        targets.push({ turnNumber: choice.continueTo, label: `C${choice.index}`, color: 'var(--edge-color)' });
      }

      for (const outcome of choice.outcomes) {
        if (outcome.command === 'pause_job') {
          const st = parseInt(outcome.params[1], 10);
          const ft = parseInt(outcome.params[2], 10);
          if (!isNaN(st)) targets.push({ turnNumber: st, label: 'ok', color: 'var(--accent)' });
          if (!isNaN(ft)) targets.push({ turnNumber: ft, label: 'fail', color: 'var(--danger)' });
        }
      }

      for (const target of targets) {
        const targetTurn = conv.turns.find(t => t.turnNumber === target.turnNumber);
        if (!targetTurn) continue;

        const targetPosition = getTurnPosition(targetTurn, positionOverrides);
        const x1 = sourcePosition.x + 220;
        const y1 = sourcePosition.y + 40 + choice.index * 25;
        const x2 = targetPosition.x;
        const y2 = targetPosition.y + 30;
        const midX = (x1 + x2) / 2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`);
        path.setAttribute('stroke', target.color);
        svg.appendChild(path);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(midX));
        text.setAttribute('y', String((y1 + y2) / 2 - 5));
        text.setAttribute('text-anchor', 'middle');
        text.textContent = target.label;
        svg.appendChild(text);
      }
    }
  }
}
