import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import assert from 'node:assert';
import { SCRAPE_REQUEST_TIMEOUT_MS } from '../../constants.js';
import * as cheerio from 'cheerio';
import { clean } from '../../lib/html.js';
import type {
  BaseJob,
  BaseStrategy,
  CacheOperations,
  Logger,
  JJIJob,
  Listing,
} from '../../types/index.js';
import listingsJson from './listings.json' with { type: 'json' };
import { AbstractStrategy } from '../AbstractStrategy.js';

interface JJIApiResponse {
  data: JJIJob[];
  meta?: {
    next?: {
      cursor: number | null;
    };
  };
}

export const JJI_SLUG = 'jji';

export class JjiStrategy extends AbstractStrategy {
  constructor() {
    super(JJI_SLUG);
  }

  async *listingsGenerator(): AsyncGenerator<Listing> {
    const listings = listingsJson as Listing[];
    for (const listing of listings) {
      yield listing;
    }
  }

  async *jobGenerator(
    listing: Listing,
    logger: Logger,
    cache: CacheOperations,
  ): AsyncGenerator<BaseJob> {
    let currentCursor = 0;
    let pageNumber = 1;

    while (true) {
      logger.log(` 📖 Fetching page ${pageNumber} (from=${currentCursor})...`);

      const urlObj = new URL(listing.url);
      urlObj.searchParams.set('from', currentCursor.toString());
      const url = urlObj.toString();

      const cacheKey = cache.dailyCacheKey(url);

      let content: JJIApiResponse;
      if (cache.hasCacheKey(cacheKey, logger)) {
        content = JSON.parse(await cache.readCache(cacheKey, logger)) as JJIApiResponse;
      } else {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(SCRAPE_REQUEST_TIMEOUT_MS),
          headers: {
            accept: 'application/json, text/plain, */*',
            'accept-language': 'en, en-gb;q=0.9, en-us;q=0.8, en;q=0.7',
            'cache-control': 'no-cache',
            origin: 'https://justjoin.it',
            pragma: 'no-cache',
            priority: 'u=1, i',
            referer: 'https://justjoin.it/',
          },
        });

        if (!response.ok) {
          logger.error(' ⚠️  Error response', await response.json());
          throw new Error(` ⚠️  HTTP ${response.status}: ${response.statusText}`);
        }

        content = (await response.json()) as JJIApiResponse;
        await cache.writeCache(cacheKey, JSON.stringify(content), logger);
      }

      if (!content || !content.data || !Array.isArray(content.data)) {
        logger.log(' ⚠️  Invalid content structure or no data found', Object.keys(content));
        break;
      }

      while (content.data.length > 0) {
        const job = content.data.pop();
        if (job) {
          assert('guid' in job, ' ⚠️  No guid in JJI job');
          this.ids.add(job.guid);
          yield job;
        }
      }

      if (!content.meta || !content.meta.next || content.meta.next.cursor === null) {
        logger.log(' 👌 Reached last page. API scraping complete.');
        break;
      }
      currentCursor = content.meta.next.cursor;
      pageNumber++;
    }
  }

  jobToUrl(job: BaseJob): string {
    const j = job as JJIJob;
    return `https://justjoin.it/job-offer/${j.slug}`;
  }

  jobToId(job: BaseJob): string {
    return (job as JJIJob).guid;
  }

  extractContent(dirtyContent: string): string {
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

export function jjiStrategy(): BaseStrategy {
  return new JjiStrategy();
}
