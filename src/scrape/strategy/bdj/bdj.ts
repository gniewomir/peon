import assert from 'node:assert';
import * as cheerio from 'cheerio';
import { SCRAPE_REQUEST_TIMEOUT_MS } from '../../constants.js';
import { clean } from '../../lib/html.js';
import type { JobJson, Strategy, CacheOperations, Logger, Listing } from '../../types/index.js';
import listingsJson from './listings.json' with { type: 'json' };
import { AbstractStrategy } from '../AbstractStrategy.js';

interface LdJobPosting {
  '@type'?: string;
  description?: string;
}

/** Next.js listing SSR payload (`<script id="__NEXT_DATA__">`). */
interface BdjListingNextData {
  props?: {
    pageProps?: {
      jobs?: Array<{ id?: string }>;
    };
  };
}

export const BDJ_SLUG = 'bdj';

const BDJ_ORIGIN = 'https://bulldogjob.pl';

function normalizeBdjJobHref(href: string): string | null {
  try {
    const u = new URL(href, BDJ_ORIGIN);
    if (!u.pathname.startsWith('/companies/jobs/')) {
      return null;
    }
    const segment = u.pathname.replace(/^\/companies\/jobs\//, '');
    if (segment.startsWith('s/') || !/^\d+-/.test(segment)) {
      return null;
    }
    u.hash = '';
    u.search = '';
    let out = u.toString();
    if (u.hostname === 'bulldogjob.com') {
      out = out.replace('https://bulldogjob.com', BDJ_ORIGIN);
    }
    return out;
  } catch {
    return null;
  }
}

/** Job links from a Bulldogjob listing page (`props.pageProps.jobs` in `__NEXT_DATA__`). */
export function parseBdjListingJobsFromHtml(html: string): JobJson[] {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').html();
  if (!raw) {
    return [];
  }

  let data: BdjListingNextData;
  try {
    data = JSON.parse(raw) as BdjListingNextData;
  } catch {
    return [];
  }

  const rows = data.props?.pageProps?.jobs;
  if (!Array.isArray(rows)) {
    return [];
  }

  const seen = new Set<string>();
  const jobs: JobJson[] = [];

  for (const row of rows) {
    const slug = row.id;
    if (typeof slug !== 'string' || !/^\d+-/.test(slug)) {
      continue;
    }
    const url = normalizeBdjJobHref(`/companies/jobs/${slug}`);
    if (!url) {
      continue;
    }
    const m = url.match(/\/companies\/jobs\/(\d+)-/);
    if (!m) {
      continue;
    }
    const id = m[1];
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    jobs.push({ ...row, id, url });
  }

  return jobs;
}

export class BdjStrategy extends AbstractStrategy {
  constructor() {
    super(BDJ_SLUG);
  }

  private static listingPageUrl(baseListingUrl: string, page: number): string {
    assert(page >= 1, 'listing page must be >= 1');
    if (page === 1) {
      return baseListingUrl;
    }
    return `${baseListingUrl.replace(/\/$/, '')}/page,${page}`;
  }

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
      parts.push(`<p>${BdjStrategy.escapeHtmlText(salary)}</p>`);
    }
    aside.find('p.text-gray-400').each((_, el) => {
      const t = $page(el).text().replace(/\s+/g, ' ').trim();
      if (t.startsWith('Valid for')) {
        parts.push(`<p>${BdjStrategy.escapeHtmlText(t)}</p>`);
      }
    });
    aside.find('div.flex').each((_, row) => {
      const $row = $page(row);
      const label = $row.find('p.text-gray-400').first().text().replace(/\s+/g, ' ').trim();
      if (label === 'Location') {
        const loc = $row.find('p.text-md').first().text().replace(/\s+/g, ' ').trim();
        if (loc.length > 0) {
          parts.push(`<p>${BdjStrategy.escapeHtmlText(loc)}</p>`);
        }
      }
    });
    if (parts.length === 0) {
      return '';
    }
    return `<h2>${BdjStrategy.escapeHtmlText('Job listing')}</h2>${parts.join('')}`;
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
          chunks.push(`<h2>${BdjStrategy.escapeHtmlText(heading)}</h2>${inner}`);
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

  async *listingsGenerator(): AsyncGenerator<Listing> {
    const listings = listingsJson as Listing[];
    for (const listing of listings) {
      yield listing;
    }
  }

  async *jobGenerator(
    listing: Listing,
    logger: Logger,
    cache: CacheOperations,
  ): AsyncGenerator<JobJson> {
    let page = 1;

    while (true) {
      const url = BdjStrategy.listingPageUrl(listing.url, page);
      logger.log(` 📖 Fetching Bulldogjob listing page ${page}: ${url}`);

      const cacheKey = cache.dailyCacheKey(url);
      let html: string;
      if (cache.hasCacheKey(cacheKey, logger)) {
        html = await cache.readCache(cacheKey, logger);
      } else {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(SCRAPE_REQUEST_TIMEOUT_MS),
          headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'pl,en;q=0.9',
          },
        });
        if (!response.ok) {
          throw new Error(` ⚠️  HTTP ${response.status}: ${response.statusText} for ${url}`);
        }
        html = await response.text();
        await cache.writeCache(cacheKey, html, logger);
      }

      const jobs = parseBdjListingJobsFromHtml(html);
      if (jobs.length === 0) {
        logger.log(' 👌 No job links on listing page; Bulldogjob listing complete.');
        break;
      }

      let yielded = 0;
      for (const job of jobs) {
        assert('id' in job && typeof job.id === 'string');
        if (this.ids.has(job.id)) {
          continue;
        }
        this.ids.add(job.id);
        yield job;
        yielded += 1;
      }

      if (yielded === 0) {
        logger.log(
          ' 👌 Listing page contained only jobs already seen; Bulldogjob listing complete.',
        );
        break;
      }

      page += 1;
    }
  }

  jobToUrl(job: JobJson): string {
    assert('url' in job && typeof job.url === 'string');
    return job.url;
  }

  jobToId(job: JobJson): string {
    assert('id' in job && typeof job.id === 'string');
    return job.id;
  }

  extractContent(dirtyContent: string): string {
    const $raw = cheerio.load(dirtyContent);

    // Accordions must be read before `clean()`: it strips `<button>` (accordion titles live there).
    let descriptionHtml: string | undefined = BdjStrategy.descriptionFromJobAccordions($raw);

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

    const appended = `${BdjStrategy.extraMainColumnHtml($raw)}${BdjStrategy.sidebarMetadataHtml($raw)}`;
    if (appended.length > 0) {
      descriptionHtml += appended;
    }

    const $ = cheerio.load(descriptionHtml);
    BdjStrategy.stripAllAttributes($);

    return $.html().replaceAll('<!---->', '');
  }
}

export function bdjStrategy(): Strategy {
  return new BdjStrategy();
}
