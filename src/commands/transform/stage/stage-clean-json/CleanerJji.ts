import { normalizeStringArray } from '../../lib/normalizeStringArray.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';
import { AbstractCleaner } from './AbstractCleaner.js';
import { nullSchema, type TSchema } from '../../../../schema/schema.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';

function salaryFrom(entry: unknown, nav: JsonNavigator): DeepPartial<TSchema['salaryB2B']> {
  if (!entry) return {};
  return {
    from: nav.numberValueByPath(entry, 'from').toString(),
    to: nav.numberValueByPath(entry, 'to').toString(),
    currency: nav.stringValueByPath(entry, 'currency'),
    unit: nav.stringValueByPath(entry, 'unit') || 'month',
  };
}

export class CleanerJji extends AbstractCleaner {
  clean(listing: Record<string, unknown>): TSchema {
    const nav = new JsonNavigator();

    const experienceLevel = listing['experienceLevel'];
    const seniority = typeof experienceLevel === 'string' ? experienceLevel : '';
    const required_skills = normalizeStringArray(listing['requiredSkills']);

    const cities = nav.arrayValueByPath(listing, 'multilocation').map((location) => {
      return nav.stringValueByPath(location, 'city');
    });
    const workplaceType = nav.stringValueByPath(listing, 'workplaceType');
    const isRemote = workplaceType.toLowerCase() === 'remote';

    const employmentTypes = nav.arrayValueByPath(listing, 'employmentTypes');
    const contractTypes = employmentTypes.map((et) => {
      const t = nav.stringValueByPath(et, 'type').toLowerCase();
      if (t === 'b2b' || t === 'b2b/contractor') return 'b2b/contractor' as const;
      if (t === 'permanent' || t === 'employment' || t === 'uop') return 'employment' as const;
      return 'other' as const;
    });

    const b2bEntry = employmentTypes.find((et) => {
      const t = nav.stringValueByPath(et, 'type').toLowerCase();
      return t === 'b2b' || t === 'b2b/contractor';
    });
    const coeEntry = employmentTypes.find((et) => {
      const t = nav.stringValueByPath(et, 'type').toLowerCase();
      return t === 'permanent' || t === 'employment' || t === 'uop';
    });

    return merge(structuredClone(nullSchema), {
      employer: {
        name: nav.stringValueByPath(listing, 'companyName'),
      },
      role: {
        title: nav.stringValueByPath(listing, 'title'),
        seniority: this.normalizeSeniority(seniority),
      },
      workplace: {
        isRemote,
        cities,
      },
      contract: {
        type: contractTypes,
      },
      salaryCoE: salaryFrom(coeEntry, nav),
      salaryB2B: salaryFrom(b2bEntry, nav),
      hardTechnologyRequirements: required_skills,
    } satisfies DeepPartial<TSchema>);
  }

  strategy(): string {
    return 'jji';
  }
}
