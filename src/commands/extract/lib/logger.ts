import type { Logger, LoggerContext } from '../types/index.js';

export function loggerContext(prefix: string): LoggerContext {
  const createLogger = (): Logger => {
    return {
      log: (message: string, ...rest: unknown[]): void => {
        console.log(`${prefix}-inf ☕: ${message.trim()}`, ...rest);
      },
      warn: (message: string, ...rest: unknown[]): void => {
        console.warn(`${prefix}-wrn ⚠️: ${message.trim()}`, ...rest);
      },
      error: (message: string, ...rest: unknown[]): void => {
        console.error(`${prefix}-err ❌: ${message.trim()}`, ...rest);
      },
    };
  };

  return {
    withLogger: async <T>(payload: (logger: Logger) => Promise<T>): Promise<T> => {
      return await payload(createLogger());
    },
  };
}
