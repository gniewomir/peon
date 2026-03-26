import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractContent } from './nfj.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Snapshot of `data/cache/nfj/87/d7/59b68b5625f4309bfb5d3daabc4f.cache` (weekly job page body HTML). */
const FIXTURE = '59b68b5625f4309bfb5d3daabc4f.body.html';

describe('nfj extractContent', () => {
  it('preserves title, company, JD, and trims valid-until parenthetical (Kellton fixture)', () => {
    const html = readFileSync(join(__dirname, 'fixtures', FIXTURE), 'utf8');
    const extracted = extractContent(html);
    expect(extracted).toContain('Remote React Native Engineer + TypeScript (Freelance)');
    expect(extracted).toContain('Kellton Europe');
    expect(extracted).toContain('Must have');
    expect(extracted).toContain('Advanced proficiency in TypeScript');
    expect(extracted).toContain(
      'Experience building and shipping production apps with React Native',
    );
    expect(extracted).toContain('Offer valid until: 01.04.2026');
    expect(extracted).not.toMatch(/Offer valid until:[^<]*\(/);
  });
});
