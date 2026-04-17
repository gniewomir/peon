class DoubleLinkedListNode<T> {
  constructor(
    public readonly value: T,
    public next: DoubleLinkedListNode<T> | null = null,
    public prev: DoubleLinkedListNode<T> | null = null,
  ) {}
}

export class DoubleLinkedList<T> {
  private head: DoubleLinkedListNode<T> | null = null;
  private tail: DoubleLinkedListNode<T> | null = null;
  private _size: number = 0;

  get size(): number {
    return this._size;
  }

  prepend(value: T): void {
    const node = new DoubleLinkedListNode(value, this.head, null);
    if (this.head) {
      this.head.prev = node;
    } else {
      // Empty list: head and tail are the same node
      this.tail = node;
    }
    this.head = node;
    this._size++;
  }

  append(value: T): void {
    const node = new DoubleLinkedListNode(value, null, this.tail);
    if (this.tail) {
      this.tail.next = node;
    } else {
      // Empty list: head and tail are the same node
      this.head = node;
    }
    this.tail = node;
    this._size++;
  }

  /**
   * NOTE: Object will be removed by identity (reference), not by value
   */
  remove(value: T): boolean {
    if (!this.head) {
      return false;
    }

    let current: DoubleLinkedListNode<T> | null = this.head;
    while (current && current.value !== value) {
      current = current.next;
    }

    if (!current) {
      return false;
    }

    const prev = current.prev;
    const next = current.next;

    if (prev) {
      prev.next = next;
    } else {
      // Removing head
      this.head = next;
    }

    if (next) {
      next.prev = prev;
    } else {
      // Removing tail
      this.tail = prev;
    }

    this._size--;
    return true;
  }

  shift(): T | undefined {
    if (!this.head) {
      return undefined;
    }

    const value = this.head.value;
    const next = this.head.next;

    this.head = next;
    if (this.head) {
      this.head.prev = null;
    } else {
      this.tail = null;
    }

    this._size--;
    return value;
  }

  pop(): T | undefined {
    if (!this.tail) {
      return undefined;
    }

    const value = this.tail.value;
    const prev = this.tail.prev;

    this.tail = prev;
    if (this.tail) {
      this.tail.next = null;
    } else {
      this.head = null;
    }

    this._size--;
    return value;
  }

  peekHead(): T | undefined {
    return this.head?.value;
  }

  peekTail(): T | undefined {
    return this.tail?.value;
  }

  *[Symbol.iterator](): Iterator<T> {
    let current = this.head;
    while (current) {
      yield current.value;
      current = current.next;
    }
  }

  toArray(): T[] {
    const result: T[] = [];
    for (const value of this) {
      result.push(value);
    }
    return result;
  }
}
