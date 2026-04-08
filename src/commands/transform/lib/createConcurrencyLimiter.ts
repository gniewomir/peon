type AsyncTask<T> = () => Promise<T>;
import { LinkedList } from './LinkedList.js';

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
  const queue = new LinkedList<() => void>();
  let queued = 0;

  const enqueue = (task: () => void): void => {
    queue.append(task);
    queued += 1;
  };

  const dequeue = (): (() => void) | undefined => {
    const task = queue.shift();
    if (task !== undefined) {
      queued -= 1;
    }
    return task;
  };

  const schedule = (): void => {
    if (active >= concurrency) {
      return;
    }

    const startTask = dequeue();
    if (!startTask) {
      return;
    }

    active += 1;
    startTask();
  };

  const run = <T>(task: AsyncTask<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      enqueue(() => {
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
    pendingCount: () => queued,
  };
}
