import type { CleanJson, JobMetadata } from '../../types/Job.js';
import type { Finder } from '../Finder.js';
import { AbstractCleaner } from '../AbstractCleaner.js';

function optionalValueByPath(finder: Finder, haystack: unknown, path: string): unknown {
  try {
    return finder.valueByPath(haystack, path);
  } catch {
    return undefined;
  }
}

function nfjLocations(finder: Finder, listing: Record<string, unknown>): string[] {
  const placesRaw = optionalValueByPath(finder, listing, 'location.places');
  const places = Array.isArray(placesRaw) ? placesRaw : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const place of places) {
    if (!place || typeof place !== 'object') continue;
    const p = place as Record<string, unknown>;
    const city = typeof p.city === 'string' && p.city.trim() ? p.city.trim() : '';
    const province = typeof p.province === 'string' && p.province.trim() ? p.province.trim() : '';
    const label = city || province;
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  const fullyRemote =
    optionalValueByPath(finder, listing, 'location.fullyRemote') === true ||
    optionalValueByPath(finder, listing, 'fullyRemote') === true;
  if (fullyRemote) {
    const hasRemote = out.some((s) => s.toLowerCase() === 'remote');
    if (!hasRemote) out.push('remote');
  }
  return out;
}

function nfjSalaryUnit(salary: Record<string, unknown>): string {
  const period = salary.period;
  if (period === 'm' || period === 'month') return 'month';
  if (period === 'h' || period === 'hour') return 'hour';
  if (period === 'y' || period === 'year') return 'year';
  if (typeof period === 'string' && period.length > 0) return period;
  return 'month';
}

export class NfjCleaner extends AbstractCleaner {
  clean(listing: Record<string, unknown>, meta: JobMetadata): CleanJson {
    const locations = nfjLocations(this, listing);

    const contract: CleanJson['contract'] = [];
    const salaryRaw = optionalValueByPath(this, listing, 'salary');
    if (salaryRaw && typeof salaryRaw === 'object') {
      const s = salaryRaw as Record<string, unknown>;
      let from = '';
      let to = '';
      if (typeof s.min === 'number' && !Number.isNaN(s.min)) from = String(s.min);
      if (typeof s.max === 'number' && !Number.isNaN(s.max)) to = String(s.max);
      if (typeof s.from === 'number' && !Number.isNaN(s.from)) from = String(s.from);
      if (typeof s.to === 'number' && !Number.isNaN(s.to)) to = String(s.to);
      if (to === '' && from !== '') to = from;

      let length = '';
      if (this.hasPath(listing, 'seniority')) {
        length = this.arrayValueByPath(listing, 'seniority')
          .filter((x): x is string => typeof x === 'string')
          .join(', ');
      }

      contract.push({
        type: typeof s.type === 'string' ? s.type : '',
        length,
        from,
        to,
        currency: typeof s.currency === 'string' ? s.currency : '',
        unit: nfjSalaryUnit(s),
      });
    }

    return {
      locations,
      url: meta.job_url,
      expires: '',
      position: this.stringValueByPath(listing, 'title'),
      contract,
      company: this.stringValueByPath(listing, 'name'),
    } satisfies CleanJson;
  }
}
