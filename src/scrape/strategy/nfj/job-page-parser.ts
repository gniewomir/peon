import assert from 'node:assert';
import * as cheerio from 'cheerio';
import { clean } from '../../lib/html.js';
import type { JobPageParser } from '../../types/index.js';

export class NfjJobPageParser implements JobPageParser {
  extract(dirtyContent: string): string {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cheerio each() binds loose Element
    $('*').each(function (this: any) {
      const $this = $(this);
      const attrs = Object.keys(this.attribs || {});

      attrs.forEach((attr) => {
        $this.removeAttr(attr);
      });

      if ($this.text().trim() === '' && $this.children().length === 0) {
        $this.remove();
      }
    });

    return $.html()
      .replaceAll('<!---->', '')
      .replaceAll('<!--ngtns-->', '')
      .replace(validUntilText, cleanValidUntilText);
  }
}
