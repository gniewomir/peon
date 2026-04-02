import chokidar from 'chokidar';

export interface RunTransformOptions {
  stagingDir: string;
}

export async function runTransform(options: RunTransformOptions): Promise<void> {
  const { stagingDir } = options;
  console.log(`Watching for changes in: ${stagingDir}`);

  const watcher = chokidar.watch(stagingDir, {
    ignoreInitial: true,
    persistent: true,
  });

  watcher.on('add', (filePath) => {
    console.log(`[transform] added: ${filePath}`);
  });

  watcher.on('change', (filePath) => {
    console.log(`[transform] changed: ${filePath}`);
  });

  watcher.on('all', (eventName, filePath) => {
    console.log(`[transform] ${eventName}: ${filePath}`);
  });

  watcher.on('error', (error) => {
    console.error('[transform] watcher error:', error);
  });

  await new Promise<void>((resolve, reject) => {
    const shutdown = async () => {
      console.log('\n[transform] shutting down watcher...');
      try {
        await watcher.close();
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
  });
}
