import type { JobJson } from '../../types/Job.js';

export interface ListingParseResult {
  jobs: JobJson[];
  /** JJI: `null` means no further pages */
  nextCursor?: number | null;
  /** NFJ pagination hint when present in the response */
  totalPages?: number;
}
