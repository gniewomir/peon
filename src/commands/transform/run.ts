import chokidar from 'chokidar';
import { Queue } from './lib/queue.js';
import { loggerContext } from '../lib/logger.js';
import type { Logger } from '../types/Logger.js';
import type { StagingFileEvent } from './types.js';
import { createRegistry } from './stage/index.js';
import type { StagesRegistry } from './stage/StagesRegistry.js';

async function consumer({
  logger,
  enabled,
  buffer,
  registry,
  delay = 200,
}: {
  logger: Logger;
  stagingDir: string;
  enabled: () => boolean;
  buffer: Queue<StagingFileEvent>;
  registry: StagesRegistry;
  delay?: number;
}): Promise<void> {
  while (enabled() || !buffer.isEmpty()) {
    const event = buffer.shift();
    if (!event) {
      logger.warn(`no buffered events, waiting ${delay}ms`);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
      continue;
    }
    void registry.handleStagingEvent(event);
  }
}

export async function runTransform(options: { stagingDir: string }): Promise<void> {
  const { stagingDir } = options;
  const { withLogger } = loggerContext('transform');
  const buffer = new Queue<StagingFileEvent>();
  let listen = true;
  const watcher = chokidar.watch(stagingDir, {
    ignoreInitial: false,
    persistent: true,
  });

  await withLogger(async (logger) => {
    watcher.on('add', (filePath) => {
      console.log(`added: ${filePath}`);
      if (listen) buffer.append({ type: 'add', payload: filePath });
    });

    watcher.on('change', (filePath) => {
      logger.log(`changed: ${filePath}`);
      if (listen) buffer.append({ type: 'change', payload: filePath });
    });

    watcher.on('error', (error) => {
      throw error;
    });

    await new Promise<void>((resolve, reject) => {
      const drain = consumer({
        logger,
        stagingDir,
        enabled: () => listen,
        buffer,
        registry: createRegistry({
          logger,
          stagingDir,
        }),
      });

      const shutdown = async () => {
        logger.log('shutting down watcher...');
        listen = false;
        try {
          await watcher.close();
          await drain;
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      process.once('SIGINT', () => {
        void shutdown();
      });

      process.once('SIGTERM', () => {
        void shutdown();
      });

      logger.log(`Watching for changes in: ${stagingDir}`);
    });
  });
}
