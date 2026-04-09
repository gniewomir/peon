import { normalizeStringArray } from '../../lib/normalizeStringArray.js';
import { AbstractCleaner } from './AbstractCleaner.js';
import { nullSchema, type TSchema } from '../../../../schema/schema.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';

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

export class CleanerBdj extends AbstractCleaner {
  clean(listing: Record<string, unknown>) {
    const nav = new JsonNavigator(listing);

    let from = '';
    let to = '';
    let currency = '';
    const ds = nav.getOptionalPath('denominatedSalaryLong');
    if (ds) {
      const range = parseBdjMoneyRange(ds.getOptionalPath('money')?.value());
      from = range.from;
      to = range.to;
      currency = bdjCurrency(ds.getOptionalPath('currency')?.value());
    }
    const experienceLevel = nav.getOptionalPath('experienceLevel')?.value();
    const seniority_level = typeof experienceLevel === 'string' ? experienceLevel : '';

    const required_skills = normalizeStringArray(nav.getOptionalPath('technologyTags')?.value());

    return merge(nullSchema(), {
      employer: {
        name: nav.getPath('company.name').toString(),
      },
      role: {
        title: nav.getPath('position').toString(),
        seniority: this.normalizeSeniority(seniority_level),
      },
      workplace: {
        isRemote: bdjBoolFlag(nav.getOptionalPath('remote')?.value()),
        cities: [nav.getPath('city').toString()],
      },
      contract: {
        type: [
          bdjBoolFlag(nav.getOptionalPath('contractB2b')?.value()) ? 'b2b/contractor' : null,
          bdjBoolFlag(nav.getOptionalPath('contractEmployment')?.value()) ? 'employment' : null,
        ],
      },
      salaryCoE: bdjBoolFlag(nav.getOptionalPath('contractB2b')?.value())
        ? {
            from,
            to,
            unit: 'month',
            currency,
          }
        : nullSchema().salaryCoE,
      salaryB2B: bdjBoolFlag(nav.getOptionalPath('contractB2b')?.value())
        ? {
            from,
            to,
            unit: 'month',
            currency,
          }
        : nullSchema().salaryB2B,
      hardTechnologyRequirements: required_skills,
    } satisfies DeepPartial<TSchema>);
  }

  strategy(): string {
    return 'bdj';
  }
}
