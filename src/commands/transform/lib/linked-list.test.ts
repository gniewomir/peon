import { describe, expect, it } from 'vitest';

import { LinkedList } from './linked-list.js';

describe('LinkedList', () => {
  it('appends values in order', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);
    list.append(3);

    expect(list.toArray()).toEqual([1, 2, 3]);
  });

  it('prepends values to the front', () => {
    const list = new LinkedList<number>();
    list.append(2);
    list.prepend(1);

    expect(list.toArray()).toEqual([1, 2]);
  });

  it('removes the first matching value', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);
    list.append(2);
    list.append(3);

    expect(list.remove(2)).toBe(true);
    expect(list.toArray()).toEqual([1, 2, 3]);
  });

  it('returns false when removing a missing value', () => {
    const list = new LinkedList<number>();
    list.append(1);

    expect(list.remove(99)).toBe(false);
    expect(list.toArray()).toEqual([1]);
  });

  it('supports removing the head value', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);

    expect(list.remove(1)).toBe(true);
    expect(list.toArray()).toEqual([2]);
  });

  it('seeks node using predicate', () => {
    const list = new LinkedList<number>();
    list.append(10);
    list.append(20);
    list.append(30);

    const node = list.seek((value, _node, index) => value > 15 && index === 1);
    expect(node?.value).toBe(20);
  });

  it('returns null when seek predicate does not match', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);

    expect(list.seek((value) => value === 999)).toBeNull();
  });

  it('shifts first value and removes it from list', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);
    list.append(3);

    expect(list.shift()).toBe(1);
    expect(list.toArray()).toEqual([2, 3]);
  });

  it('returns undefined when shifting an empty list', () => {
    const list = new LinkedList<number>();

    expect(list.shift()).toBeUndefined();
  });
});
