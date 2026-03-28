import type {
  BaseJob,
  BaseStrategy,
  CacheOperations,
  Listing,
  Logger,
  StrategyStats,
} from '../types/index.js';

function createBaseStats(): StrategyStats {
  return {
    listings_processed: 0,
    job_processed: 0,
    cache_hit: 0,
    cache_miss: 0,
    cache_writes: 0,
    unique: 0,
    writes: 0,
    errors: 0,
  };
}

export abstract class AbstractStrategy implements BaseStrategy {
  readonly slug: string;
  stats: StrategyStats;
  ids: Set<string>;

  protected constructor(slug: string) {
    this.slug = slug;
    this.stats = createBaseStats();
    this.ids = new Set<string>();
  }

  abstract listingsGenerator(): AsyncGenerator<Listing>;

  abstract jobGenerator(
    listing: Listing,
    logger: Logger,
    cache: CacheOperations,
  ): AsyncGenerator<BaseJob>;

  abstract jobToUrl(job: BaseJob): string;

  abstract jobToId(job: BaseJob): string;

  abstract extractContent(content: string): string;
}
