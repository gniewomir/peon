import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import { NotEmptySerializedGuard } from '../guards/NotEmptySerializedGuard.js';
import { CleanerMetaBdj } from './CleanerMetaBdj.js';
import { CleanerMetaJji } from './CleanerMetaJji.js';
import { CleanerMetaNfj } from './CleanerMetaNfj.js';
import type { Transformation } from '../AbstractTransformation.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { DedupByUrlGuard } from './DedupByUrlGuard.js';
import { ExpirationGuard } from './ExpirationGuard.js';
import type { TMetaSchema } from '../../../../schema/schema.meta.js';
import { metaSchema } from '../../../../schema/schema.meta.js';

export class CleanMetaStage extends AbstractStage<TMetaSchema> {
  public static transformations(): Transformation[] {
    return [new CleanerMetaBdj(), new CleanerMetaJji(), new CleanerMetaNfj()];
  }

  public inputArtifacts() {
    return [
      KnownArtifactsEnum.RAW_JOB_META,
      KnownArtifactsEnum.RAW_JOB_JSON,
      KnownArtifactsEnum.CLEAN_MARKDOWN,
      KnownArtifactsEnum.CLEAN_JOB_HTML,
      KnownArtifactsEnum.CLEAN_JOB_HTML_JSON,
    ];
  }

  public outputArtifact() {
    return KnownArtifactsEnum.CLEAN_JOB_META_JSON;
  }

  protected toStageResult(raw: string): TMetaSchema {
    return metaSchema.parse(JSON.parse(raw));
  }

  protected guards(): AbstractGuard<TMetaSchema>[] {
    return [new NotEmptySerializedGuard(100), new DedupByUrlGuard(), new ExpirationGuard()];
  }
}
