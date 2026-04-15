import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { Logger } from './logger.js';
import assert from 'node:assert';
import { statsAddToCounter } from './stats.js';
import { stripRoot } from './root.js';

export async function atomicWrite(
  filePath: string,
  content: unknown,
  logger: Logger,
): Promise<boolean> {
  assert(typeof content === 'string' || typeof content === 'object', 'Expected string or object!');
  const newContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;

  try {
    const existing = await fs.readFile(filePath, 'utf8');
    if (existing === newContent) {
      logger.debug(` 🚬 file content unchanged, skipping write: ${stripRoot(filePath)}`);
      statsAddToCounter('file_unchanged');
      return false;
    }
  } catch {
    // file doesn't exist yet — proceed to write
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(dir, `.${base}.tmp-${process.pid}-${randomUUID()}`);

  try {
    const fh = await fs.open(tmpPath, 'w');
    try {
      await fh.writeFile(newContent, 'utf8');
      // Ensure content hits disk before the atomic rename, so a crash/power loss
      // won't leave us with a renamed-but-empty/partial artifact.
      await fh.sync();
    } finally {
      await fh.close();
    }

    // Atomic publish: rename temp file into place.
    // Note: on POSIX this typically replaces an existing destination atomically;
    // on Windows renaming over an existing file may fail.
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Best-effort cleanup of temp file on any failure.
    try {
      await fs.unlink(tmpPath);
    } catch {
      // ignore
    }
    throw err;
  }

  statsAddToCounter('file_written');
  logger.debug(` 💾 Saved file ${stripRoot(filePath)}`);
  return true;
}
