import assert from 'node:assert';
import listingsJson from './listings.json' with { type: 'json' };
import { AbstractStrategy } from '../AbstractStrategy.js';
import { parseListingResponse } from './listingParser.js';
import type { ItemJson, Listing } from '../../types.js';
import type { CacheContext } from '../../lib/cache.js';
import type { KnownStrategy } from '../../../../lib/types.js';

export class BdjStrategy extends AbstractStrategy {
  public slug: KnownStrategy = 'bdj';

  private listingPageUrl(baseListingUrl: string, page: number): string {
    assert(page >= 1, 'listing page must be >= 1');
    return `${baseListingUrl}/page,${page}`;
  }

  async *listingGenerator(): AsyncGenerator<Listing> {
    const listings = listingsJson as Listing[];
    for (const listing of listings) {
      yield listing;
    }
    this.forgetSeen();
  }

  async *itemGenerator(listing: Listing, cache: CacheContext): AsyncGenerator<ItemJson> {
    let page = 1;

    while (true) {
      const url = this.listingPageUrl(listing.url, page);
      this.logger.log(` 📖 Fetching Bulldog job listing page ${page}: ${url}`);
      const cacheKey = cache.dailyCacheKey(url);
      let parsed: string = '';

      if (
        ['all', 'listings'].includes(this.options.cache) &&
        (await cache.hasCacheKey(cacheKey, this.logger))
      ) {
        parsed = await cache.readCache(cacheKey, this.logger);
      }

      if (!parsed) {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(this.options.requestsTimeout),
          headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'pl,en;q=0.9',
          },
        });

        if (!response.ok) {
          this.logger.error(` ⚠️  Listing response with status ${response.status}`, {
            status: response.status,
            statusText: response.statusText,
            url,
          });
          break;
        }

        try {
          parsed = await response.text();
          await cache.writeCache(cacheKey, parsed, this.logger);
        } catch (error) {
          this.logger.error(' ⚠️  Error while parsing listing response', {
            url,
            error,
          });
          break;
        }
      }

      assert(parsed, 'Parsed listing is set');

      const { jobs } = parseListingResponse(parsed);
      this.logger.log(`${jobs.length} on listing page ${page}: ${url}`);

      if (jobs.length === 0) {
        this.logger.log(' 👌 No job links on listing page; Bulldog job listing complete.');
        break;
      }

      for (const job of jobs) {
        if (this.hasSeen(this.itemToId(job))) {
          this.logger.warn(`item ${this.itemToUrl(job)} has been already seen. Skipping`);
          continue;
        }
        this.addSeen(this.itemToId(job));
        yield job;
      }

      page += 1;
    }
  }

  itemToUrl(job: ItemJson): string {
    assert('url' in job && typeof job.url === 'string');
    return job.url;
  }

  itemToId(job: ItemJson): string {
    assert('id' in job && typeof job.id === 'string');
    return job.id;
  }
}
