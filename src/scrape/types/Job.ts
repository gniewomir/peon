export interface JobJson {
  [key: string]: unknown;
}

export type JobMetadata = {
  strategy_slug: string;
  job_id: string;
  job_url: string;
  job_staging_dir: string;
  files: {
    job_cache: string;
    job_meta: string;
    listing_json: string;
    job_html: string;
    job_markdown: string;
    job_clean_json: string;
    job_normalized_json: string;
  };
};

export interface CleanJson {
  url: string;
  company: string;
  position: string;
  /** Normalized label for required experience (e.g. senior, mid, lead); empty if unknown. */
  seniority_level: string;
  contract: {
    type: string;
    length: string;
    from: string;
    to: string;
    currency: string;
    unit: string;
  }[];
  locations: string[];
  expires: string;
}

export interface NormalizedJson {
  url: string;
  company: string;
  position: string;
  salary: {
    from: number;
    to: number;
    currency: 'PLN' | 'EUR' | 'USD' | 'GBP' | 'CHF' | 'other' | 'unknown';
    period: 'hour' | 'day' | 'month' | 'year' | 'other' | 'unknown';
  };
  contract_type: 'b2b' | 'coe' | 'other' | 'unknown';
  contract_length: 'part-time' | 'full-time' | 'project' | 'internship' | 'other' | 'unknown';
  location: 'remote' | 'onsite' | 'hybrid' | 'unknown';
  cities: string[];
  valid_until: Date;
}
