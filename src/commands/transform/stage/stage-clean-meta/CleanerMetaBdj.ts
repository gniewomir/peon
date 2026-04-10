import { AbstractMetaCleaner } from './AbstractMetaCleaner.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { metaSchema, type TMetaSchema } from '../../../../schema/schema.meta.js';

export class CleanerMetaBdj extends AbstractMetaCleaner {
  clean(meta: unknown): TMetaSchema {
    return merge(metaSchema.parse(meta), {
      offer: {
        publishedAt: null,
        expiresAt: null,
        updatedAt: null,
        canonicalUrl: null,
        alternateUrls: [],
      },
    } satisfies DeepPartial<TMetaSchema>);
  }

  strategy(): string {
    return 'bdj';
  }
}
