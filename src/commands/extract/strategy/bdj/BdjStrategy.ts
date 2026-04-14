import assert from 'node:assert';
import listingsJson from './listings.json' with { type: 'json' };
import { AbstractStrategy } from '../AbstractStrategy.js';
import { parseListingResponse } from './listingParser.js';
import type { JobJson, Listing } from '../../types.js';
import type { CacheOperations } from '../../lib/cache.js';
import type { KnownStrategy } from '../../../../lib/types.js';

export class BdjStrategy extends AbstractStrategy {
  public slug: KnownStrategy = 'bdj';

  private listingPageUrl(baseListingUrl: string, page: number): string {
    assert(page >= 1, 'listing page must be >= 1');
    return `${baseListingUrl}/page,${page}`;
  }

  async *jobListingsGenerator(): AsyncGenerator<Listing> {
    const listings = listingsJson as Listing[];
    for (const listing of listings) {
      yield listing;
    }
  }

  async *jobGenerator(listing: Listing, cache: CacheOperations): AsyncGenerator<JobJson> {
    let page = 1;

    while (true) {
      const url = this.listingPageUrl(listing.url, page);
      this.logger.log(` 📖 Fetching Bulldog job listing page ${page}: ${url}`);

      const cacheKey = cache.dailyCacheKey(url);
      let listingHtml: string;
      if (this.options.cache !== 'jobs' && (await cache.hasCacheKey(cacheKey, this.logger))) {
        listingHtml = await cache.readCache(cacheKey, this.logger);
      } else {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(this.options.requestsTimeout),
          headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'pl,en;q=0.9',
          },
        });
        if (!response.ok) {
          throw new Error(` ⚠️  HTTP ${response.status}: ${response.statusText} for ${url}`);
        }
        listingHtml = await response.text();
        await cache.writeCache(cacheKey, listingHtml, this.logger);
      }
      const { jobs } = parseListingResponse(listingHtml);
      this.logger.log(`${jobs.length} on listing page ${page}: ${url}`);

      if (jobs.length === 0) {
        this.logger.log(' 👌 No job links on listing page; Bulldog job listing complete.');
        break;
      }

      for (const job of jobs) {
        assert('id' in job && typeof job.id === 'string');
        yield Promise.resolve(job);
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
