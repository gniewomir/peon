import assert from 'node:assert';
import { SCRAPE_REQUEST_TIMEOUT_MS } from '../../constants.js';
import type { CacheOperations, JobJson, Listing } from '../../types/index.js';
import listingsJson from './listings.json' with { type: 'json' };
import { AbstractStrategy } from '../AbstractStrategy.js';
import { parseListingResponse } from './listing-parser.js';
import type { Logger } from '../../../lib/logger.js';
import type { Strategy } from '../types.js';

export const JJI_SLUG = 'jji';

export class JjiStrategy extends AbstractStrategy {
  constructor() {
    super(JJI_SLUG);
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
    let currentCursor = 0;
    let pageNumber = 1;

    while (true) {
      logger.log(` 📖 Fetching page ${pageNumber} (from=${currentCursor})...`);

      const urlObj = new URL(listing.url);
      urlObj.searchParams.set('from', currentCursor.toString());
      const url = urlObj.toString();

      const cacheKey = cache.dailyCacheKey(url);

      let jsonText: string;
      if (cache.hasCacheKey(cacheKey, logger)) {
        jsonText = await cache.readCache(cacheKey, logger);
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

      const { jobs, nextCursor } = parsed;
      const stack = [...jobs];
      while (stack.length > 0) {
        const job = stack.pop();
        if (job) {
          assert('guid' in job && typeof job.guid === 'string', ' ⚠️  No guid in JJI job');
          this.ids.add(job.guid);
          yield job;
        }
      }

      if (
        nextCursor === null ||
        nextCursor === undefined ||
        nextCursor === currentCursor ||
        parsed.jobs.length === 0
      ) {
        logger.log(' 👌 Reached last page. API scraping complete.');
        break;
      }
      currentCursor = nextCursor;
      pageNumber++;
    }
  }

  jobToUrl(job: JobJson): string {
    assert('slug' in job && typeof job.slug === 'string', ' ⚠️  No slug in JJI job');
    return `https://justjoin.it/job-offer/${job.slug}`;
  }

  jobToId(job: JobJson): string {
    assert('guid' in job && typeof job.guid === 'string', ' ⚠️  No guid in JJI job');
    return job.guid;
  }
}

export function jjiStrategy(): Strategy {
  return new JjiStrategy();
}
