import { AbstractStrategy } from '../AbstractStrategy.js';
import type { KnownStrategy } from '../../../../lib/types.js';
import type { CacheContext } from '../../lib/cache.js';
import type { ItemJson, Listing } from '../../types.js';
import listingsJson from './listings.json' with { type: 'json' };
import assert from 'node:assert';

export class PtcStrategy extends AbstractStrategy {
  readonly slug: KnownStrategy = 'ptc';

  async *itemGenerator(listing: Listing, cache: CacheContext): AsyncGenerator<ItemJson> {
    console.log(listing, cache.dailyCacheKey('xxx'));
    yield {};
  }

  itemToUrl(job: ItemJson): string {
    assert('url' in job && typeof job.url === 'string', ' ⚠️  No url in NFJ job');
    return job.url;
  }

  itemToId(job: ItemJson): string {
    assert('id' in job && typeof job.id === 'string', ' ⚠️  No url in NFJ job');
    return job.id;
  }

  async *listingGenerator(): AsyncGenerator<Listing> {
    const listings = listingsJson as Listing[];
    for (const listing of listings) {
      assert('meta' in listing, ' ⚠️  No metadata for listing');
      yield listing;
    }
    this.forgetSeen();
  }
}
