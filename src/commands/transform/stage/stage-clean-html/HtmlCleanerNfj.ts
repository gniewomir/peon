import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';

export class HtmlCleanerNfj extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'nfj';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const $ = this.toPreprocessedCheerio(KnownArtifactsEnum.RAW_JOB_HTML, input);

    const $content = $('common-posting-content-wrapper');
    const $sidebar = $('common-apply-box');

    $sidebar.remove('nfj-posting-similar');
    $sidebar.remove('common-salary-match-inspect');

    $('*').each(function () {
      const $this = $(this);

      const attrs = Object.keys($this.attr() || {});

      if ($this.text().trim() === '' && $this.children().length === 0) {
        $this.remove();
      }

      attrs.forEach((attr) => {
        /**
         * Drop tailwind, grid and angular classes
         */
        if (attr === 'class') {
          const cssClassAttr = $this.attr('class') || '';
          const cssClasses = cssClassAttr
            .split(' ')
            .map((c) => c.trim())
            .filter(Boolean)
            .filter((c) => !(c.startsWith('tr-') || c.startsWith('mb-') || c.startsWith('ng-')))
            .join(' ');
          $this.attr('class', cssClasses);
        }
        if (['href', 'id', 'class', 'type'].includes(attr)) {
          return;
        }
        $this.removeAttr(attr);
      });
    });

    return ($content.html() || '') + ($sidebar.html() || '');
  }
}
