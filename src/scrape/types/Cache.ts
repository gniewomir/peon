import type { Logger } from './Logger.js';

export interface CacheOperations {
  hasCacheKey(key: string, logger: Logger): boolean;
  readCache(key: string, logger: Logger): Promise<string>;
  writeCache(key: string, content: string, logger: Logger): Promise<number>;
  dailyCacheKey(str: string): string;
  weeklyCacheKey(str: string): string;
}
