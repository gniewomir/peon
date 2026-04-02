export interface StrategyStats {
  listings_processed: number;
  job_processed: number;
  cache_hit: number;
  cache_miss: number;
  cache_writes: number;
  unique: number;
  writes: number;
  errors: number;
}
