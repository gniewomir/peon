import assert from 'node:assert';
import * as cheerio from 'cheerio';
import { SCRAPE_REQUEST_TIMEOUT_MS } from '../../constants.js';
import { clean } from '../../lib/html.js';
import type { CacheOperations, Logger, BDJJob, Listing } from '../../types/index.js';
import listingsJson from './listings.json' with { type: 'json' };

const ORIGIN = 'https://bulldogjob.pl';

/** SSR listing cards use this class; hrefs are canonical job URLs. */
const JOB_CARD_SELECTOR = 'a.JobListItem_item__fYh8y';

function listingPageUrl(baseListingUrl: string, page: number): string {
  assert(page >= 1, 'listing page must be >= 1');
  if (page === 1) {
    return baseListingUrl;
  }
  return `${baseListingUrl.replace(/\/$/, '')}/page,${page}`;
}

function normalizeJobHref(href: string): string | null {
  try {
    const u = new URL(href, ORIGIN);
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
      out = out.replace('https://bulldogjob.com', ORIGIN);
    }
    return out;
  } catch {
    return null;
  }
}

function parseJobsFromListingHtml(html: string): BDJJob[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const jobs: BDJJob[] = [];

  $(JOB_CARD_SELECTOR).each((_, el) => {
    const href = $(el).attr('href');
    if (!href) {
      return;
    }
    const url = normalizeJobHref(href);
    if (!url) {
      return;
    }
    const m = url.match(/\/companies\/jobs\/(\d+)-/);
    if (!m) {
      return;
    }
    const id = m[1];
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    jobs.push({ id, url });
  });

  return jobs;
}

interface LdJobPosting {
  '@type'?: string;
  description?: string;
}

function stripAllAttributes($: cheerio.CheerioAPI): void {
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

export const slug = 'bdj';

export const jobToUrl = (job: BDJJob): string => job.url;

export async function* jobGenerator(
  listing: Listing,
  logger: Logger,
  ids: Set<string>,
  cache: CacheOperations,
): AsyncGenerator<BDJJob> {
  let page = 1;

  while (true) {
    const url = listingPageUrl(listing.url, page);
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

    const jobs = parseJobsFromListingHtml(html);
    if (jobs.length === 0) {
      logger.log(' 👌 No job links on listing page; Bulldogjob listing complete.');
      break;
    }

    let yielded = 0;
    for (const job of jobs) {
      if (ids.has(job.id)) {
        continue;
      }
      ids.add(job.id);
      yield job;
      yielded += 1;
    }

    if (yielded === 0) {
      logger.log(' 👌 Listing page contained only jobs already seen; Bulldogjob listing complete.');
      break;
    }

    page += 1;
  }
}

export function extractContent(dirtyContent: string): string {
  const content = clean(dirtyContent);
  assert(content.length > 0, 'extractContent: content must be a non empty string');

  const $page = cheerio.load(content);
  let descriptionHtml: string | undefined;

  // Prefer JSON-LD if it exists in the provided payload (some scrapers send full HTML).
  for (const el of $page('script[type="application/ld+json"]').toArray()) {
    const raw = $page(el).html();
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

  const $ = cheerio.load(descriptionHtml);
  stripAllAttributes($);

  return $.html().replaceAll('<!---->', '');
}

export async function* listingsGenerator(): AsyncGenerator<Listing> {
  const listings = listingsJson as Listing[];
  for (const listing of listings) {
    yield listing;
  }
}

export function jobToId(job: BDJJob): string {
  return job.id;
}
