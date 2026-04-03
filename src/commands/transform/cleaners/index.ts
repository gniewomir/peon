import type { AbstractCleaner } from './AbstractCleaner.js';
import { BdjCleaner } from './bdj/bdj.cleaner.js';
import { JjiCleaner } from './jji/jji.cleaner.js';
import { NfjCleaner } from './nfj/nfj.cleaner.js';

const cleanerRegistry = new Map<string, AbstractCleaner>([
  ['bdj', new BdjCleaner()],
  ['jji', new JjiCleaner()],
  ['nfj', new NfjCleaner()],
]);

export function cleanerByStrategySlug(slug: string): AbstractCleaner | undefined {
  return cleanerRegistry.get(slug);
}
