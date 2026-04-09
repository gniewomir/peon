export class JsonNavigator {
  private readonly haystack: unknown;
  private readonly rootPath: string;

  constructor(haystack: unknown, rootPath?: string) {
    this.haystack = haystack;
    this.rootPath = rootPath ?? '';
  }

  getPath(path: string): JsonNavigator {
    if (path === '') {
      throw new Error(this.errorPrefix('getPath requires a non-empty path'));
    }
    const resolved = this.resolve(this.haystack, path);
    return new JsonNavigator(resolved, this.childPath(path));
  }

  getOptionalPath(path: string): JsonNavigator | undefined {
    if (path === '') {
      throw new Error(this.errorPrefix('getOptionalPath requires a non-empty path'));
    }
    try {
      const resolved = this.resolve(this.haystack, path);
      return new JsonNavigator(resolved, this.childPath(path));
    } catch {
      return undefined;
    }
  }

  value(): unknown {
    return this.haystack;
  }

  toString(): string {
    if (typeof this.haystack === 'string') {
      return this.haystack;
    }
    throw new Error(this.errorPrefix(`Expected string, got ${typeof this.haystack}`));
  }

  toNumber(): number {
    if (typeof this.haystack === 'number') {
      return this.haystack;
    }
    throw new Error(this.errorPrefix(`Expected number, got ${typeof this.haystack}`));
  }

  toArray(): JsonNavigator[] {
    if (Array.isArray(this.haystack)) {
      return this.haystack.map((item, i) => new JsonNavigator(item, this.childPath(String(i))));
    }
    throw new Error(this.errorPrefix(`Expected array, got ${typeof this.haystack}`));
  }

  toBool(): boolean {
    if (typeof this.haystack === 'boolean') {
      return this.haystack;
    }
    throw new Error(this.errorPrefix(`Expected boolean, got ${typeof this.haystack}`));
  }

  toNullableBool(): boolean | null {
    if (typeof this.haystack === 'boolean') {
      return this.haystack;
    }
    if (this.haystack === null) {
      return null;
    }
    throw new Error(this.errorPrefix(`Expected boolean or null, got ${typeof this.haystack}`));
  }

  toDateFromString(): Date {
    if (typeof this.haystack === 'string') {
      return new Date(this.haystack);
    }
    throw new Error(this.errorPrefix(`Expected date string, got ${typeof this.haystack}`));
  }

  toDateFromTimestamp(): Date {
    if (typeof this.haystack === 'number') {
      return new Date(this.haystack);
    }
    throw new Error(this.errorPrefix(`Expected numeric timestamp, got ${typeof this.haystack}`));
  }

  private resolve(haystack: unknown, path: string): unknown {
    if (path === '') {
      return haystack;
    }
    const parts = path.split('.');
    const needle = parts.shift();
    if (Array.isArray(haystack) && needle && !isNaN(parseInt(needle, 10))) {
      return this.resolve(haystack[parseInt(needle, 10)], parts.join('.'));
    }
    if (
      typeof haystack === 'object' &&
      haystack !== null &&
      needle &&
      Object.hasOwn(haystack, needle)
    ) {
      return this.resolve(haystack[needle as keyof typeof haystack], parts.join('.'));
    }
    if (needle === undefined) {
      return haystack;
    }
    throw new Error(this.errorPrefix(`No entry at path "${this.childPath(path)}"`));
  }

  private childPath(segment: string): string {
    return this.rootPath ? `${this.rootPath}.${segment}` : segment;
  }

  private errorPrefix(message: string): string {
    if (this.rootPath) {
      return `[JsonNavigator at "${this.rootPath}"] ${message}`;
    }
    return `[JsonNavigator] ${message}`;
  }
}
