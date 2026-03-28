import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import assert from 'node:assert';
import * as cheerio from 'cheerio';
import { clean } from '../../lib/html.js';
import type { JobPageParser } from '../../types/index.js';

export class JjiJobPageParser implements JobPageParser {
  extract(dirtyContent: string): string {
    const content = clean(dirtyContent);
    assert(content.length > 0, 'extractContent: content must be a non empty string');

    let $ = cheerio.load(content);
    const payload = $('h2').parent().parent().parent().html();

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
