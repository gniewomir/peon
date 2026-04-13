import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import { HtmlToJsonExtractor } from './HtmlToJsonExtractor.js';
import type { Transformation } from '../AbstractTransformation.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';

export class CleanHtmlToJsonStage extends AbstractStage {
  public static transformations(): Transformation[] {
    return [new HtmlToJsonExtractor()];
  }

  protected inputArtifacts() {
    return [KnownArtifactsEnum.RAW_JOB_HTML];
  }

  protected outputArtifact() {
    return KnownArtifactsEnum.RAW_JOB_HTML_JSON;
  }

  protected guards(): AbstractGuard[] {
    return [];
  }
}
