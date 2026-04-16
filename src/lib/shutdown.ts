import type { Logger } from './logger.js';
import { statsAls } from './stats.js';

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
  const storeReference = statsAls.getStore();

  const shutdown = async (signal?: 'SIGINT' | 'SIGTERM'): Promise<void> => {
    /**
     * We want the shutdown callbacks to have access to the stats ALS store,
     * if shutdown context was created inside stats context
     */
    if (storeReference) {
      statsAls.enterWith(storeReference);
    }

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

    const results = await Promise.allSettled([...cleanups].map((cb) => cb()));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        logger.log(` 🧹 Cleanup callback #${i} succeded`);
      }
      if (r.status === 'rejected') {
        logger.error(` 🧹 Cleanup callback #${i} failed`, { error: r.reason });
      }
    });

    clearTimeout(timeout);

    logger.log(' 🧹 Cleanup complete.');

    const exitCode = {
      SIGINT: 130,
      SIGTERM: 143,
      OK: 0,
    }[signal || 'OK'];

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
