import path from 'node:path';
import type { Command } from 'commander';
import { rootPath } from '../root.js';
import { runExtract } from './extract/run.js';
import { selectStrategies } from './extract/strategy/index.js';
import { loggerContext } from './lib/logger.js';
import { createShutdownRegistry } from './extract/lib/shutdown.js';

function parseOnlySlugs(only: string | undefined): Set<string> | 'all' {
  if (only === undefined || only.trim() === '' || only === 'all') {
    return 'all';
  }
  return new Set(
    only
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function registerExtractCommand(program: Command): void {
  const defaultDir = 'staging';
  program
    .command('extract')
    .description('Scrape job boards')
    .option('-v, --verbose', 'Enable debug logs')
    .option('--out <dir>', 'Output directory (default: <repo>/data/${defaultDir})')
    .option(
      '--cache <dir>',
      'Cache base directory; each strategy uses <dir>/<slug>/ (default: <repo>/data/cache)',
    )
    .option('--only <slugs>', `Comma-separated strategies to run`)
    .action(async (opts: { out?: string; cache?: string; only?: string; verbose?: boolean }) => {
      const root = rootPath();
      const { withLogger } = loggerContext({ prefix: 'extract', verbose: Boolean(opts.verbose) });
      return withLogger((logger) => {
        return runExtract({
          outDir: path.resolve(opts.out ?? path.join(root, 'data', defaultDir)),
          cacheDir: path.resolve(opts.cache ?? path.join(root, 'data', 'cache')),
          strategies: selectStrategies(parseOnlySlugs(opts.only), logger),
          logger,
          registry: createShutdownRegistry(logger),
        });
      });
    });
}
