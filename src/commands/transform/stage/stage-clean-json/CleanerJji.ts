import { normalizeStringArray } from '../../lib/normalizeStringArray.js';
import { AbstractCleaner } from './AbstractCleaner.js';
import { nullSchema, type TSchema } from '../../../../schema/schema.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';

export class CleanerJji extends AbstractCleaner {
  clean(listing: Record<string, unknown>): TSchema {
    const experienceLevel = listing['experienceLevel'];
    const seniority = typeof experienceLevel === 'string' ? experienceLevel : '';
    const required_skills = normalizeStringArray(listing['requiredSkills']);

    const cities = this.arrayValueByPath(listing, 'multilocation').map((location) => {
      return this.stringValueByPath(location, 'city');
    });
    const workplaceType = this.stringValueByPath(listing, 'workplaceType');
    const isRemote = workplaceType.toLowerCase() === 'remote';

    const employmentTypes = this.arrayValueByPath(listing, 'employmentTypes');
    const contractTypes = employmentTypes.map((et) => {
      const t = this.stringValueByPath(et, 'type').toLowerCase();
      if (t === 'b2b' || t === 'b2b/contractor') return 'b2b/contractor' as const;
      if (t === 'permanent' || t === 'employment' || t === 'uop') return 'employment' as const;
      return 'other' as const;
    });

    const b2bEntry = employmentTypes.find((et) => {
      const t = this.stringValueByPath(et, 'type').toLowerCase();
      return t === 'b2b' || t === 'b2b/contractor';
    });
    const coeEntry = employmentTypes.find((et) => {
      const t = this.stringValueByPath(et, 'type').toLowerCase();
      return t === 'permanent' || t === 'employment' || t === 'uop';
    });

    function salaryFrom(entry: unknown, cleaner: CleanerJji): DeepPartial<TSchema['salaryB2B']> {
      if (!entry) return {};
      return {
        from: cleaner.numberValueByPath(entry, 'from').toString(),
        to: cleaner.numberValueByPath(entry, 'to').toString(),
        currency: cleaner.stringValueByPath(entry, 'currency'),
        unit: cleaner.stringValueByPath(entry, 'unit') || 'month',
      };
    }

    return merge(structuredClone(nullSchema), {
      employer: {
        name: this.stringValueByPath(listing, 'companyName'),
      },
      role: {
        title: this.stringValueByPath(listing, 'title'),
        seniority,
      },
      workplace: {
        isRemote,
        cities,
      },
      contract: {
        type: contractTypes,
      },
      salaryCoE: salaryFrom(coeEntry, this),
      salaryB2B: salaryFrom(b2bEntry, this),
      hardTechnologyRequirements: required_skills,
    } satisfies DeepPartial<TSchema>);
  }

  strategy(): string {
    return 'jji';
  }
}
