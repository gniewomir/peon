import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import { createConcurrencyLimiter } from './lib/limiter.js';
import { processTransformEvent } from './run.js';
import type { JobMetadata } from '../types/Job.js';

const roots: string[] = [];

const logger = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      const { rm } = await import('node:fs/promises');
      await rm(root, { recursive: true, force: true });
    }),
  );
});

function limiters() {
  return {
    markdownLimiter: createConcurrencyLimiter(2),
    interrogateLimiter: createConcurrencyLimiter(1),
    cleanLimiter: createConcurrencyLimiter(2),
    combineLimiter: createConcurrencyLimiter(2),
  };
}

function metadata(jobDir: string): JobMetadata {
  return {
    strategy_slug: 'nfj',
    job_id: '123',
    job_url: 'https://nofluffjobs.com/job/abc',
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

async function seedCleanInputs(meta: JobMetadata): Promise<void> {
  await mkdir(meta.job_staging_dir, { recursive: true });
  await writeFile(meta.files.job_meta, JSON.stringify(meta, null, 2), 'utf8');
  await writeFile(
    meta.files.job_json,
    JSON.stringify(
      { title: 'Backend Engineer', name: 'Acme', salary: { min: 10, max: 20 } },
      null,
      2,
    ),
    'utf8',
  );
}

describe('processTransformEvent integration', () => {
  it('runs clean stage for add/change and keeps idempotent outputs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'peon-transform-'));
    roots.push(root);
    const stagingDir = join(root, 'data', 'staging');
    const jobDir = join(stagingDir, 'nfj-123');
    const meta = metadata(jobDir);
    await seedCleanInputs(meta);

    await processTransformEvent({
      logger,
      stagingDir,
      event: { type: 'add', payload: meta.files.job_json },
      ...limiters(),
    });

    const before = await stat(meta.files.job_clean_json);
    await new Promise((resolve) => setTimeout(resolve, 15));

    await processTransformEvent({
      logger,
      stagingDir,
      event: { type: 'change', payload: meta.files.job_json },
      ...limiters(),
    });

    const after = await stat(meta.files.job_clean_json);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it('waits for clean+interrogated+markdown before combine', async () => {
    const root = await mkdtemp(join(tmpdir(), 'peon-transform-'));
    roots.push(root);
    const stagingDir = join(root, 'data', 'staging');
    const jobDir = join(stagingDir, 'nfj-123');
    const meta = metadata(jobDir);
    await seedCleanInputs(meta);
    await writeFile(
      meta.files.job_clean_json,
      JSON.stringify(
        {
          url: 'u',
          company: 'c',
          position: 'p',
          seniority_level: '',
          contract: [],
          locations: [],
          expires: '',
          required_skills: [],
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(meta.files.job_markdown, '- Offer valid until: 12.04.2026', 'utf8');

    await processTransformEvent({
      logger,
      stagingDir,
      event: { type: 'add', payload: meta.files.job_markdown },
      ...limiters(),
    });

    const { access } = await import('node:fs/promises');
    await expect(access(meta.files.job_combined_json)).rejects.toThrow();

    await writeFile(
      meta.files.job_interrogated_json,
      JSON.stringify({ foo: 'bar' }, null, 2),
      'utf8',
    );
    await processTransformEvent({
      logger,
      stagingDir,
      event: { type: 'change', payload: meta.files.job_interrogated_json },
      ...limiters(),
    });

    const combined = await readFile(meta.files.job_combined_json, 'utf8');
    expect(combined).toContain('"interrogated"');
    expect(combined).toContain('"expires"');
  });

  it('writes error and quarantines failing job directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'peon-transform-'));
    roots.push(root);
    const stagingDir = join(root, 'data', 'staging');
    const jobDir = join(stagingDir, 'nfj-123');
    await mkdir(jobDir, { recursive: true });
    await writeFile(join(jobDir, 'job.json'), '{}', 'utf8');

    await processTransformEvent({
      logger,
      stagingDir,
      event: { type: 'add', payload: join(jobDir, 'job.json') },
      ...limiters(),
    });

    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(join(root, 'data', 'quarantine'));
    expect(entries.length).toBe(1);
    expect(entries[0]?.startsWith('nfj-123__')).toBe(true);
  });
});
