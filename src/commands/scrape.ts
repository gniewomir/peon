import path from 'node:path';
import type { Command } from 'commander';
import { getPeonRepoRoot } from '../scrape/repoRoot.js';
import { runScrape } from '../scrape/run.js';
import { allStrategies, jjiStrategy, nfjStrategy } from '../scrape/strategy/index.js';
import type { BaseStrategy } from '../scrape/types/index.js';

function parseOnlySlugs(only: string | undefined): Set<string> | null {
  if (only === undefined || only.trim() === '') {
    return null;
  }
  return new Set(
    only
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function selectStrategies(only: string | undefined): BaseStrategy[] {
  const wanted = parseOnlySlugs(only);
  const all = allStrategies();
  if (!wanted) {
    return all;
  }
  const bySlug = new Map<string, () => BaseStrategy>([
    ['jji', jjiStrategy],
    ['nfj', nfjStrategy],
  ]);
  const selected: BaseStrategy[] = [];
  for (const slug of wanted) {
    const factory = bySlug.get(slug);
    if (!factory) {
      throw new Error(`Unknown strategy "${slug}". Use: jji, nfj`);
    }
    selected.push(factory());
  }
  return selected;
}

export function registerScrapeCommand(program: Command): void {
  program
    .command('scrape')
    .description('Scrape job boards into raw JSON')
    .option('--out <dir>', 'Output directory for raw JSON (default: <repo>/data/raw)')
    .option('--cache <dir>', 'Cache directory for HTML/API responses (default: <repo>/data/cache)')
    .option('--only <slugs>', 'Comma-separated strategies to run (jji, nfj)')
    .action(async (opts: { out?: string; cache?: string; only?: string }) => {
      const root = getPeonRepoRoot();
      const outDir = path.resolve(opts.out ?? path.join(root, 'data', 'raw'));
      const cacheDir = path.resolve(opts.cache ?? path.join(root, 'data', 'cache'));
      const strategies = selectStrategies(opts.only);
      await runScrape({ outDir, cacheDir, strategies });
    });
}
