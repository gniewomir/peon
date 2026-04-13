import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { Logger } from './logger.js';
import assert from 'node:assert';
import { statsAddToCounter } from '../../lib/stats.js';

export async function smartSave(
  filePath: string,
  content: unknown,
  force: boolean,
  logger: Logger,
): Promise<boolean> {
  assert(typeof content === 'string' || typeof content === 'object', 'Expected string or object!');
  const newContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;

  if (!force) {
    try {
      const existing = await fs.readFile(filePath, 'utf8');
      if (existing === newContent) {
        logger.debug(
          ` 🚬 file content unchanged, skipping write: ${path.relative(process.cwd(), filePath)}`,
        );
        statsAddToCounter('files_unchanged');
        return false;
      }
    } catch {
      // file doesn't exist yet — proceed to write
    }
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, newContent, 'utf8');
  statsAddToCounter('files_written');
  logger.debug(` 💾 Saved file ${path.relative(process.cwd(), filePath)}`);
  return true;
}
