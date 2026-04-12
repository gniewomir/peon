import { AbstractTransformation } from '../AbstractTransformation.js';
import { type Artifact, KnownArtifactsEnum } from '../../artifacts.js';
import type { StrategySelector } from '../../../lib/types.js';

export class HtmlCleanerBdj extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'bdj';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const $ = this.toPreprocessedCheerio(KnownArtifactsEnum.RAW_JOB_HTML, input);

    $('.cookie-bar').remove();
    $('#main-menu').remove();
    $('.bg-action').remove();
    $('.bg-black ').remove();
    $('footer').remove();
    $('h3')
      .filter(function () {
        return $(this).text().startsWith('Similar offers');
      })
      .each(function () {
        $(this).parent().remove();
      });

    return $.html();
  }
}
