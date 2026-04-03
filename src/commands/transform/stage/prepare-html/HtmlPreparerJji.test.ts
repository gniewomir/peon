import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HtmlPreparerJji } from './HtmlPreparerJji.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FIXTURE = join(__dirname, '../../../extract/strategy/jji/fixtures/offer.html');

describe('HtmlPreparerJji', () => {
  it('preserves most important informations', () => {
    const html = readFileSync(FIXTURE, 'utf8');
    const extracted = new HtmlPreparerJji().prepare(html);
    expect(extracted).toContain('Senior Angular Developer');
    expect(extracted).toContain('Link Group');
    expect(extracted).toContain('TypeScript');
    expect(extracted).toContain('Full-time');
    expect(extracted).toContain('Remote');
    expect(extracted).toContain('Previous work in large-scale, enterprise systems');
  });
});
