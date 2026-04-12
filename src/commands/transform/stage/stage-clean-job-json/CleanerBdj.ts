import { nullSchema, type TSchema } from '../../../../schema/schema.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';
import { normalizeStringArray } from '../../lib/normalizeStringArray.js';
import { normalizeSeniority } from '../lib/normalizeSeniority.js';
import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../artifacts.js';

export class CleanerBdj extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'bdj';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const nav = new JsonNavigator(this.objectFromJson(KnownArtifactsEnum.RAW_JOB_JSON, input));

    return this.toString(
      merge(nullSchema(), {
        employer: {
          name: nav.getPath('company.name').toString(),
          logo: nav.getPath('company.logo.url').toString(),
        },
        role: {
          title: nav.getPath('position').toString(),
          seniority: normalizeSeniority(nav.getPath('experienceLevel').toString()),
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
        reqTechnology: normalizeStringArray(
          nav
            .getPath('technologyTags')
            .toArray()
            .map((t) => t.toString()),
        ),
      } satisfies DeepPartial<TSchema>),
    );
  }

  private normalizeSalary(nav: JsonNavigator): TSchema['salaryCoE'] {
    if (
      !nav.getOptionalPath('denominatedSalaryLong.money') ||
      nav.getOptionalPath('denominatedSalaryLong.money')?.isEmpty()
    ) {
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
}
