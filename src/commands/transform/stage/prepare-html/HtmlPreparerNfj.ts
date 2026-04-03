import assert from 'node:assert';
import * as cheerio from 'cheerio';
import { clean } from '../../../extract/lib/html.js';
import { AbstractHtmlPreparer } from './AbstractHtmlPreparer.js';
import { stripAllAttributesAndPruneEmpty } from './html-utils.js';

export class HtmlPreparerNfj extends AbstractHtmlPreparer {
  strategy(): string {
    return 'nfj';
  }

  prepare(dirtyContent: string): string {
    const content = clean(dirtyContent);
    assert(content.length > 0, 'extractContent: content must be a non empty string');

    let $ = cheerio.load(content);
    const payload = $('common-posting-content-wrapper').html();
    assert(
      typeof payload === 'string' && payload.length > 0,
      'extractContent: payload must be a non empty string',
    );

    $ = cheerio.load(payload);
    $('nfj-posting-similar').remove();
    $('common-image-blur').remove();
    $('common-posting-locations').remove();
    $('popover-content').remove();

    const validUntilText = $('common-posting-time-info').text();
    const cleanValidUntilText = validUntilText.split('(')[0];

    stripAllAttributesAndPruneEmpty($);

    return $.html()
      .replaceAll('<!---->', '')
      .replaceAll('<!--ngtns-->', '')
      .replace(validUntilText, cleanValidUntilText);
  }
}
