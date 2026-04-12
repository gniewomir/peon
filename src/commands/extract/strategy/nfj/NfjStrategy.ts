import assert from 'node:assert';
import listingsJson from './listings.json' with { type: 'json' };
import { AbstractStrategy } from '../AbstractStrategy.js';
import { parseListingResponse } from './listing-parser.js';
import type { Logger } from '../../../lib/logger.js';
import type { JobJson, Listing } from '../../types.js';
import type { CacheOperations } from '../../lib/cache.js';
import type { KnownStrategy } from '../../../lib/types.js';
import { slugifyWtPolishTransliteration } from '../../../lib/slugifyWtPolishTransliteration.js';
import type { GoToOptions } from 'puppeteer';

interface NFJListing extends Listing {
  meta: {
    rawBody: string;
  };
}

export class NfjStrategy extends AbstractStrategy {
  public readonly slug: KnownStrategy = 'nfj';

  constructor(logger: Logger) {
    super({
      logger,
    });
  }

  pageOpenOptions(): GoToOptions {
    return {
      waitUntil: 'load',
      timeout: 30000,
    };
  }

  async *jobListingsGenerator(): AsyncGenerator<Listing> {
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

      let jsonText: string;
      if (await cache.hasCacheKey(cacheKey, logger)) {
        jsonText = await cache.readCache(cacheKey, logger);
      } else {
        const response = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(60_000),
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

        const content = await response.json();
        jsonText = JSON.stringify(content);
        await cache.writeCache(cacheKey, jsonText, logger);
      }

      const parsed = parseListingResponse(jsonText);
      if (parsed === null) {
        let keys: string[] = [];
        try {
          const o: unknown = JSON.parse(jsonText);
          if (o && typeof o === 'object') {
            keys = Object.keys(o as object);
          }
        } catch {
          /* ignore */
        }
        logger.log(' ⚠️  Invalid content structure or no data found', keys);
        break;
      }

      const { jobs, totalPages: responseTotalPages } = parsed;

      if (totalPages === null && responseTotalPages !== undefined) {
        totalPages = responseTotalPages;
      }

      if (jobs.length === 0) {
        logger.log(' 👌 No more postings; NFJ API scraping complete.');
        break;
      }

      const stack = [...jobs];
      while (stack.length > 0) {
        const job = stack.pop();
        if (job) {
          assert('id' in job && typeof job.id === 'string', ' ⚠️  No id in NFJ job');
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
    assert('url' in job && typeof job.url === 'string', ' ⚠️  No url in NFJ job');
    return `https://nofluffjobs.com/job/${job.url}`;
  }

  jobToId(job: JobJson): string {
    assert('id' in job && typeof job.id === 'string', ' ⚠️  No id in NFJ job');
    return slugifyWtPolishTransliteration(job.id);
  }
}
