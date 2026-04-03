import type { CleanJson, JobMetadata } from '../../../types/Job.js';
import { normalizeRequiredSkills } from '../../../lib/skills.js';
import type { Finder } from '../../../lib/finder.js';
import { AbstractCleaner } from '../AbstractCleaner.js';

/**
 * Bulldogjob listing rows historically used booleans for contract/remote flags.
 * Newer payloads sometimes use objects (e.g. rich filter metadata); coerce to boolean.
 */
function bdjBoolFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value !== 0;
  }
  if (value == null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const k of ['value', 'selected', 'enabled', 'active', 'checked'] as const) {
      if (typeof o[k] === 'boolean') {
        return o[k];
      }
    }
    return Object.keys(o).length > 0;
  }
  return false;
}

function optionalValueByPath(finder: Finder, haystack: unknown, path: string): unknown {
  try {
    return finder.valueByPath(haystack, path);
  } catch {
    return undefined;
  }
}

function parseBdjMoneyRange(money: unknown): { from: string; to: string } {
  if (money == null) {
    return { from: '', to: '' };
  }
  if (typeof money === 'string') {
    const parts = money
      .split('-')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      from: parts[0] ?? '',
      to: parts[1] ?? parts[0] ?? '',
    };
  }
  if (typeof money === 'object') {
    const o = money as Record<string, unknown>;
    if ('min' in o && 'max' in o) {
      return { from: String(o.min ?? ''), to: String(o.max ?? '') };
    }
    if ('from' in o && 'to' in o) {
      return { from: String(o.from ?? ''), to: String(o.to ?? '') };
    }
  }
  return { from: '', to: '' };
}

function bdjCurrency(currency: unknown): string {
  return typeof currency === 'string' ? currency : '';
}

export class BdjCleaner extends AbstractCleaner {
  clean(listing: Record<string, unknown>, meta: JobMetadata): CleanJson {
    let from = '';
    let to = '';
    let currency = '';
    if (this.hasPath(listing, 'denominatedSalaryLong')) {
      const ds = this.valueByPath(listing, 'denominatedSalaryLong');
      if (ds && typeof ds === 'object') {
        const d = ds as Record<string, unknown>;
        const range = parseBdjMoneyRange(d.money);
        from = range.from;
        to = range.to;
        currency = bdjCurrency(d.currency);
      }
    }
    const contract = [];
    if (bdjBoolFlag(optionalValueByPath(this, listing, 'contractEmployment'))) {
      contract.push({
        type: 'uop',
        from,
        to,
        unit: 'month',
        currency,
        length: this.stringValueByPath(listing, 'employmentType'),
      });
    }
    if (bdjBoolFlag(optionalValueByPath(this, listing, 'contractB2b'))) {
      contract.push({
        type: 'b2b',
        from,
        to,
        unit: 'month',
        currency,
        length: this.stringValueByPath(listing, 'employmentType'),
      });
    }

    const experienceLevel = optionalValueByPath(this, listing, 'experienceLevel');
    const seniority_level = typeof experienceLevel === 'string' ? experienceLevel : '';
    const required_skills = normalizeRequiredSkills(
      optionalValueByPath(this, listing, 'technologyTags'),
    );

    return {
      url: meta.job_url,
      company: this.stringValueByPath(listing, 'company.name'),
      position: this.stringValueByPath(listing, 'position'),
      seniority_level,
      expires: '',
      locations: [
        this.stringValueByPath(listing, 'city'),
        bdjBoolFlag(optionalValueByPath(this, listing, 'remote')) ? 'remote' : '',
      ],
      contract,
      required_skills,
    } satisfies CleanJson;
  }
}
