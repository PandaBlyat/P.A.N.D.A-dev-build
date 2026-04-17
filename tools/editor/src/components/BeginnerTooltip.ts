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

const HOVER_OPEN_DELAY_MS = 280;
const HOVER_CLOSE_DELAY_MS = 120;

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
  private hoveredAnchor: HTMLElement | null = null;
  private openTimer: number | null = null;
  private closeTimer: number | null = null;
  private mutationObserver: MutationObserver;

  constructor(private readonly root: HTMLElement) {
    document.addEventListener('pointerover', this.handlePointerOver, true);
    document.addEventListener('pointerout', this.handlePointerOut, true);
    document.addEventListener('focusin', this.handleFocusIn, true);
    document.addEventListener('focusout', this.handleFocusOut, true);
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
        this.close();
      }
    });
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  dispose(): void {
    this.cancelTimers();
    this.close();
    document.removeEventListener('pointerover', this.handlePointerOver, true);
    document.removeEventListener('pointerout', this.handlePointerOut, true);
    document.removeEventListener('focusin', this.handleFocusIn, true);
    document.removeEventListener('focusout', this.handleFocusOut, true);
    document.removeEventListener('click', this.handleDocumentClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('scroll', this.handleScroll, true);
    window.removeEventListener('resize', this.handleResize);
    this.mutationObserver.disconnect();
  }

  private handlePointerOver = (event: PointerEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (this.current?.element.contains(target)) {
      this.cancelClose();
      return;
    }

    const anchor = target.closest<HTMLElement>('[data-beginner-tooltip-id]');
    if (!anchor || !this.root.contains(anchor)) return;

    if (this.hoveredAnchor === anchor && this.current?.anchor === anchor) {
      this.cancelClose();
      return;
    }

    this.hoveredAnchor = anchor;
    this.scheduleOpen(anchor, { x: event.clientX, y: event.clientY });
  };

  private handlePointerOut = (event: PointerEvent): void => {
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (related && this.current?.element.contains(related)) return;
    if (related && related.closest?.('[data-beginner-tooltip-id]') === this.hoveredAnchor) return;

    if (this.hoveredAnchor) {
      this.hoveredAnchor = null;
      this.cancelOpen();
    }
    if (this.current) {
      this.scheduleClose();
    }
  };

  private handleFocusIn = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const anchor = target.closest<HTMLElement>('[data-beginner-tooltip-id]');
    if (!anchor || !this.root.contains(anchor)) return;
    const rect = anchor.getBoundingClientRect();
    this.hoveredAnchor = anchor;
    this.scheduleOpen(anchor, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  };

  private handleFocusOut = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const anchor = target.closest<HTMLElement>('[data-beginner-tooltip-id]');
    if (!anchor) return;
    if (this.hoveredAnchor === anchor) this.hoveredAnchor = null;
    this.scheduleClose();
  };

  private handleDocumentClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (this.current?.element.contains(target)) return;
    this.close();
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

  private scheduleOpen(anchor: HTMLElement, fallbackPoint: TooltipAnchorPoint): void {
    this.cancelClose();
    this.cancelOpen();
    const config = getBeginnerTooltipConfig(anchor);
    if (!config || isBeginnerTooltipDismissed(config.id)) return;
    if (this.current?.anchor === anchor) return;
    this.openTimer = window.setTimeout(() => {
      this.openTimer = null;
      if (this.hoveredAnchor !== anchor) return;
      this.open(anchor, config, fallbackPoint);
    }, HOVER_OPEN_DELAY_MS);
  }

  private scheduleClose(): void {
    this.cancelClose();
    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = null;
      if (this.hoveredAnchor) return;
      this.close();
    }, HOVER_CLOSE_DELAY_MS);
  }

  private cancelOpen(): void {
    if (this.openTimer !== null) {
      window.clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  private cancelClose(): void {
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private cancelTimers(): void {
    this.cancelOpen();
    this.cancelClose();
  }

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
    element.addEventListener('pointerenter', () => this.cancelClose());
    element.addEventListener('pointerleave', () => this.scheduleClose());
    document.body.appendChild(element);
    this.current = { element, anchor, config, fallbackPoint };
    this.positionCurrent();
  }

  private close(): void {
    this.cancelTimers();
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
  tooltip.setAttribute('role', 'tooltip');
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
