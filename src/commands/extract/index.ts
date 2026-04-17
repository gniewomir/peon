import path from 'node:path';
import type { Command } from 'commander';
import { rootPath } from '../../lib/root.js';
import { runExtract } from './run.js';
import { type Logger, loggerContext } from '../../lib/logger.js';
import { isStrategySlug } from '../../lib/types.js';
import assert from 'node:assert';
import type { CacheScope, Strategy, StrategyOptions } from './strategy/types.js';
import { BdjStrategy } from './strategy/bdj/BdjStrategy.js';
import { JjiStrategy } from './strategy/jji/JjiStrategy.js';
import { NfjStrategy } from './strategy/nfj/NfjStrategy.js';
import type { AbstractStrategy } from './strategy/AbstractStrategy.js';

function parseCacheScope(val: unknown): CacheScope {
  if (val === 'listings' || val === 'jobs' || val === 'all') {
    return val;
  }
  throw new Error(`Invalid --cache value "${String(val)}" (expected: listings|jobs|all)`);
}

const strategy_factories = [
  (logger: Logger, options: Omit<StrategyOptions, 'requestsTimeout' | 'pageOpenOptions'>) =>
    new BdjStrategy({
      logger,
      options: {
        ...options,
        requestsTimeout: 30_000,
        pageOpenOptions: {
          waitUntil: 'load',
          timeout: 30_000,
        },
      },
    }),
  (logger: Logger, options: Omit<StrategyOptions, 'requestsTimeout' | 'pageOpenOptions'>) =>
    new JjiStrategy({
      logger,
      options: {
        ...options,
        requestsTimeout: 30_000,
        pageOpenOptions: {
          waitUntil: 'networkidle0',
          timeout: 30_000,
        },
      },
    }),
  (logger: Logger, options: Omit<StrategyOptions, 'requestsTimeout' | 'pageOpenOptions'>) =>
    new NfjStrategy({
      logger,
      options: {
        ...options,
        requestsTimeout: 30_000,
        pageOpenOptions: {
          waitUntil: 'load',
          timeout: 30_000,
        },
      },
    }),
] as const;

let instantiated: null | Map<string, AbstractStrategy> = null;

function selectStrategies({
  only,
  logger,
  options,
}: {
  only: string | undefined;
  logger: Logger;
  options: Omit<StrategyOptions, 'requestsTimeout' | 'pageOpenOptions'>;
}): Strategy[] {
  if (instantiated === null) {
    instantiated = new Map<string, AbstractStrategy>();
    strategy_factories
      .map((e) => e(logger, options))
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
  const relCacheDir = 'data/cache';
  const relStagingDir = 'data/staging';
  const relQuarantineDir = 'data/quarantine';
  const relTrashDir = 'data/trash';
  const relLoadDir = 'data/load';
  const command = 'extract';
  program
    .command(command)
    .description('Scrape job boards')
    .option('-v, --verbose', 'Enable debug logs')
    .option('--cacheDir <dir>', `Cache directory (default: <repo>/${relCacheDir})`)
    .option('--stagingDir <dir>', `Staging directory (default: <repo>/${relStagingDir})`)
    .option('--quarantineDir <dir>', `Quarantine directory (default: <repo>/${relQuarantineDir})`)
    .option('--trashDir <dir>', `Trashed directory (default: <repo>/${relTrashDir})`)
    .option('--loadDir <dir>', `Load directory (default: <repo>/${relLoadDir})`)
    .option('--cache <scope>', `Cache read scope: listings|jobs|all`, 'all')
    .option('--only <slugs>', `Comma-separated strategies to run`, 'all')
    .option('--limit <number>', `Limit the number of jobs to scrape for each strategy`)
    .action(
      async (opts: {
        cacheDir?: string;
        stagingDir?: string;
        quarantineDir?: string;
        trashDir?: string;
        loadDir?: string;
        cache?: CacheScope;
        only?: string;
        verbose?: boolean;
        limit?: number;
      }) => {
        const loggerCtx = loggerContext({ prefix: command, verbose: Boolean(opts.verbose) });
        const cacheScope = parseCacheScope(opts.cache ?? 'all');
        return loggerCtx.withLogger((logger) =>
          runExtract({
            logger,
            cacheDir: path.resolve(opts.cacheDir ?? path.join(root, relCacheDir)),
            strategies: selectStrategies({
              only: opts.only,
              logger,
              options: {
                limit: opts.limit,
                stagingDir: path.resolve(opts.stagingDir ?? path.join(root, relStagingDir)),
                quarantineDir: path.resolve(
                  opts.quarantineDir ?? path.join(root, relQuarantineDir),
                ),
                trashDir: path.resolve(opts.trashDir ?? path.join(root, relTrashDir)),
                loadDir: path.resolve(opts.loadDir ?? path.join(root, relLoadDir)),
                cache: cacheScope,
              },
            }),
          }),
        );
      },
    );
}
