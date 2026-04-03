type PerfSample = {
  label: string;
  durationMs: number;
  timestamp: number;
  meta?: Record<string, unknown>;
};

type PerfStore = {
  samples: PerfSample[];
  lastByLabel: Record<string, PerfSample>;
};

declare global {
  interface Window {
    __PANDA_EDITOR_PERF__?: PerfStore;
    __PANDA_EDITOR_PERF_ENABLED__?: boolean;
  }
}

const MAX_SAMPLES = 200;

function getPerfStore(): PerfStore {
  const global = globalThis as typeof globalThis & {
    __PANDA_EDITOR_PERF__?: PerfStore;
  };

  if (!global.__PANDA_EDITOR_PERF__) {
    global.__PANDA_EDITOR_PERF__ = {
      samples: [],
      lastByLabel: {},
    };
  }

  return global.__PANDA_EDITOR_PERF__;
}

export function recordPerf(label: string, durationMs: number, meta?: Record<string, unknown>): void {
  const store = getPerfStore();
  const sample: PerfSample = {
    label,
    durationMs,
    timestamp: Date.now(),
    meta,
  };

  store.lastByLabel[label] = sample;
  store.samples.push(sample);
  if (store.samples.length > MAX_SAMPLES) {
    store.samples.splice(0, store.samples.length - MAX_SAMPLES);
  }

  if ((globalThis as typeof globalThis & { __PANDA_EDITOR_PERF_ENABLED__?: boolean }).__PANDA_EDITOR_PERF_ENABLED__) {
    console.debug(`[panda-perf] ${label}: ${durationMs.toFixed(2)}ms`, meta ?? {});
  }
}

export function measurePerf<T>(label: string, fn: () => T, meta?: Record<string, unknown>): T {
  const start = performance.now();
  try {
    return fn();
  } finally {
    recordPerf(label, performance.now() - start, meta);
  }
}
