import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { nullCombinedSchema, type TCombinedSchema } from '../../../../schema/schema.combined.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';

export class CombineCleanToCombined extends AbstractTransformation<TCombinedSchema> {
  strategy(): StrategySelector {
    return 'all';
  }

  async transform(input: Map<Artifact, string>): Promise<TCombinedSchema> {
    const meta = this.objectFromJson<Record<string, unknown>>(
      KnownArtifactsEnum.CLEAN_JOB_META_JSON,
      input,
    );
    const schema = this.objectFromJson<Record<string, unknown>>(
      KnownArtifactsEnum.CLEAN_JOB_JSON,
      input,
    );

    return merge(nullCombinedSchema(), {
      ...(meta as DeepPartial<TCombinedSchema>),
      ...(schema as DeepPartial<TCombinedSchema>),
    }) as TCombinedSchema;
  }
}
