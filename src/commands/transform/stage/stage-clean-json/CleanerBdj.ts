import { AbstractCleaner } from './AbstractCleaner.js';
import { nullSchema, type TSchema } from '../../../../schema/schema.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';

export class CleanerBdj extends AbstractCleaner {
  clean(listing: Record<string, unknown>) {
    const nav = new JsonNavigator(listing);

    return merge(nullSchema(), {
      employer: {
        name: nav.getPath('company.name').toString(),
        logo: nav.getPath('company.logo.url').toString(),
      },
      role: {
        title: nav.getPath('position').toString(),
        seniority: this.normalizeSeniority(nav.getPath('experienceLevel').toString()),
      },
      workplace: {
        isRemote: nav.getPath('remote').toBool(),
        cities: [nav.getPath('city').toString()],
      },
      contract: {
        type: [
          nav.getPath('contractB2b').toBool() ? 'b2b/contractor' : null,
          nav.getPath('contractEmployment').toBool() ? 'employment' : null,
        ],
      },
      salaryCoE: nav.getPath('contractB2b').toBool()
        ? {
            from: nav.getPath('denominatedSalaryLong.money').toString().split('-')[0].trim(),
            to: nav.getPath('denominatedSalaryLong.money').toString().split('-')[1].trim(),
            unit: 'month',
            currency: nav.getPath('denominatedSalaryLong.currency').toString(),
          }
        : nullSchema().salaryCoE,
      salaryB2B: nav.getPath('contractEmployment').toBool()
        ? {
            from: nav.getPath('denominatedSalaryLong.money').toString().split('-')[0].trim(),
            to: nav.getPath('denominatedSalaryLong.money').toString().split('-')[1].trim(),
            unit: 'month',
            currency: nav.getPath('denominatedSalaryLong.currency').toString(),
          }
        : nullSchema().salaryB2B,
      hardTechnologyRequirements: nav
        .getPath('technologyTags')
        .toArray()
        .map((t) => t.toString()),
    } satisfies DeepPartial<TSchema>);
  }

  strategy(): string {
    return 'bdj';
  }
}
