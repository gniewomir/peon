import { normalizeStringArray } from '../../lib/normalizeStringArray.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';
import { AbstractCleaner } from './AbstractCleaner.js';
import { nullSchema, type TSchema } from '../../../../schema/schema.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';

function salaryFrom(entry: JsonNavigator | undefined): DeepPartial<TSchema['salaryB2B']> {
  if (!entry) return {};
  return {
    from: entry.getPath('from').toNumber().toString(),
    to: entry.getPath('to').toNumber().toString(),
    currency: entry.getPath('currency').toString(),
    unit: entry.getPath('unit').toString() || 'month',
  };
}

export class CleanerJji extends AbstractCleaner {
  clean(listing: Record<string, unknown>): TSchema {
    const nav = new JsonNavigator(listing);

    const experienceLevel = nav.getOptionalPath('experienceLevel')?.value();
    const seniority = typeof experienceLevel === 'string' ? experienceLevel : '';
    const required_skills = normalizeStringArray(nav.getOptionalPath('requiredSkills')?.value());

    const cities = nav
      .getPath('multilocation')
      .toArray()
      .map((loc) => {
        return loc.getPath('city').toString();
      });
    const workplaceType = nav.getPath('workplaceType').toString();
    const isRemote = workplaceType.toLowerCase() === 'remote';

    const employmentTypes = nav.getPath('employmentTypes').toArray();
    const contractTypes = employmentTypes.map((et) => {
      const t = et.getPath('type').toString().toLowerCase();
      if (t === 'b2b' || t === 'b2b/contractor') return 'b2b/contractor' as const;
      if (t === 'permanent' || t === 'employment' || t === 'uop') return 'employment' as const;
      return 'other' as const;
    });

    const b2bEntry = employmentTypes.find((et) => {
      const t = et.getPath('type').toString().toLowerCase();
      return t === 'b2b' || t === 'b2b/contractor';
    });
    const coeEntry = employmentTypes.find((et) => {
      const t = et.getPath('type').toString().toLowerCase();
      return t === 'permanent' || t === 'employment' || t === 'uop';
    });

    return merge(nullSchema(), {
      employer: {
        name: nav.getPath('companyName').toString(),
      },
      role: {
        title: nav.getPath('title').toString(),
        seniority: this.normalizeSeniority(seniority),
      },
      workplace: {
        isRemote,
        cities,
      },
      contract: {
        type: contractTypes,
      },
      salaryCoE: salaryFrom(coeEntry),
      salaryB2B: salaryFrom(b2bEntry),
      hardTechnologyRequirements: required_skills,
    } satisfies DeepPartial<TSchema>);
  }

  strategy(): string {
    return 'jji';
  }
}
