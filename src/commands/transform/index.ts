import path from 'node:path';
import type { Command } from 'commander';
import { rootPath } from '../../lib/root.js';
import { runTransform } from './run.js';
import { type Logger, loggerContext } from '../../lib/logger.js';

export function registerTransformCommand(program: Command): void {
  const root = rootPath();
  const relDataDir = 'data';
  const command = 'transform';
  program
    .command(command)
    .description('Watch staging directory and log file changes')
    .option('-v, --verbose', 'Enable debug logs')
    .option('-l, --loop', 'Keep working until explicitly terminated')
    .option('--dataDir <dir>', `Cache directory (default: <repo>/${relDataDir})`)
    .action(async (opts: { dataDir?: string; verbose?: boolean; loop?: boolean }) => {
      const cx = loggerContext({ prefix: command, verbose: Boolean(opts.verbose) });
      return cx.withLogger((logger: Logger) =>
        runTransform({
          stagingDir: path.resolve(root, opts.dataDir ?? 'data', 'staging'),
          quarantineDir: path.resolve(root, opts.dataDir ?? 'data', 'quarantine'),
          trashDir: path.resolve(root, opts.dataDir ?? 'data', 'trash'),
          loadDir: path.resolve(root, opts.dataDir ?? 'data', 'load'),
          loop: Boolean(opts.loop),
          logger,
        }),
      );
    });
}
