import { AbstractStage } from '../AbstractStage.js';
import type { Transformation } from '../AbstractTransformation.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { HtmlJsonCleanerAll } from './HtmlJsonCleanerAll.js';

export class CleanHtmlJsonStage extends AbstractStage {
  public static transformations(): Transformation[] {
    return [new HtmlJsonCleanerAll()];
  }

  protected inputArtifacts() {
    return [KnownArtifactsEnum.RAW_JOB_HTML_JSON];
  }

  protected outputArtifact() {
    return KnownArtifactsEnum.CLEAN_JOB_HTML_JSON;
  }

  protected guards(): AbstractGuard[] {
    return [];
  }
}
