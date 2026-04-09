import { describe, expect, it } from 'vitest';

import { JsonNavigator } from './JsonNavigator.js';

const fixture = {
  name: 'Alice',
  age: 30,
  active: true,
  address: {
    city: 'Berlin',
    zip: 10115,
    geo: {
      lat: 52.52,
      lng: 13.405,
    },
  },
  tags: ['admin', 'editor'],
  scores: [100, 200, 300],
  nested: {
    items: [
      { id: 1, label: 'first' },
      { id: 2, label: 'second' },
    ],
  },
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: 1705312200000,
  empty: null,
};

describe('JsonNavigator', () => {
  describe('value', () => {
    it('returns the raw value at root', () => {
      const nav = new JsonNavigator(fixture);

      expect(nav.value()).toBe(fixture);
    });

    it('returns primitive values', () => {
      expect(new JsonNavigator(42).value()).toBe(42);
      expect(new JsonNavigator('hello').value()).toBe('hello');
      expect(new JsonNavigator(null).value()).toBe(null);
    });
  });

  describe('getPath', () => {
    it('navigates to a top-level key', () => {
      const nav = new JsonNavigator(fixture);

      expect(nav.getPath('name').value()).toBe('Alice');
    });

    it('navigates to a nested key with dot notation', () => {
      const nav = new JsonNavigator(fixture);

      expect(nav.getPath('address.city').value()).toBe('Berlin');
    });

    it('navigates to deeply nested keys', () => {
      const nav = new JsonNavigator(fixture);

      expect(nav.getPath('address.geo.lat').value()).toBe(52.52);
    });

    it('navigates into arrays by index', () => {
      const nav = new JsonNavigator(fixture);

      expect(nav.getPath('tags.0').value()).toBe('admin');
      expect(nav.getPath('tags.1').value()).toBe('editor');
    });

    it('navigates into nested arrays then into objects', () => {
      const nav = new JsonNavigator(fixture);

      expect(nav.getPath('nested.items.0.label').value()).toBe('first');
      expect(nav.getPath('nested.items.1.id').value()).toBe(2);
    });

    it('returns a new JsonNavigator that can be further navigated', () => {
      const nav = new JsonNavigator(fixture);
      const address = nav.getPath('address');

      expect(address.getPath('city').value()).toBe('Berlin');
      expect(address.getPath('geo').getPath('lng').value()).toBe(13.405);
    });

    it('throws on empty path', () => {
      const nav = new JsonNavigator(fixture);

      expect(() => nav.getPath('')).toThrow('getPath requires a non-empty path');
    });

    it('throws on missing key', () => {
      const nav = new JsonNavigator(fixture);

      expect(() => nav.getPath('nonexistent')).toThrow('No entry at path "nonexistent"');
    });

    it('throws on missing nested key', () => {
      const nav = new JsonNavigator(fixture);

      expect(() => nav.getPath('address.country')).toThrow('No entry at path "country"');
    });

    it('throws when navigating through a primitive', () => {
      const nav = new JsonNavigator(fixture);

      expect(() => nav.getPath('name.length')).toThrow(/No entry at path/);
    });

    it('throws when navigating through null', () => {
      const nav = new JsonNavigator(fixture);

      expect(() => nav.getPath('empty.key')).toThrow(/No entry at path/);
    });
  });

  describe('getOptionalPath', () => {
    it('returns a JsonNavigator when path exists', () => {
      const nav = new JsonNavigator(fixture);
      const result = nav.getOptionalPath('name');

      expect(result).toBeDefined();
      expect(result!.value()).toBe('Alice');
    });

    it('returns undefined when path does not exist', () => {
      const nav = new JsonNavigator(fixture);

      expect(nav.getOptionalPath('nonexistent')).toBeUndefined();
    });

    it('returns undefined for missing nested path', () => {
      const nav = new JsonNavigator(fixture);

      expect(nav.getOptionalPath('address.country')).toBeUndefined();
    });

    it('throws on empty path', () => {
      const nav = new JsonNavigator(fixture);

      expect(() => nav.getOptionalPath('')).toThrow('getOptionalPath requires a non-empty path');
    });
  });

  describe('toString', () => {
    it('returns the string value', () => {
      const nav = new JsonNavigator(fixture).getPath('name');

      expect(nav.toString()).toBe('Alice');
    });

    it('throws when value is not a string', () => {
      const nav = new JsonNavigator(fixture).getPath('age');

      expect(() => nav.toString()).toThrow('Expected string, got number');
    });

    it('throws for null', () => {
      const nav = new JsonNavigator(null);

      expect(() => nav.toString()).toThrow('Expected string, got object');
    });
  });

  describe('toNumber', () => {
    it('returns the number value', () => {
      const nav = new JsonNavigator(fixture).getPath('age');

      expect(nav.toNumber()).toBe(30);
    });

    it('throws when value is not a number', () => {
      const nav = new JsonNavigator(fixture).getPath('name');

      expect(() => nav.toNumber()).toThrow('Expected number, got string');
    });
  });

  describe('toBool', () => {
    it('returns the boolean value', () => {
      const nav = new JsonNavigator(fixture).getPath('active');

      expect(nav.toBool()).toBe(true);
    });

    it('throws when value is not a boolean', () => {
      const nav = new JsonNavigator(fixture).getPath('name');

      expect(() => nav.toBool()).toThrow('Expected boolean, got string');
    });
  });

  describe('toArray', () => {
    it('returns an array of JsonNavigators', () => {
      const nav = new JsonNavigator(fixture).getPath('tags');
      const items = nav.toArray();

      expect(items).toHaveLength(2);
      expect(items[0].toString()).toBe('admin');
      expect(items[1].toString()).toBe('editor');
    });

    it('returns navigators that can be further traversed', () => {
      const nav = new JsonNavigator(fixture).getPath('nested.items');
      const items = nav.toArray();

      expect(items[0].getPath('label').toString()).toBe('first');
      expect(items[1].getPath('id').toNumber()).toBe(2);
    });

    it('returns empty array for empty input', () => {
      const nav = new JsonNavigator([]);

      expect(nav.toArray()).toHaveLength(0);
    });

    it('throws when value is not an array', () => {
      const nav = new JsonNavigator(fixture).getPath('name');

      expect(() => nav.toArray()).toThrow('Expected array, got string');
    });

    it('throws for objects', () => {
      const nav = new JsonNavigator(fixture).getPath('address');

      expect(() => nav.toArray()).toThrow('Expected array, got object');
    });
  });

  describe('toDateFromString', () => {
    it('parses a date from a string value', () => {
      const nav = new JsonNavigator(fixture).getPath('createdAt');
      const date = nav.toDateFromString();

      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('throws when value is not a string', () => {
      const nav = new JsonNavigator(fixture).getPath('age');

      expect(() => nav.toDateFromString()).toThrow('Expected date string, got number');
    });
  });

  describe('toDateFromTimestamp', () => {
    it('parses a date from a numeric timestamp', () => {
      const nav = new JsonNavigator(fixture).getPath('updatedAt');
      const date = nav.toDateFromTimestamp();

      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBe(1705312200000);
    });

    it('throws when value is not a number', () => {
      const nav = new JsonNavigator(fixture).getPath('name');

      expect(() => nav.toDateFromTimestamp()).toThrow('Expected numeric timestamp, got string');
    });
  });

  describe('error messages include path context', () => {
    it('includes root path in errors from navigated children', () => {
      const nav = new JsonNavigator(fixture).getPath('address');

      expect(() => nav.toString()).toThrow('[JsonNavigator at "address"]');
    });

    it('includes full dotted path for deeply navigated children', () => {
      const nav = new JsonNavigator(fixture).getPath('address').getPath('geo');

      expect(() => nav.toString()).toThrow('[JsonNavigator at "address.geo"]');
    });

    it('omits path prefix at root level', () => {
      const nav = new JsonNavigator(42);

      expect(() => nav.toString()).toThrow('[JsonNavigator] Expected string, got number');
    });

    it('includes path context in getPath errors', () => {
      const nav = new JsonNavigator(fixture).getPath('address');

      expect(() => nav.getPath('missing')).toThrow(
        '[JsonNavigator at "address"] No entry at path "address.missing"',
      );
    });
  });

  describe('custom rootPath', () => {
    it('uses the provided rootPath in error messages', () => {
      const nav = new JsonNavigator(42, 'data.response');

      expect(() => nav.toString()).toThrow(
        '[JsonNavigator at "data.response"] Expected string, got number',
      );
    });

    it('appends navigated segments to the custom rootPath', () => {
      const nav = new JsonNavigator(fixture, 'root').getPath('address');

      expect(() => nav.getPath('missing')).toThrow('No entry at path "root.address.missing"');
    });
  });

  describe('edge cases', () => {
    it('handles array at root level', () => {
      const nav = new JsonNavigator(['a', 'b', 'c']);
      const items = nav.toArray();

      expect(items).toHaveLength(3);
      expect(items[2].toString()).toBe('c');
    });

    it('handles numeric string keys on objects', () => {
      const data = { '0': 'zero', '1': 'one' };
      const nav = new JsonNavigator(data);

      expect(nav.getPath('0').toString()).toBe('zero');
    });

    it('returns undefined for out-of-bounds array index', () => {
      const nav = new JsonNavigator(fixture);

      expect(nav.getPath('tags.5').value()).toBeUndefined();
    });

    it('maps toArray indices correctly in child paths', () => {
      const nav = new JsonNavigator(fixture).getPath('scores');
      const items = nav.toArray();

      expect(() => items[0].toString()).toThrow(
        '[JsonNavigator at "scores.0"] Expected string, got number',
      );
    });
  });
});
