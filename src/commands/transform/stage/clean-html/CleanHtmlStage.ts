import { AbstractStage } from '../AbstractStage.js';
import type { Transformation } from '../AbstractTransformation.js';
import type { AbstractGuard } from '../AbstractGuard.js';
import { HtmlCleanerJji } from './HtmlCleanerJji.js';
import { HtmlCleanerNfj } from './HtmlCleanerNfj.js';
import { HtmlCleanerBdj } from './HtmlCleanerBdj.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { NoContentHtmlGuard } from './NoContentHtmlGuard.js';

export class CleanHtmlStage extends AbstractStage {
  public static transformations(): Transformation[] {
    return [new HtmlCleanerJji(), new HtmlCleanerNfj(), new HtmlCleanerBdj()];
  }

  public inputArtifacts() {
    return [KnownArtifactsEnum.RAW_JOB_HTML];
  }

  public outputArtifact() {
    return KnownArtifactsEnum.CLEAN_JOB_HTML;
  }

  protected guards(): AbstractGuard<string>[] {
    return [new NoContentHtmlGuard(100)];
  }
}
