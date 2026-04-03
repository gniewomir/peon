import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HtmlPreparerBdj } from './HtmlPreparerBdj.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('HtmlPreparerBdj', () => {
  it('includes JD, company blurb, and sidebar metadata (Luxoft 232726 fixture)', () => {
    const html = readFileSync(
      join(
        __dirname,
        '../../../extract/strategy/bdj/fixtures/232726-senior-full-stack-developer-krakow-luxoft-dxc.html',
      ),
      'utf8',
    );
    const extracted = new HtmlPreparerBdj().prepare(html);
    expect(extracted).toContain('<h2>Luxoft DXC</h2><h1>Senior Full-stack Developer</h1>');
    expect(extracted).toContain(
      'In our agile operating model, crews are aligned to larger products and services fulfilling client needs and encompass multiple autonomous pods.',
    );
    expect(extracted).toContain('Experience with Cloud platforms or Kubernetes is a plus.');
    expect(extracted).toContain(
      'Technology is our passion! We focus on top engineering talent means that you will be working with the best industry professionals from around the world. Because of that, Luxoft is a global family with an epic atmosphere – we love what we do!',
    );
    expect(extracted).toContain('No salary info');
    expect(extracted).toContain('Valid for 18 days');
    expect(extracted).toContain('Krakow');
  });

  it('includes full salary block when range uses text-2xl and VAT line is separate (BDJ layout)', () => {
    const html = `<!DOCTYPE html><html><body><main>
<h2>Acme</h2><h1>Engineer</h1>
<div id="accordionGroup"><h3><button>Opis</button></h3><section><div class="content list--check"><p>Do things.</p></div></section></div>
</main>
<aside><div class="mb-4"><p class="text-c22 xl:text-2xl">28 000 - 32 000 PLN</p><p class="text-gray-300">+ VAT (B2B) / mies.</p></div></aside>
</body></html>`;
    const extracted = new HtmlPreparerBdj().prepare(html);
    expect(extracted).toContain('28 000 - 32 000 PLN');
    expect(extracted).toContain('+ VAT (B2B) / mies.');
  });
});
