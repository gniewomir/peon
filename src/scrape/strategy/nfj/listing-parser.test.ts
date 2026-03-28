import { describe, expect, it } from 'vitest';
import { parseListingResponse } from './listing-parser.js';

describe('nfj parseListingResponse', () => {
  it('returns jobs and totalPages from API-shaped JSON', () => {
    const json = JSON.stringify({
      postings: [
        { id: '1', url: 'acme-senior-dev' },
        { id: '2', url: 'other-job' },
      ],
      totalPages: 5,
    });
    const result = parseListingResponse(json);
    expect(result).not.toBeNull();
    expect(result!.jobs).toHaveLength(2);
    expect(result!.jobs[0]).toMatchObject({ id: '1', url: 'acme-senior-dev' });
    expect(result!.totalPages).toBe(5);
  });

  it('allows empty postings with totalPages', () => {
    const json = JSON.stringify({ postings: [], totalPages: 1 });
    const result = parseListingResponse(json);
    expect(result).not.toBeNull();
    expect(result!.jobs).toHaveLength(0);
    expect(result!.totalPages).toBe(1);
  });

  it('returns null for invalid JSON', () => {
    expect(parseListingResponse('{')).toBeNull();
  });

  it('returns null when postings is not an array', () => {
    const json = JSON.stringify({ postings: {} });
    expect(parseListingResponse(json)).toBeNull();
  });

  it('returns null when postings key is missing', () => {
    expect(parseListingResponse(JSON.stringify({ totalPages: 1 }))).toBeNull();
  });
});
