import { AbstractTransformation } from '../AbstractTransformation.js';
import { llmStructuredResponse } from '../../../../llm/llmStructuredResponse.js';
import type { TSchema } from '../../../../schema/schema.js';
import type { StrategySelector } from '../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../artifacts.js';

export class StructureUnstructured extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'all';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const response = await llmStructuredResponse<TSchema>({
      fallback: true,
      input: input.get(KnownArtifactsEnum.LLM_MARKDOWN) || '',
    });
    return this.toString(response);
  }
}
