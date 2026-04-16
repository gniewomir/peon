import 'dotenv/config';

import { type Logger } from '../../lib/logger.js';
import { stripRoot } from '../../lib/root.js';
import { StageOrchestrator } from './StageOrchestrator.js';
import { stats, statsContext } from '../../lib/stats.js';
import { shutdownContext } from '../../lib/shutdown.js';
import { createStages } from './stage/createStages.js';
import { directoryAsyncIterator } from './lib/directoryAsyncIterator.js';

const ONE_SECOND_MS = 1_000;
const ONE_MINUTE_MS = ONE_SECOND_MS * 60;

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
