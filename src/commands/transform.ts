import path from 'node:path';
import type { Command } from 'commander';
import { rootPath } from '../root.js';
import { runTransform } from './transform/run.js';

export function registerTransformCommand(program: Command): void {
  const defaultDir = 'staging';
  program
    .command('transform')
    .description('Watch staging directory and log file changes')
    .option('--dir <dir>', 'Directory to watch (default: <repo>/data/staging)')
    .action(async (opts: { dir?: string }) => {
      const root = rootPath();
      const stagingDir = path.resolve(opts.dir ?? path.join(root, 'data', defaultDir));
      await runTransform({ stagingDir });
    });
}
