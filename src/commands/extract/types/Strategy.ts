import type { Logger } from '../../types/Logger.js';
import type { StrategyStats } from './Stats.js';
import type { JobJson, JobMetadata } from '../../types/Job.js';
import type { Listing } from './Listing.js';
import type { CacheOperations } from './Cache.js';

export interface StrategySaveOptions {
  outDir: string;
  cached: string;
  job: JobJson;
  url: string;
  content: string;
  logger: Logger;
}

export interface Strategy {
  slug: string;
  stats: StrategyStats;
  ids: Set<string>;
  jobListingsGenerator(): AsyncGenerator<Listing>;
  jobGenerator(listing: Listing, logger: Logger, cache: CacheOperations): AsyncGenerator<JobJson>;
  jobToUrl(job: JobJson): string;
  jobToId(job: JobJson): string;
  jobContent(content: string): string;
  save(options: StrategySaveOptions): Promise<JobMetadata>;
}
