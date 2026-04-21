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
      logger: logger.withSuffix('bdj'),
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
      logger: logger.withSuffix('jji'),
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
      logger: logger.withSuffix('nfj'),
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
  const relDataDir = 'data';
  const command = 'extract';
  program
    .command(command)
    .description('Scrape job boards')
    .option('-v, --verbose', 'Enable debug logs')
    .option('--dataDir <dir>', `Cache directory (default: <repo>/${relDataDir})`)
    .option('--cache <scope>', `Cache read scope: listings|jobs|all`, 'all')
    .option('--only <slugs>', `Comma-separated strategies to run`, 'all')
    .option('--limit <number>', `Limit the number of jobs to scrape for each strategy`)
    .action(
      async (opts: {
        dataDir?: string;
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
            cacheDir: path.resolve(root, opts.dataDir ?? 'data', 'cache'),
            strategies: selectStrategies({
              only: opts.only,
              logger,
              options: {
                limit: opts.limit,
                stagingDir: path.resolve(root, opts.dataDir ?? 'data', 'staging'),
                quarantineDir: path.resolve(root, opts.dataDir ?? 'data', 'quarantine'),
                trashDir: path.resolve(root, opts.dataDir ?? 'data', 'trash'),
                loadDir: path.resolve(root, opts.dataDir ?? 'data', 'load'),
                cache: cacheScope,
              },
            }),
          }),
        );
      },
    );
}
