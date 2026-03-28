import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseListingResponse } from './listing-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('bdj parseListingResponse', () => {
  it('parses job ids and canonical URLs from __NEXT_DATA__ (city-remote fixture)', () => {
    const html = readFileSync(join(__dirname, 'fixtures', 'city-remote-listings.html'), 'utf8');
    const { jobs } = parseListingResponse(html);
    expect(jobs).toHaveLength(50);
    expect(jobs[0]).toMatchObject({
      id: '233931',
      url: 'https://bulldogjob.pl/companies/jobs/233931-cloud-tech-lead-microsoft-azure-data-cloud-warszawa-krakow-katowice-wroclaw-poznan-gdansk-lodz-kpmg-w-polsce',
    });
  });
});
