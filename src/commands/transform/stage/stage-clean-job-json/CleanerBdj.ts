import { AbstractCleaner } from './AbstractCleaner.js';
import { nullSchema, type TSchema } from '../../../../schema/schema.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';
import { normalizeStringArray } from '../../lib/normalizeStringArray.js';

export class CleanerBdj extends AbstractCleaner {
  private normalizeSalary(nav: JsonNavigator): TSchema['salaryCoE'] {
    if (!nav.getOptionalPath('denominatedSalaryLong.money')) {
      return nullSchema().salaryCoE;
    }
    const money = nav.getPath('denominatedSalaryLong.money').toString();
    let from: string | null = null;
    let to: string | null = null;
    if (money.toLowerCase().startsWith('from')) {
      from = money.slice('from'.length);
    }
    if (money.includes('-')) {
      from = money.split('-')[0].trim();
      to = money.split('-')[1].trim();
    }
    return {
      from,
      to,
      unit: 'month',
      currency: nav.getPath('denominatedSalaryLong.currency').toString(),
    };
  }

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
        type: normalizeStringArray([
          nav.getPath('contractB2b').toOptionalBool() ? 'b2b/contractor' : null,
          nav.getPath('contractEmployment').toOptionalBool() ? 'employment' : null,
          nav.getPath('contractOther').toOptionalBool() ? 'other' : null,
        ]),
      },
      salaryCoE: nav.getPath('contractB2b').toOptionalBool()
        ? this.normalizeSalary(nav)
        : nullSchema().salaryCoE,
      salaryB2B: nav.getPath('contractEmployment').toOptionalBool()
        ? this.normalizeSalary(nav)
        : nullSchema().salaryB2B,
      hardTechnologyRequirements: normalizeStringArray(
        nav
          .getPath('technologyTags')
          .toArray()
          .map((t) => t.toString()),
      ),
    } satisfies DeepPartial<TSchema>);
  }

  strategy(): string {
    return 'bdj';
  }
}
