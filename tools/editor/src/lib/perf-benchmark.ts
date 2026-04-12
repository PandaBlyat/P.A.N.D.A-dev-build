import { createFlowChange, store } from './state';
import { createEmptyProject, createChoice, createTurn } from './xml-export';
import { recordPerf } from './perf';
import { validate } from './validation';
import type { Project } from './types';

type BenchmarkResult = {
  turnCount: number;
  validationMs: number;
  loadMs: number;
  inputPatchMs: number;
};

declare global {
  interface Window {
    __PANDA_EDITOR_BENCHMARK__?: {
      run: () => Promise<BenchmarkResult[]>;
    };
  }
}

const TURN_COUNTS = [5, 10, 20, 40, 80] as const;

export function installPerfBenchmark(): void {
  if (typeof window === 'undefined' || import.meta.env.PROD) return;
  window.__PANDA_EDITOR_BENCHMARK__ = {
    run: async () => runBenchmark(),
  };
}

async function runBenchmark(): Promise<BenchmarkResult[]> {
  const original = store.get();
  const originalProject = JSON.parse(JSON.stringify(original.project)) as Project;
  const originalStrings = new Map(original.systemStrings);
  const results: BenchmarkResult[] = [];

  for (const turnCount of TURN_COUNTS) {
    const project = createBenchmarkProject(turnCount);

    const validationStart = performance.now();
    validate(project);
    const validationMs = performance.now() - validationStart;
    recordPerf('benchmark.validation', validationMs, { turnCount });

    const loadStart = performance.now();
    store.loadProject(project, new Map());
    await nextFrame();
    await nextFrame();
    const loadMs = performance.now() - loadStart;
    recordPerf('benchmark.loadAndRender', loadMs, { turnCount });

    const conversation = store.getSelectedConversation() ?? store.get().project.conversations[0]!;
    const inputStart = performance.now();
    store.updateTurn(conversation.id, 1, {
      openingMessage: `Benchmark opening message ${turnCount}`,
    }, {
      textSessionKey: `benchmark:${turnCount}:opening`,
      change: createFlowChange('text-content', 'flowEditor', 'propertiesPanel'),
    });
    await nextFrame();
    const inputPatchMs = performance.now() - inputStart;
    recordPerf('benchmark.inputDebounceToRender', inputPatchMs, { turnCount });

    results.push({ turnCount, validationMs, loadMs, inputPatchMs });
  }

  store.loadProject(originalProject, originalStrings);
  await nextFrame();
  return results;
}

function createBenchmarkProject(turnCount: number): Project {
  const project = createEmptyProject('stalker');
  const conversation = project.conversations[0]!;
  conversation.label = `Benchmark ${turnCount}`;
  conversation.turns = [];

  for (let i = 1; i <= turnCount; i += 1) {
    const turn = createTurn(i);
    turn.position = {
      x: 120 + (i % 8) * 330,
      y: 120 + Math.floor((i - 1) / 8) * 220,
    };
    turn.openingMessage = i === 1 ? 'Benchmark opening message' : `NPC reply for branch ${i}`;
    turn.choices = [];
    const choiceCount = Math.min(4, Math.max(1, (i % 4) + 1));
    for (let c = 1; c <= choiceCount; c += 1) {
      const choice = createChoice(c);
      choice.text = `Player option ${c} on branch ${i}`;
      choice.reply = `NPC answer ${c} on branch ${i}`;
      const target = i + c;
      if (target <= turnCount) {
        choice.continueTo = target;
        choice.terminal = false;
      }
      turn.choices.push(choice);
    }
    conversation.turns.push(turn);
  }

  return project;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
