import type { TMetaSchema } from '../../../../schema/schema.meta.js';

export abstract class AbstractMetaCleaner {
  abstract strategy(): string;
  abstract clean(input: unknown): TMetaSchema;
}
