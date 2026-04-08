import { z } from 'zod';

export function sString(prompt: string) {
  return z.string().trim().min(1).nullable().default(null).catch(null).describe(prompt);
}

export function sStringArray(prompt: string) {
  return z.array(z.string().trim().min(1).nullable().default(null).catch(null)).describe(prompt);
}

export function sEnum(values: string[], prompt: string) {
  return z.enum(values).nullable().describe(prompt);
}

export function sEnumArray(values: string[], prompt: string) {
  return z.array(z.enum(values).nullable()).describe(prompt);
}

export function sBool(prompt: string) {
  return z.boolean().nullable().default(null).catch(null).describe(prompt);
}

export function sNamespace<T extends Record<string, unknown>>(namespace: T, prompt: string) {
  return z.object(namespace).describe(prompt);
}

export function sDateTime(prompt: string) {
  // NOTE: using datetime will crash ollama schema to grammar parser ATM
  return sString(prompt);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [null, Object.prototype].includes(Object.getPrototypeOf(value))
  );
}

function dedupArray(arr: unknown[]): unknown[] {
  const seen = new Set<string>();
  const result: unknown[] = [];
  for (const item of arr) {
    const key = typeof item === 'string' ? item.trim().toLowerCase() : JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(target)) {
    if (!(key in source)) continue;

    const targetVal = target[key];
    const sourceVal = source[key];

    if (isPlainObject(targetVal) && isPlainObject(sourceVal)) {
      mergeInto(targetVal, sourceVal);
    } else if (Array.isArray(sourceVal)) {
      if (sourceVal.length > 0) {
        const base = Array.isArray(targetVal) ? targetVal : [];
        target[key] = dedupArray([...base, ...sourceVal]);
      }
    } else if (sourceVal === null || sourceVal === '') {
      // "no data" — skip
    } else {
      target[key] = sourceVal;
    }
  }
}

/**
 * Merge schemas into target schema in order.
 *
 * Rules:
 *  - target is mutated in place
 *  - only keys already present in target are considered (unknown keys ignored)
 *  - null / empty string in source are treated as "no data" and skipped
 *  - empty array in source is treated as "no data" and skipped
 *  - non-empty arrays are set-unioned (case-insensitive dedup for strings)
 *  - plain objects are recursed into
 *  - all other non-null values use last-write-wins
 */
export function merge<T extends Record<string, unknown>>(
  target: T,
  ...schemas: Record<string, unknown>[]
): T {
  for (const source of schemas) {
    mergeInto(target, source);
  }
  return target;
}

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;
