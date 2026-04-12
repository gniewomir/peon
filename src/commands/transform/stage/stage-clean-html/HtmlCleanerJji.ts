import { AbstractTransformation } from '../AbstractTransformation.js';
import { type Artifact, KnownArtifactsEnum } from '../../artifacts.js';
import type { StrategySelector } from '../../../lib/types.js';

export class HtmlCleanerJji extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'jji';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const $ = this.toPreprocessedCheerio(KnownArtifactsEnum.RAW_JOB_HTML, input);

    $('span').each((_, el) => {
      const $this = $(el);
      if ($this.text().trim().startsWith('#1 Job Board for tech industry in Europe')) {
        $this.parent().parent().parent().parent().parent().remove();
      }
      if ($this.text().trim().startsWith('ADVERTISEMENT: Recommended by Just Join IT')) {
        $this.parent().parent().remove();
      }
    });
    $('#cookiescript_injected_wrapper').remove();
    $('footer').remove();
    $('a[href="/job-offers/all-locations"]').parent().parent().remove();

    return $.html();
  }
}
