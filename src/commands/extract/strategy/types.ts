import type { Logger } from '../../lib/logger.js';
import type { CacheOperations } from '../lib/cache.js';
import type { JobJson, Listing } from '../types.js';

export interface StrategySaveOptions {
  outDir: string;
  cached: string;
  job: JobJson;
  url: string;
  content: string;
  logger: Logger;
}

export interface StrategyStats {
  listings_processed: number;
  job_processed: number;
  cache_hit: number;
  cache_miss: number;
  cache_writes: number;
  unique: number;
  writes: number;
  errors: number;
}

export interface Strategy {
  slug: string;
  stats: StrategyStats;
  ids: Set<string>;
  jobListingsGenerator(): AsyncGenerator<Listing>;
  jobGenerator(listing: Listing, logger: Logger, cache: CacheOperations): AsyncGenerator<JobJson>;
  jobToUrl(job: JobJson): string;
  jobToId(job: JobJson): string;
  save(options: StrategySaveOptions): Promise<void>;
}
