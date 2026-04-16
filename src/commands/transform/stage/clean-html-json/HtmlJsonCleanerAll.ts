import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { htmlJsonSchema, type THtmlJsonSchema } from '../../../../schema/schema.html-json.js';

export class HtmlJsonCleanerAll extends AbstractTransformation<THtmlJsonSchema> {
  strategy(): StrategySelector {
    return 'all';
  }

  async transform(input: Map<Artifact, string>): Promise<THtmlJsonSchema> {
    return this.objectFromSchema<THtmlJsonSchema>(
      htmlJsonSchema,
      KnownArtifactsEnum.RAW_JOB_HTML_JSON,
      input,
    );
  }
}
