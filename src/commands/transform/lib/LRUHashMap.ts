import { HashMap } from './HashMap.js';
import { LinkedList } from './LinkedList.js';

/**
 * Bounded map: when a new key is inserted beyond capacity, the least recently
 * used key (by get or set) is evicted. Order is tracked with a linked list
 * (head = LRU, tail = MRU).
 */
export class LRUHashMap<V> {
  private readonly map = new HashMap<V>();
  private readonly order = new LinkedList<string>();

  constructor(private readonly maxKeys: number) {
    if (!Number.isInteger(maxKeys) || maxKeys < 0) {
      throw new RangeError('maxKeys must be a non-negative integer');
    }
  }

  capacity(): number {
    return this.maxKeys;
  }

  set(key: string, value: V): void {
    if (this.maxKeys === 0) {
      return;
    }

    if (this.map.has(key)) {
      this.map.set(key, value);
      this.touch(key);
      return;
    }

    if (this.map.size() >= this.maxKeys) {
      const lru = this.order.shift();
      if (lru !== undefined) {
        this.map.delete(lru);
      }
    }

    this.map.set(key, value);
    this.order.append(key);
  }

  get(key: string): V | undefined {
    if (!this.map.has(key)) {
      return undefined;
    }
    const value = this.map.get(key);
    this.touch(key);
    return value;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  delete(key: string): boolean {
    if (!this.map.delete(key)) {
      return false;
    }
    this.order.remove(key);
    return true;
  }

  size(): number {
    return this.map.size();
  }

  isEmpty(): boolean {
    return this.map.isEmpty();
  }

  /**
   * Keys from least recently used to most recently used.
   */
  keys(): string[] {
    return this.order.toArray();
  }

  values(): V[] {
    return this.order.toArray().map((k) => this.map.get(k)!);
  }

  *[Symbol.iterator](): Iterator<[string, V]> {
    for (const key of this.order) {
      yield [key, this.map.get(key)!];
    }
  }

  toArray(): [string, V][] {
    return this.order.toArray().map((k) => [k, this.map.get(k)!]);
  }

  private touch(key: string): void {
    this.order.remove(key);
    this.order.append(key);
  }
}
