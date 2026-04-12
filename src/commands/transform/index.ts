import path from 'node:path';
import type { Command } from 'commander';
import { rootPath } from '../../lib/root.js';
import { runTransform } from './run.js';
import { type Logger, loggerContext } from '../lib/logger.js';

export function registerTransformCommand(program: Command): void {
  const root = rootPath();
  const defaultStagingDir = 'data/staging';
  const defaultQuarantineDir = 'data/quarantine';
  const defaultTrashDir = 'data/trash';
  const defaultLoadDir = 'data/load';
  const command = 'transform';
  program
    .command(command)
    .description('Watch staging directory and log file changes')
    .option('-v, --verbose', 'Enable debug logs')
    .option('--dir <dir>', `Directory to watch (default: <repo>/${defaultStagingDir})`)
    .option(
      '--quarantineDir <dir>',
      `Directory for quarantined items (default: <repo>/${defaultQuarantineDir})`,
    )
    .option('--trashDir <dir>', `Directory for trashed items (default: <repo>/${defaultTrashDir})`)
    .option(
      '--loadDir <dir>',
      `Directory for items ready to load (default: <repo>/${defaultLoadDir})`,
    )
    .action(
      async (opts: {
        dir?: string;
        quarantineDir?: string;
        trashDir?: string;
        loadDir?: string;
        verbose?: boolean;
      }) => {
        const { withLogger } = loggerContext({ prefix: command, verbose: Boolean(opts.verbose) });
        await withLogger((logger: Logger) =>
          runTransform({
            stagingDir: path.resolve(opts.dir ?? path.join(root, defaultStagingDir)),
            quarantineDir: path.resolve(opts.quarantineDir ?? path.join(root, defaultStagingDir)),
            trashDir: path.resolve(opts.trashDir ?? path.join(root, defaultTrashDir)),
            loadDir: path.resolve(opts.loadDir ?? path.join(root, defaultLoadDir)),
            logger,
          }),
        );
      },
    );
}
