import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { JjiJobPageParser } from './job-page-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FIXTURE = 'offer.html';

describe('JjiJobPageParser', () => {
  it('preserves most important informations', () => {
    const html = readFileSync(join(__dirname, 'fixtures', FIXTURE), 'utf8');
    const extracted = new JjiJobPageParser().extract(html);
    expect(extracted).toContain('Senior Angular Developer');
    expect(extracted).toContain('Link Group');
    expect(extracted).toContain('TypeScript');
    expect(extracted).toContain('Full-time');
    expect(extracted).toContain('Remote');
    expect(extracted).toContain('Previous work in large-scale, enterprise systems');
  });
});
