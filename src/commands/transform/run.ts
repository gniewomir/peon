import chokidar from 'chokidar';
import { Queue } from './lib/Queue.js';
import { loggerContext } from '../lib/logger.js';
import type { Logger } from '../types/Logger.js';
import type { StagingFileEvent } from './types.js';
import { createStageRegistry } from './stage/lib.stage/createStageRegistry.js';
import { LinkedList } from './lib/LinkedList.js';
import { stripRootPath } from '../../root.js';
import type { StageRegistry } from './stage/lib.stage/StageRegistry.js';

async function consumer({
  logger,
  buffer,
  registry,
  delay = 500,
  shutdown,
}: {
  logger: Logger;
  stagingDir: string;
  shutdown: () => boolean;
  buffer: Queue<StagingFileEvent>;
  registry: StageRegistry;
  delay?: number;
}): Promise<void> {
  const running = new LinkedList<Promise<unknown>>();
  while (!shutdown() || !buffer.isEmpty()) {
    const event = buffer.dequeue();
    if (!event) {
      logger.debug(`no buffered events, waiting ${delay}ms`);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
      continue;
    }
    const tracked = registry
      .handleStagingEvent(event)
      .catch((error) => {
        logger.error(`failed to process ${event.payload}`, error);
      })
      .finally(() => {
        running.remove(tracked);
      });
    running.append(tracked);
  }
  await Promise.allSettled(running.toArray());
}

export async function runTransform(options: {
  stagingDir: string;
  verbose: boolean;
}): Promise<void> {
  const { stagingDir, verbose } = options;
  const { withLogger } = loggerContext({ prefix: 'transform', verbose });
  const buffer = new Queue<StagingFileEvent>();
  const watcher = chokidar.watch(stagingDir, {
    ignoreInitial: false,
    persistent: true,
  });

  await withLogger(async (logger) => {
    let shuttingDown = false;

    await new Promise<void>((resolve, reject) => {
      watcher.on('add', (filePath) => {
        if (shuttingDown) return;
        logger.debug(`added: ${filePath}`);
        buffer.enqueue({ type: 'add', payload: filePath });
      });

      watcher.on('change', (filePath) => {
        if (shuttingDown) return;
        logger.debug(`changed: ${filePath}`);
        buffer.enqueue({ type: 'change', payload: filePath });
      });

      watcher.on('error', (error) => {
        if (shuttingDown) return;
        logger.error('error watching staging directory', error);
        shuttingDown = true;
        void shutdown(error);
      });

      const drain = consumer({
        logger,
        stagingDir,
        shutdown: () => shuttingDown,
        buffer,
        registry: createStageRegistry({
          logger,
          stagingDir,
        }),
      });

      const shutdown = async (cause?: unknown) => {
        logger.log('shutting down watcher...');

        try {
          await watcher.close();
          await drain;
          if (cause !== undefined) {
            reject(cause);
            return;
          }
          resolve();
        } catch (error) {
          reject(error);
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
  });
}
