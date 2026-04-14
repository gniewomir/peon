import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact } from '../../../../lib/artifacts.js';
import { HtmlToMdConverterAll } from './HtmlToMdConverterAll.js';

export class HtmlToMdConverterJji extends HtmlToMdConverterAll {
  strategy(): StrategySelector {
    return 'jji';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    let markdown = await super.transform(input);

    const CONSENT_PREFIX = 'By applying, I consent to the processing of my personal data';
    markdown = markdown
      .split('\n')
      .filter((line) => !line.trimStart().startsWith(CONSENT_PREFIX))
      .join('\n');

    markdown = markdown.replaceAll('Show menu\n', '');
    markdown = markdown.replaceAll('Save\n', '');
    markdown = markdown.replaceAll('Apply\n', '');
    markdown = markdown.replaceAll('Applied -\n', '');
    return markdown;
  }
}
