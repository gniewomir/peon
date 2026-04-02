import path from 'node:path';
import type { Command } from 'commander';
import { getPeonRepoRoot } from './extract/repoRoot.js';
import { runTransform } from './transform/run.js';

export function registerTransformCommand(program: Command): void {
  const defaultDir = 'staging';
  program
    .command('transform')
    .description('Watch staging directory and log file changes')
    .option('--dir <dir>', 'Directory to watch (default: <repo>/data/staging)')
    .action(async (opts: { dir?: string }) => {
      const root = getPeonRepoRoot();
      const stagingDir = path.resolve(opts.dir ?? path.join(root, 'data', defaultDir));
      await runTransform({ stagingDir });
    });
}
