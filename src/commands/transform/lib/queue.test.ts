import { describe, expect, it } from 'vitest';

import { Queue } from './queue.js';

describe('Queue', () => {
  it('enqueues and dequeues in FIFO order', () => {
    const queue = new Queue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    expect(queue.dequeue()).toBe(1);
    expect(queue.dequeue()).toBe(2);
    expect(queue.dequeue()).toBe(3);
  });

  it('returns undefined when dequeuing an empty queue', () => {
    const queue = new Queue<string>();

    expect(queue.dequeue()).toBeUndefined();
  });

  it('peeks at the next value without removing it', () => {
    const queue = new Queue<string>();
    queue.enqueue('first');
    queue.enqueue('second');

    expect(queue.peek()).toBe('first');
    expect(queue.size()).toBe(2);
  });

  it('tracks size and emptiness as items are added and removed', () => {
    const queue = new Queue<number>();

    expect(queue.isEmpty()).toBe(true);
    expect(queue.size()).toBe(0);

    queue.enqueue(10);
    queue.enqueue(20);

    expect(queue.isEmpty()).toBe(false);
    expect(queue.size()).toBe(2);

    queue.dequeue();
    queue.dequeue();

    expect(queue.isEmpty()).toBe(true);
    expect(queue.size()).toBe(0);
  });

  it('keeps insertion order in array view', () => {
    const queue = new Queue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    expect(queue.toArray()).toEqual([1, 2, 3]);
  });

  it('supports append and shift aliases', () => {
    const queue = new Queue<number>();
    queue.append(1);
    queue.append(2);

    expect(queue.shift()).toBe(1);
    expect(queue.shift()).toBe(2);
  });
});
