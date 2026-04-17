export interface ItemJson {
  [key: string]: unknown;
}
export interface Listing {
  url: string;
  description: string;
  [key: string]: unknown;
}

export interface ListingParseResult {
  jobs: ItemJson[];
  /** JJI: `null` means no further pages */
  nextCursor?: number | null;
  /** NFJ pagination hint when present in the response */
  totalPages?: number;
}
