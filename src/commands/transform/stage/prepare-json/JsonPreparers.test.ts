import { describe, expect, it } from 'vitest';
import type { JobMetadata } from '../../../types/Job.js';
import { JsonPreparerBdj } from './JsonPreparerBdj.js';
import { JsonPreparerJji } from './JsonPreparerJji.js';
import { JsonPreparerNfj } from './JsonPreparerNfj.js';

const meta: JobMetadata = {
  strategy_slug: 'nfj',
  job_id: '1',
  job_url: 'https://example.com/job',
  job_staging_dir: '/tmp/job',
  files: {
    job_cache: '/tmp/cache',
    job_meta: '/tmp/meta.json',
  },
};

describe('JsonPreparers', () => {
  it('passes through valid objects for all strategies', () => {
    const nfjInput = { id: 'x', url: 'nfj-job-url', title: 'Engineer' };
    const jjiInput = { guid: 'guid-1', slug: 'slug-1', title: 'Engineer' };
    const bdjInput = { id: '42', url: 'https://bulldogjob.pl/companies/jobs/42-engineer' };
    expect(new JsonPreparerNfj().prepare(nfjInput, meta)).toEqual(nfjInput);
    expect(new JsonPreparerJji().prepare(jjiInput, { ...meta, strategy_slug: 'jji' })).toEqual(
      jjiInput,
    );
    expect(new JsonPreparerBdj().prepare(bdjInput, { ...meta, strategy_slug: 'bdj' })).toEqual(
      bdjInput,
    );
  });

  it('throws on invalid payload', () => {
    expect(() => new JsonPreparerNfj().prepare(null, meta)).toThrowError(/Invalid raw job payload/);
    expect(() => new JsonPreparerJji().prepare({ guid: 'x' }, meta)).toThrowError(/slug/);
    expect(() => new JsonPreparerBdj().prepare({ id: 'x' }, meta)).toThrowError(/url/);
  });
});
