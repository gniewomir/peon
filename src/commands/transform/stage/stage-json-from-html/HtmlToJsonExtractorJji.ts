import { AbstractHtmlToJsonExtractor } from './AbstractHtmlToJsonExtractor.js';

export class HtmlToJsonExtractorJji extends AbstractHtmlToJsonExtractor {
  extract(rawHtml: string): Record<string, unknown> {
    const $ = this.$(rawHtml);
    const ld = $('script[type="application/ld+json"]')
      .toArray()
      .map((el) => JSON.parse($(el).html() || '{}'));
    const hydration = $('script[type="application/json"]')
      .toArray()
      .map((el) => JSON.parse($(el).html() || '{}'));
    return {
      ld,
      hydration,
    };
  }

  strategy(): string {
    return 'jji';
  }
}
