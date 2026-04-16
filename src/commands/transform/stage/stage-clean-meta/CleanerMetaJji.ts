import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { metaSchema, type TMetaSchema } from '../../../../schema/schema.meta.js';
import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';

export class CleanerMetaJji extends AbstractTransformation<TMetaSchema> {
  strategy(): StrategySelector {
    return 'jji';
  }

  async transform(input: Map<Artifact, string>): Promise<TMetaSchema> {
    const meta = this.objectFromSchema<TMetaSchema>(
      metaSchema,
      KnownArtifactsEnum.RAW_JOB_META,
      input,
    );
    const json = this.objectFromJson(KnownArtifactsEnum.RAW_JOB_JSON, input);
    const nav = new JsonNavigator(json);

    return merge(meta, {
      offer: {
        publishedAt: nav.getPath('publishedAt').toString(),
        expiresAt: nav.getPath('expiredAt').toString(),
        updatedAt: null,
        canonicalUrl: meta.offer.url,
        alternateUrls: [],
      },
    } satisfies DeepPartial<TMetaSchema>) as TMetaSchema;
  }
}
