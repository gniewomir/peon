import { describe, expect, it } from 'vitest';
import { parseListingResponse } from './listing-parser.js';

describe('jji parseListingResponse', () => {
  it('returns jobs and nextCursor from API-shaped JSON', () => {
    const json = JSON.stringify({
      data: [
        { guid: 'a', slug: 'job-a' },
        { guid: 'b', slug: 'job-b' },
      ],
      meta: { next: { cursor: 42 } },
    });
    const result = parseListingResponse(json);
    expect(result).not.toBeNull();
    expect(result!.jobs).toHaveLength(2);
    expect(result!.jobs[0]).toMatchObject({ guid: 'a', slug: 'job-a' });
    expect(result!.nextCursor).toBe(42);
  });

  it('returns nextCursor null when API signals last page', () => {
    const json = JSON.stringify({
      data: [],
      meta: { next: { cursor: null } },
    });
    const result = parseListingResponse(json);
    expect(result).not.toBeNull();
    expect(result!.jobs).toHaveLength(0);
    expect(result!.nextCursor).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseListingResponse('not json')).toBeNull();
  });

  it('returns null when data is not an array', () => {
    const json = JSON.stringify({ data: {}, meta: {} });
    expect(parseListingResponse(json)).toBeNull();
  });

  it('returns null when data key is missing', () => {
    expect(parseListingResponse(JSON.stringify({ meta: {} }))).toBeNull();
  });
});
