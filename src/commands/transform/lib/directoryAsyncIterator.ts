import type { Logger } from '../../../lib/logger.js';
import { opendir } from 'node:fs/promises';
import path from 'node:path';

/**
 * opendir is lazy, while readdir is eager.
 * We want to avoid reading the directory into memory all at once, and work incrementally.
 */
export async function* directoryAsyncIterator(dir: string, logger: Logger) {
  let handle: Awaited<ReturnType<typeof opendir>> | undefined;
  try {
    handle = await opendir(dir, { encoding: 'utf8' });
    for await (const de of handle) {
      if (!de.isDirectory()) continue;
      yield path.join(dir, de.name);
    }
  } catch (error) {
    logger.error(`Error reading directory ${dir}`, { error, dir });
    return;
  } finally {
    try {
      await handle?.close();
    } catch (error) {
      // ignore ERR_DIR_CLOSED error
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error?.code === 'ERR_DIR_CLOSED'
      ) {
        // ignore
      } else {
        logger.error(`Unexpected error when closing directory handle for ${dir}`, { error, dir });
      }
    }
  }
}
