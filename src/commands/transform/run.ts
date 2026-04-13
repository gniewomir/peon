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
import { statsAddToCounter, statsContext } from '../../lib/stats.js';
import { shutdownContext } from '../../lib/shutdown.js';

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
  await statsCtx.withStats(async () => {
    const orchestrator = new StageOrchestrator({
      logger,
      stagingDir,
      quarantineDir,
      trashDir,
      loadDir,
      stages: [
        new CleanJsonStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: CleanJsonStage.transformations(),
        }),
        new HtmlToJsonStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: HtmlToJsonStage.transformations(),
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
        new HtmlToMdStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: HtmlToMdStage.transformations(),
        }),
        new LlmStage({
          logger,
          stagingDir,
          trashDir,
          loadDir,
          transformations: LlmStage.transformations(),
        }),
      ],
    });
    shutdownCtx.registerCleanup(() => orchestrator.shutdown());

    const watcher = chokidar.watch(stagingDir, {
      ignoreInitial: false,
      persistent: true,
      ignored: (file) =>
        !file.endsWith('.md') && !file.endsWith('.json') && !file.endsWith('.html'),
    });
    shutdownCtx.registerCleanup(() => watcher.close());

    watcher.on('add', (filePath) => {
      statsAddToCounter('watcher_add_events');
      logger.debug(`added: ${stripRoot(filePath)}`);
      orchestrator.handleStagingEvent({ type: 'add', payload: filePath });
    });

    watcher.on('change', (filePath) => {
      statsAddToCounter('watcher_change_events');
      logger.debug(`changed: ${stripRoot(filePath)}`);
      orchestrator.handleStagingEvent({ type: 'change', payload: filePath });
    });

    watcher.on('error', (error) => {
      statsAddToCounter('watcher_error_events');
      logger.error(`error: ${error}`);
    });

    logger.log(`Watching for changes in: ${stripRoot(stagingDir)}`);

    await new Promise(() => {});
  });
}
