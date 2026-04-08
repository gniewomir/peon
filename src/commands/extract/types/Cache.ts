import type { ILogger } from '../../lib/logger.js';

export interface CacheOperations {
  /** Absolute filesystem path for the cache file for this key. */
  cacheFilePath(key: string): string;
  hasCacheKey(key: string, logger: ILogger): boolean;
  readCache(key: string, logger: ILogger): Promise<string>;
  writeCache(key: string, content: string, logger: ILogger): Promise<boolean>;
  dailyCacheKey(str: string): string;
  weeklyCacheKey(str: string): string;
}

export interface CacheContext {
  withCache<T>(payload: (cache: CacheOperations) => Promise<T>): Promise<T>;
}
