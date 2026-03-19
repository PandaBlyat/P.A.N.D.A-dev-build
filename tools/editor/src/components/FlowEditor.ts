// P.A.N.D.A. Conversation Editor — Visual Flow Editor (Center Panel)

import { store } from '../lib/state';
import type { Conversation, Turn, Choice } from '../lib/types';

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

  // Calculate layout dimensions
  const nodeWidth = 220;
  const nodeGap = 60;
  let maxRight = 0;
  let maxBottom = 0;

  // Auto-layout if positions are at defaults
  autoLayout(conv);

  for (const turn of conv.turns) {
    const right = turn.position.x + nodeWidth;
    const bottom = turn.position.y + 200;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  content.style.width = (maxRight + 100) + 'px';
  content.style.height = (maxBottom + 100) + 'px';

  // Draw edges (SVG)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('flow-edges');
  svg.setAttribute('width', String(maxRight + 100));
  svg.setAttribute('height', String(maxBottom + 100));

  drawEdges(svg, conv);
  content.appendChild(svg);

  // Draw nodes
  for (const turn of conv.turns) {
    const node = renderTurnNode(conv, turn, state.selectedTurnNumber === turn.turnNumber);
    content.appendChild(node);
  }

  canvas.appendChild(content);
  container.appendChild(canvas);
}

function autoLayout(conv: Conversation): void {
  // Only auto-layout if all positions are at default (0,0) or sequential defaults
  const needsLayout = conv.turns.every(t => t.position.x === (t.turnNumber - 1) * 300 && t.position.y === 0);
  if (!needsLayout && conv.turns.some(t => t.position.x !== 0 || t.position.y !== 0)) return;

  // Simple horizontal layout with BFS from turn 1
  const visited = new Set<number>();
  const queue: { turnNumber: number; col: number; row: number }[] = [{ turnNumber: 1, col: 0, row: 0 }];
  const positions = new Map<number, { col: number; row: number }>();
  const colRows = new Map<number, number>(); // track max row per column

  while (queue.length > 0) {
    const { turnNumber, col, row } = queue.shift()!;
    if (visited.has(turnNumber)) continue;
    visited.add(turnNumber);
    positions.set(turnNumber, { col, row });
    colRows.set(col, Math.max(colRows.get(col) || 0, row + 1));

    const turn = conv.turns.find(t => t.turnNumber === turnNumber);
    if (!turn) continue;

    let childRow = 0;
    for (const choice of turn.choices) {
      const targets: number[] = [];
      if (choice.continueTo != null) targets.push(choice.continueTo);
      for (const outcome of choice.outcomes) {
        if (outcome.command === 'pause_job') {
          const st = parseInt(outcome.params[1], 10);
          const ft = parseInt(outcome.params[2], 10);
          if (!isNaN(st)) targets.push(st);
          if (!isNaN(ft)) targets.push(ft);
        }
      }
      for (const t of targets) {
        if (!visited.has(t)) {
          queue.push({ turnNumber: t, col: col + 1, row: childRow });
          childRow++;
        }
      }
    }
  }

  // Place unvisited turns
  let unvisitedCol = (positions.size > 0 ? Math.max(...[...positions.values()].map(p => p.col)) + 1 : 0);
  for (const turn of conv.turns) {
    if (!positions.has(turn.turnNumber)) {
      positions.set(turn.turnNumber, { col: unvisitedCol, row: 0 });
      unvisitedCol++;
    }
  }

  // Apply positions
  for (const turn of conv.turns) {
    const pos = positions.get(turn.turnNumber);
    if (pos) {
      turn.position.x = pos.col * 280 + 20;
      turn.position.y = pos.row * 200 + 20;
    }
  }
}

function renderTurnNode(conv: Conversation, turn: Turn, selected: boolean): HTMLElement {
  const state = store.get();
  const hasWarning = turn.choices.some(c => !c.text && !c.reply);
  const node = document.createElement('div');
  node.className = 'turn-node' + (selected ? ' selected' : '') + (hasWarning ? ' has-warning' : '');
  node.style.left = turn.position.x + 'px';
  node.style.top = turn.position.y + 'px';
  node.onclick = (e) => {
    e.stopPropagation();
    store.selectTurn(turn.turnNumber);
  };

  // Make draggable
  let dragging = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;
  node.onmousedown = (e) => {
    if ((e.target as HTMLElement).closest('.turn-choice-item')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origX = turn.position.x;
    origY = turn.position.y;
    e.preventDefault();

    const onMove = (ev: MouseEvent) => {
      if (!dragging) return;
      turn.position.x = Math.max(0, origX + (ev.clientX - startX));
      turn.position.y = Math.max(0, origY + (ev.clientY - startY));
      node.style.left = turn.position.x + 'px';
      node.style.top = turn.position.y + 'px';
    };
    const onUp = () => {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Trigger re-render to update edges
      store.selectTurn(turn.turnNumber);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Header
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

  // Body
  const body = document.createElement('div');
  body.className = 'turn-body';

  // Opening message preview (turn 1 only)
  if (turn.turnNumber === 1 && turn.openingMessage) {
    const msg = document.createElement('div');
    msg.className = 'turn-message';
    msg.textContent = turn.openingMessage.substring(0, 80) + (turn.openingMessage.length > 80 ? '...' : '');
    body.appendChild(msg);
  }

  // Choices list
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

function drawEdges(svg: SVGSVGElement, conv: Conversation): void {
  for (const turn of conv.turns) {
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

        const x1 = turn.position.x + 220; // right edge of source
        const y1 = turn.position.y + 40 + choice.index * 25;
        const x2 = targetTurn.position.x; // left edge of target
        const y2 = targetTurn.position.y + 30;

        const midX = (x1 + x2) / 2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`);
        path.setAttribute('stroke', target.color);
        svg.appendChild(path);

        // Edge label
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
