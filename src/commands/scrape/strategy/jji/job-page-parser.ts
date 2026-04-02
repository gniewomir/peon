import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import assert from 'node:assert';
import * as cheerio from 'cheerio';
import { clean } from '../../lib/html.js';
import type { JobPageParser } from '../../types/index.js';

/** Smallest ancestor of the title that still holds the full offer body (JJI stacks header + meta in shallow wrappers). */
function jobOfferHtmlFragment($: cheerio.CheerioAPI): string | null {
  const h1 = $('h1').first();
  if (!h1.length) {
    return $('h2').first().parent().parent().parent().html() ?? null;
  }

  const minAggregatedTextLen = 2000;
  let cur = h1.parent();
  while (cur.length) {
    if (cur.text().length >= minAggregatedTextLen) {
      return cur.html() ?? null;
    }
    const next = cur.parent();
    if (!next.length) {
      return cur.html() ?? null;
    }
    cur = next;
  }

  return null;
}

export class JjiJobPageParser implements JobPageParser {
  extract(dirtyContent: string): string {
    const content = clean(dirtyContent);
    assert(content.length > 0, 'extractContent: content must be a non empty string');

    let $ = cheerio.load(content);
    const payload = jobOfferHtmlFragment($);

    if (typeof payload === 'string' && payload.length > 0) {
      // ok
    } else {
      const debugDir = path.join(os.tmpdir(), 'peon-scrape-debug', 'jji');
      fs.mkdirSync(debugDir, { recursive: true });
      fs.writeFileSync(path.join(debugDir, 'dirty_content.txt'), dirtyContent, 'utf8');
      fs.writeFileSync(path.join(debugDir, 'content.txt'), content, 'utf8');
      fs.writeFileSync(path.join(debugDir, 'payload.txt'), dirtyContent, 'utf8');
      console.log(
        JSON.stringify({
          dirtyContent,
          content,
          payload,
        }),
      );
    }

    assert(
      typeof payload === 'string' && payload.length > 0,
      'extractContent: payload must be a non empty string',
    );

    $ = cheerio.load(payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cheerio each() binds loose Element
    $('*').each(function (this: any) {
      const attrs = Object.keys(this.attribs || {});
      const $this = $(this);

      attrs.forEach((attr) => {
        $this.removeAttr(attr);
      });

      if ($this.text().trim() === 'ADVERTISEMENT: Recommended by Just Join IT') {
        $this.remove();
        return;
      }

      if ($this.text().trim() === '' && $this.children().length === 0) {
        $this.remove();
      }
    });

    assert($('h1').length === 1, ' ⚠️  Unexpected output after parsing jji job html - h1');

    return $.html();
  }
}
