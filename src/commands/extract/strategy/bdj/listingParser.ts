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

  return { jobs };
}
