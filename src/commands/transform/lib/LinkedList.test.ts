import { describe, expect, it } from 'vitest';

import { LinkedList } from './linked-list.js';

describe('LinkedList', () => {
  it('starts with size zero', () => {
    const list = new LinkedList<number>();

    expect(list.size).toBe(0);
  });

  it('appends values in order', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);
    list.append(3);

    expect(list.toArray()).toEqual([1, 2, 3]);
    expect(list.size).toBe(3);
  });

  it('prepends values to the front', () => {
    const list = new LinkedList<number>();
    list.append(2);
    list.prepend(1);

    expect(list.toArray()).toEqual([1, 2]);
    expect(list.size).toBe(2);
  });

  it('removes the first matching value', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);
    list.append(2);
    list.append(3);

    expect(list.remove(2)).toBe(true);
    expect(list.toArray()).toEqual([1, 2, 3]);
    expect(list.size).toBe(3);
  });

  it('returns false when removing a missing value', () => {
    const list = new LinkedList<number>();
    list.append(1);

    expect(list.remove(99)).toBe(false);
    expect(list.toArray()).toEqual([1]);
    expect(list.size).toBe(1);
  });

  it('supports removing the head value', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);

    expect(list.remove(1)).toBe(true);
    expect(list.toArray()).toEqual([2]);
    expect(list.size).toBe(1);
  });

  it('shifts first value and removes it from list', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);
    list.append(3);

    expect(list.shift()).toBe(1);
    expect(list.toArray()).toEqual([2, 3]);
    expect(list.size).toBe(2);
  });

  it('returns undefined when shifting an empty list', () => {
    const list = new LinkedList<number>();

    expect(list.shift()).toBeUndefined();
    expect(list.size).toBe(0);
  });

  it('shifts the last remaining element and nulls tail', () => {
    const list = new LinkedList<number>();
    list.append(1);

    expect(list.shift()).toBe(1);
    expect(list.toArray()).toEqual([]);
    expect(list.peekHead()).toBeUndefined();
    expect(list.peekTail()).toBeUndefined();
    expect(list.size).toBe(0);
  });

  it('removes the tail element', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);
    list.append(3);

    expect(list.remove(3)).toBe(true);
    expect(list.toArray()).toEqual([1, 2]);
    expect(list.peekTail()).toBe(2);
    expect(list.size).toBe(2);
  });

  it('returns false when removing from an empty list', () => {
    const list = new LinkedList<number>();

    expect(list.remove(1)).toBe(false);
    expect(list.size).toBe(0);
  });

  it('prepends to an empty list', () => {
    const list = new LinkedList<number>();
    list.prepend(1);

    expect(list.toArray()).toEqual([1]);
    expect(list.peekHead()).toBe(1);
    expect(list.peekTail()).toBe(1);
    expect(list.size).toBe(1);
  });

  it('peeks head and tail', () => {
    const list = new LinkedList<number>();

    expect(list.peekHead()).toBeUndefined();
    expect(list.peekTail()).toBeUndefined();

    list.append(1);
    list.append(2);
    list.append(3);

    expect(list.peekHead()).toBe(1);
    expect(list.peekTail()).toBe(3);
  });

  it('is iterable with for...of', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);
    list.append(3);

    const result: number[] = [];
    for (const value of list) {
      result.push(value);
    }

    expect(result).toEqual([1, 2, 3]);
  });

  it('supports spread operator', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);

    expect([...list]).toEqual([1, 2]);
  });

  it('iterates an empty list', () => {
    const list = new LinkedList<number>();

    expect([...list]).toEqual([]);
  });
});
