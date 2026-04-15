import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { Logger } from './logger.js';
import { stripRoot } from './root.js';
import { statsAddToCounter } from './stats.js';

async function fsyncDirBestEffort(dirPath: string): Promise<void> {
  // Best-effort durability: fsync() the directory entry changes.
  // On some platforms/filesystems this is unsupported.
  try {
    const fh = await fs.open(dirPath, 'r');
    try {
      await fh.sync();
    } finally {
      await fh.close();
    }
  } catch {
    // ignore
  }
}

export type AtomicMoveDirOptions = {
  /**
   * If true and destination exists, we'll first move the destination aside,
   * then publish the source, then delete the old destination.
   *
   * This keeps the publish step atomic, but the overall operation is still
   * multi-step (crash can leave a backup directory behind).
   */
  overwrite?: boolean;
};

/**
 * Atomically move a directory by using a single rename() within the same filesystem.
 *
 * Notes:
 * - This is only atomic when `fromDir` and `toDir` live on the same filesystem.
 *   If not, rename() fails with EXDEV and we throw (copying would not be atomic).
 * - For best-effort crash-safety, we fsync the parent directories before/after.
 */
export async function atomicMoveDir(
  fromDir: string,
  toDir: string,
  logger: Logger,
  options: AtomicMoveDirOptions = {},
): Promise<void> {
  assert(fromDir && toDir, 'Expected fromDir and toDir');

  const toParent = path.dirname(toDir);
  await fs.mkdir(toParent, { recursive: true });

  const overwrite = options.overwrite ?? false;
  const backupDir = path.join(
    toParent,
    `.${path.basename(toDir)}.bak-${process.pid}-${randomUUID()}`,
  );

  await fsyncDirBestEffort(toParent);

  try {
    if (overwrite) {
      try {
        await fs.rename(toDir, backupDir);
        await fsyncDirBestEffort(toParent);
      } catch (err: unknown) {
        // If destination doesn't exist, that's fine.
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as NodeJS.ErrnoException).code === 'ENOENT'
        ) {
          // noop
        } else {
          throw err;
        }
      }
    }

    await fs.rename(fromDir, toDir);
    await fsyncDirBestEffort(toParent);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'EXDEV'
    ) {
      throw new Error(
        `atomicMoveDir requires same filesystem (rename() EXDEV): ${stripRoot(fromDir)} -> ${stripRoot(
          toDir,
        )}`,
        { cause: err as unknown as Error },
      );
    }
    throw err;
  } finally {
    if (overwrite) {
      // Best-effort cleanup. If a crash happens earlier, the backup might remain;
      // that's preferable to risking data loss.
      try {
        await fs.rm(backupDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  statsAddToCounter('dir_moved');
  logger.debug(` 📁 moved dir ${stripRoot(fromDir)} -> ${stripRoot(toDir)}`);
}
