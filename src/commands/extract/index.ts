import path from 'node:path';
import type { Command } from 'commander';
import { rootPath } from '../../lib/root.js';
import { runExtract } from './run.js';
import { type Logger, loggerContext } from '../lib/logger.js';
import { createShutdownRegistry } from './lib/shutdown.js';
import { isStrategySlug } from '../../lib/types.js';
import assert from 'node:assert';
import type { Strategy } from './strategy/types.js';
import { BdjStrategy } from './strategy/bdj/BdjStrategy.js';
import { JjiStrategy } from './strategy/jji/JjiStrategy.js';
import { NfjStrategy } from './strategy/nfj/NfjStrategy.js';
import type { AbstractStrategy } from './strategy/AbstractStrategy.js';

const strategy_factories = [
  (logger: Logger) => new BdjStrategy(logger),
  (logger: Logger) => new JjiStrategy(logger),
  (logger: Logger) => new NfjStrategy(logger),
] as const;

let instantiated: null | Map<string, AbstractStrategy> = null;

function selectStrategies(only: string | undefined, logger: Logger): Strategy[] {
  if (instantiated === null) {
    instantiated = new Map<string, AbstractStrategy>();
    strategy_factories
      .map((e) => e(logger))
      .forEach((s) => {
        assert(instantiated);
        instantiated.set(s.slug, s);
      });
  }
  if (only === undefined || only.trim() === '' || only === 'all') {
    return Array.from(instantiated.values());
  }
  const valid = new Set(
    only
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter(isStrategySlug),
  );
  const invalid = new Set(
    only
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !isStrategySlug(s)),
  );
  if (invalid.size) {
    throw new Error(
      `${Array.from(invalid.values()).join(', ')} are not valid strategy slugs, available ${Array.from(valid.values()).join(', ')}`,
    );
  }
  return Array.from(instantiated.values()).filter((s) => valid.has(s.slug));
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
      await withLogger((logger) =>
        runExtract({
          logger,
          stagingDir: path.resolve(opts.out ?? path.join(root, defaultStagingDir)),
          cacheDir: path.resolve(opts.cache ?? path.join(root, defaultCacheDir)),
          strategies: selectStrategies(opts.only, logger),
          registry: createShutdownRegistry(logger),
        }),
      );
    });
}
