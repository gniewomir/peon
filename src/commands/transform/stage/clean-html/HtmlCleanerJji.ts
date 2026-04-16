import { AbstractTransformation } from '../AbstractTransformation.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import type { StrategySelector } from '../../../../lib/types.js';

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

    $('*').each(function () {
      const $this = $(this);

      const attrs = Object.keys($this.attr() || {});

      if ($this.text().trim() === '' && $this.children().length === 0) {
        $this.remove();
      }

      attrs.forEach((attr) => {
        /**
         * Drop material-ui classes
         */
        if (attr === 'class') {
          const cssClassAttr = $this.attr('class') || '';
          const cssClasses = cssClassAttr
            .split(' ')
            .map((c) => c.trim())
            .filter(Boolean)
            .filter((c) => !(c.startsWith('mui-') || c.startsWith('Mui')))
            .join(' ');
          $this.attr('class', cssClasses);
        }
        if (['href', 'id', 'class', 'type'].includes(attr)) {
          return;
        }
        $this.removeAttr(attr);
      });
    });
    return $.html();
  }
}
