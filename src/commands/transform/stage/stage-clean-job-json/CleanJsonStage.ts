import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import { SchemaShapeGuard } from '../guards/SchemaShapeGuard.js';
import { NotEmptyGuard } from '../guards/NotEmptyGuard.js';
import type { Transformation } from '../AbstractTransformation.js';
import { CleanerJji } from './CleanerJji.js';
import { CleanerNfj } from './CleanerNfj.js';
import { CleanerBdj } from './CleanerBdj.js';
import { KnownArtifactsEnum } from '../../artifacts.js';

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
    return [new NotEmptyGuard(), new SchemaShapeGuard()];
  }
}
