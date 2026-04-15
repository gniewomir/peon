import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../../lib/types.js';
import { KnownArtifactsEnum, type Artifact } from '../../../../lib/artifacts.js';
import {
  combined,
  nullCombinedSchema,
  type TCombinedSchema,
} from '../../../../schema/schema.combined.js';
import { merge, type DeepPartial } from '../../../../schema/schema.utils.js';

export class CombineCleanToCombined extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'all';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const meta = this.objectFromJson<Record<string, unknown>>(
      KnownArtifactsEnum.CLEAN_JOB_META_JSON,
      input,
    );
    const schema = this.objectFromJson<Record<string, unknown>>(
      KnownArtifactsEnum.CLEAN_JOB_JSON,
      input,
    );

    const merged = merge(nullCombinedSchema(), {
      ...(meta as DeepPartial<TCombinedSchema>),
      ...(schema as DeepPartial<TCombinedSchema>),
    });

    // enforce the final shape early; guards run after saving, but this keeps the output predictable
    combined.parse(merged);

    return this.toString(merged);
  }
}
