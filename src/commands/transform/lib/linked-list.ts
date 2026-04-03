export class LinkedListNode<T> {
  constructor(
    public readonly value: T,
    public next: LinkedListNode<T> | null = null,
  ) {}
}

export class LinkedList<T> {
  private head: LinkedListNode<T> | null = null;
  private tail: LinkedListNode<T> | null = null;

  prepend(value: T): void {
    const node = new LinkedListNode(value, this.head);
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  append(value: T): void {
    const node = new LinkedListNode(value);

    if (!this.head) {
      this.head = node;
      this.tail = node;
      return;
    }

    this.tail!.next = node;
    this.tail = node;
  }

  remove(value: T): boolean {
    if (!this.head) {
      return false;
    }

    if (this.head.value === value) {
      this.head = this.head.next;
      if (!this.head) {
        this.tail = null;
      }
      return true;
    }

    let current = this.head;
    while (current.next && current.next.value !== value) {
      current = current.next;
    }

    if (!current.next) {
      return false;
    }

    if (current.next === this.tail) {
      this.tail = current;
    }
    current.next = current.next.next;
    return true;
  }

  shift(): T | undefined {
    if (!this.head) {
      return undefined;
    }

    const value = this.head.value;
    this.head = this.head.next;
    if (!this.head) {
      this.tail = null;
    }
    return value;
  }

  seek(
    predicate: (value: T, node: LinkedListNode<T>, index: number) => boolean,
  ): LinkedListNode<T> | null {
    let current = this.head;
    let index = 0;

    while (current) {
      if (predicate(current.value, current, index)) {
        return current;
      }
      current = current.next;
      index += 1;
    }

    return null;
  }

  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;

    while (current) {
      result.push(current.value);
      current = current.next;
    }

    return result;
  }
}
