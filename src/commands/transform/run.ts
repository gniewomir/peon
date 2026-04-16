import 'dotenv/config';

import { type Logger } from '../../lib/logger.js';
import { stripRoot } from '../../lib/root.js';
import { StageOrchestrator } from './StageOrchestrator.js';
import { stats, statsContext } from '../../lib/stats.js';
import { shutdownContext } from '../../lib/shutdown.js';
import { opendir } from 'node:fs/promises';
import path from 'node:path';
import { createStages } from './stage/createStages.js';

const ONE_SECOND_MS = 1_000;
const ONE_MINUTE_MS = ONE_SECOND_MS * 60;

/**
 * opendir is lazy, while readdir is eager.
 * We want to avoid reading the directory into memory all at once, and work incrementally.
 */
async function* directoryAsyncIterator(dir: string, logger: Logger) {
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

export async function runTransform({
  stagingDir,
  quarantineDir,
  trashDir,
  loadDir,
  logger,
}: {
  stagingDir: string;
  quarantineDir: string;
  trashDir: string;
  loadDir: string;
  logger: Logger;
}): Promise<void> {
  const statsCtx = statsContext('transform_');
  await statsCtx.withStats(async () => {
    await using shutdownCtx = shutdownContext(logger);
    const orchestrator = new StageOrchestrator({
      logger,
      quarantineDir,
      trashDir,
      loadDir,
      autoScaling: {
        minConcurrentStages: 1,
        maxConcurrentStages: 100,
        rssMemorySoftCap: 512 * 1024 * 1024,
      },
      stages: createStages({
        logger,
        stagingDir,
        trashDir,
        loadDir,
      }),
    });
    const orchestratorCleanup = async () => {
      await orchestrator.shutdown();
      logger.log(` 📊 Stats: ${JSON.stringify(stats())}`);
    };
    shutdownCtx.registerCleanup(orchestratorCleanup);

    logger.log(` 🔍 Scanning for jobs in: ${stripRoot(stagingDir)}`);

    const minDelayMs = ONE_SECOND_MS;
    const maxDelayMs = ONE_MINUTE_MS * 3;

    const idleMs = ONE_MINUTE_MS * 60;

    while (true) {
      if (Date.now() - orchestrator.lastProgressAt() > idleMs) {
        logger.log(
          ` ✅ Transformations completed (idle for ${Math.round(idleMs / ONE_MINUTE_MS)}m). Done`,
        );
        logger.log(` 📊 Stats: ${JSON.stringify(stats())}`);
        return;
      }

      for await (const dir of directoryAsyncIterator(stagingDir, logger)) {
        if ((await orchestrator.enqueue(dir)) === 'denied') {
          break;
        }
      }
      orchestrator.adjustConcurrency();

      const delayMs = Math.min(
        maxDelayMs,
        Math.max(minDelayMs, Date.now() - orchestrator.lastProgressAt()),
      );
      logger.debug(` ⏳ Waiting for ${Math.round(delayMs / ONE_SECOND_MS)}s before next scan...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  });
}
