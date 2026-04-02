import type { JobJson, ListingParseResult } from '../../types/index.js';

interface NFJApiResponse {
  postings: JobJson[];
  totalPages?: number;
}

/**
 * Parses a No Fluff Jobs listing API JSON body.
 * Returns `null` when the payload is not a valid listing response (missing `postings` array).
 */
export function parseListingResponse(jsonText: string): ListingParseResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || !('postings' in parsed)) {
    return null;
  }

  const content = parsed as NFJApiResponse;
  if (!Array.isArray(content.postings)) {
    return null;
  }

  return {
    jobs: [...content.postings],
    totalPages: content.totalPages,
  };
}
