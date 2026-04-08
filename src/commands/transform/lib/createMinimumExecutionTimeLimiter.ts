export function createMinimumExecutionTimeLimiter(minimumMs: number) {
  if (minimumMs < 0) {
    throw new Error('Minimum execution time must be >= 0');
  }

  return async <T>(task: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    const result = await task();
    const elapsed = Date.now() - start;
    const remaining = minimumMs - elapsed;

    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }

    return result;
  };
}
