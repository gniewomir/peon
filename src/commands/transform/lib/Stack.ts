import { LinkedList } from './LinkedList.js';

export class Stack<T> {
  private readonly items = new LinkedList<T>();
  private count = 0;

  push(value: T): void {
    this.items.prepend(value);
    this.count += 1;
  }

  pop(): T | undefined {
    const value = this.items.shift();
    if (value !== undefined) {
      this.count -= 1;
    }
    return value;
  }

  peek(): T | undefined {
    return this.items.peekHead();
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
}
