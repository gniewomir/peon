import * as jji from './jji/jji.js';
import * as nfj from './nfj/nfj.js';
import type { BaseStrategy, StrategyStats } from '../types/index.js';

function createBaseStats(): StrategyStats {
  return {
    listings_processed: 0,
    job_processed: 0,
    cache_hit: 0,
    cache_miss: 0,
    cache_writes: 0,
    unique: 0,
    writes: 0,
    errors: 0,
  };
}

export function jjiStrategy(): BaseStrategy {
  return {
    ...jji,
    stats: createBaseStats(),
  };
}

export function nfjStrategy(): BaseStrategy {
  return {
    ...nfj,
    stats: createBaseStats(),
  };
}

export const allStrategies = (): BaseStrategy[] => [jjiStrategy(), nfjStrategy()];
