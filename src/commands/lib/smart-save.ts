import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type { Logger } from './logger.js';

export async function smartSave(
  filePath: string,
  content: Record<string, unknown> | unknown[] | string,
  force: boolean,
  logger: Logger,
): Promise<boolean> {
  const newContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;

  if (!force) {
    try {
      const existing = await fs.readFile(filePath, 'utf8');
      if (existing === newContent) {
        logger.log(
          ` 🚬 file content unchanged, skipping write: ${path.relative(process.cwd(), filePath)}`,
        );
        return false;
      }
    } catch {
      // file doesn't exist yet — proceed to write
    }
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, newContent, 'utf8');
  logger.log(` 💾 Saved file ${path.relative(process.cwd(), filePath)}`);
  return true;
}
