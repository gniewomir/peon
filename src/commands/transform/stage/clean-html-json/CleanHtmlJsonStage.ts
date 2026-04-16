import { AbstractStage } from '../AbstractStage.js';
import type { Transformation } from '../AbstractTransformation.js';
import type { AbstractGuard } from '../AbstractGuard.js';
import { SchemaGuard } from '../SchemaGuard.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { HtmlJsonCleanerAll } from './HtmlJsonCleanerAll.js';
import type { THtmlJsonSchema } from '../../../../schema/schema.html-json.js';
import { htmlJsonSchema } from '../../../../schema/schema.html-json.js';

export class CleanHtmlJsonStage extends AbstractStage<THtmlJsonSchema> {
  public static transformations(): Transformation<THtmlJsonSchema>[] {
    return [new HtmlJsonCleanerAll()];
  }

  public inputArtifacts() {
    return [KnownArtifactsEnum.RAW_JOB_HTML_JSON];
  }

  public outputArtifact() {
    return KnownArtifactsEnum.CLEAN_JOB_HTML_JSON;
  }

  protected guards(): AbstractGuard<THtmlJsonSchema>[] {
    return [new SchemaGuard(htmlJsonSchema)];
  }
}
