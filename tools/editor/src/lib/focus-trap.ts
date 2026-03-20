export type FocusTrapController = {
  release: () => void;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    .filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}

export function trapFocus(
  container: HTMLElement,
  options: {
    restoreFocus?: HTMLElement | null;
    initialFocus?: HTMLElement | null;
    onEscape?: () => void;
  } = {},
): FocusTrapController {
  const restoreTarget = options.restoreFocus ?? null;

  const focusFirst = (): void => {
    const focusTarget = options.initialFocus && container.contains(options.initialFocus)
      ? options.initialFocus
      : getFocusableElements(container)[0] ?? container;
    if (focusTarget.tabIndex < 0) focusTarget.tabIndex = -1;
    focusTarget.focus();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      options.onEscape?.();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? focusable.indexOf(active) : -1;
    const delta = event.shiftKey ? -1 : 1;
    const nextIndex = currentIndex === -1
      ? (event.shiftKey ? focusable.length - 1 : 0)
      : (currentIndex + delta + focusable.length) % focusable.length;

    event.preventDefault();
    focusable[nextIndex]?.focus();
  };

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target as Node | null;
    if (!target || container.contains(target)) return;
    focusFirst();
  };

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('focusin', onFocusIn);
  queueMicrotask(focusFirst);

  return {
    release: () => {
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('focusin', onFocusIn);
      if (restoreTarget?.isConnected) restoreTarget.focus();
    },
  };
}
