import { AbstractTransformation } from '../AbstractTransformation.js';
import { llmStructuredResponse } from '../../../../llm/llmStructuredResponse.js';
import type { TSchema } from '../../../../schema/schema.js';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import type { TLlmSchema } from '../../../../schema/schema.llm.js';

export class StructureUnstructured extends AbstractTransformation<TLlmSchema> {
  strategy(): StrategySelector {
    return 'all';
  }

  async transform(input: Map<Artifact, string>): Promise<TLlmSchema> {
    const response = await llmStructuredResponse<TSchema>({
      fallback: true,
      input: input.get(KnownArtifactsEnum.CLEAN_MARKDOWN) || '',
    });
    return response as TLlmSchema;
  }
}
