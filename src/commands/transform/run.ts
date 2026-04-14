import 'dotenv/config';

import chokidar from 'chokidar';
import { type Logger } from '../../lib/logger.js';
import { stripRoot } from '../../lib/root.js';
import { StageOrchestrator } from './stage/StageOrchestrator.js';
import { CleanHtmlToJsonStage } from './stage/stage-clean-html-to-json/CleanHtmlToJsonStage.js';
import { CleanMetaStage } from './stage/stage-clean-meta/CleanMetaStage.js';
import { CleanJsonStage } from './stage/stage-clean-job-json/CleanJsonStage.js';
import { CleanHtmlStage } from './stage/stage-clean-html/CleanHtmlStage.js';
import { CleanHtmlToMdStage } from './stage/stage-clean-html-to-md/CleanHtmlToMdStage.js';
import { EnrichLlmStage } from './stage/stage-enrich-llm/EnrichLlmStage.js';
import { stats, statsAddToCounter, statsContext } from '../../lib/stats.js';
import { shutdownContext } from '../../lib/shutdown.js';
import { InMemoryDirectoryTracker } from './stage/InMemoryDirectoryTracker.js';

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
  const shutdownCtx = shutdownContext(logger);
  const inMemoryDirectoryTracker = new InMemoryDirectoryTracker(5000);
  return statsCtx.withStats(async () => {
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
        new EnrichLlmStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: EnrichLlmStage.transformations(),
          inMemoryDirectoryTracker,
        }),
      ],
    });
    shutdownCtx.registerCleanup(() => orchestrator.shutdown());

    const watcher = chokidar.watch(stagingDir, {
      ignoreInitial: false,
      persistent: true,
      ignored: (val) => val.includes('.DS_Store') || val.includes('error.json'),
    });
    shutdownCtx.registerCleanup(() => watcher.close());

    watcher.on('add', (filePath) => {
      try {
        statsAddToCounter('watcher_add_event');
        logger.debug(`added: ${stripRoot(filePath)}`);
        orchestrator.handleStagingEvent({ type: 'add', payload: filePath });
      } catch (error) {
        logger.error(`error: ${error}`);
      }
    });

    watcher.on('change', (filePath) => {
      try {
        statsAddToCounter('watcher_change_event');
        logger.debug(`changed: ${stripRoot(filePath)}`);
        orchestrator.handleStagingEvent({ type: 'change', payload: filePath });
      } catch (error) {
        logger.error(`error: ${error}`);
      }
    });

    watcher.on('error', (error) => {
      statsAddToCounter('watcher_error_event');
      logger.error(`error: ${error}`);
    });

    logger.log(`Watching for changes in: ${stripRoot(stagingDir)}`);

    /**
     * Keeps process alive until terminated.
     */
    await new Promise(() =>
      setInterval(
        () => {
          logger.log(` 📊 Stats: ${JSON.stringify(stats())}`);
        },
        1000 * 60 * 1,
      ),
    );
  });
}
