export class HashMap<V> {
  private readonly store: Record<string, V> = Object.create(null);
  private count: number = 0;

  set(key: string, value: V): void {
    if (!this.has(key)) {
      this.count++;
    }
    this.store[key] = value;
  }

  get(key: string): V | undefined {
    return this.store[key];
  }

  has(key: string): boolean {
    return key in this.store;
  }

  delete(key: string): boolean {
    if (!this.has(key)) {
      return false;
    }
    delete this.store[key];
    this.count--;
    return true;
  }

  size(): number {
    return this.count;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  keys(): string[] {
    return Object.keys(this.store);
  }

  values(): V[] {
    return Object.values(this.store);
  }

  *[Symbol.iterator](): Iterator<[string, V]> {
    for (const key in this.store) {
      yield [key, this.store[key]];
    }
  }

  toArray(): [string, V][] {
    return Object.entries(this.store);
  }
}
