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
  const ids = new Set<string>();
  return {
    slug: jji.slug,
    stats: createBaseStats(),
    ids,
    listingsGenerator: jji.listingsGenerator,
    jobGenerator: (listing, logger) => jji.jobGenerator(listing, logger, ids),
    jobToUrl: jji.jobToUrl,
    jobToId: jji.jobToId,
    extractContent: jji.extractContent,
  };
}

export function nfjStrategy(): BaseStrategy {
  const ids = new Set<string>();
  return {
    slug: nfj.slug,
    stats: createBaseStats(),
    ids,
    listingsGenerator: nfj.listingsGenerator,
    jobGenerator: (listing, logger) => nfj.jobGenerator(listing, logger, ids),
    jobToUrl: nfj.jobToUrl,
    jobToId: nfj.jobToId,
    extractContent: nfj.extractContent,
  };
}

export const allStrategies = (): BaseStrategy[] => [jjiStrategy(), nfjStrategy()];
