import { z } from 'zod';

export function sString(prompt: string) {
  return z.string().trim().min(1).nullable().default(null).catch(null).describe(prompt);
}

export function sStringArray(prompt: string) {
  return z.array(z.string().trim().min(1).nullable().default(null).catch(null)).describe(prompt);
}

export function sEnum(values: string[], prompt: string) {
  return z.enum(values).describe(prompt);
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
