import type { CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';

export abstract class AbstractHtmlToJsonExtractor {
  abstract strategy(): string;
  abstract extract(rawHtml: string): Record<string, unknown>;

  protected $(dirtyContent: string): CheerioAPI {
    return cheerio.load(dirtyContent);
  }
}
