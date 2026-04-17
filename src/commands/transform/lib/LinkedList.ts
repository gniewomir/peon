class LinkedListNode<T> {
  constructor(
    public readonly value: T,
    public next: LinkedListNode<T> | null = null,
  ) {}
}

export class LinkedList<T> {
  private head: LinkedListNode<T> | null = null;
  private tail: LinkedListNode<T> | null = null;
  private _size: number = 0;

  get size(): number {
    return this._size;
  }

  prepend(value: T): void {
    const node = new LinkedListNode(value, this.head);
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
    this._size++;
  }

  append(value: T): void {
    const node = new LinkedListNode(value);

    if (!this.head) {
      this.head = node;
      this.tail = node;
      this._size++;
      return;
    }

    this.tail!.next = node;
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

    if (this.head.value === value) {
      this.head = this.head.next;
      if (!this.head) {
        this.tail = null;
      }
      this._size--;
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
    this._size--;
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
    this._size--;
    return value;
  }

  pop(): T | undefined {
    if (!this.head) {
      return undefined;
    }

    // Single element
    if (this.head === this.tail) {
      const value = this.head.value;
      this.head = null;
      this.tail = null;
      this._size--;
      return value;
    }

    let current = this.head;
    while (current.next && current.next !== this.tail) {
      current = current.next;
    }

    const value = this.tail!.value;
    current.next = null;
    this.tail = current;
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
    let current = this.head;

    while (current) {
      result.push(current.value);
      current = current.next;
    }

    return result;
  }
}
