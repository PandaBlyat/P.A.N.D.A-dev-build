import { recordPerf } from './perf';
import type { Project, ValidationMessage } from './types';
import { validate } from './validation';

export type ValidationMode = 'idle' | 'immediate';

type ValidationResult = {
  revision: number;
  messages: ValidationMessage[];
  durationMs: number;
};

type ValidationCallback = (result: ValidationResult) => void;

let worker: Worker | null | undefined;
let timer: ReturnType<typeof setTimeout> | null = null;
let latestRevision = 0;
let latestCallback: ValidationCallback | null = null;

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') {
    worker = null;
    return worker;
  }
  try {
    worker = new Worker(new URL('./validation.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<ValidationResult>) => {
      const result = event.data;
      if (result.revision !== latestRevision) return;
      recordPerf('state.validation.worker', result.durationMs, { revision: result.revision });
      latestCallback?.(result);
    };
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

function requestValidation(project: Project, revision: number, callback: ValidationCallback): void {
  latestRevision = revision;
  latestCallback = callback;

  const activeWorker = getWorker();
  if (activeWorker) {
    activeWorker.postMessage({ project, revision });
    return;
  }

  setTimeout(() => {
    if (revision !== latestRevision) return;
    const start = performance.now();
    const messages = validate(project);
    const durationMs = performance.now() - start;
    recordPerf('state.validation.fallback', durationMs, { revision });
    callback({ revision, messages, durationMs });
  }, 0);
}

export function scheduleValidation(
  project: Project,
  revision: number,
  mode: ValidationMode,
  callback: ValidationCallback,
  delayMs = 0,
): void {
  cancelPendingValidation();
  const delay = mode === 'immediate' ? 0 : delayMs;
  timer = setTimeout(() => {
    timer = null;
    requestValidation(project, revision, callback);
  }, delay);
}

export function flushValidation(project: Project, revision: number, callback: ValidationCallback): void {
  cancelPendingValidation();
  requestValidation(project, revision, callback);
}

export function cancelPendingValidation(): void {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
}
