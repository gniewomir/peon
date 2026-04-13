import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import { NotEmptyGuard } from '../guards/NotEmptyGuard.js';
import { CleanerMetaBdj } from './CleanerMetaBdj.js';
import { CleanerMetaJji } from './CleanerMetaJji.js';
import { CleanerMetaNfj } from './CleanerMetaNfj.js';
import type { Transformation } from '../AbstractTransformation.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { DedupByUrlGuard } from './DedupByUrlGuard.js';
import { ExpirationGuard } from './ExpirationGuard.js';

export class CleanMetaStage extends AbstractStage {
  public static transformations(): Transformation[] {
    return [new CleanerMetaBdj(), new CleanerMetaJji(), new CleanerMetaNfj()];
  }

  protected inputArtifacts() {
    return [
      KnownArtifactsEnum.RAW_JOB_META_JSON,
      KnownArtifactsEnum.RAW_JOB_JSON,
      KnownArtifactsEnum.LLM_MARKDOWN,
      KnownArtifactsEnum.CLEAN_JOB_HTML,
      KnownArtifactsEnum.RAW_JOB_HTML_JSON,
    ];
  }

  protected outputArtifact() {
    return KnownArtifactsEnum.CLEAN_JOB_META_JSON;
  }

  protected guards(): AbstractGuard[] {
    return [new NotEmptyGuard(), new DedupByUrlGuard(), new ExpirationGuard()];
  }
}
