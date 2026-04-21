import assert from 'node:assert';
import listingsJson from './listings.json' with { type: 'json' };
import { AbstractStrategy } from '../AbstractStrategy.js';
import type { ItemJson, Listing, ListingParseResult } from '../../types.js';
import type { CacheOperations } from '../../lib/cache.js';
import type { KnownStrategy } from '../../../../lib/types.js';

interface JJIApiResponse {
  data: ItemJson[];
  meta?: {
    next?: {
      cursor: number | null;
    };
  };
}

export class JjiStrategy extends AbstractStrategy {
  public readonly slug: KnownStrategy = 'jji';

  async *listingGenerator(): AsyncGenerator<Listing> {
    const listings = listingsJson as Listing[];
    for (const listing of listings) {
      yield listing;
    }
    this.forgetSeen();
  }

  async *itemGenerator(listing: Listing, cache: CacheOperations): AsyncGenerator<ItemJson> {
    let currentCursor = 0;

    while (true) {
      this.logger.log(` 📖 Fetching listing page (cursor=${currentCursor})...`);

      const urlObj = new URL(listing.url);
      urlObj.searchParams.set('from', currentCursor.toString());
      const url = urlObj.toString();
      const cacheKey = cache.dailyCacheKey(url);
      let parsed: ListingParseResult | null = null;

      if (
        ['all', 'listings'].includes(this.options.cache) &&
        (await cache.hasCacheKey(cacheKey, this.logger))
      ) {
        try {
          parsed = this.parseListingResponse(
            JSON.parse(await cache.readCache(cacheKey, this.logger)),
          );
        } catch (error) {
          this.logger.error(' ⚠️  Cannot parse listing from cache', {
            url,
            error,
            cacheKey,
          });
          continue;
        }
      }

      if (!parsed) {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(this.options.requestsTimeout),
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
          this.logger.error(` ⚠️  Listing response with status ${response.status}`, {
            url,
          });
          break;
        }

        try {
          const json = await response.json();
          await cache.writeCache(cacheKey, json, this.logger);
          parsed = this.parseListingResponse(json);
        } catch (error) {
          this.logger.error(' ⚠️  Error while parsing listing response', {
            url,
            error,
          });
          break;
        }
      }

      assert(parsed, 'Parsed listing is set');

      const { jobs, nextCursor } = parsed;
      const jobsCount = jobs.length;
      this.logger.log(`${jobs.length} on listing page: ${url}`);
      while (jobs.length > 0) {
        const job = jobs.pop();
        if (!job) {
          this.logger.warn(`Empty job on listing. Skipping`);
          continue;
        }
        if (this.hasSeen(this.itemToId(job))) {
          this.logger.warn(`item ${this.itemToUrl(job)} has been already seen. Skipping`);
          continue;
        }
        this.addSeen(this.itemToId(job));
        yield job;
      }

      if (
        nextCursor === null ||
        nextCursor === undefined ||
        nextCursor === currentCursor ||
        nextCursor === 10_000 ||
        jobsCount === 0
      ) {
        this.logger.log(' 👌 Reached last page. JJI API scraping complete.', {
          nextCursor,
          currentCursor,
          items: jobs.length,
        });
        break;
      }
      currentCursor = nextCursor;
    }
  }

  itemToUrl(job: ItemJson): string {
    assert('slug' in job && typeof job.slug === 'string', ' ⚠️  No slug in JJI job');
    return `https://justjoin.it/job-offer/${job.slug}`;
  }

  itemToId(job: ItemJson): string {
    assert('guid' in job && typeof job.guid === 'string', ' ⚠️  No guid in JJI job');
    return job.guid;
  }

  private parseListingResponse(response: unknown): ListingParseResult {
    if (!response || typeof response !== 'object' || !('data' in response)) {
      throw new Error('Invalid JSON (missing data)');
    }

    const content = response as JJIApiResponse;
    if (!Array.isArray(content.data)) {
      throw new Error('Invalid JSON (not an array)');
    }

    const nextCursor = content.meta?.next?.cursor;
    return {
      jobs: [...content.data],
      nextCursor,
    };
  }
}
