import { sNamespace } from './schema.utils.js';
import { metaObject } from './schema.meta.js';

export const combined = sNamespace(
  {
    ...metaObject,
    ...schemaObject,
  },
  'Combined schema',
);
export type TCombinedSchema = z.infer<typeof combined>;
