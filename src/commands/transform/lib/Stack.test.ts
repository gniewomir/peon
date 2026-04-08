import { describe, expect, it } from 'vitest';

import { Stack } from './Stack.js';

describe('Stack', () => {
  it('pushes and pops in LIFO order', () => {
    const stack = new Stack<number>();
    stack.push(1);
    stack.push(2);
    stack.push(3);

    expect(stack.pop()).toBe(3);
    expect(stack.pop()).toBe(2);
    expect(stack.pop()).toBe(1);
  });

  it('returns undefined when popping an empty stack', () => {
    const stack = new Stack<string>();

    expect(stack.pop()).toBeUndefined();
  });

  it('peeks at the current top value without removing it', () => {
    const stack = new Stack<string>();
    stack.push('first');
    stack.push('second');

    expect(stack.peek()).toBe('second');
    expect(stack.size()).toBe(2);
  });

  it('tracks size and emptiness as items are added and removed', () => {
    const stack = new Stack<number>();

    expect(stack.isEmpty()).toBe(true);
    expect(stack.size()).toBe(0);

    stack.push(10);
    stack.push(20);

    expect(stack.isEmpty()).toBe(false);
    expect(stack.size()).toBe(2);

    stack.pop();
    stack.pop();

    expect(stack.isEmpty()).toBe(true);
    expect(stack.size()).toBe(0);
  });

  it('keeps latest value at the start', () => {
    const stack = new Stack<number>();
    stack.push(1);
    stack.push(2);
    stack.push(3);

    expect(stack.toArray()).toEqual([3, 2, 1]);
  });
});
