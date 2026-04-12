import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../artifacts.js';

export class HtmlToJsonExtractor extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'all';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const $ = this.toCheerio(KnownArtifactsEnum.RAW_JOB_HTML, input);
    const ld = $('script[type="application/ld+json"]')
      .toArray()
      .map((el) => {
        try {
          return JSON.parse($(el).html() || '{}');
        } catch {
          return {};
        }
      });
    const hydration = $('script[type="application/json"]')
      .toArray()
      .map((el) => {
        try {
          return JSON.parse($(el).html() || '{}');
        } catch {
          return {};
        }
      });

    return this.toString({
      ld,
      hydration,
    });
  }
}
