import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import type { Logger } from '../../../types/Logger.js';
import { CleanJsonStage } from './CleanJsonStage.js';
import { JsonPreparerNfj } from '../prepare-json/JsonPreparerNfj.js';
import { CleanerNfj } from './CleanerNfj.js';

const tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function logger(): Logger {
  return {
    withSuffix: () => logger(),
    debug: () => undefined,
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

describe('CleanJsonStage (merged prepare+clean)', () => {
  it('creates job.json and job.clean.json from raw-job.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'peon-clean-json-'));
    tmpRoots.push(root);
    const jobDir = join(root, 'nfj-1');
    mkdirSync(jobDir, { recursive: true });
    writeFileSync(
      join(jobDir, 'meta.json'),
      JSON.stringify({
        strategy_slug: 'nfj',
        job_id: '1',
        job_url: 'https://example.com',
        job_staging_dir: jobDir,
        files: {
          job_cache: join(jobDir, 'cache'),
          job_meta: join(jobDir, 'meta.json'),
        },
      }),
    );
    writeFileSync(
      join(jobDir, 'raw-job.json'),
      JSON.stringify({ id: '1', url: 'react-native-engineer', title: 'Engineer', name: 'ACME' }),
    );

    const stage = new CleanJsonStage({
      logger: logger(),
      stagingDir: root,
      preparers: [new JsonPreparerNfj()],
      cleaners: [new CleanerNfj()],
    });
    await stage.runIfPreconditionsMet({
      type: 'add',
      payload: join(jobDir, 'raw-job.json'),
    });

    const prepared = JSON.parse(readFileSync(join(jobDir, 'job.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(prepared.id).toBe('1');
    expect(prepared.url).toBe('react-native-engineer');

    const cleaned = JSON.parse(readFileSync(join(jobDir, 'job.clean.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(cleaned.url).toBe('https://example.com');
    expect(cleaned.position).toBe('Engineer');
  });
});

