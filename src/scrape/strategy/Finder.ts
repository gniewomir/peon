export class Finder {
  public hasPath(haystack: unknown, path: string): boolean {
    try {
      this.valueByPath(haystack, path);
      return true;
    } catch {
      return false;
    }
  }

  public valueByPath(haystack: unknown, path: string): unknown {
    if (path === '') {
      return haystack;
    }
    const parts = path.split('.');
    const needle = parts.shift();
    if (Array.isArray(haystack) && needle && !isNaN(parseInt(needle, 10))) {
      return this.valueByPath(haystack[parseInt(needle, 10)], parts.join('.'));
    }
    if (
      typeof haystack === 'object' &&
      haystack !== null &&
      needle &&
      Object.hasOwn(haystack, needle)
    ) {
      return this.valueByPath(haystack[needle as keyof typeof haystack], parts.join('.'));
    }
    if (needle === undefined) {
      return haystack;
    }
    throw new Error(`No entry with path "${path}" found.`);
  }

  public stringValueByPath(haystack: unknown, path: string): string {
    const value = this.valueByPath(haystack, path);
    if (typeof value === 'string') {
      return value;
    }
    throw new Error(
      `Unexpected value type for path "${path}" found. String expected, got ${typeof value}`,
    );
  }

  public numberValueByPath(haystack: unknown, path: string): number {
    const value = this.valueByPath(haystack, path);
    if (typeof value === 'number') {
      return value;
    }
    throw new Error(
      `Unexpected value type for path "${path}" found. Number expected, got ${typeof value}`,
    );
  }

  public arrayValueByPath(haystack: unknown, path: string): unknown[] {
    const value = this.valueByPath(haystack, path);
    if (Array.isArray(value)) {
      return value;
    }
    throw new Error(
      `Unexpected value type for path "${path}" found. Array expected, got ${typeof value}`,
    );
  }

  public dateValueByPath(haystack: unknown, path: string): Date {
    const value = this.valueByPath(haystack, path);
    if (typeof value === 'string') {
      return new Date(value);
    }
    throw new Error(
      `Unexpected value type for path "${path}" found. Number expected, got ${typeof value}`,
    );
  }

  public boolValueByPath(haystack: unknown, path: string): boolean {
    const value = this.valueByPath(haystack, path);
    if (typeof value === 'boolean') {
      return value;
    }
    throw new Error(
      `Unexpected value type for path "${path}" found. Bool expected, got ${typeof value}`,
    );
  }
}
