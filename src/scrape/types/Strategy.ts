import type { Logger } from './Logger.js';
import type { StrategyStats } from './Stats.js';
import type { BaseJob } from './Job.js';
import type { Listing } from './Listing.js';
import type { CacheOperations } from './Cache.js';

export interface StrategySaveOptions<TJob extends BaseJob> {
  outDir: string;
  job: TJob;
  url: string;
  content: string;
  logger: Logger;
}

export interface Strategy<TJob extends BaseJob = BaseJob> {
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
  jobGenerator(listing: Listing, logger: Logger, cache: CacheOperations): AsyncGenerator<BaseJob>;
  jobToUrl(job: BaseJob): string;
  jobToId(job: BaseJob): string;
  extractContent(content: string): string;
  save(options: StrategySaveOptions<BaseJob>): Promise<number>;
}
