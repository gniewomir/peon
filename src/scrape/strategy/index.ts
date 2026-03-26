import * as jji from './jji/jji.js';
import * as nfj from './nfj/nfj.js';
import * as bdj from './bdj/bdj.js';
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
    jobGenerator: (listing, logger, cache) => jji.jobGenerator(listing, logger, ids, cache),
    jobToUrl: jji.jobToUrl,
    jobToId: jji.jobToId,
    extractContent: jji.extractContent,
  };
}

export function bdjStrategy(): BaseStrategy {
  const ids = new Set<string>();
  return {
    slug: bdj.slug,
    stats: createBaseStats(),
    ids,
    listingsGenerator: bdj.listingsGenerator,
    jobGenerator: (listing, logger, cache) => bdj.jobGenerator(listing, logger, ids, cache),
    jobToUrl: bdj.jobToUrl,
    jobToId: bdj.jobToId,
    extractContent: bdj.extractContent,
  };
}

export function nfjStrategy(): BaseStrategy {
  const ids = new Set<string>();
  return {
    slug: nfj.slug,
    stats: createBaseStats(),
    ids,
    listingsGenerator: nfj.listingsGenerator,
    jobGenerator: (listing, logger, cache) => nfj.jobGenerator(listing, logger, ids, cache),
    jobToUrl: nfj.jobToUrl,
    jobToId: nfj.jobToId,
    extractContent: nfj.extractContent,
  };
}

export const allStrategies = (): BaseStrategy[] => [jjiStrategy(), nfjStrategy(), bdjStrategy()];
