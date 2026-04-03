import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import type { JobMetadata } from '../../types/Job.js';
import { cleanMissingInputs, combineMissingInputs } from './readiness.js';

const tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function makeMeta(root: string): JobMetadata {
  const jobDir = join(root, 'nfj-1');
  return {
    strategy_slug: 'nfj',
    job_id: '1',
    job_url: 'https://example.com/job',
    job_staging_dir: jobDir,
    files: {
      job_cache: join(jobDir, 'cache.html'),
      job_meta: join(jobDir, 'meta.json'),
      job_json: join(jobDir, 'job.json'),
      job_html: join(jobDir, 'job.html'),
      job_markdown: join(jobDir, 'job.md'),
      job_clean_json: join(jobDir, 'job.clean.json'),
      job_clean_normalized_json: join(jobDir, 'job.normalized.json'),
      job_interrogated_json: join(jobDir, 'job.interrogated.json'),
      job_interrogated_normalized_json: join(jobDir, 'job.interrogated.normalized.json'),
      job_combined_json: join(jobDir, 'job.combined.json'),
    },
  };
}

describe('readiness helpers', () => {
  it('reports missing clean inputs', () => {
    const root = mkdtempSync(join(tmpdir(), 'peon-readiness-'));
    tmpRoots.push(root);
    const meta = makeMeta(root);
    mkdirSync(meta.job_staging_dir, { recursive: true });

    expect(cleanMissingInputs(meta)).toHaveLength(2);
    writeFileSync(meta.files.job_meta, '{}');
    expect(cleanMissingInputs(meta)).toEqual([meta.files.job_json]);
  });

  it('reports missing combine inputs', () => {
    const root = mkdtempSync(join(tmpdir(), 'peon-readiness-'));
    tmpRoots.push(root);
    const meta = makeMeta(root);
    mkdirSync(meta.job_staging_dir, { recursive: true });

    writeFileSync(meta.files.job_clean_json, '{}');
    expect(combineMissingInputs(meta)).toEqual([
      meta.files.job_interrogated_json,
      meta.files.job_markdown,
    ]);
  });
});
