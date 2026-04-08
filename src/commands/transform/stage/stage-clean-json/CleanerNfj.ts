import { normalizeStringArray } from '../../lib/normalizeStringArray.js';
import type { Finder } from '../../lib/Finder.js';
import { AbstractCleaner } from './AbstractCleaner.js';
import { nullSchema, type TSchema } from '../../../../schema/schema.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';

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
  return out;
}

function nfjIsRemote(finder: Finder, listing: Record<string, unknown>): boolean {
  return (
    optionalValueByPath(finder, listing, 'location.fullyRemote') === true ||
    optionalValueByPath(finder, listing, 'fullyRemote') === true
  );
}

function nfjSalaryUnit(salary: Record<string, unknown>): string {
  const period = salary.period;
  if (period === 'm' || period === 'month') return 'month';
  if (period === 'h' || period === 'hour') return 'hour';
  if (period === 'y' || period === 'year') return 'year';
  if (typeof period === 'string' && period.length > 0) return period;
  return 'month';
}

function nfjSeniorityLevel(finder: Finder, listing: Record<string, unknown>): string {
  if (!finder.hasPath(listing, 'seniority')) return '';
  const parts = finder
    .arrayValueByPath(listing, 'seniority')
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim());
  return parts.join(', ');
}

function nfjRequiredSkills(finder: Finder, listing: Record<string, unknown>): string[] {
  const ordered: string[] = [];
  const tilesRaw = optionalValueByPath(finder, listing, 'tiles.values');
  if (Array.isArray(tilesRaw)) {
    for (const item of tilesRaw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (o.type !== 'requirement') continue;
      if (typeof o.value === 'string' && o.value.trim()) {
        ordered.push(o.value.trim());
      }
    }
  }
  const tech = optionalValueByPath(finder, listing, 'technology');
  if (typeof tech === 'string' && tech.trim()) {
    ordered.push(tech.trim());
  }
  return normalizeStringArray(ordered);
}

function nfjContractType(salary: Record<string, unknown>): string | null {
  const t = typeof salary.type === 'string' ? salary.type.toLowerCase() : '';
  if (t === 'b2b' || t === 'b2b/contractor') return 'b2b/contractor';
  if (t === 'permanent' || t === 'employment' || t === 'uop') return 'employment';
  if (t) return 'other';
  return null;
}

export class CleanerNfj extends AbstractCleaner {
  clean(listing: Record<string, unknown>): TSchema {
    const cities = nfjLocations(this, listing);
    const isRemote = nfjIsRemote(this, listing);
    const seniority = nfjSeniorityLevel(this, listing);
    const required_skills = nfjRequiredSkills(this, listing);

    const salaryCoE: DeepPartial<TSchema['salaryCoE']> = {};
    const salaryB2B: DeepPartial<TSchema['salaryB2B']> = {};
    const contractTypes: string[] = [];

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

      const unit = nfjSalaryUnit(s);
      const currency = typeof s.currency === 'string' ? s.currency : '';
      const ct = nfjContractType(s);
      if (ct) contractTypes.push(ct);

      const salaryData = { from, to, currency, unit };
      if (ct === 'b2b/contractor') {
        Object.assign(salaryB2B, salaryData);
      } else if (ct === 'employment') {
        Object.assign(salaryCoE, salaryData);
      } else {
        // unknown contract type — put salary in both as best effort
        Object.assign(salaryCoE, salaryData);
        Object.assign(salaryB2B, salaryData);
      }
    }

    return merge(structuredClone(nullSchema), {
      employer: {
        name: this.stringValueByPath(listing, 'name'),
      },
      role: {
        title: this.stringValueByPath(listing, 'title'),
        seniority: this.normalizeSeniority(seniority),
      },
      workplace: {
        isRemote,
        cities,
      },
      contract: {
        type: contractTypes,
      },
      salaryCoE,
      salaryB2B,
      hardTechnologyRequirements: required_skills,
    } satisfies DeepPartial<TSchema>);
  }

  strategy(): string {
    return 'nfj';
  }
}
