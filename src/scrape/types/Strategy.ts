import type { Logger } from './Logger.js';
import type { StrategyStats } from './Stats.js';
import type { JobJson, JobMetadata } from './Job.js';
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
  listingsGenerator(): AsyncGenerator<Listing>;
  jobGenerator(listing: Listing, logger: Logger, cache: CacheOperations): AsyncGenerator<JobJson>;
  jobToUrl(job: JobJson): string;
  jobToId(job: JobJson): string;
  extractContent(content: string): string;
  saveRaw(options: StrategySaveOptions): Promise<JobMetadata>;
  saveClean(metadata: JobMetadata): Promise<JobMetadata>;
  saveNormalized(metadata: JobMetadata): Promise<JobMetadata>;
}
