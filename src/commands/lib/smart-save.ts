import { promises as fs } from 'node:fs';
import * as fsSync from 'node:fs';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import assert from 'node:assert';
import type { Logger } from '../extract/types/index.js';

export async function smartSave(
  filePath: string,
  content: object | string,
  force: boolean,
  logger: Logger,
): Promise<number> {
  assert(filePath.indexOf('undefined') === -1, 'filePath cannot contain "undefined" string.');
  assert(
    typeof logger === 'object' && 'log' in logger && 'error' in logger,
    'logger must be a proper logger.',
  );

  try {
    const newContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
    const newHash = crypto.createHash('md5').update(newContent).digest('hex');

    if (fsSync.existsSync(filePath) && !force) {
      const existingContent = await fs.readFile(filePath, 'utf8');
      const existingHash = crypto.createHash('md5').update(existingContent).digest('hex');

      if (existingHash === newHash) {
        logger.log(
          ` 🚬 ${typeof content === 'object' ? 'Content' : 'Cache'} unchanged, skipping write: ${path.relative(process.cwd(), filePath)}`,
        );
        return 0;
      }
    }

    const dir = path.dirname(filePath);
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }

    await fs.writeFile(filePath, newContent, 'utf8');
    logger.log(
      ` 💾 Saved ${typeof content === 'object' ? 'content' : 'cache'} ${path.relative(process.cwd(), filePath)} (${force ? 'forced' : 'different content hash'})`,
    );

    return 1;
  } catch (error) {
    logger.error(` ❌ Error in smartSave:`, (error as Error).message);
    throw error;
  }
}
