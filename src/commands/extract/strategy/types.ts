import type { Logger } from '../../../lib/logger.js';
import type { CacheOperations } from '../lib/cache.js';
import type { JobJson, Listing } from '../types.js';
import type { KnownStrategy } from '../../../lib/types.js';
import type { GoToOptions } from 'puppeteer-core';

export interface StrategyParameters {
  logger: Logger;
  options: StrategyOptions;
}

export interface StrategyOptions {
  limit?: number;
  stagingDir: string;
  quarantineDir: string;
  trashDir: string;
  loadDir: string;
  requestsTimeout: number;
  pageOpenOptions: GoToOptions;
}

export interface StrategySaveOptions {
  cachePath: string;
  json: JobJson;
  url: string;
  html: string;
}

export interface Strategy {
  slug: KnownStrategy;
  pageOpenOptions(): GoToOptions;
  jobListingsGenerator(): AsyncGenerator<Listing>;
  jobGenerator(listing: Listing, cache: CacheOperations): AsyncGenerator<JobJson>;
  jobToUrl(job: JobJson): string;
  jobToId(job: JobJson): string;
  save(options: StrategySaveOptions): Promise<void>;
}
