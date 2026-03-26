import type { Logger } from './Logger.js';

export interface CacheOperations {
  hasCacheKey(key: string, logger: Logger): boolean;
  readCache(key: string, logger: Logger): Promise<string>;
  writeCache(key: string, content: string, logger: Logger): Promise<number>;
  dailyCacheKey(str: string): string;
  weeklyCacheKey(str: string): string;
}

export interface CacheContext {
  withCache<T>(payload: (cache: CacheOperations) => Promise<T>): Promise<T>;
}
