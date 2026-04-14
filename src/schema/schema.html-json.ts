import { z } from 'zod';
import { sNamespace } from './schema.utils.js';

export const htmlJsonObject = {
  ['application/ld+json']: z.unknown(),
  ['application/json']: z.unknown(),
};
export const htmlJsonSchema = sNamespace(htmlJsonObject, 'Json extracted from html');
export type THtmlJsonSchema = z.infer<typeof htmlJsonSchema>;
export const nullHtmlJsonSchema = (): THtmlJsonSchema => ({
  ['application/ld+json']: null,
  ['application/json']: null,
});
