import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { Logger } from './logger.js';
import { stripRoot } from './root.js';
import { statsAddToCounter } from './stats.js';

async function fsyncDirBestEffort(dirPath: string): Promise<void> {
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

export type AtomicRemoveDirOptions = {
  /**
   * If true, treat a missing directory as success.
   * Default: true.
   */
  ignoreMissing?: boolean;

  /**
   * If true, do not delete the renamed directory (leave it in place as a "trash" dir).
   * Default: false.
   */
  keepTrash?: boolean;
};

/**
 * "Atomic" directory removal:
 * - First renames `dirPath` to a hidden sibling (same parent) so the original path disappears atomically.
 * - Then removes the renamed directory recursively.
 *
 * Notes:
 * - This is only atomic in terms of the *path disappearing*. Actual disk space is freed later.
 * - Requires the rename to be on the same filesystem (same parent). If parent is on a different FS,
 *   rename() would fail with EXDEV (we rethrow with context).
 */
export async function atomicRemoveDir(
  dirPath: string,
  logger: Logger,
  options: AtomicRemoveDirOptions = {},
): Promise<void> {
  assert(dirPath, 'Expected dirPath');

  const ignoreMissing = options.ignoreMissing ?? true;
  const keepTrash = options.keepTrash ?? false;

  const parent = path.dirname(dirPath);
  const trashPath = path.join(
    parent,
    `.${path.basename(dirPath)}.rm-${process.pid}-${randomUUID()}`,
  );

  await fsyncDirBestEffort(parent);

  try {
    await fs.rename(dirPath, trashPath);
    await fsyncDirBestEffort(parent);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT' &&
      ignoreMissing
    ) {
      statsAddToCounter('dir_remove_missing_ignored');
      logger.debug(` 🗑️ dir missing, skipping remove: ${stripRoot(dirPath)}`);
      return;
    }
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'EXDEV'
    ) {
      throw new Error(`atomicRemoveDir requires same filesystem: ${stripRoot(dirPath)}`, {
        cause: err as unknown as Error,
      });
    }
    throw err;
  }

  if (keepTrash) {
    statsAddToCounter('dir_removed_to_trash');
    logger.warn(` 🗑️ moved dir to trash (kept): ${stripRoot(dirPath)} -> ${stripRoot(trashPath)}`);
    return;
  }

  await fs.rm(trashPath, { recursive: true, force: true });
  await fsyncDirBestEffort(parent);

  statsAddToCounter('dir_removed');
  logger.debug(` 🗑️ removed dir ${stripRoot(dirPath)}`);
}
