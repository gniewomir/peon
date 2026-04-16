import { AbstractStage } from '../AbstractStage.js';
import type { Transformation } from '../AbstractTransformation.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { HtmlJsonCleanerAll } from './HtmlJsonCleanerAll.js';
import type { THtmlJsonSchema } from '../../../../schema/schema.html-json.js';
import { htmlJsonSchema } from '../../../../schema/schema.html-json.js';

export class CleanHtmlJsonStage extends AbstractStage<THtmlJsonSchema> {
  public static transformations(): Transformation[] {
    return [new HtmlJsonCleanerAll()];
  }

  public inputArtifacts() {
    return [KnownArtifactsEnum.RAW_JOB_HTML_JSON];
  }

  public outputArtifact() {
    return KnownArtifactsEnum.CLEAN_JOB_HTML_JSON;
  }

  protected toStageResult(raw: string): THtmlJsonSchema {
    return htmlJsonSchema.parse(JSON.parse(raw));
  }

  protected guards(): AbstractGuard<THtmlJsonSchema>[] {
    return [];
  }
}
