import * as cheerio from 'cheerio';
import type { JobJson, ListingParseResult } from '../../types.js';

/** Next.js listing SSR payload (`<script id="__NEXT_DATA__">`). */
interface BdjListingNextData {
  props?: {
    pageProps?: {
      jobs?: Array<{ id?: string }>;
    };
  };
}

const BDJ_ORIGIN = 'https://bulldogjob.pl';

function normalizeBdjJobHref(href: string): string | null {
  try {
    const url = new URL(href, BDJ_ORIGIN);
    if (!url.pathname.startsWith('/companies/jobs/')) {
      return null;
    }
    const segment = url.pathname.replace(/^\/companies\/jobs\//, '');
    if (segment.startsWith('s/') || !/^\d+-/.test(segment)) {
      return null;
    }
    url.hash = '';
    url.search = '';
    let out = url.toString();
    if (url.hostname === 'bulldogjob.com') {
      out = out.replace('https://bulldogjob.com', BDJ_ORIGIN);
    }
    return out;
  } catch {
    return null;
  }
}

export function parseListingResponse(html: string): ListingParseResult {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').html();
  if (!raw) {
    return { jobs: [] };
  }

  let data: BdjListingNextData;
  try {
    data = JSON.parse(raw) as BdjListingNextData;
  } catch {
    return { jobs: [] };
  }

  const rows = data.props?.pageProps?.jobs;
  if (!Array.isArray(rows)) {
    return { jobs: [] };
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
    const match = url.match(/\/companies\/jobs\/(\d+)-/);
    if (!match) {
      continue;
    }
    const id = match[1];
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    jobs.push({ ...row, id, url });
  }

  return { jobs };
}
