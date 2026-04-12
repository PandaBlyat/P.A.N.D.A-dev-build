import {
  dismissBeginnerTooltip,
  getBeginnerTooltipConfig,
  isBeginnerTooltipDismissed,
  type BeginnerTooltipConfig,
  type BeginnerTooltipPlacement,
} from '../lib/beginner-tooltips';

type TooltipAnchorPoint = {
  x: number;
  y: number;
};

type MountedTooltip = {
  element: HTMLElement;
  anchor: HTMLElement;
  config: BeginnerTooltipConfig;
  fallbackPoint: TooltipAnchorPoint;
};

let controller: BeginnerTooltipController | null = null;
let mountListenerAttached = false;

export function installBeginnerTooltipBridge(): void {
  if (mountListenerAttached) return;
  mountListenerAttached = true;
  window.addEventListener('panda:beginner-tooltips:mount', (event) => {
    const detail = (event as CustomEvent<{ root?: HTMLElement }>).detail;
    mountBeginnerTooltipController(detail?.root ?? document.body);
  });
  window.addEventListener('panda:beginner-tooltips:unmount', () => {
    controller?.dispose();
    controller = null;
  });
}

export function mountBeginnerTooltipController(root: HTMLElement = document.body): void {
  controller?.dispose();
  controller = new BeginnerTooltipController(root);
}

class BeginnerTooltipController {
  private current: MountedTooltip | null = null;
  private mutationObserver: MutationObserver;

  constructor(private readonly root: HTMLElement) {
    document.addEventListener('click', this.handleDocumentClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('scroll', this.handleScroll, true);
    window.addEventListener('resize', this.handleResize);

    this.mutationObserver = new MutationObserver(() => {
      if (document.querySelector('[aria-modal="true"]')) {
        this.close();
        return;
      }
      if (this.current && !this.current.anchor.isConnected) {
        this.positionCurrent();
      }
    });
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  dispose(): void {
    this.close();
    document.removeEventListener('click', this.handleDocumentClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('scroll', this.handleScroll, true);
    window.removeEventListener('resize', this.handleResize);
    this.mutationObserver.disconnect();
  }

  private handleDocumentClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (this.current?.element.contains(target)) return;

    const anchor = target.closest<HTMLElement>('[data-beginner-tooltip-id]');
    if (!anchor || !this.root.contains(anchor)) {
      this.close();
      return;
    }

    const config = getBeginnerTooltipConfig(anchor);
    if (!config || isBeginnerTooltipDismissed(config.id)) {
      this.close();
      return;
    }

    const fallbackPoint = { x: event.clientX, y: event.clientY };
    window.requestAnimationFrame(() => {
      this.open(anchor, config, fallbackPoint);
    });
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    this.close();
  };

  private handleScroll = (): void => {
    this.close();
  };

  private handleResize = (): void => {
    this.close();
  };

  private open(anchor: HTMLElement, config: BeginnerTooltipConfig, fallbackPoint: TooltipAnchorPoint): void {
    if (document.querySelector('[aria-modal="true"]')) return;
    if (isBeginnerTooltipDismissed(config.id)) return;

    this.close();
    const element = createTooltipElement(config, {
      onClose: () => this.close(),
      onDismiss: () => {
        dismissBeginnerTooltip(config.id);
        this.close();
      },
    });
    document.body.appendChild(element);
    this.current = { element, anchor, config, fallbackPoint };
    this.positionCurrent();
  }

  private close(): void {
    this.current?.element.remove();
    this.current = null;
  }

  private positionCurrent(): void {
    if (!this.current) return;
    const { element, anchor, config, fallbackPoint } = this.current;
    const anchorRect = anchor.isConnected
      ? anchor.getBoundingClientRect()
      : createFallbackRect(fallbackPoint);
    const placement = config.placement ?? 'bottom';
    const gap = 10;
    const viewportGap = 8;

    element.dataset.placement = placement;
    element.style.left = '0px';
    element.style.top = '0px';

    const tooltipRect = element.getBoundingClientRect();
    const position = calculatePosition(anchorRect, tooltipRect, placement, gap);
    const clamped = {
      left: clamp(position.left, viewportGap, Math.max(viewportGap, window.innerWidth - tooltipRect.width - viewportGap)),
      top: clamp(position.top, viewportGap, Math.max(viewportGap, window.innerHeight - tooltipRect.height - viewportGap)),
    };

    element.style.left = `${Math.round(clamped.left)}px`;
    element.style.top = `${Math.round(clamped.top)}px`;
  }
}

function createTooltipElement(
  config: BeginnerTooltipConfig,
  actions: { onClose: () => void; onDismiss: () => void },
): HTMLElement {
  const tooltip = document.createElement('section');
  tooltip.className = 'beginner-tooltip';
  tooltip.setAttribute('role', 'status');
  tooltip.setAttribute('aria-live', 'polite');
  tooltip.dataset.tooltipId = config.id;

  const marker = document.createElement('span');
  marker.className = 'beginner-tooltip-marker';
  marker.textContent = '?';

  const copy = document.createElement('div');
  copy.className = 'beginner-tooltip-copy';

  const title = document.createElement('strong');
  title.className = 'beginner-tooltip-title';
  title.textContent = config.title;

  const body = document.createElement('p');
  body.className = 'beginner-tooltip-body';
  body.textContent = config.body;

  copy.append(title, body);

  if (config.shortcut) {
    const shortcut = document.createElement('span');
    shortcut.className = 'beginner-tooltip-shortcut';
    shortcut.textContent = config.shortcut;
    copy.appendChild(shortcut);
  }

  const actionsRow = document.createElement('div');
  actionsRow.className = 'beginner-tooltip-actions';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn-sm beginner-tooltip-close';
  close.textContent = 'Close';
  close.onclick = actions.onClose;

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'btn-sm btn-primary beginner-tooltip-dismiss';
  dismiss.textContent = "Don't show again";
  dismiss.onclick = actions.onDismiss;

  actionsRow.append(close, dismiss);
  tooltip.append(marker, copy, actionsRow);
  return tooltip;
}

function calculatePosition(
  anchorRect: DOMRect,
  tooltipRect: DOMRect,
  placement: BeginnerTooltipPlacement,
  gap: number,
): { left: number; top: number } {
  switch (placement) {
    case 'top':
      return {
        left: anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2,
        top: anchorRect.top - tooltipRect.height - gap,
      };
    case 'right':
      return {
        left: anchorRect.right + gap,
        top: anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2,
      };
    case 'left':
      return {
        left: anchorRect.left - tooltipRect.width - gap,
        top: anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2,
      };
    case 'bottom':
    default:
      return {
        left: anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2,
        top: anchorRect.bottom + gap,
      };
  }
}

function createFallbackRect(point: TooltipAnchorPoint): DOMRect {
  return new DOMRect(point.x, point.y, 1, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
