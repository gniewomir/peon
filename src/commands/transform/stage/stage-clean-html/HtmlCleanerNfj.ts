import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../artifacts.js';

export class HtmlCleanerNfj extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'nfj';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const $ = this.toPreprocessedCheerio(KnownArtifactsEnum.RAW_JOB_HTML, input);

    const $content = $('common-posting-content-wrapper');
    const $sidebar = $('common-apply-box');

    $sidebar.remove('nfj-posting-similar');

    let html = ($content.html() || '') + ($sidebar.html() || '');
    html = html.replaceAll('<!---->', '');

    return html;
  }
}
