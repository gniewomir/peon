import { LinkedList } from './linked-list.js';

export class Queue<T> {
  private readonly items = new LinkedList<T>();
  private count = 0;

  enqueue(value: T): void {
    this.items.append(value);
    this.count += 1;
  }

  dequeue(): T | undefined {
    const value = this.items.shift();
    if (value !== undefined) {
      this.count -= 1;
    }
    return value;
  }

  peek(): T | undefined {
    return this.items.toArray()[0];
  }

  size(): number {
    return this.count;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  toArray(): T[] {
    return this.items.toArray();
  }

  append(value: T): void {
    this.enqueue(value);
  }

  shift(): T | undefined {
    return this.dequeue();
  }
}
