import assert from 'node:assert';
import * as cheerio from 'cheerio';
import { clean } from '../../lib/html.js';
import type { JobPageParser } from '../../types/index.js';

interface LdJobPosting {
  '@type'?: string;
  description?: string;
}

export class BdjJobPageParser implements JobPageParser {
  private static escapeHtmlText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Company profile / marketing copy lives in `div.content` blocks without `list--check` (outside accordions). */
  private static extraMainColumnHtml($page: cheerio.CheerioAPI): string {
    const chunks: string[] = [];
    $page('main div.content').each((_, el) => {
      const $el = $page(el);
      if ($el.hasClass('list--check')) {
        return;
      }
      const inner = $el.html();
      if (typeof inner === 'string' && inner.trim().length > 0) {
        chunks.push(inner);
      }
    });
    return chunks.join('');
  }

  /** Salary, validity, and location appear in `<aside>` and are not part of accordion / JSON-LD description. */
  private static sidebarMetadataHtml($page: cheerio.CheerioAPI): string {
    const aside = $page('aside').first();
    if (aside.length === 0) {
      return '';
    }
    const parts: string[] = [];
    const salary = aside.find('p.text-gray-300').first().text().replace(/\s+/g, ' ').trim();
    if (salary.length > 0) {
      parts.push(`<p>${BdjJobPageParser.escapeHtmlText(salary)}</p>`);
    }
    aside.find('p.text-gray-400').each((_, el) => {
      const t = $page(el).text().replace(/\s+/g, ' ').trim();
      if (t.startsWith('Valid for')) {
        parts.push(`<p>${BdjJobPageParser.escapeHtmlText(t)}</p>`);
      }
    });
    aside.find('div.flex').each((_, row) => {
      const $row = $page(row);
      const label = $row.find('p.text-gray-400').first().text().replace(/\s+/g, ' ').trim();
      if (label === 'Location') {
        const loc = $row.find('p.text-md').first().text().replace(/\s+/g, ' ').trim();
        if (loc.length > 0) {
          parts.push(`<p>${BdjJobPageParser.escapeHtmlText(loc)}</p>`);
        }
      }
    });
    if (parts.length === 0) {
      return '';
    }
    return `<h2>${BdjJobPageParser.escapeHtmlText('Job listing')}</h2>${parts.join('')}`;
  }

  /** Bulldogjob splits the JD into multiple `#accordionGroup` blocks (h3 + section each). */
  private static descriptionFromJobAccordions($page: cheerio.CheerioAPI): string | undefined {
    const chunks: string[] = [];
    $page('#accordionGroup').each((_, accordionEl) => {
      const $accordion = $page(accordionEl);
      $accordion.children('section').each((__, sec) => {
        const $sec = $page(sec);
        const $h3 = $sec.prev('h3');
        if ($h3.length === 0) {
          return;
        }
        const heading = $h3.find('button').first().text().replace(/\s+/g, ' ').trim();
        const inner = $sec.find('div.content.list--check').first().html();
        if (typeof inner !== 'string' || inner.trim().length === 0) {
          return;
        }
        if (heading.length > 0) {
          chunks.push(`<h2>${BdjJobPageParser.escapeHtmlText(heading)}</h2>${inner}`);
        } else {
          chunks.push(inner);
        }
      });
    });
    if (chunks.length === 0) {
      return undefined;
    }
    return chunks.join('');
  }

  private static stripAllAttributes($: cheerio.CheerioAPI): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cheerio each() binds loose Element
    $('*').each(function (this: any) {
      const $this = $(this);
      const attrs = Object.keys(this.attribs || {});
      attrs.forEach((attr) => {
        $this.removeAttr(attr);
      });
      if ($this.text().trim() === '' && $this.children().length === 0) {
        $this.remove();
      }
    });
  }

  extract(dirtyContent: string): string {
    const $raw = cheerio.load(dirtyContent);

    // Accordions must be read before `clean()`: it strips `<button>` (accordion titles live there).
    let descriptionHtml: string | undefined = BdjJobPageParser.descriptionFromJobAccordions($raw);

    const content = clean(dirtyContent);
    assert(content.length > 0, 'extractContent: content must be a non empty string');

    const $page = cheerio.load(content);

    // JSON-LD lives in `<head>` on full documents; `clean()` keeps only `<body>`, so use `$raw`.
    if (!descriptionHtml) {
      for (const el of $raw('script[type="application/ld+json"]').toArray()) {
        const raw = $raw(el).html();
        if (!raw) continue;

        let data: LdJobPosting;
        try {
          data = JSON.parse(raw) as LdJobPosting;
        } catch {
          continue;
        }

        if (
          data['@type'] === 'JobPosting' &&
          typeof data.description === 'string' &&
          data.description.length > 0
        ) {
          descriptionHtml = data.description;
          break;
        }
      }
    }

    // In this project, `run.ts` passes only `body.innerHTML` into extractContent.
    // Bulldogjob renders JSON-LD in `<head>`, so we need an SSR body fallback.
    if (!descriptionHtml) {
      const containerWithChecks = $page('div.content.list--check').first();
      const containerFallback = $page('div.content').first();
      const container =
        containerWithChecks && containerWithChecks.length > 0
          ? containerWithChecks
          : containerFallback;

      const inner = container.html();
      if (typeof inner === 'string' && inner.trim().length > 0) {
        descriptionHtml = inner;
      }
    }

    assert(
      typeof descriptionHtml === 'string' && descriptionHtml.length > 0,
      'extractContent: JobPosting description not found (JSON-LD or SSR body container)',
    );

    const appended = `${BdjJobPageParser.extraMainColumnHtml($raw)}${BdjJobPageParser.sidebarMetadataHtml($raw)}`;
    if (appended.length > 0) {
      descriptionHtml += appended;
    }

    const $ = cheerio.load(descriptionHtml);
    BdjJobPageParser.stripAllAttributes($);

    return $.html().replaceAll('<!---->', '');
  }
}
