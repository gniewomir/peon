import path from 'node:path';
import type { Command } from 'commander';
import { rootPath } from '../../lib/root.js';
import { runTransform } from './run.js';
import { type Logger, loggerContext } from '../../lib/logger.js';

export function registerTransformCommand(program: Command): void {
  const root = rootPath();
  const relCacheDir = 'data/cache';
  const relStagingDir = 'data/staging';
  const relQuarantineDir = 'data/quarantine';
  const relTrashDir = 'data/trash';
  const relLoadDir = 'data/load';
  const command = 'transform';
  program
    .command(command)
    .description('Watch staging directory and log file changes')
    .option('-v, --verbose', 'Enable debug logs')
    .option('--cacheDir <dir>', `Cache directory (default: <repo>/${relCacheDir})`)
    .option('--stagingDir <dir>', `Staging directory (default: <repo>/${relStagingDir})`)
    .option('--quarantineDir <dir>', `Quarantine directory (default: <repo>/${relQuarantineDir})`)
    .option('--trashDir <dir>', `Trashed directory (default: <repo>/${relTrashDir})`)
    .option('--loadDir <dir>', `Load directory (default: <repo>/${relLoadDir})`)
    .action(
      async (opts: {
        cacheDir?: string;
        stagingDir?: string;
        quarantineDir?: string;
        trashDir?: string;
        loadDir?: string;
        verbose?: boolean;
      }) => {
        const cx = loggerContext({ prefix: command, verbose: Boolean(opts.verbose) });
        return cx.withLogger((logger: Logger) =>
          runTransform({
            stagingDir: path.resolve(opts.stagingDir ?? path.join(root, relStagingDir)),
            quarantineDir: path.resolve(opts.quarantineDir ?? path.join(root, relQuarantineDir)),
            trashDir: path.resolve(opts.trashDir ?? path.join(root, relTrashDir)),
            loadDir: path.resolve(opts.loadDir ?? path.join(root, relLoadDir)),
            logger,
          }),
        );
      },
    );
}
