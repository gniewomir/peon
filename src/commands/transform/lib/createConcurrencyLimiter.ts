type AsyncTask<T> = () => Promise<T>;
import { Queue } from './Queue.js';

export interface ConcurrencyLimiter {
  run<T>(task: AsyncTask<T>): Promise<T>;
  activeCount(): number;
  pendingCount(): number;
}

export function createConcurrencyLimiter(concurrency: number): ConcurrencyLimiter {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('Concurrency must be an integer >= 1');
  }

  let active = 0;
  const queue = new Queue<() => void>();

  const schedule = (): void => {
    if (active >= concurrency) {
      return;
    }

    const startTask = queue.dequeue();
    if (!startTask) {
      return;
    }

    active += 1;
    startTask();
  };

  const run = <T>(task: AsyncTask<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.enqueue(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            schedule();
          });
      });

      schedule();
    });

  return {
    run,
    activeCount: () => active,
    pendingCount: () => queue.size(),
  };
}
