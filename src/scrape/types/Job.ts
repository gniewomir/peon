export interface JobJson {
  [key: string]: unknown;
}

export interface JJIJobJson extends JobJson {
  guid: string;
  slug: string;
}

export interface NFJJobJson extends JobJson {
  id: string;
  url: string;
}

export interface BDJJobJson extends JobJson {
  id: string;
  url: string;
}
