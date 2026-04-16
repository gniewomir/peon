import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../AbstractGuard.js';
import { NotEmptyGuard } from './NotEmptyGuard.js';
import type { Transformation } from '../AbstractTransformation.js';
import { HtmlToMdConverterAll } from './HtmlToMdConverterAll.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { HtmlToMdConverterBdj } from './HtmlToMdConverterBdj.js';
import { HtmlToMdConverterJji } from './HtmlToMdConverterJji.js';

export class CleanHtmlToMdStage extends AbstractStage {
  public static transformations(): Transformation[] {
    return [new HtmlToMdConverterBdj(), new HtmlToMdConverterJji(), new HtmlToMdConverterAll()];
  }

  public inputArtifacts() {
    return [KnownArtifactsEnum.CLEAN_JOB_HTML];
  }

  public outputArtifact() {
    return KnownArtifactsEnum.CLEAN_MARKDOWN;
  }

  public concurrency() {
    return 'unlimited' as const;
  }

  protected guards(): AbstractGuard<string>[] {
    return [new NotEmptyGuard()];
  }
}
