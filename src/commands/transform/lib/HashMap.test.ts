import { describe, expect, it } from 'vitest';

import { HashMap } from './HashMap.js';

describe('HashMap', () => {
  it('starts empty', () => {
    const map = new HashMap<number>();

    expect(map.size()).toBe(0);
    expect(map.isEmpty()).toBe(true);
  });

  it('sets and gets values by key', () => {
    const map = new HashMap<number>();
    map.set('a', 1);
    map.set('b', 2);

    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBe(2);
    expect(map.size()).toBe(2);
  });

  it('returns undefined for missing keys', () => {
    const map = new HashMap<number>();

    expect(map.get('missing')).toBeUndefined();
  });

  it('overwrites existing keys without changing size', () => {
    const map = new HashMap<string>();
    map.set('key', 'old');
    map.set('key', 'new');

    expect(map.get('key')).toBe('new');
    expect(map.size()).toBe(1);
  });

  it('checks key existence with has', () => {
    const map = new HashMap<number>();
    map.set('present', 42);

    expect(map.has('present')).toBe(true);
    expect(map.has('absent')).toBe(false);
  });

  it('deletes existing keys', () => {
    const map = new HashMap<number>();
    map.set('a', 1);
    map.set('b', 2);

    expect(map.delete('a')).toBe(true);
    expect(map.has('a')).toBe(false);
    expect(map.get('a')).toBeUndefined();
    expect(map.size()).toBe(1);
  });

  it('returns false when deleting a missing key', () => {
    const map = new HashMap<number>();

    expect(map.delete('ghost')).toBe(false);
  });

  it('returns all keys and values', () => {
    const map = new HashMap<number>();
    map.set('x', 10);
    map.set('y', 20);

    expect(map.keys().sort()).toEqual(['x', 'y']);
    expect(map.values().sort()).toEqual([10, 20]);
  });

  it('is iterable with for...of yielding [key, value] tuples', () => {
    const map = new HashMap<number>();
    map.set('a', 1);
    map.set('b', 2);

    const entries: [string, number][] = [];
    for (const entry of map) {
      entries.push(entry);
    }

    expect(entries.sort()).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('converts to array of [key, value] tuples', () => {
    const map = new HashMap<number>();
    map.set('one', 1);
    map.set('two', 2);

    expect(map.toArray().sort()).toEqual([
      ['one', 1],
      ['two', 2],
    ]);
  });

  it('tracks size and emptiness as items are added and removed', () => {
    const map = new HashMap<number>();

    expect(map.isEmpty()).toBe(true);
    expect(map.size()).toBe(0);

    map.set('a', 1);
    map.set('b', 2);

    expect(map.isEmpty()).toBe(false);
    expect(map.size()).toBe(2);

    map.delete('a');
    map.delete('b');

    expect(map.isEmpty()).toBe(true);
    expect(map.size()).toBe(0);
  });

  it('does not collide with Object.prototype properties', () => {
    const map = new HashMap<number>();
    map.set('toString', 1);
    map.set('constructor', 2);
    map.set('hasOwnProperty', 3);

    expect(map.get('toString')).toBe(1);
    expect(map.get('constructor')).toBe(2);
    expect(map.get('hasOwnProperty')).toBe(3);
    expect(map.size()).toBe(3);
  });
});
