import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import type { Logger } from '../../../types/Logger.js';
import { HtmlPreparerBdj } from './HtmlPreparerBdj.js';
import { PrepareHtmlStage } from './PrepareHtmlStage.js';

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

describe('PrepareHtmlStage', () => {
  it('creates job.html from raw-job.html', async () => {
    const root = mkdtempSync(join(tmpdir(), 'peon-prepare-html-'));
    tmpRoots.push(root);
    const jobDir = join(root, 'bdj-1');
    mkdirSync(jobDir, { recursive: true });
    writeFileSync(
      join(jobDir, 'meta.json'),
      JSON.stringify({
        strategy_slug: 'bdj',
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
      join(jobDir, 'raw-job.html'),
      `<!DOCTYPE html><html><body><main>
<h2>Acme</h2><h1>Engineer</h1>
<div id="accordionGroup"><h3><button>Opis</button></h3><section><div class="content list--check"><p>Do things.</p></div></section></div>
</main>
<aside><div class="mb-4"><p class="text-c22 xl:text-2xl">28 000 - 32 000 PLN</p><p class="text-gray-300">+ VAT (B2B) / mies.</p></div></aside>
</body></html>`,
    );

    const stage = new PrepareHtmlStage({
      logger: logger(),
      stagingDir: root,
      preparers: [new HtmlPreparerBdj()],
    });
    await stage.runIfPreconditionsMet({
      type: 'add',
      payload: join(jobDir, 'raw-job.html'),
    });

    const content = readFileSync(join(jobDir, 'job.html'), 'utf8');
    expect(content).toContain('28 000 - 32 000 PLN');
    expect(content).toContain('Do things.');
  });
});
