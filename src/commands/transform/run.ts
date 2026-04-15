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
import { InMemoryDirectoryTracker } from './stage/InMemoryDirectoryTracker.js';
import { CleanHtmlJsonStage } from './stage/stage-clean-html-json/CleanHtmlJsonStage.js';
import { CleanCombineStage } from './stage/stage-clean-combine/CleanCombineStage.js';
import { readdir, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const inMemoryDirectoryTracker = new InMemoryDirectoryTracker(5000);
  await statsCtx.withStats(async () => {
    const orchestrator = new StageOrchestrator({
      logger,
      stagingDir,
      quarantineDir,
      trashDir,
      loadDir,
      inMemoryDirectoryTracker,
      stages: [
        new CleanJsonStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanJsonStage.transformations(),
          inMemoryDirectoryTracker,
        }),
        new CleanHtmlToJsonStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanHtmlToJsonStage.transformations(),
          inMemoryDirectoryTracker,
        }),
        new CleanHtmlJsonStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanHtmlJsonStage.transformations(),
          inMemoryDirectoryTracker,
        }),
        new CleanMetaStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanMetaStage.transformations(),
          inMemoryDirectoryTracker,
        }),
        new CleanHtmlStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanHtmlStage.transformations(),
          inMemoryDirectoryTracker,
        }),
        new CleanHtmlToMdStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanHtmlToMdStage.transformations(),
          inMemoryDirectoryTracker,
        }),
        new CleanCombineStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanCombineStage.transformations(),
          inMemoryDirectoryTracker,
        }),
      ],
    });
    shutdownCtx.registerCleanup(() => orchestrator.shutdown());

    logger.log(` 🔍 Scanning for jobs in: ${stripRoot(stagingDir)}`);

    const idleMs = 1000 * 60 * 30;
    let backoffMs = 1000;
    const backoffMaxMs = 30_000;
    let lastWritten = stats().counters['transform_file_written'] ?? 0;
    let lastProgressAt = Date.now();

    while (true) {
      // Progress detection (global, not per-cycle): relies on smartSave() counter.
      const curWritten = stats().counters['transform_file_written'] ?? 0;
      if (curWritten > lastWritten) {
        lastWritten = curWritten;
        lastProgressAt = Date.now();
        backoffMs = 1000;
      }

      if (Date.now() - lastProgressAt > idleMs) {
        logger.log(` ✅ Transformations completed (idle). Done`);
        logger.log(` 📊 Stats: ${JSON.stringify(stats())}`);
        await orchestrator.shutdown();
        return;
      }

      // Discover job dirs (snapshot) and enqueue in oldest->newest order by dir mtime.
      let dirents: Dirent[];
      try {
        dirents = await readdir(stagingDir, { withFileTypes: true, encoding: 'utf8' });
      } catch (error) {
        logger.error(`Failed to scan staging dir ${stripRoot(stagingDir)}`, error);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMaxMs, backoffMs * 2);
        continue;
      }

      const jobDirs: { dir: string; mtimeMs: number }[] = [];
      for (const de of dirents) {
        if (!de.isDirectory()) continue;
        const full = path.join(stagingDir, de.name);
        try {
          const st = await stat(full);
          jobDirs.push({ dir: full, mtimeMs: st.mtimeMs });
        } catch {
          // dir may have been moved mid-scan
        }
      }
      jobDirs.sort((a, b) => a.mtimeMs - b.mtimeMs);

      let enqueuedCount = 0;
      for (const j of jobDirs) {
        statsAddToCounter('scan_enqueued_job');
        if (orchestrator.enqueueJobDir(j.dir)) enqueuedCount += 1;
        if (enqueuedCount >= 50) break;
      }
      if (enqueuedCount >= 50) {
        logger.warn(` ⚠️ Too many jobs enqueued (${enqueuedCount})- increasing backoff`);
        backoffMs = Math.min(backoffMaxMs, Math.round(backoffMs * 1.5));
      } else {
        backoffMs = Math.min(backoffMaxMs, Math.max(backoffMs, Math.round(backoffMs * 0.75)));
      }

      await sleep(backoffMs);
    }
  });
}
