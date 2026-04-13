import { AsyncLocalStorage } from 'node:async_hooks';

export type StatsErrorCode =
  | 'NO_CONTEXT'
  | 'NESTED_CONTEXT'
  | 'WITH_STATS_ALREADY_USED'
  | 'MISSING_VALUE'
  | 'CLONE_FAILED';

export class StatsError extends Error {
  readonly code: StatsErrorCode;

  constructor(code: StatsErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StatsError';
    this.code = code;
  }
}

export type StatsSnapshot = {
  readonly values: Record<string, unknown>;
  readonly counters: Record<string, number>;
};

type StatsStore = {
  values: Record<string, unknown>;
  counters: Record<string, number>;
};

const statsAls = new AsyncLocalStorage<StatsStore>();

function emptyStore(): StatsStore {
  return { values: {}, counters: {} };
}

function snapshotFromStore(store: StatsStore): StatsSnapshot {
  try {
    return {
      values: structuredClone(store.values),
      counters: structuredClone(store.counters),
    };
  } catch (cause) {
    throw new StatsError('CLONE_FAILED', 'structuredClone failed for stats snapshot', { cause });
  }
}

function requireStore(): StatsStore {
  const store = statsAls.getStore();
  if (!store) {
    throw new StatsError('NO_CONTEXT', 'No active stats context');
  }
  return store;
}

export function stats(): StatsSnapshot {
  return snapshotFromStore(requireStore());
}

export function statsGetValue(key: string): unknown {
  const store = requireStore();
  if (!(key in store.values)) {
    throw new StatsError('MISSING_VALUE', `Missing stats value for key: ${key}`);
  }
  return store.values[key];
}

export function statsSetValue(key: string, value: unknown): void {
  const store = requireStore();
  store.values[key] = value;
}

export function statsAddToCounter(key: string, increment = 1): void {
  const store = requireStore();
  const cur = store.counters[key] ?? 0;
  store.counters[key] = cur + increment;
}

export function statsSubtractFromCounter(key: string, decrement = 1): void {
  const store = requireStore();
  const cur = store.counters[key] ?? 0;
  store.counters[key] = cur - decrement;
}

export interface StatsContext {
  withStats<T>(fn: () => Promise<T>): Promise<T>;
}

export function statsContext(): StatsContext {
  let withStatsUsed = false;

  return {
    async withStats<T>(payload: () => Promise<T>): Promise<T> {
      if (withStatsUsed) {
        throw new StatsError(
          'WITH_STATS_ALREADY_USED',
          'withStats already invoked on this stats context',
        );
      }
      if (statsAls.getStore()) {
        throw new StatsError('NESTED_CONTEXT', 'Nested stats context is not allowed');
      }
      withStatsUsed = true;
      const store = emptyStore();

      return await statsAls.run(store, payload);
    },
  };
}
