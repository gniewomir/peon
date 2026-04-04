import type { Logger, LoggerContext } from '../types/Logger.js';

export function loggerContext(prefix: string): LoggerContext {
  const createLogger = (currentPrefix: string): Logger => {
    return {
      withSuffix: (suffix: string): Logger => {
        const trimmedSuffix = suffix.trim().replace(/(^-+)|(-+$)/g, '');

        if (trimmedSuffix.length === 0) {
          return createLogger(currentPrefix);
        }

        return createLogger(`${currentPrefix}-${trimmedSuffix}`);
      },
      debug: (message: string, ...rest: unknown[]): void => {
        console.debug(`${currentPrefix}-dbg 🐛: ${message.trim()}`, ...rest);
      },
      log: (message: string, ...rest: unknown[]): void => {
        console.log(`${currentPrefix}-inf ☕: ${message.trim()}`, ...rest);
      },
      warn: (message: string, ...rest: unknown[]): void => {
        console.warn(`${currentPrefix}-wrn ⚠️: ${message.trim()}`, ...rest);
      },
      error: (message: string, ...rest: unknown[]): void => {
        console.error(`${currentPrefix}-err ❌: ${message.trim()}`, ...rest);
      },
    };
  };

  return {
    withLogger: async <T>(payload: (logger: Logger) => Promise<T>): Promise<T> => {
      return await payload(createLogger(prefix));
    },
  };
}
