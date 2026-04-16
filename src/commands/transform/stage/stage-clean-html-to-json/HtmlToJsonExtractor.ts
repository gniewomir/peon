import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import type { THtmlJsonSchema } from '../../../../schema/schema.html-json.js';

export class HtmlToJsonExtractor extends AbstractTransformation<THtmlJsonSchema> {
  strategy(): StrategySelector {
    return 'all';
  }

  async transform(input: Map<Artifact, string>): Promise<THtmlJsonSchema> {
    const $ = this.toCheerio(KnownArtifactsEnum.RAW_JOB_HTML, input);
    const ldJson = $('script[type="application/ld+json"]')
      .toArray()
      .map((el) => {
        try {
          return JSON.parse($(el).html() || '{}');
        } catch {
          return {};
        }
      });
    const json = $('script[type="application/json"]')
      .toArray()
      .map((el) => {
        try {
          return JSON.parse($(el).html() || '{}');
        } catch {
          return {};
        }
      });

    return {
      ['application/ld+json']: ldJson,
      ['application/json']: json,
    } satisfies THtmlJsonSchema;
  }
}
