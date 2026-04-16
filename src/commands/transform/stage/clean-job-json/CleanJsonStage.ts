import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../AbstractGuard.js';
import { SchemaGuard } from '../SchemaGuard.js';
import type { Transformation } from '../AbstractTransformation.js';
import { CleanerJji } from './CleanerJji.js';
import { CleanerNfj } from './CleanerNfj.js';
import { CleanerBdj } from './CleanerBdj.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { schema, type TSchema } from '../../../../schema/schema.js';

export class CleanJsonStage extends AbstractStage<TSchema> {
  public static transformations(): Transformation<TSchema>[] {
    return [new CleanerJji(), new CleanerNfj(), new CleanerBdj()];
  }

  public inputArtifacts() {
    return [KnownArtifactsEnum.RAW_JOB_JSON];
  }

  public outputArtifact() {
    return KnownArtifactsEnum.CLEAN_JOB_JSON;
  }

  public concurrency() {
    return 'unlimited' as const;
  }

  protected guards(): AbstractGuard<TSchema>[] {
    return [new SchemaGuard(schema)];
  }
}
