import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import { HtmlToJsonExtractor } from './HtmlToJsonExtractor.js';
import type { Transformation } from '../AbstractTransformation.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import type { THtmlJsonSchema } from '../../../../schema/schema.html-json.js';
import { htmlJsonSchema } from '../../../../schema/schema.html-json.js';
import { SchemaGuard } from '../guards/SchemaGuard.js';

export class CleanHtmlToJsonStage extends AbstractStage<THtmlJsonSchema> {
  public static transformations(): Transformation<THtmlJsonSchema>[] {
    return [new HtmlToJsonExtractor()];
  }

  public inputArtifacts() {
    return [KnownArtifactsEnum.RAW_JOB_HTML];
  }

  public outputArtifact() {
    return KnownArtifactsEnum.RAW_JOB_HTML_JSON;
  }

  protected guards(): AbstractGuard<THtmlJsonSchema>[] {
    return [new SchemaGuard(htmlJsonSchema)];
  }
}
