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
      if (shuttingDown) return;
      logger.debug(`added: ${filePath}`);
      orchestrator.handleStagingEvent({ type: 'add', payload: filePath });
    });

    watcher.on('change', (filePath) => {
      if (shuttingDown) return;
      logger.debug(`changed: ${filePath}`);
      orchestrator.handleStagingEvent({ type: 'change', payload: filePath });
    });

    watcher.on('unlinkDir', (directoryPath) => {
      logger.warn(`removed directory: ${directoryPath}`);
      orchestrator.handleStagingEvent({ type: 'removeDirectory', payload: directoryPath });
    });

    watcher.on('error', (error) => {
      logger.error('watcher error', error);
      shuttingDown = true;
      void shutdown(error);
    });

    const shutdown = async (cause?: unknown) => {
      logger.log('shutting down watcher...');
      await watcher.close();
      await orchestrator.shutdown();
      if (cause) {
        throw cause;
      }
    };

    process.once('SIGINT', () => {
      if (shuttingDown) return;
      shuttingDown = true;
      void shutdown();
    });

    process.once('SIGTERM', () => {
      if (shuttingDown) return;
      shuttingDown = true;
      void shutdown();
    });

    logger.log(`Watching for changes in: ${stripRootPath(stagingDir)}`);
  });
}
