import type { Logger } from '../../../lib/logger.js';
import type { CacheContext } from '../lib/cache.js';
import type { ItemJson, Listing } from '../types.js';
import type { KnownStrategy } from '../../../lib/types.js';
import type { GoToOptions } from 'puppeteer-core';

export type CacheScope = 'listings' | 'jobs' | 'all';

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
  cache: CacheScope;
  requestsTimeout: number;
  pageOpenOptions: GoToOptions;
}

export interface StrategySaveOptions {
  cachePath: string;
  json: ItemJson;
  url: string;
  html: string;
}

export interface Strategy {
  slug: KnownStrategy;
  cacheScope(): CacheScope;
  pageOpenOptions(): GoToOptions;
  listingGenerator(): AsyncGenerator<Listing>;
  itemGenerator(listing: Listing, cache: CacheContext): AsyncGenerator<ItemJson>;
  itemToUrl(job: ItemJson): string;
  itemToId(job: ItemJson): string;
  save(options: StrategySaveOptions): Promise<void>;
}
