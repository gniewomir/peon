import { sNamespace } from './schema.utils.js';
import { metaObject, nullMetaSchema } from './schema.meta.js';
import { nullSchema, schemaObject } from './schema.js';
import { z } from 'zod';

export const combined = sNamespace(
  {
    ...metaObject,
    ...schemaObject,
  },
  'Combined schema',
);
export type TCombinedSchema = z.infer<typeof combined>;
export const nullCombinedSchema: TCombinedSchema = {
  ...nullMetaSchema,
  ...nullSchema,
};
