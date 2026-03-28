import assert from 'node:assert';
import { SCRAPE_REQUEST_TIMEOUT_MS } from '../../constants.js';
import * as cheerio from 'cheerio';
import { clean } from '../../lib/html.js';
import type {
  JobJson,
  BaseStrategy,
  CacheOperations,
  Logger,
  Listing,
  NFJJobJson,
} from '../../types/index.js';
import listingsJson from './listings.json' with { type: 'json' };
import { AbstractStrategy } from '../AbstractStrategy.js';

interface NFJListing extends Listing {
  meta: {
    rawBody: string;
  };
}

interface NFJApiResponse {
  postings: NFJJobJson[];
  totalPages?: number;
}

export const NFJ_SLUG = 'nfj';

export class NfjStrategy extends AbstractStrategy {
  constructor() {
    super(NFJ_SLUG);
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
  ): AsyncGenerator<JobJson> {
    const nfjListing = listing as NFJListing;
    let currentPage = 1;
    let totalPages: number | null = null;

    assert('meta' in nfjListing, ' ⚠️  No metadata for listing');
    assert(
      'rawBody' in nfjListing.meta &&
        typeof nfjListing.meta.rawBody === 'string' &&
        nfjListing.meta.rawBody.length > 0,
      ' ⚠️  No request body in metadata',
    );

    while (true) {
      logger.log(` 📖 Fetching NFJ page ${currentPage}${totalPages ? `/${totalPages}` : ''}...`);

      const urlObj = new URL(nfjListing.url);
      urlObj.searchParams.set('pageTo', currentPage.toString());
      const url = urlObj.toString();

      const cacheKey = cache.dailyCacheKey(url);

      let content: NFJApiResponse;
      if (cache.hasCacheKey(cacheKey, logger)) {
        content = JSON.parse(await cache.readCache(cacheKey, logger)) as NFJApiResponse;
      } else {
        const response = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(SCRAPE_REQUEST_TIMEOUT_MS),
          headers: {
            accept: 'application/json, text/plain, */*',
            'accept-language': 'en, en-gb;q=0.9, en-us;q=0.8, en;q=0.7',
            'cache-control': 'no-cache',
            'content-type': 'application/infiniteSearch+json',
            origin: 'https://nofluffjobs.com',
            pragma: 'no-cache',
            priority: 'u=1, i',
          },
          body: nfjListing.meta.rawBody,
        });

        if (!response.ok) {
          logger.error(' ⚠️  Error response', await response.json());
          throw new Error(` ⚠️  HTTP ${response.status}: ${response.statusText}`);
        }

        content = (await response.json()) as NFJApiResponse;
        await cache.writeCache(cacheKey, JSON.stringify(content), logger);
      }

      if (!content || !content.postings || !Array.isArray(content.postings)) {
        logger.log(' ⚠️  Invalid content structure or no data found', Object.keys(content));
        break;
      }

      if (totalPages === null && content.totalPages !== undefined) {
        totalPages = content.totalPages;
      }

      if (content.postings.length === 0) {
        logger.log(' 👌 No more postings; NFJ API scraping complete.');
        break;
      }

      while (content.postings.length > 0) {
        const job = content.postings.pop();
        if (job) {
          assert('id' in job, ' ⚠️  No id in NFJ job');
          this.ids.add(job.id);
          yield job;
        }
      }

      if (totalPages === 0) {
        logger.log(' 👌 totalPages=0; NFJ API scraping complete.');
        break;
      }

      if (totalPages !== null && totalPages > 0 && currentPage >= totalPages) {
        logger.log(' 👌 Reached last page. NFJ API scraping complete.');
        break;
      }

      currentPage++;
    }
  }

  jobToUrl(job: JobJson): string {
    const j = job as NFJJobJson;
    return `https://nofluffjobs.com/job/${String(j.url)}`;
  }

  jobToId(job: JobJson): string {
    return (job as NFJJobJson).id;
  }

  extractContent(dirtyContent: string): string {
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

export function nfjStrategy(): BaseStrategy {
  return new NfjStrategy();
}
