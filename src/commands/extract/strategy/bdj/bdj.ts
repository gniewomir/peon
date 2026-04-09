import assert from 'node:assert';
import { SCRAPE_REQUEST_TIMEOUT_MS } from '../../constants.js';
import type { JobJson, CacheOperations, Listing } from '../../types/index.js';
import listingsJson from './listings.json' with { type: 'json' };
import { AbstractStrategy } from '../AbstractStrategy.js';
import { parseListingResponse } from './listing-parser.js';
import type { Logger } from '../../../lib/logger.js';
import type { Strategy } from '../types.js';

export const BDJ_SLUG = 'bdj';

export class BdjStrategy extends AbstractStrategy {
  constructor() {
    super(BDJ_SLUG);
  }

  private static listingPageUrl(baseListingUrl: string, page: number): string {
    assert(page >= 1, 'listing page must be >= 1');
    if (page === 1) {
      return baseListingUrl;
    }
    return `${baseListingUrl.replace(/\/$/, '')}/page,${page}`;
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
    let page = 1;

    while (true) {
      const url = BdjStrategy.listingPageUrl(listing.url, page);
      logger.log(` 📖 Fetching Bulldogjob listing page ${page}: ${url}`);

      const cacheKey = cache.dailyCacheKey(url);
      let html: string;
      if (cache.hasCacheKey(cacheKey, logger)) {
        html = await cache.readCache(cacheKey, logger);
      } else {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(SCRAPE_REQUEST_TIMEOUT_MS),
          headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'pl,en;q=0.9',
          },
        });
        if (!response.ok) {
          throw new Error(` ⚠️  HTTP ${response.status}: ${response.statusText} for ${url}`);
        }
        html = await response.text();
        await cache.writeCache(cacheKey, html, logger);
      }

      const { jobs } = parseListingResponse(html);
      if (jobs.length === 0) {
        logger.log(' 👌 No job links on listing page; Bulldogjob listing complete.');
        break;
      }

      let yielded = 0;
      for (const job of jobs) {
        assert('id' in job && typeof job.id === 'string');
        if (this.ids.has(job.id)) {
          continue;
        }
        this.ids.add(job.id);
        yield job;
        yielded += 1;
      }

      if (yielded === 0) {
        logger.log(
          ' 👌 Listing page contained only jobs already seen; Bulldogjob listing complete.',
        );
        break;
      }

      page += 1;
    }
  }

  jobToUrl(job: JobJson): string {
    assert('url' in job && typeof job.url === 'string');
    return job.url;
  }

  jobToId(job: JobJson): string {
    assert('id' in job && typeof job.id === 'string');
    return job.id;
  }
}

export function bdjStrategy(): Strategy {
  return new BdjStrategy();
}
