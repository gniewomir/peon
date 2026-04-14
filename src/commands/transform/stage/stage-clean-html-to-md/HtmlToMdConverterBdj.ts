import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact } from '../../../../lib/artifacts.js';
import { HtmlToMdConverterAll } from './HtmlToMdConverterAll.js';

export class HtmlToMdConverterBdj extends HtmlToMdConverterAll {
  strategy(): StrategySelector {
    return 'bdj';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    let markdown = await super.transform(input);
    markdown = markdown.replaceAll('Apply\n', '');
    return markdown;
  }
}
