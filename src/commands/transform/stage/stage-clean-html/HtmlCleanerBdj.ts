import assert from 'node:assert';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { clean } from '../../../extract/lib/html.js';
import { AbstractHtmlCleaner } from './AbstractHtmlCleaner.js';
import { stripAllAttributesAndPruneEmpty } from './html-utils.js';

interface LdJobPosting {
  '@type'?: string;
  description?: string;
}

export class HtmlCleanerBdj extends AbstractHtmlCleaner {
  strategy(): string {
    return 'bdj';
  }

  private static escapeHtmlText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Job title and company sit in `main` above accordions: company `h2` immediately before position `h1`.
   * `body.innerHTML` from the scraper still contains `<main>`, so this works on live pages.
   */
  private static headerHtml($page: cheerio.CheerioAPI): string {
    const h1 = $page('main h1').first();
    if (h1.length === 0) {
      return '';
    }
    const parts: string[] = [];
    const companyHeading = h1.prev('h2');
    if (companyHeading.length > 0) {
      parts.push($page.html(companyHeading));
    }
    parts.push($page.html(h1));
    return parts.join('');
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

  /**
   * Salary in the aside: either a headline `p` with `text-2xl` plus optional `p.text-gray-300` (+ VAT / mies.),
   * or a single `p.text-gray-300` under `div.relative` ("No salary info"). Do not use the first `p.text-gray-300`
   * globally — when a range exists it is the second line and `.first()` would drop the PLN amounts.
   */
  private static asideSalaryParagraphs(
    $page: cheerio.CheerioAPI,
    aside: cheerio.Cheerio<AnyNode>,
  ): string[] {
    const headline = aside.find('p[class*="text-2xl"]').first();
    if (headline.length > 0) {
      const lines: string[] = [];
      const block = headline.parent();
      block.children('p').each((_, el) => {
        const t = $page(el).text().replace(/\s+/g, ' ').trim();
        if (t.length > 0) {
          lines.push(t);
        }
      });
      return lines;
    }
    const noInfo = aside
      .find('div.relative p.text-gray-300')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    return noInfo.length > 0 ? [noInfo] : [];
  }

  /** Salary, validity, and location appear in `<aside>` and are not part of accordion / JSON-LD description. */
  private static sidebarMetadataHtml($page: cheerio.CheerioAPI): string {
    const aside = $page('aside').first();
    if (aside.length === 0) {
      return '';
    }
    const parts: string[] = [];
    for (const line of HtmlCleanerBdj.asideSalaryParagraphs($page, aside)) {
      parts.push(`<p>${HtmlCleanerBdj.escapeHtmlText(line)}</p>`);
    }
    aside.find('p.text-gray-400').each((_, el) => {
      const t = $page(el).text().replace(/\s+/g, ' ').trim();
      if (t.startsWith('Valid for')) {
        parts.push(`<p>${HtmlCleanerBdj.escapeHtmlText(t)}</p>`);
      }
    });
    aside.find('div.flex').each((_, row) => {
      const $row = $page(row);
      const label = $row.find('p.text-gray-400').first().text().replace(/\s+/g, ' ').trim();
      if (label === 'Location') {
        const loc = $row.find('p.text-md').first().text().replace(/\s+/g, ' ').trim();
        if (loc.length > 0) {
          parts.push(`<p>${HtmlCleanerBdj.escapeHtmlText(loc)}</p>`);
        }
      }
    });
    if (parts.length === 0) {
      return '';
    }
    return `<h2>${HtmlCleanerBdj.escapeHtmlText('Job listing')}</h2>${parts.join('')}`;
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
          chunks.push(`<h2>${HtmlCleanerBdj.escapeHtmlText(heading)}</h2>${inner}`);
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

  clean(dirtyContent: string): string {
    const $raw = cheerio.load(dirtyContent);

    // Accordions must be read before `clean()`: it strips `<button>` (accordion titles live there).
    let descriptionHtml: string | undefined = HtmlCleanerBdj.descriptionFromJobAccordions($raw);

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

    const header = HtmlCleanerBdj.headerHtml($raw);
    if (header.length > 0) {
      descriptionHtml = `${header}${descriptionHtml}`;
    }

    const appended = `${HtmlCleanerBdj.extraMainColumnHtml($raw)}${HtmlCleanerBdj.sidebarMetadataHtml($raw)}`;
    if (appended.length > 0) {
      descriptionHtml += appended;
    }

    const $ = cheerio.load(descriptionHtml);
    stripAllAttributesAndPruneEmpty($);
    assert($('h1').length >= 1, 'extractContent: expected at least one h1 in prepared BDJ HTML');

    return $.html().replaceAll('<!---->', '');
  }
}
