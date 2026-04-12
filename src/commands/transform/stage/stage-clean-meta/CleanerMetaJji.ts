import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { metaSchema, type TMetaSchema } from '../../../../schema/schema.meta.js';
import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../artifacts.js';

export class CleanerMetaJji extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'jji';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const meta = this.toSchema<TMetaSchema>(
      metaSchema,
      KnownArtifactsEnum.RAW_JOB_META_JSON,
      input,
    );
    return this.toString(
      merge(meta, {
        offer: {
          publishedAt: null,
          expiresAt: null,
          updatedAt: null,
          canonicalUrl: null,
          alternateUrls: [],
        },
      } satisfies DeepPartial<TMetaSchema>),
    );
  }
}
