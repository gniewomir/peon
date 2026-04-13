import type { Logger } from './logger.js';

export interface ShutdownContext {
  registerCleanup(cb: () => Promise<void>): void;
  deregisterCleanup(cb: () => Promise<void>): void;
  registerPid(pid: number): void;
  deregisterPid(pid: number): void;
}

const SHUTDOWN_TIMEOUT_MS = 30_000;

export function shutdownContext(logger: Logger): ShutdownContext {
  const cleanups = new Set<() => Promise<void>>();
  const pids = new Set<number>();
  let shuttingDown = false;

  const shutdown = async (signal?: 'SIGINT' | 'SIGTERM'): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    const exitCode = signal === 'SIGINT' ? 130 : 143;

    logger.log('gracefully shutting down...');

    const timeout = setTimeout(() => {
      logger.warn(`shutdown timeout (${SHUTDOWN_TIMEOUT_MS / 1000}s) forcing exit...`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    await Promise.allSettled([...cleanups].map((cb) => cb()));

    clearTimeout(timeout);
    logger.log('cleanup complete');
    process.exit(exitCode);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // NOTE: ONLY sync
  process.on('exit', () => {
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGKILL');
        logger.log(`Sent SIGKILL to pid ${pid}`);
      } catch {
        logger.log(`Pid ${pid} already dead`);
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
  };
}
