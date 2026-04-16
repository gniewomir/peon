import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import type { Transformation } from '../AbstractTransformation.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { CombineCleanToCombined } from './CombineCleanToCombined.js';
import { CombinedSchemaLoadGuard } from './CombinedSchemaLoadGuard.js';

export class CleanCombineStage extends AbstractStage {
  public static transformations(): Transformation[] {
    return [new CombineCleanToCombined()];
  }

  public inputArtifacts() {
    return [
      KnownArtifactsEnum.CLEAN_JOB_JSON,
      KnownArtifactsEnum.CLEAN_JOB_META_JSON,
      KnownArtifactsEnum.CLEAN_JOB_HTML_JSON,
      KnownArtifactsEnum.CLEAN_MARKDOWN,
    ];
  }

  public outputArtifact() {
    return KnownArtifactsEnum.CLEAN_COMBINE_JSON;
  }

  protected guards(): AbstractGuard[] {
    // If the structured (non-meta) part is good enough, we're done: load this job.
    // Otherwise, allow downstream enrichment (LLM) stages to run.
    return [new CombinedSchemaLoadGuard(0.4)];
  }
}
