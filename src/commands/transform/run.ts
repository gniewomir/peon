import 'dotenv/config';

import chokidar from 'chokidar';
import { loggerContext } from '../lib/logger.js';
import { createStageOrchestrator } from './stage/lib.stage/createStageOrchestrator.js';
import { stripRootPath } from '../../root.js';

export async function runTransform(options: {
  stagingDir: string;
  verbose: boolean;
}): Promise<void> {
  const { stagingDir, verbose } = options;
  let shuttingDown = false;
  const { withLogger } = loggerContext({ prefix: 'transform', verbose });

  return withLogger(async (logger) => {
    const orchestrator = createStageOrchestrator({
      logger,
      stagingDir,
    });
    const watcher = chokidar.watch(stagingDir, {
      ignoreInitial: false,
      persistent: true,
    });

    watcher.on('add', (filePath) => {
      logger.debug(`added: ${filePath}`);
      orchestrator.handleStagingEvent({ type: 'add', payload: filePath });
    });

    watcher.on('change', (filePath) => {
      logger.debug(`changed: ${filePath}`);
      orchestrator.handleStagingEvent({ type: 'change', payload: filePath });
    });

    watcher.on('error', (error) => {
      shutdown(error);
    });

    const shutdown = (cause?: unknown) => {
      if (shuttingDown) return;
      if (cause) {
        logger.error('shutting down because of error', cause);
      }
      logger.log('gracefully shutting down...');
      shuttingDown = true;
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
          process.exit(0);
        });
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

    logger.log(`Watching for changes in: ${stripRootPath(stagingDir)}`);
  });
}
