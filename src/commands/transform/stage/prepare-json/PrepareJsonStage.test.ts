import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import type { Logger } from '../../../types/Logger.js';
import { JsonPreparerNfj } from './JsonPreparerNfj.js';
import { PrepareJsonStage } from './PrepareJsonStage.js';

const tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function logger(): Logger {
  return {
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

describe('PrepareJsonStage', () => {
  it('creates job.json from raw-job.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'peon-prepare-json-'));
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
      JSON.stringify({ id: '1', url: 'react-native-engineer', title: 'Engineer' }),
    );

    const stage = new PrepareJsonStage({
      logger: logger(),
      stagingDir: root,
      preparers: [new JsonPreparerNfj()],
    });
    await stage.runIfPreconditionsMet({
      type: 'add',
      payload: join(jobDir, 'raw-job.json'),
    });

    const content = JSON.parse(readFileSync(join(jobDir, 'job.json'), 'utf8')) as Record<
      string,
      string
    >;
    expect(content.id).toBe('1');
    expect(content.url).toBe('react-native-engineer');
    expect(content.title).toBe('Engineer');
  });
});
