import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import { SchemaGuard } from '../guards/SchemaGuard.js';
import { NotEmptyGuard } from '../guards/NotEmptyGuard.js';
import type { Transformation } from '../AbstractTransformation.js';
import { CleanerJji } from './CleanerJji.js';
import { CleanerNfj } from './CleanerNfj.js';
import { CleanerBdj } from './CleanerBdj.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { schema } from '../../../../schema/schema.js';

export class CleanJsonStage extends AbstractStage {
  public static transformations(): Transformation[] {
    return [new CleanerJji(), new CleanerNfj(), new CleanerBdj()];
  }

  protected inputArtifacts() {
    return [KnownArtifactsEnum.RAW_JOB_JSON];
  }

  protected outputArtifact() {
    return KnownArtifactsEnum.CLEAN_JOB_JSON;
  }

  protected guards(): AbstractGuard[] {
    return [new NotEmptyGuard(), new SchemaGuard(schema)];
  }
}
