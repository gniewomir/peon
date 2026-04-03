import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HtmlPreparerNfj } from './HtmlPreparerNfj.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FIXTURE = join(
  __dirname,
  '../../../extract/strategy/nfj/fixtures/59b68b5625f4309bfb5d3daabc4f.body.html',
);

describe('HtmlPreparerNfj', () => {
  it('preserves title, company, JD, and trims valid-until parenthetical (Kellton fixture)', () => {
    const html = readFileSync(FIXTURE, 'utf8');
    const extracted = new HtmlPreparerNfj().prepare(html);
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
