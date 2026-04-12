import path from 'node:path';
import type { Command } from 'commander';
import { rootPath } from '../../lib/root.js';
import { runTransform } from './run.js';
import { type Logger, loggerContext } from '../lib/logger.js';

export function registerTransformCommand(program: Command): void {
  const root = rootPath();
  const defaultStagingDir = 'data/staging';
  const command = 'transform';
  program
    .command(command)
    .description('Watch staging directory and log file changes')
    .option('-v, --verbose', 'Enable debug logs')
    .option('--dir <dir>', `Directory to watch (default: <repo>/${defaultStagingDir})`)
    .action(async (opts: { dir?: string; verbose?: boolean }) => {
      const { withLogger } = loggerContext({ prefix: command, verbose: Boolean(opts.verbose) });
      await withLogger((logger: Logger) =>
        runTransform({
          stagingDir: path.resolve(opts.dir ?? path.join(root, defaultStagingDir)),
          logger,
        }),
      );
    });
}
