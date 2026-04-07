type DeepVisitFn = (value: unknown, key: string | number) => unknown | undefined;

function isPlainObject<T>(obj: unknown): obj is Exclude<
  T,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  | Function
  | symbol
  | bigint
  | string
  | number
  | boolean
  | undefined
  | null
  | RegExp
  | Date
  | Map<unknown, unknown>
  | Set<unknown>
> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    [null, Object.prototype].includes(Object.getPrototypeOf(obj))
  );
}

function isContainer(value: unknown): boolean {
  return Array.isArray(value) || (value !== null && isPlainObject(value));
}

/**
 * Visits every JSON-serializable value (including containers) in nested
 * object(s) and/or array(s). Values can be replaced when the visitor returns a
 * non-undefined result. Traversal is iterative and handles circular references.
 * @param root - The root object to visit.
 * @param visit - The function to visit each value.
 * @param seen - The set of objects that have been visited.
 * @returns void
 */
export function deepVisitor(
  root: unknown,
  visit: DeepVisitFn,
  seen: WeakSet<object> = new WeakSet(),
): void {
  if (!isContainer(root)) {
    return;
  }

  const stack: unknown[] = [root];

  while (stack.length) {
    const node = stack.pop()!;

    if (seen.has(node)) {
      continue;
    }

    seen.add(node);
    const entries = Array.isArray(node) ? node.entries() : Object.entries(node);

    for (const [key, value] of entries) {
      const result = visit(value, key);
      const nextValue = result === undefined ? value : result;

      if (result !== undefined) {
        Reflect.set(node, key, nextValue);
      }

      if (nextValue !== null && typeof nextValue === 'object' && isContainer(nextValue)) {
        stack.push(nextValue);
      }
    }
  }
}
