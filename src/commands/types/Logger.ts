export interface Logger {
  withSuffix(suffix: string): Logger;
  debug(message: string, ...args: unknown[]): void;
  log(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface LoggerContext {
  withLogger<T>(payload: (logger: Logger) => Promise<T>): Promise<T>;
}
