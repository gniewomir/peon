import 'dotenv/config';

import { type Logger } from '../../lib/logger.js';
import { stripRoot } from '../../lib/root.js';
import { StageOrchestrator } from './stage/StageOrchestrator.js';
import { CleanHtmlToJsonStage } from './stage/stage-clean-html-to-json/CleanHtmlToJsonStage.js';
import { CleanMetaStage } from './stage/stage-clean-meta/CleanMetaStage.js';
import { CleanJsonStage } from './stage/stage-clean-job-json/CleanJsonStage.js';
import { CleanHtmlStage } from './stage/stage-clean-html/CleanHtmlStage.js';
import { CleanHtmlToMdStage } from './stage/stage-clean-html-to-md/CleanHtmlToMdStage.js';
import { stats, statsAddToCounter, statsContext } from '../../lib/stats.js';
import { shutdownContext } from '../../lib/shutdown.js';
import { CleanHtmlJsonStage } from './stage/stage-clean-html-json/CleanHtmlJsonStage.js';
import { CleanCombineStage } from './stage/stage-clean-combine/CleanCombineStage.js';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* directoryAsyncIterator(dir: string) {
  for (const de of await readdir(dir, {
    withFileTypes: true,
    encoding: 'utf8',
  })) {
    if (!de.isDirectory()) continue;
    const full = path.join(dir, de.name);
    try {
      const st = await stat(full);
      yield { dir: full, mtimeMs: st.mtimeMs };
    } catch {
      // dir may have been moved mid-scan
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
  await using shutdownCtx = shutdownContext(logger);
  const statsCtx = statsContext('transform_');
  await statsCtx.withStats(async () => {
    const orchestrator = new StageOrchestrator({
      logger,
      stagingDir,
      quarantineDir,
      trashDir,
      loadDir,
      autoScaling: {
        maxConcurrentStages: 100,
        maxRssMemoryUsage: 512 * 1024 * 1024, // 512mb
        rssMemoryCheckMs: 2_000,
        concurrencyUpRssLimit: 0.7,
        concurrencyDownRssLimit: 0.9,
      },
      stages: [
        new CleanJsonStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanJsonStage.transformations(),
        }),
        new CleanHtmlToJsonStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanHtmlToJsonStage.transformations(),
        }),
        new CleanHtmlJsonStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanHtmlJsonStage.transformations(),
        }),
        new CleanMetaStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanMetaStage.transformations(),
        }),
        new CleanHtmlStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanHtmlStage.transformations(),
        }),
        new CleanHtmlToMdStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanHtmlToMdStage.transformations(),
        }),
        new CleanCombineStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanCombineStage.transformations(),
        }),
      ],
    });
    shutdownCtx.registerCleanup(() => orchestrator.shutdown());

    logger.log(` 🔍 Scanning for jobs in: ${stripRoot(stagingDir)}`);

    const idleMs = 1000 * 60 * 30;
    let backoffMs = 10_000;
    const backoffMinMs = 1_000;
    const backoffMaxMs = 30_000;
    let lastProgressAt = Date.now();

    while (true) {
      if (orchestrator.hasWorkInProgress()) {
        lastProgressAt = Date.now();
      }
      if (Date.now() - lastProgressAt > idleMs) {
        logger.log(
          ` ✅ Transformations completed (idle for ${Math.round(idleMs / (1000 * 60))}m). Done`,
        );
        logger.log(` 📊 Stats: ${JSON.stringify(stats())}`);
        await orchestrator.shutdown();
        return;
      }

      let capacity: Awaited<ReturnType<typeof orchestrator.enqueue>> | null = null;
      for await (const dir of directoryAsyncIterator(stagingDir)) {
        statsAddToCounter('scan_enqueued_job');
        capacity = await orchestrator.enqueue(dir.dir);
        if (capacity === 'at-capacity') {
          break;
        }
      }
      if (capacity === 'at-capacity') {
        backoffMs = Math.min(backoffMaxMs, Math.max(backoffMinMs, Math.round(backoffMs * 1.2)));
        logger.warn(` ⚠️ At capacity - increasing backoff (${backoffMs})`);
      } else {
        backoffMs = Math.min(backoffMinMs, Math.max(backoffMinMs, Math.round(backoffMs * 0.75)));
        logger.debug(` ✅ Under capacity - decreasing backoff (${backoffMs})`);
      }

      await sleep(backoffMs);
    }
  });
}
