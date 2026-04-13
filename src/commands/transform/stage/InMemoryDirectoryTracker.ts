import assert from 'node:assert';
import { LRUHashMap } from '../lib/LRUHashMap.js';

export type DirectoryStatus = boolean;

export class InMemoryDirectoryTracker {
  private readonly hashmap;

  constructor(private readonly maxKeys: number) {
    assert(Number.isInteger(maxKeys) && maxKeys > 0, 'maxKeys must be a positive integer');
    this.hashmap = new LRUHashMap<DirectoryStatus>(this.maxKeys);
  }

  moved(key: string): void {
    this.hashmap.set(key, true);
  }

  wasMoved(key: string): boolean {
    return this.hashmap.get(key) || false;
  }
}
