import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { Logger } from './logger.js';
import assert from 'node:assert';
import { statsAddToCounter } from './stats.js';
import { stripRoot } from './root.js';

export async function smartSave(
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
  await fs.writeFile(filePath, newContent, 'utf8');
  statsAddToCounter('file_written');
  logger.debug(` 💾 Saved file ${stripRoot(filePath)}`);
  return true;
}
