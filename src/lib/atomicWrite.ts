import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { Logger } from './logger.js';
import { statsAddToCounter } from './stats.js';
import { stripRoot } from './root.js';

type WritablePayload = { kind: 'utf8'; text: string } | { kind: 'buffer'; data: Buffer };

function normalizePayload(content: unknown): WritablePayload {
  if (typeof content === 'string') {
    return { kind: 'utf8', text: content };
  }
  if (Buffer.isBuffer(content)) {
    return { kind: 'buffer', data: content };
  }
  if (typeof content === 'object' && content !== null) {
    return { kind: 'utf8', text: JSON.stringify(content, null, 2) };
  }
  throw new TypeError(
    `atomicWrite expects string, Buffer, or non-null object; got ${typeof content}`,
  );
}

function payloadsEqual(a: WritablePayload, b: WritablePayload): boolean {
  if (a.kind === 'utf8' && b.kind === 'utf8') return a.text === b.text;
  if (a.kind === 'buffer' && b.kind === 'buffer') return Buffer.compare(a.data, b.data) === 0;
  return false;
}

export async function atomicWrite(
  filePath: string,
  content: unknown,
  logger: Logger,
): Promise<boolean> {
  const newPayload = normalizePayload(content);

  try {
    let existing: WritablePayload | undefined;
    try {
      if (newPayload.kind === 'utf8') {
        existing = { kind: 'utf8', text: await fs.readFile(filePath, 'utf8') };
      } else {
        existing = { kind: 'buffer', data: await fs.readFile(filePath) };
      }
    } catch {
      // file doesn't exist yet — proceed to write
    }
    if (existing !== undefined && payloadsEqual(existing, newPayload)) {
      logger.debug(` 🚬 file content unchanged, skipping write: ${stripRoot(filePath)}`);
      statsAddToCounter('file_unchanged');
      return false;
    }
  } catch {
    // best-effort compare
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(dir, `.${base}.tmp-${process.pid}-${randomUUID()}`);

  try {
    const fh = await fs.open(tmpPath, 'w');
    try {
      if (newPayload.kind === 'utf8') {
        await fh.writeFile(newPayload.text, 'utf8');
      } else {
        await fh.writeFile(newPayload.data);
      }
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
