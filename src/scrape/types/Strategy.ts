import type { Logger } from './Logger.js';
import type { StrategyStats } from './Stats.js';
import type { JobJson } from './Job.js';
import type { Listing } from './Listing.js';
import type { CacheOperations } from './Cache.js';

export interface StrategySaveOptions<TJob extends JobJson> {
  outDir: string;
  cached: string;
  job: TJob;
  url: string;
  content: string;
  logger: Logger;
}

export interface Strategy<TJob extends JobJson = JobJson> {
  slug: string;
  stats: StrategyStats;
  ids: Set<string>;
  listingsGenerator(): AsyncGenerator<Listing>;
  jobGenerator(listing: Listing, logger: Logger, cache: CacheOperations): AsyncGenerator<TJob>;
  jobToUrl(job: TJob): string;
  jobToId(job: TJob): string;
  extractContent(content: string): string;
  save(options: StrategySaveOptions<TJob>): Promise<number>;
}

export interface BaseStrategy {
  slug: string;
  stats: StrategyStats;
  ids: Set<string>;
  listingsGenerator(): AsyncGenerator<Listing>;
  jobGenerator(listing: Listing, logger: Logger, cache: CacheOperations): AsyncGenerator<JobJson>;
  jobToUrl(job: JobJson): string;
  jobToId(job: JobJson): string;
  extractContent(content: string): string;
  save(options: StrategySaveOptions<JobJson>): Promise<number>;
}
