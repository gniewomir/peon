export interface JobJson {
  [key: string]: unknown;
}

export type JobMetadata = {
  strategy_slug: string;
  job_id: string;
  job_url: string;
  job_staging_dir: string;
  files: {
    cached: string;
    meta: string;
    json: string;
    html: string;
    md: string;
    clean_json?: CleanJson;
    normalized_json?: NormalizedJson;
  };
};

export interface CleanJson {
  url: string;
  company: string;
  position: string;
  salary: string;
  contract_type: string;
  contract_lenght: string;
  location: string;
  valid_until: string;
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
