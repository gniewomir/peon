import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import { NotEmptyGuard } from '../guards/NotEmptyGuard.js';
import type { Transformation } from '../AbstractTransformation.js';
import { HtmlToMarkdownConverter } from './HtmlToMarkdownConverter.js';
import { KnownArtifactsEnum } from '../../artifacts.js';

export class HtmlToMdStage extends AbstractStage {
  public static transformations(): Transformation[] {
    return [new HtmlToMarkdownConverter()];
  }

  protected inputArtifacts() {
    return [KnownArtifactsEnum.CLEAN_JOB_HTML];
  }

  protected outputArtifact() {
    return KnownArtifactsEnum.LLM_MARKDOWN;
  }

  protected guards(): AbstractGuard[] {
    return [new NotEmptyGuard()];
  }
}
