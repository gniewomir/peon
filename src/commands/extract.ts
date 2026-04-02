import path from 'node:path';
import type { Command } from 'commander';
import { getPeonRepoRoot } from './extract/repoRoot.js';
import { runScrape } from './extract/run.js';
import { allStrategies, strategyFactoryBySlug } from './extract/strategy/index.js';
import type { Strategy } from './extract/types/index.js';

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

function selectStrategies(only: string | undefined): Strategy[] {
  const wanted = parseOnlySlugs(only);
  const all = allStrategies();
  if (!wanted) {
    return all;
  }
  const bySlug = strategyFactoryBySlug();
  const allowedSlugs = [...bySlug.keys()].join(', ');
  const selected: Strategy[] = [];
  for (const slug of wanted) {
    const factory = bySlug.get(slug);
    if (!factory) {
      throw new Error(`Unknown strategy "${slug}". Use: ${allowedSlugs}`);
    }
    selected.push(factory());
  }
  return selected;
}

export function registerExtractCommand(program: Command): void {
  const allowedOnly = [...strategyFactoryBySlug().keys()].join(', ');
  const defaultDir = 'staging';
  program
    .command('extract')
    .description('Scrape job boards')
    .option('--out <dir>', 'Output directory (default: <repo>/data/${defaultDir})')
    .option(
      '--cache <dir>',
      'Cache base directory; each strategy uses <dir>/<slug>/ (default: <repo>/data/cache)',
    )
    .option('--only <slugs>', `Comma-separated strategies to run (${allowedOnly})`)
    .action(async (opts: { out?: string; cache?: string; only?: string }) => {
      const root = getPeonRepoRoot();
      const outDir = path.resolve(opts.out ?? path.join(root, 'data', defaultDir));
      const cacheDir = path.resolve(opts.cache ?? path.join(root, 'data', 'cache'));
      const strategies = selectStrategies(opts.only);
      await runScrape({ outDir, cacheDir, strategies });
    });
}
