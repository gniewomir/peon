import type { JobJson, ListingParseResult } from '../../types/index.js';

interface JJIApiResponse {
  data: JobJson[];
  meta?: {
    next?: {
      cursor: number | null;
    };
  };
}

/**
 * Parses a Just Join IT listing API JSON body.
 * Returns `null` when the payload is not a valid listing response (missing `data` array).
 */
export function parseListingResponse(jsonText: string): ListingParseResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
    return null;
  }

  const content = parsed as JJIApiResponse;
  if (!Array.isArray(content.data)) {
    return null;
  }

  const nextCursor = content.meta?.next?.cursor;
  return {
    jobs: [...content.data],
    nextCursor,
  };
}
