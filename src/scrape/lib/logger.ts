import type { Logger, LoggerContext } from '../types/index.js';

export function loggerContext(prefix: string): LoggerContext {
  const createLogger = (): Logger => {
    return {
      log: (message: string, ...rest: unknown[]): void => {
        console.log(`inf-${prefix} ☕: ${message.trim()}`, ...rest);
      },
      warn: (message: string, ...rest: unknown[]): void => {
        console.warn(`wrn-${prefix} ⚠️: ${message.trim()}`, ...rest);
      },
      error: (message: string, ...rest: unknown[]): void => {
        console.error(`err-${prefix} ❌: ${message.trim()}`, ...rest);
      },
    };
  };

  return {
    withLogger: async <T>(payload: (logger: Logger) => Promise<T>): Promise<T> => {
      return await payload(createLogger());
    },
  };
}
