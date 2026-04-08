export interface ILogger {
  withSuffix(suffix: string): ILogger;
  debug(message: string, ...args: unknown[]): void;
  log(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface LoggerContext {
  withLogger<T>(payload: (logger: ILogger) => Promise<T>): Promise<T>;
}

export function loggerContext({
  prefix,
  verbose = false,
}: {
  prefix: string;
  verbose?: boolean;
}): LoggerContext {
  const createLogger = (currentPrefix: string): ILogger => {
    return {
      withSuffix: (suffix: string): ILogger => {
        const trimmedSuffix = suffix.trim().replace(/(^-+)|(-+$)/g, '');

        if (trimmedSuffix.length === 0) {
          return createLogger(currentPrefix);
        }

        return createLogger(`${currentPrefix}-${trimmedSuffix}`);
      },
      debug: (message: string, ...rest: unknown[]): void => {
        if (!verbose) {
          return;
        }
        console.debug(`[${currentPrefix}-dbg] 🐛: ${message.trim()}`, ...rest);
      },
      log: (message: string, ...rest: unknown[]): void => {
        console.log(`[${currentPrefix}-inf] ☕: ${message.trim()}`, ...rest);
      },
      warn: (message: string, ...rest: unknown[]): void => {
        console.warn(`[${currentPrefix}-wrn] ⚠️: ${message.trim()}`, ...rest);
      },
      error: (message: string, ...rest: unknown[]): void => {
        console.error(`[${currentPrefix}-err] ❌: ${message.trim()}`, ...rest);
      },
    };
  };

  return {
    withLogger: async <T>(payload: (logger: ILogger) => Promise<T>): Promise<T> => {
      return await payload(createLogger(prefix));
    },
  };
}
