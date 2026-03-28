export interface BaseJob {
  [key: string]: unknown;
}

export interface ProcessedJob extends BaseJob {
  strategy_id: string;
  strategy_slug: string;
  strategy_url: string;
  strategy_from_cache: boolean;
  strategy_is_up: boolean | null;
}

export interface JJIJob extends BaseJob {
  guid: string;
  slug: string;
}

export interface NFJJob extends BaseJob {
  id: string;
  url: string;
}

export interface BDJJob extends BaseJob {
  id: string;
  url: string;
}
