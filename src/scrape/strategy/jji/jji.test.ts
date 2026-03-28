import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { jjiStrategy } from '../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Snapshot of `data/cache/jji/5f/e9/157b04b371c21a01b9a9a572d585.cache` (weekly job page body HTML). */
const FIXTURE = '157b04b371c21a01b9a9a572d585.body.html';

describe('jji extractContent', () => {
  it('preserves title, skill, location, and company from cached job page (Appliscale fixture)', () => {
    const html = readFileSync(join(__dirname, 'fixtures', FIXTURE), 'utf8');
    const extracted = jjiStrategy().jobContent(html);
    expect(extracted).toContain('Senior Backend Engineer (Node.js / AWS)');
    expect(extracted).toContain('JavaScript');
    expect(extracted).toContain('ul. profesora Michala Zyszkowskieg');
    expect(extracted).toContain('Kraków');
    expect(extracted).toContain('<h2>Appliscale</h2>');
  });
});
