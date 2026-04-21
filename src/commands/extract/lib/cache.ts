import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as crypto from 'node:crypto';
import { atomicWrite } from '../../../lib/atomicWrite.js';
import type { Logger } from '../../../lib/logger.js';
import { statsAddToCounter } from '../../../lib/stats.js';

function getISOWeek(date: Date): number {
  const d = new Date(date);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function dailyCacheKey(str: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return crypto.createHash('md5').update(`${str}.${today}`).digest('hex');
}

export function weeklyCacheKey(str: string): string {
  const weekNumber = getISOWeek(new Date());
  return crypto.createHash('md5').update(`${str}.${weekNumber}`).digest('hex');
}

function sliceCacheKey(str: string): [string, string, string] {
  return [str.slice(0, 2), str.slice(2, 4), str.slice(4)];
}

function cacheKeyToPath(key: string, basePath: string): string {
  const [dir1, dir2, fileName] = sliceCacheKey(key);
  return path.join(basePath, dir1, dir2, `${fileName}.cache`);
}

function relativeCachePath(cachePath: string, basePath: string): string {
  return path.relative(basePath, cachePath);
}

export function createCacheOperations(root: string): CacheContext {
  const basePath = path.resolve(root);

  return {
    cacheFilePath(key: string): string {
      return path.resolve(cacheKeyToPath(key, basePath));
    },

    async hasCacheKey(key: string, logger: Logger): Promise<boolean> {
      const cachePath = cacheKeyToPath(key, basePath);
      try {
        await fs.access(cachePath);
        logger.debug(` 🎯 Cache hit! ${relativeCachePath(cachePath, basePath)}`);
        return true;
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as NodeJS.ErrnoException).code !== 'ENOENT'
        ) {
          throw err;
        }
        logger.debug(` ❌ Cache miss! ${relativeCachePath(cachePath, basePath)}`);
        return false;
      }
    },

    async writeCache(key: string, content: unknown, logger: Logger): Promise<boolean> {
      const saved = await atomicWrite(cacheKeyToPath(key, basePath), content, logger);
      statsAddToCounter('cache_write');
      return saved;
    },

    async readCache(key: string, logger: Logger): Promise<string> {
      const cachePath = cacheKeyToPath(key, basePath);
      logger.debug(` 📖 reading cache ${relativeCachePath(cachePath, basePath)}`);
      const content = await fs.readFile(cachePath, { encoding: 'utf8' });
      statsAddToCounter('cache_read');
      return content;
    },

    dailyCacheKey,
    weeklyCacheKey,
  };
}
export function cacheContext(root: string): CacheContext {
  return createCacheOperations(path.resolve(root));
}
export interface CacheContext {
  /** Absolute filesystem path for the cache file for this key. */
  cacheFilePath(key: string): string;
  hasCacheKey(key: string, logger: Logger): Promise<boolean>;
  readCache(key: string, logger: Logger): Promise<string>;
  writeCache(key: string, content: unknown, logger: Logger): Promise<boolean>;
  dailyCacheKey(str: string): string;
  weeklyCacheKey(str: string): string;
}
