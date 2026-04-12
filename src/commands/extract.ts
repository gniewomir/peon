import path from 'node:path';
import type { Command } from 'commander';
import { rootPath } from '../lib/root.js';
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
  const root = rootPath();
  const defaultStagingDir = 'data/staging';
  const defaultCacheDir = 'data/cache';
  const command = 'extract';
  program
    .command(command)
    .description('Scrape job boards')
    .option('-v, --verbose', 'Enable debug logs')
    .option('--out <dir>', `Staging directory (default: <repo>/${defaultStagingDir})`)
    .option(
      '--cache <dir>',
      `Cache directory; each strategy uses <dir>/<slug>/ (default: <repo>/${defaultCacheDir})`,
    )
    .option('--only <slugs>', `Comma-separated strategies to run`)
    .action(async (opts: { out?: string; cache?: string; only?: string; verbose?: boolean }) => {
      const { withLogger } = loggerContext({ prefix: command, verbose: Boolean(opts.verbose) });
      return withLogger((logger) =>
        runExtract({
          logger,
          stagingDir: path.resolve(opts.out ?? path.join(root, defaultStagingDir)),
          cacheDir: path.resolve(opts.cache ?? path.join(root, defaultCacheDir)),
          strategies: selectStrategies(parseOnlySlugs(opts.only), logger),
          registry: createShutdownRegistry(logger),
        }),
      );
    });
}
