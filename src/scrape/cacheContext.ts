import path from 'node:path';
import { createCacheOperations } from './lib/cache.js';
import type { CacheContext, CacheOperations } from './types/index.js';

export function cacheContext(root: string): CacheContext {
  return {
    withCache: async <T>(payload: (cache: CacheOperations) => Promise<T>): Promise<T> => {
      const cache = createCacheOperations(path.resolve(root));
      return await payload(cache);
    },
  };
}
