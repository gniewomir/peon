import type { Logger } from './logger.js';

export interface ShutdownContext {
  registerCleanup(cb: () => Promise<void>): void;
  deregisterCleanup(cb: () => Promise<void>): void;
  registerPid(pid: number): void;
  deregisterPid(pid: number): void;
  [Symbol.asyncDispose]: () => Promise<void>;
}

const SHUTDOWN_TIMEOUT_MS = 30_000;

export function shutdownContext(logger: Logger): ShutdownContext {
  const cleanups = new Set<() => Promise<void>>();
  const pids = new Set<number>();
  let shuttingDown = false;

  const shutdown = async (signal?: 'SIGINT' | 'SIGTERM'): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (signal) {
      logger.log(` 🔪 Received signal ${signal}`);
    }

    logger.log(' 🧹 Cleaning up...');

    const timeout = setTimeout(() => {
      logger.warn(` 🔪 Cleanup timeout (${SHUTDOWN_TIMEOUT_MS / 1000}s). Forcing exit...`);
      const exitCode = 1;
      logger.warn(` 🔪 Exiting with non-zero exit code ${exitCode}`);
      process.exit(exitCode);
    }, SHUTDOWN_TIMEOUT_MS);

    await Promise.allSettled([...cleanups].map((cb) => cb()));

    logger.log(' 🧹 Cleanup complete.');

    clearTimeout(timeout);
    const exitCode = {
      SIGINT: 130,
      SIGTERM: 143,
      NONE: 0,
    }[signal || 'NONE'];

    if (exitCode !== 0) {
      logger.warn(` 🔪 Exiting with non-zero exit code ${exitCode}`);
      process.exit(exitCode);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // NOTE: ONLY sync
  process.on('exit', () => {
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGKILL');
        logger.log(` 🔪 Sent SIGKILL to pid ${pid}`);
      } catch {
        logger.log(` 🔪 Pid ${pid} already dead`);
        // PID already dead — ignore
      }
    }
  });

  return {
    registerCleanup(cb) {
      cleanups.add(cb);
    },
    deregisterCleanup(cb) {
      cleanups.delete(cb);
    },
    registerPid(pid) {
      pids.add(pid);
    },
    deregisterPid(pid) {
      pids.delete(pid);
    },
    [Symbol.asyncDispose]() {
      return shutdown();
    },
  };
}
