import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import { quarantineJobDirectory } from './quarantine.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('quarantineJobDirectory', () => {
  it('moves a failing job into quarantine with unique suffix', async () => {
    const root = join(tmpdir(), `peon-quarantine-${Date.now()}`);
    roots.push(root);
    const stagingDir = join(root, 'data', 'staging');
    const jobDir = join(stagingDir, 'nfj-123');
    mkdirSync(jobDir, { recursive: true });
    writeFileSync(join(jobDir, 'job.json'), '{}');

    const logger = {
      log: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };

    await quarantineJobDirectory({
      logger,
      stagingDir,
      jobDir,
      stage: 'clean',
      error: new Error('boom'),
      inputPaths: [join(jobDir, 'job.json')],
    });

    const quarantineDir = join(root, 'data', 'quarantine');
    const entries = readdirSync(quarantineDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.startsWith('nfj-123__')).toBe(true);
    expect(existsSync(jobDir)).toBe(false);

    const errorJson = await readFile(
      join(quarantineDir, entries[0]!, 'transform.error.json'),
      'utf8',
    );
    expect(errorJson).toContain('"stage": "clean"');
  });
});
