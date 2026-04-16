import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import { SchemaGuard } from '../guards/SchemaGuard.js';
import { NotEmptySerializedGuard } from '../guards/NotEmptySerializedGuard.js';
import type { Transformation } from '../AbstractTransformation.js';
import { CleanerJji } from './CleanerJji.js';
import { CleanerNfj } from './CleanerNfj.js';
import { CleanerBdj } from './CleanerBdj.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { schema, type TSchema } from '../../../../schema/schema.js';

export class CleanJsonStage extends AbstractStage<TSchema> {
  public static transformations(): Transformation[] {
    return [new CleanerJji(), new CleanerNfj(), new CleanerBdj()];
  }

  public inputArtifacts() {
    return [KnownArtifactsEnum.RAW_JOB_JSON];
  }

  public outputArtifact() {
    return KnownArtifactsEnum.CLEAN_JOB_JSON;
  }

  protected toStageResult(raw: string): TSchema {
    return schema.parse(JSON.parse(raw));
  }

  protected guards(): AbstractGuard<TSchema>[] {
    return [new NotEmptySerializedGuard(100), new SchemaGuard(schema)];
  }
}
