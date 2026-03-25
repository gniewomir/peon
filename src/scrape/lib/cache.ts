import { promises as fs } from 'node:fs';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { smartSave } from './smart-save.js';
import { getCacheRoot } from '../cacheContext.js';
import type { Logger } from '../types/index.js';

function getBasePath(): string {
  return getCacheRoot();
}

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

function cacheKeyToPath(str: string): string {
  const [dir1, dir2, fileName] = sliceCacheKey(str);
  return path.join(getBasePath(), dir1, dir2, `${fileName}.cache`);
}

function relativeCachePath(cachePath: string): string {
  return path.relative(getBasePath(), cachePath);
}

export function hasCacheKey(key: string, logger: Logger): boolean {
  const cachePath = cacheKeyToPath(key);
  if (fsSync.existsSync(cachePath)) {
    logger.log(` 🎯 Cache hit! ${relativeCachePath(cachePath)}`);
    return true;
  } else {
    logger.log(` ❌ Cache miss! ${relativeCachePath(cachePath)}`);
    return false;
  }
}

export async function writeCache(key: string, content: string, logger: Logger): Promise<number> {
  return smartSave(cacheKeyToPath(key), content, false, logger);
}

export function readCache(key: string, logger: Logger): Promise<string> {
  const cachePath = cacheKeyToPath(key);
  logger.log(` 📖 reading cache ${relativeCachePath(cachePath)}`);
  return fs.readFile(cacheKeyToPath(key), { encoding: 'utf8' });
}
