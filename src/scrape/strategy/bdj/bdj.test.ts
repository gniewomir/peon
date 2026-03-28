import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bdjStrategy } from '../index.js';
import { parseBdjListingJobsFromHtml } from './bdj.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('bdj extractContent', () => {
  it('includes JD, company blurb, and sidebar metadata (Luxoft 232726 fixture)', () => {
    const html = readFileSync(
      join(__dirname, 'fixtures', '232726-senior-full-stack-developer-krakow-luxoft-dxc.html'),
      'utf8',
    );
    const extracted = bdjStrategy().extractContent(html);
    expect(extracted).toContain(
      'In our agile operating model, crews are aligned to larger products and services fulfilling client needs and encompass multiple autonomous pods.',
    );
    expect(extracted).toContain('Experience with Cloud platforms or Kubernetes is a plus.');
    expect(extracted).toContain(
      'Technology is our passion! We focus on top engineering talent means that you will be working with the best industry professionals from around the world. Because of that, Luxoft is a global family with an epic atmosphere – we love what we do!',
    );
    expect(extracted).toContain('No salary info');
    expect(extracted).toContain('Valid for 18 days');
    expect(extracted).toContain('Krakow');
  });
});

describe('bdj listing page (__NEXT_DATA__)', () => {
  it('parses job ids and canonical URLs from props.pageProps.jobs', () => {
    const html = readFileSync(join(__dirname, 'fixtures', 'city-remote-listings.html'), 'utf8');
    const jobs = parseBdjListingJobsFromHtml(html);
    expect(jobs).toHaveLength(50);
    expect(jobs[0]).toEqual({
      id: '233931',
      url: 'https://bulldogjob.pl/companies/jobs/233931-cloud-tech-lead-microsoft-azure-data-cloud-warszawa-krakow-katowice-wroclaw-poznan-gdansk-lodz-kpmg-w-polsce',
    });
  });
});
