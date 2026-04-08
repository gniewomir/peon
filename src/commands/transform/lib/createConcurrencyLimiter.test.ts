import { describe, expect, it } from 'vitest';

import { createConcurrencyLimiter } from './limiter.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('createConcurrencyLimiter', () => {
  it('limits how many tasks run at once', async () => {
    const limiter = createConcurrencyLimiter(2);
    let currentlyRunning = 0;
    let maxRunning = 0;

    const makeTask = (ms: number) =>
      limiter.run(async () => {
        currentlyRunning += 1;
        maxRunning = Math.max(maxRunning, currentlyRunning);
        await wait(ms);
        currentlyRunning -= 1;
        return ms;
      });

    const results = await Promise.all([makeTask(25), makeTask(25), makeTask(25), makeTask(25)]);

    expect(results).toEqual([25, 25, 25, 25]);
    expect(maxRunning).toBe(2);
  });

  it('resolves each promise with its own task output', async () => {
    const limiter = createConcurrencyLimiter(1);

    const promises = [
      limiter.run(async () => 'first'),
      limiter.run(async () => 'second'),
      limiter.run(async () => 'third'),
    ];

    await expect(Promise.all(promises)).resolves.toEqual(['first', 'second', 'third']);
  });

  it('continues processing queued tasks after a rejection', async () => {
    const limiter = createConcurrencyLimiter(1);

    const first = limiter.run(async () => {
      throw new Error('boom');
    });
    const second = limiter.run(async () => 'still runs');

    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe('still runs');
  });

  it('throws for invalid concurrency values', () => {
    expect(() => createConcurrencyLimiter(0)).toThrow();
    expect(() => createConcurrencyLimiter(-1)).toThrow();
    expect(() => createConcurrencyLimiter(1.5)).toThrow();
  });

  it('exposes current active and pending task counts', async () => {
    const limiter = createConcurrencyLimiter(1);

    const first = limiter.run(async () => {
      await wait(30);
    });
    const second = limiter.run(async () => {
      await wait(1);
    });

    expect(limiter.activeCount()).toBe(1);
    expect(limiter.pendingCount()).toBe(1);

    await Promise.all([first, second]);

    expect(limiter.activeCount()).toBe(0);
    expect(limiter.pendingCount()).toBe(0);
  });
});
