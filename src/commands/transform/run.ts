import 'dotenv/config';

import chokidar from 'chokidar';
import { type Logger } from '../lib/logger.js';
import { stripRoot } from '../../lib/root.js';
import { StageOrchestrator } from './stage/StageOrchestrator.js';
import { HtmlToJsonStage } from './stage/stage-html-to-json/HtmlToJsonStage.js';
import { CleanMetaStage } from './stage/stage-clean-meta/CleanMetaStage.js';
import { CleanJsonStage } from './stage/stage-clean-job-json/CleanJsonStage.js';
import { CleanHtmlStage } from './stage/stage-clean-html/CleanHtmlStage.js';
import { HtmlToMdStage } from './stage/stage-html-to-md/HtmlToMdStage.js';
import { LlmStage } from './stage/stage-llm/LlmStage.js';
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
  const statsCtx = statsContext();
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
        new HtmlToJsonStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: HtmlToJsonStage.transformations(),
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
        new HtmlToMdStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: HtmlToMdStage.transformations(),
          inMemoryDirectoryTracker,
        }),
        new LlmStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: LlmStage.transformations(),
          inMemoryDirectoryTracker,
        }),
      ],
    });
    shutdownCtx.registerCleanup(() => orchestrator.shutdown());

    const watcher = chokidar.watch(stagingDir, {
      ignoreInitial: false,
      persistent: true,
      ignored: (val) => val.includes('.DS_Store'),
    });
    shutdownCtx.registerCleanup(() => watcher.close());

    watcher.on('add', (filePath) => {
      try {
        statsAddToCounter('watcher_add_events');
        logger.debug(`added: ${stripRoot(filePath)}`);
        orchestrator.handleStagingEvent({ type: 'add', payload: filePath });
      } catch (error) {
        logger.error(`error: ${error}`);
      }
    });

    watcher.on('change', (filePath) => {
      try {
        statsAddToCounter('watcher_change_events');
        logger.debug(`changed: ${stripRoot(filePath)}`);
        orchestrator.handleStagingEvent({ type: 'change', payload: filePath });
      } catch (error) {
        logger.error(`error: ${error}`);
      }
    });

    watcher.on('error', (error) => {
      statsAddToCounter('watcher_error_events');
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
