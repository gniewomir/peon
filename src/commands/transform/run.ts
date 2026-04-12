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

export async function runTransform({
  stagingDir,
  logger,
}: {
  stagingDir: string;
  logger: Logger;
}): Promise<void> {
  let shuttingDown = false;

  const orchestrator = new StageOrchestrator({
    logger,
    stagingDir,
    stages: [
      new CleanJsonStage({
        logger,
        stagingDir,
        transformations: CleanJsonStage.transformations(),
      }),
      new HtmlToJsonStage({
        logger,
        stagingDir,
        transformations: HtmlToJsonStage.transformations(),
      }),
      new CleanMetaStage({
        logger,
        stagingDir,
        transformations: CleanMetaStage.transformations(),
      }),
      new CleanHtmlStage({
        logger,
        stagingDir,
        transformations: CleanHtmlStage.transformations(),
      }),
      new HtmlToMdStage({
        logger,
        stagingDir,
        transformations: HtmlToMdStage.transformations(),
      }),
      new LlmStage({
        logger,
        stagingDir,
        transformations: LlmStage.transformations(),
      }),
    ],
  });
  const watcher = chokidar.watch(stagingDir, {
    ignoreInitial: false,
    persistent: true,
  });

  watcher.on('add', (filePath) => {
    logger.debug(`added: ${stripRoot(filePath)}`);
    orchestrator.handleStagingEvent({ type: 'add', payload: filePath });
  });

  watcher.on('change', (filePath) => {
    logger.debug(`changed: ${stripRoot(filePath)}`);
    orchestrator.handleStagingEvent({ type: 'change', payload: filePath });
  });

  watcher.on('error', (error) => {
    shutdown(undefined, error);
  });

  const shutdown = (signal?: 'SIGINT' | 'SIGTERM', cause?: unknown) => {
    if (shuttingDown) return;
    if (cause) {
      logger.error('shutting down because of error', cause);
    }
    logger.log('gracefully shutting down...');
    shuttingDown = true;
    const exitCode = signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 0;
    const timeout = setTimeout(() => {
      logger.warn('shutdown timeout (30s) forcing exit...');
      process.exit(1);
    }, 1000 * 30);
    watcher
      .close()
      .then(() => orchestrator.shutdown())
      .then(() => {
        clearTimeout(timeout);
        logger.log('cleanup complete');
        process.exit(exitCode);
      });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  logger.log(`Watching for changes in: ${stripRoot(stagingDir)}`);
}
