import assert from 'node:assert';
import listingsJson from './listings.json' with { type: 'json' };
import { AbstractStrategy } from '../AbstractStrategy.js';
import type { ItemJson, Listing, ListingParseResult } from '../../types.js';
import type { CacheOperations } from '../../lib/cache.js';
import type { KnownStrategy } from '../../../../lib/types.js';
import { JsonNavigator } from '../../../transform/lib/JsonNavigator.js';
import { statsAddToCounter } from '../../../../lib/stats.js';
import { transliteratePolishString } from '../../lib/transliteratePolishString.js';

interface NFJListing extends Listing {
  meta: {
    rawBody: string;
  };
}

interface NFJApiResponse {
  postings: ItemJson[];
  totalPages?: number;
}

export class NfjStrategy extends AbstractStrategy {
  public readonly slug: KnownStrategy = 'nfj';

  async *listingGenerator(): AsyncGenerator<Listing> {
    const listings = listingsJson as Listing[];
    for (const listing of listings) {
      assert('meta' in listing, ' ⚠️  No metadata for listing');
      assert(
        typeof listing.meta === 'object' &&
          listing.meta !== null &&
          'rawBody' in listing.meta &&
          typeof listing.meta.rawBody === 'string' &&
          listing.meta.rawBody.length > 0,
        ' ⚠️  No request body in metadata',
      );
      yield listing;
    }
    this.resetSeen();
  }

  async *itemGenerator(listing: Listing, cache: CacheOperations): AsyncGenerator<ItemJson> {
    const nfjListing = listing as NFJListing;
    let currentPage = 1;
    let totalPages: number | null = null;

    while (true) {
      this.logger.log(
        ` 📖 Fetching NFJ page ${currentPage}${totalPages ? `/${totalPages}` : ''}...`,
      );
      const urlObj = new URL(nfjListing.url);
      urlObj.searchParams.set('pageFrom', (currentPage - 1).toString());
      urlObj.searchParams.set('pageTo', currentPage.toString());
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
          method: 'POST',
          signal: AbortSignal.timeout(this.options.requestsTimeout),
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

      const { jobs, totalPages: responseTotalPages } = parsed;

      if (totalPages === null && responseTotalPages !== undefined) {
        totalPages = responseTotalPages;
      }

      if (jobs.length === 0) {
        this.logger.log(' 👌 No more postings; NFJ API scraping complete.');
        break;
      }

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
        if ('name' in job && typeof job.name === 'string' && job.name.includes('Żabka Polska')) {
          statsAddToCounter('item_skipped_extraction_zabka_marketing_nfj');
          continue;
        }
        if (this.isDuplicate(job)) {
          statsAddToCounter('item_skipped_extraction_duplicate_nfj');
          this.logger.debug('Found nfj duplicate, skipping extraction', {
            canonicalUrl: this.slugToUrl(this.establishCanonicalUrlSlug(new JsonNavigator(job))),
            currentUrl: this.itemToUrl(job).trim().toLowerCase(),
          });
          continue;
        }
        yield job;
      }

      if (totalPages === 0) {
        this.logger.log(' 👌 totalPages=0; NFJ API scraping complete.');
        break;
      }

      if (totalPages !== null && totalPages > 0 && currentPage >= totalPages) {
        this.logger.log(' 👌 Reached last page. NFJ API scraping complete.');
        break;
      }

      currentPage++;
    }
  }

  itemToUrl(job: ItemJson): string {
    assert('url' in job && typeof job.url === 'string', ' ⚠️  No url in NFJ job');
    return this.slugToUrl(job.url);
  }

  itemToId(job: ItemJson): string {
    assert('id' in job && typeof job.id === 'string', ' ⚠️  No url in NFJ job');
    return transliteratePolishString(job.id).trim().toLowerCase();
  }

  private slugToUrl(slug: string): string {
    return `https://nofluffjobs.com/job/${slug}`;
  }

  private isDuplicate(job: ItemJson): boolean {
    return (
      this.slugToUrl(this.establishCanonicalUrlSlug(new JsonNavigator(job))) !==
      this.itemToUrl(job).trim().toLowerCase()
    );
  }

  private establishCanonicalUrlSlug(nav: JsonNavigator): string {
    const urls = nav
      .getPath('location.places')
      .toArray()
      .map((place) => place.getPath('url').toString().toLowerCase().trim())
      .sort((a, b) => a.length - b.length);
    const urlIncludeRemote = urls.filter((url: string) => url.includes('remote'));
    if (urlIncludeRemote.length > 0) {
      return urlIncludeRemote[0];
    }
    assert(urls[0], 'Url cannot be undefined');
    return urls[0];
  }

  private parseListingResponse(json: unknown): ListingParseResult {
    if (!json || typeof json !== 'object' || !('postings' in json)) {
      throw new Error('Invalid JSON (missing postings)');
    }

    const content = json as NFJApiResponse;
    if (!Array.isArray(content.postings)) {
      throw new Error('Invalid JSON (not an array)');
    }

    return {
      jobs: [...content.postings],
      totalPages: content.totalPages,
    };
  }
}
