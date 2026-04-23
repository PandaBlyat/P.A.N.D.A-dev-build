import type { CursorAnimationIntensity } from '../lib/state';

export type CursorState =
  | 'defaultPointer'
  | 'workspaceGrab'
  | 'dragging'
  | 'linking'
  | 'drawing'
  | 'textInput'
  | 'disabled';

export type CursorSettings = {
  enabled: boolean;
  animationIntensity: CursorAnimationIntensity;
  size: number;
};

type CursorShape = 'triangle' | 'circle' | 'cross' | 'hidden';

type FlowCursorSystemOptions = {
  canvas: HTMLElement;
  settings: CursorSettings;
  telemetry?: (event: string, payload?: Record<string, unknown>) => void;
};

type CursorRenderer = {
  setVisible: (visible: boolean) => void;
  setPosition: (x: number, y: number) => void;
  setState: (state: CursorState) => void;
  setAccentColor: (color: string) => void;
  setAnimationIntensity: (intensity: CursorAnimationIntensity) => void;
  setSize: (size: number) => void;
  pulse: () => void;
  destroy: () => void;
};

const TEXT_INPUT_SELECTOR = 'input, textarea, select, [contenteditable="true"], [contenteditable=""], .turn-label-input';
const POINTER_TRACKING_NAMESPACE = '__pandaFlowCursorPointerTracker';

const SHAPE_BY_STATE: Record<CursorState, CursorShape> = {
  defaultPointer: 'triangle',
  workspaceGrab: 'circle',
  dragging: 'circle',
  linking: 'circle',
  drawing: 'cross',
  textInput: 'triangle',
  disabled: 'hidden',
};

const TRIANGLE_HOTSPOT = {
  x: 0.04,
  y: 0.12,
} as const;

function getCursorHotspotOffset(shape: CursorShape, size: number): { x: number; y: number } {
  if (shape !== 'triangle') return { x: 0, y: 0 };
  // Match native pointer behavior: click lands on triangle tip, not visual center.
  return {
    x: (0.5 - TRIANGLE_HOTSPOT.x) * size,
    y: (0.5 - TRIANGLE_HOTSPOT.y) * size,
  };
}

type SharedPointerTracker = {
  lastPosition: { x: number; y: number } | null;
  dispose: () => void;
};

function getSharedPointerTracker(): SharedPointerTracker {
  const globalWindow = window as typeof window & { [POINTER_TRACKING_NAMESPACE]?: SharedPointerTracker };
  const existing = globalWindow[POINTER_TRACKING_NAMESPACE];
  if (existing) return existing;

  let lastPosition: { x: number; y: number } | null = null;
  const updatePointer = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    lastPosition = { x: event.clientX, y: event.clientY };
  };

  document.addEventListener('pointerdown', updatePointer, { passive: true });
  document.addEventListener('pointermove', updatePointer, { capture: true, passive: true });

  const tracker: SharedPointerTracker = {
    get lastPosition() {
      return lastPosition;
    },
    dispose() {
      document.removeEventListener('pointerdown', updatePointer);
      document.removeEventListener('pointermove', updatePointer, { capture: true });
      delete globalWindow[POINTER_TRACKING_NAMESPACE];
    },
  };

  globalWindow[POINTER_TRACKING_NAMESPACE] = tracker;
  return tracker;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

class CursorThemeAdapter {
  constructor(private readonly root: HTMLElement) {}

  getAccentColor(): string {
    const accent = getComputedStyle(this.root).getPropertyValue('--accent').trim() || '#5eaa3a';
    const bg = getComputedStyle(this.root).getPropertyValue('--bg-main').trim() || '#10141a';
    return this.ensureContrast(accent, bg);
  }

  private ensureContrast(foreground: string, background: string): string {
    const fg = this.parseColor(foreground);
    const bg = this.parseColor(background);
    if (!fg || !bg) return foreground;

    const contrast = this.getContrastRatio(fg, bg);
    if (contrast >= 2.4) return foreground;

    const lighten = this.relativeLuminance(fg) <= this.relativeLuminance(bg);
    const adjusted = this.mixTowards(fg, lighten ? [255, 255, 255] : [0, 0, 0], 0.24);
    return `rgb(${adjusted[0]} ${adjusted[1]} ${adjusted[2]})`;
  }

  private parseColor(input: string): [number, number, number] | null {
    const hex = input.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
    if (hex) {
      const value = hex[1].length === 3
        ? hex[1].split('').map(ch => parseInt(ch + ch, 16))
        : [
          parseInt(hex[1].slice(0, 2), 16),
          parseInt(hex[1].slice(2, 4), 16),
          parseInt(hex[1].slice(4, 6), 16),
        ];
      return [value[0], value[1], value[2]];
    }

    const rgb = input.match(/rgba?\(([^)]+)\)/i);
    if (!rgb) return null;
    const parts = rgb[1].split(',').map(part => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.some(part => Number.isNaN(part))) return null;
    return [parts[0], parts[1], parts[2]];
  }

  private relativeLuminance([r, g, b]: [number, number, number]): number {
    const normalize = (channel: number) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
  }

  private getContrastRatio(foreground: [number, number, number], background: [number, number, number]): number {
    const fg = this.relativeLuminance(foreground);
    const bg = this.relativeLuminance(background);
    const lighter = Math.max(fg, bg);
    const darker = Math.min(fg, bg);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private mixTowards(
    input: [number, number, number],
    target: [number, number, number],
    amount: number,
  ): [number, number, number] {
    const factor = clamp(amount, 0, 1);
    return [
      Math.round(input[0] + (target[0] - input[0]) * factor),
      Math.round(input[1] + (target[1] - input[1]) * factor),
      Math.round(input[2] + (target[2] - input[2]) * factor),
    ];
  }
}

function createCursorRenderer(canvas: HTMLElement, settings: CursorSettings): CursorRenderer {
  const pointerTracker = getSharedPointerTracker();
  const root = document.createElement('div');
  root.className = 'flow-custom-cursor';

  const glyph = document.createElement('div');
  glyph.className = 'flow-custom-cursor-glyph';

  const ring = document.createElement('div');
  ring.className = 'flow-custom-cursor-ring';

  root.append(glyph, ring);
  document.body.appendChild(root);

  let currentState: CursorState = 'disabled';
  let currentShape: CursorShape = 'hidden';
  let currentSize = clamp(settings.size, 10, 32);
  let lastPointerPosition: { x: number; y: number } | null = pointerTracker.lastPosition;

  const applyPosition = () => {
    if (!lastPointerPosition) return;
    const hotspotOffset = getCursorHotspotOffset(currentShape, currentSize);
    root.style.transform = `translate3d(${lastPointerPosition.x - currentSize / 2 + hotspotOffset.x}px, ${lastPointerPosition.y - currentSize / 2 + hotspotOffset.y}px, 0)`;
  };

  const setShape = (state: CursorState) => {
    currentShape = SHAPE_BY_STATE[state];
    root.dataset.shape = currentShape;
  };

  setShape('disabled');
  applyPosition();

  return {
    setVisible(visible) {
      root.classList.toggle('is-visible', visible);
    },
    setPosition(x, y) {
      lastPointerPosition = { x, y };
      applyPosition();
    },
    setState(state) {
      if (currentState === state) return;
      currentState = state;
      setShape(state);
      root.dataset.state = state;
      applyPosition();
    },
    setAccentColor(color) {
      root.style.setProperty('--cursor-accent', color);
    },
    setAnimationIntensity(intensity) {
      root.dataset.intensity = intensity;
    },
    setSize(size) {
      currentSize = clamp(size, 10, 32);
      root.style.setProperty('--cursor-size', `${currentSize}px`);
      applyPosition();
    },
    pulse() {
      root.classList.remove('is-clicking');
      void root.offsetWidth;
      root.classList.add('is-clicking');
    },
    destroy() {
      root.remove();
    },
  };
}

class CursorController {
  private state: CursorState = 'disabled';
  private requestedState: CursorState = 'defaultPointer';

  constructor(
    private readonly renderer: CursorRenderer,
    private readonly telemetry?: (event: string, payload?: Record<string, unknown>) => void,
  ) {}

  setRequestedState(state: CursorState): void {
    if (this.requestedState !== state) {
      this.requestedState = state;
    }
    this.evaluate();
  }

  setEnabled(enabled: boolean): void {
    this.setRequestedState(enabled ? this.requestedState : 'disabled');
    this.evaluate(enabled);
  }

  private evaluate(enabledOverride?: boolean): void {
    const enabled = enabledOverride ?? this.requestedState !== 'disabled';
    const nextState = enabled ? this.requestedState : 'disabled';
    if (nextState === this.state) return;
    const previous = this.state;
    this.state = nextState;
    this.renderer.setState(this.state);
    this.telemetry?.('cursor_state_changed', { previous, next: this.state });
  }
}

class CursorInteractionAdapter {
  private rafId = 0;
  private pointerX = 0;
  private pointerY = 0;
  private insideCanvas = false;
  private linking = false;
  private dragging = false;
  private panning = false;
  private drawing = false;
  private hoveringManipulationZone = false;
  private inTextInput = false;
  private shouldDisable = false;
  private featureEnabled = true;
  private pointerTracker: SharedPointerTracker;

  constructor(
    private readonly canvas: HTMLElement,
    private readonly renderer: CursorRenderer,
    private readonly controller: CursorController,
  ) {
    this.pointerTracker = getSharedPointerTracker();
    const lastPointer = this.pointerTracker.lastPosition;
    if (lastPointer) {
      this.pointerX = lastPointer.x;
      this.pointerY = lastPointer.y;
      this.queueRender();
    }
    this.bind();
  }

  destroy(): void {
    this.unbind();
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  setFeatureEnabled(enabled: boolean): void {
    this.featureEnabled = enabled;
    this.updateState();
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.insideCanvas = this.canvas.contains(event.target as Node);
    this.hoveringManipulationZone = this.detectManipulationZone(event.target as HTMLElement | null);
    this.inTextInput = this.detectTextInput(event.target as HTMLElement | null);
    this.queueRender();
    this.updateState();
  };

  private onCapturedPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    const target = event.target as HTMLElement | null;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.insideCanvas = Boolean(target && this.canvas.contains(target)) || this.drawing || this.panning || this.dragging || this.linking;
    this.hoveringManipulationZone = this.detectManipulationZone(target);
    this.inTextInput = this.detectTextInput(target);
    this.queueRender();
    this.updateState();
  };

  private onDocumentPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    const target = event.target as Node | null;
    if (target && this.canvas.contains(target)) return;

    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.insideCanvas = false;
    this.hoveringManipulationZone = false;
    this.inTextInput = this.detectTextInput(event.target as HTMLElement | null);
    this.queueRender();
    this.updateState();
  };

  private onPointerEnter = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    this.insideCanvas = true;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.queueRender();
    this.updateState();
  };

  private onPointerLeave = (): void => {
    this.insideCanvas = false;
    this.linking = false;
    this.dragging = false;
    this.panning = false;
    this.updateState();
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.insideCanvas = this.canvas.contains(event.target as Node);
    this.hoveringManipulationZone = this.detectManipulationZone(event.target as HTMLElement | null);
    this.inTextInput = this.detectTextInput(event.target as HTMLElement | null);
    this.queueRender();
    if (!this.insideCanvas) {
      this.updateState();
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('.choice-output-port')) {
      this.linking = true;
    }
    if (target?.closest('.turn-node') && !target.closest('.turn-choice-item, .choice-output-port, .turn-input-port, .turn-label-input, .turn-color-input')) {
      this.dragging = true;
    }
    this.renderer.pulse();
    this.updateState();
  };

  private onPointerUp = (): void => {
    this.linking = false;
    this.dragging = false;
    this.panning = false;
    this.updateState();
  };

  private onCanvasStateEvent = (event: Event): void => {
    const detail = (event as CustomEvent<{ kind: 'panning' | 'dragging' | 'linking' | 'drawing'; active: boolean }>).detail;
    if (!detail) return;
    if (detail.kind === 'panning') this.panning = detail.active;
    if (detail.kind === 'dragging') this.dragging = detail.active;
    if (detail.kind === 'linking') this.linking = detail.active;
    if (detail.kind === 'drawing') this.drawing = detail.active;
    this.updateState();
  };

  private onWindowBlur = (): void => {
    this.linking = false;
    this.dragging = false;
    this.panning = false;
    this.drawing = false;
    this.updateState();
  };

  private onWindowFocus = (): void => {
    this.updateState();
  };

  private onMediaChange = (): void => {
    this.shouldDisable = this.getDisableReason();
    this.updateState();
  };

  private getDisableReason(): boolean {
    const noFinePointer = !window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return noFinePointer || reducedMotion;
  }

  private bind(): void {
    this.shouldDisable = this.getDisableReason();
    this.canvas.addEventListener('pointerenter', this.onPointerEnter);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.addEventListener('pointermove', this.onCapturedPointerMove, { capture: true, passive: true });
    document.addEventListener('pointermove', this.onDocumentPointerMove, { passive: true });
    document.addEventListener('pointerdown', this.onPointerDown);
    document.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('flow-cursor-state', this.onCanvasStateEvent as EventListener);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('focus', this.onWindowFocus);
    document.addEventListener('mouseleave', this.onWindowBlur);
    window.matchMedia('(pointer: fine)').addEventListener('change', this.onMediaChange);
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', this.onMediaChange);
  }

  private unbind(): void {
    this.canvas.removeEventListener('pointerenter', this.onPointerEnter);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointermove', this.onCapturedPointerMove, { capture: true });
    document.removeEventListener('pointermove', this.onDocumentPointerMove);
    document.removeEventListener('pointerdown', this.onPointerDown);
    document.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('flow-cursor-state', this.onCanvasStateEvent as EventListener);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('focus', this.onWindowFocus);
    document.removeEventListener('mouseleave', this.onWindowBlur);
    window.matchMedia('(pointer: fine)').removeEventListener('change', this.onMediaChange);
    window.matchMedia('(prefers-reduced-motion: reduce)').removeEventListener('change', this.onMediaChange);
  }

  private queueRender(): void {
    if (this.rafId !== 0) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.renderer.setPosition(this.pointerX, this.pointerY);
    });
  }

  private detectManipulationZone(target: HTMLElement | null): boolean {
    if (!target || !this.canvas.contains(target)) return false;
    if (target.closest('.flow-controls, .flow-cursor-setting, .flow-cursor-intensity, .flow-cursor-size')) {
      return false;
    }
    if (target.closest('.turn-input-port, .choice-output-port, .flow-edge')) return true;
    if (target.closest('.turn-node')) return true;
    return Boolean(target.closest('.flow-canvas'));
  }

  private detectTextInput(target: HTMLElement | null): boolean {
    if (!target) return false;
    return Boolean(target.closest(TEXT_INPUT_SELECTOR));
  }

  private updateState(): void {
    const nextState: CursorState = !this.featureEnabled || this.shouldDisable
      ? 'disabled'
      : !this.insideCanvas
      ? 'defaultPointer'
      : this.inTextInput
      ? 'textInput'
      : this.linking
      ? 'linking'
      : this.dragging || this.panning
      ? 'dragging'
      : this.drawing
      ? 'drawing'
      : this.hoveringManipulationZone
      ? 'workspaceGrab'
      : 'defaultPointer';

    const hideNative = nextState !== 'disabled';
    document.body.classList.toggle('use-custom-cursor', hideNative);
    this.renderer.setVisible(hideNative);
    if (hideNative) {
      this.renderer.setPosition(this.pointerX, this.pointerY);
    }
    this.controller.setRequestedState(nextState);
  }
}

export type FlowCursorSystem = {
  updateSettings: (settings: CursorSettings) => void;
  destroy: () => void;
};

export function createFlowCursorSystem(options: FlowCursorSystemOptions): FlowCursorSystem {
  const { canvas, settings, telemetry } = options;
  const renderer = createCursorRenderer(canvas, settings);
  const theme = new CursorThemeAdapter(canvas);
  const controller = new CursorController(renderer, telemetry);
  const interactions = new CursorInteractionAdapter(canvas, renderer, controller);

  const applySettings = (next: CursorSettings) => {
    renderer.setSize(next.size);
    renderer.setAnimationIntensity(next.animationIntensity);
    renderer.setAccentColor(theme.getAccentColor());
    canvas.classList.toggle('custom-cursor-enabled', next.enabled);
    controller.setRequestedState(next.enabled ? 'defaultPointer' : 'disabled');
    interactions.setFeatureEnabled(next.enabled);
  };

  applySettings(settings);

  return {
    updateSettings(nextSettings) {
      applySettings(nextSettings);
    },
    destroy() {
      interactions.destroy();
      renderer.destroy();
      canvas.classList.remove('custom-cursor-enabled');
      document.body.classList.remove('use-custom-cursor');
    },
  };
}
