import { nullSchema, type TSchema } from '../../../../schema/schema.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';
import { normalizeStringArray } from '../../lib/normalizeStringArray.js';
import { normalizeSeniority } from '../lib/normalizeSeniority.js';
import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';

export class CleanerJji extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'jji';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const nav = new JsonNavigator(this.objectFromJson(KnownArtifactsEnum.RAW_JOB_JSON, input));

    const employmentTypes = nav.getPath('employmentTypes').toArray();
    const b2bEntry = employmentTypes.find(
      (et) => this.normalizeContractType(et.getPath('type').toString()) === 'b2b/contractor',
    );
    const coeEntry = employmentTypes.find(
      (et) => this.normalizeContractType(et.getPath('type').toString()) === 'employment',
    );

    return this.toString(
      merge(nullSchema(), {
        employer: {
          name: nav.getPath('companyName').toString(),
          logo: nav.getPath('companyLogoThumbUrl').toString(),
        },
        role: {
          title: nav.getPath('title').toString(),
          seniority: normalizeSeniority(nav.getOptionalPath('experienceLevel')?.toString() ?? ''),
        },
        workplace: {
          isRemote: nav.getPath('workplaceType').toString().toLowerCase() === 'remote',
          isHybrid: nav.getPath('workplaceType').toString().toLowerCase() === 'hybrid',
          isOnsite: nav.getPath('workplaceType').toString().toLowerCase() === 'office',
          cities: nav.getOptionalPath('multilocation')
            ? nav
                .getPath('multilocation')
                .toArray()
                .map((loc) => loc.getPath('city').toString())
            : [],
        },
        contract: {
          type: employmentTypes.map((et) =>
            this.normalizeContractType(et.getPath('type').toString()),
          ),
        },
        salaryCoE: coeEntry ? this.normalizeSalary(coeEntry) : nullSchema().salaryCoE,
        salaryB2B: b2bEntry ? this.normalizeSalary(b2bEntry) : nullSchema().salaryB2B,
        ...this.normalizeSkills(nav),
      } satisfies DeepPartial<TSchema>),
    );
  }

  private normalizeContractType(type: string): 'b2b/contractor' | 'employment' | 'other' {
    const t = type.toLowerCase();
    if (t === 'b2b' || t === 'b2b/contractor') return 'b2b/contractor';
    if (t === 'permanent' || t === 'employment' || t === 'uop') return 'employment';
    return 'other';
  }

  private normalizeSalary(entry: JsonNavigator): DeepPartial<TSchema['salaryB2B']> {
    return {
      from: entry.getPath('from').isNull() ? null : entry.getPath('from').toNumber().toString(),
      to: entry.getPath('to').isNull() ? null : entry.getPath('to').toNumber().toString(),
      currency: entry.getPath('currency').isNull() ? null : entry.getPath('currency').toString(),
      unit: entry.getPath('unit').isNull() ? null : entry.getPath('unit').toString().toLowerCase(),
    };
  }

  private normalizeNiceToHaveSkills(entry: JsonNavigator): TSchema['optTechnology'] {
    const skills = entry.getPath('niceToHaveSkills').toOptionalArray();
    return normalizeStringArray(skills.map((n) => n.toString()));
  }

  private normalizeSkills(
    entry: JsonNavigator,
    requiredThreshold: number = 2,
  ): DeepPartial<Pick<TSchema, 'reqTechnology' | 'optTechnology'>> {
    if (!entry.getOptionalPath('requiredSkills')) return {};
    const skills = entry.getPath('requiredSkills').toOptionalArray();
    if (skills.length === 0)
      return {
        optTechnology: this.normalizeNiceToHaveSkills(entry),
      };
    if (skills.map((nav) => typeof nav.value() === 'string').every(Boolean)) {
      return {
        reqTechnology: normalizeStringArray(skills.map((nav) => nav.toString())),
        optTechnology: this.normalizeNiceToHaveSkills(entry),
      };
    }
    if (skills.map((nav) => typeof nav.value() === 'object').every(Boolean)) {
      return {
        reqTechnology: normalizeStringArray(
          skills
            .filter((nav) => nav.getPath('level').toNumber() > requiredThreshold)
            .map((nav) => nav.getPath('name').toString()),
        ),
        optTechnology: normalizeStringArray([
          ...this.normalizeNiceToHaveSkills(entry),
          skills
            .filter((nav) => nav.getPath('level').toNumber() <= requiredThreshold)
            .map((nav) => nav.getPath('name').toString()),
        ]),
      };
    }
    return {
      optTechnology: this.normalizeNiceToHaveSkills(entry),
    };
  }
}
