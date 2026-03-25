import type { Logger } from './Logger.js';
import type { StrategyStats } from './Stats.js';
import type { BaseJob } from './Job.js';
import type { Listing } from './Listing.js';

export interface Strategy<TJob extends BaseJob = BaseJob> {
  slug: string;
  stats: StrategyStats;
  ids: Set<string>;
  listingsGenerator(): AsyncGenerator<Listing>;
  jobGenerator(listing: Listing, logger: Logger): AsyncGenerator<TJob>;
  jobToUrl(job: TJob): string;
  jobToId(job: TJob): string;
  extractContent(content: string): string;
}

export interface BaseStrategy {
  slug: string;
  stats: StrategyStats;
  ids: Set<string>;
  listingsGenerator(): AsyncGenerator<Listing>;
  jobGenerator(listing: Listing, logger: Logger): AsyncGenerator<BaseJob>;
  jobToUrl(job: BaseJob): string;
  jobToId(job: BaseJob): string;
  extractContent(content: string): string;
}
