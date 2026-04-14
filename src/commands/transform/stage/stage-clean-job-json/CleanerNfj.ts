import { nullSchema, type TSchema } from '../../../../schema/schema.js';
import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';
import { normalizeStringArray } from '../../lib/normalizeStringArray.js';
import { normalizeSeniority } from '../lib/normalizeSeniority.js';
import { AbstractTransformation } from '../AbstractTransformation.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import type { StrategySelector } from '../../../../lib/types.js';

export class CleanerNfj extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'nfj';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const nav = new JsonNavigator(this.objectFromJson(KnownArtifactsEnum.RAW_JOB_JSON, input));

    const salaryCoE: DeepPartial<TSchema['salaryCoE']> = {};
    const salaryB2B: DeepPartial<TSchema['salaryB2B']> = {};
    const contractTypes: string[] = [];

    const salaryNav = nav.getOptionalPath('salary');
    if (salaryNav && typeof salaryNav.value() === 'object' && salaryNav.value() !== null) {
      const salaryData = this.normalizeSalary(salaryNav);
      const ct = this.normalizeContractType(salaryNav);
      if (ct) contractTypes.push(ct);

      if (ct === 'b2b/contractor') {
        Object.assign(salaryB2B, salaryData);
      } else if (ct === 'employment') {
        Object.assign(salaryCoE, salaryData);
      } else {
        Object.assign(salaryCoE, salaryData);
        Object.assign(salaryB2B, salaryData);
      }
    }

    return this.toString(
      merge(nullSchema(), {
        employer: {
          name: nav.getPath('name').toString(),
          type: null,
          url: null,
          logo: nav.getOptionalPath('logo.original')?.isNull()
            ? null
            : `https://static.nofluffjobs.com/${nav.getPath('logo.original').toString()}`,
        },
        role: {
          title: nav.getPath('title').toString(),
          seniority: normalizeSeniority(this.normalizeSeniority(nav)),
          scope: null,
          specialization: null,
        },
        workplace: {
          isRemote: this.normalizeIsRemote(nav),
          isHybrid: null,
          isOnsite: null,
          cities: this.normalizeLocations(nav),
        },
        contract: {
          type: contractTypes,
        },
        salaryCoE,
        salaryB2B,
        reqTechnology: this.normalizeRequiredSkills(nav),
      } satisfies DeepPartial<TSchema>),
    );
  }

  private normalizeLocations(nav: JsonNavigator): string[] {
    const placesRaw = nav.getOptionalPath('location.places')?.value();
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

  private normalizeIsRemote(nav: JsonNavigator): boolean {
    return (
      nav.getOptionalPath('location.fullyRemote')?.value() === true ||
      nav.getOptionalPath('fullyRemote')?.value() === true
    );
  }

  private normalizeSalaryUnit(salary: JsonNavigator): string {
    const period = salary.getOptionalPath('period')?.value();
    if (period === 'm' || period === 'month') return 'month';
    if (period === 'h' || period === 'hour') return 'hour';
    if (period === 'y' || period === 'year') return 'year';
    if (typeof period === 'string' && period.length > 0) return period;
    return 'month';
  }

  private normalizeSeniority(nav: JsonNavigator): string {
    const seniorityNav = nav.getOptionalPath('seniority');
    if (!seniorityNav) return '';
    const parts = seniorityNav
      .toArray()
      .map((item) => item.value())
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((s) => s.trim());
    return parts.join(', ');
  }

  private normalizeRequiredSkills(nav: JsonNavigator): string[] {
    const ordered: string[] = [];
    const tilesRaw = nav.getOptionalPath('tiles.values')?.value();
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
    const tech = nav.getOptionalPath('technology')?.value();
    if (typeof tech === 'string' && tech.trim()) {
      ordered.push(tech.trim());
    }
    return normalizeStringArray(ordered);
  }

  private normalizeContractType(salary: JsonNavigator): string | null {
    const typeVal = salary.getOptionalPath('type')?.value();
    const t = typeof typeVal === 'string' ? typeVal.toLowerCase() : '';
    if (t === 'b2b' || t === 'b2b/contractor') return 'b2b/contractor';
    if (t === 'permanent' || t === 'employment' || t === 'uop') return 'employment';
    if (t) return 'other';
    return null;
  }

  private normalizeSalary(salaryNav: JsonNavigator): {
    from: string;
    to: string;
    currency: string;
    unit: string;
  } {
    let from = '';
    let to = '';
    const min = salaryNav.getOptionalPath('min')?.value();
    const max = salaryNav.getOptionalPath('max')?.value();
    const fromVal = salaryNav.getOptionalPath('from')?.value();
    const toVal = salaryNav.getOptionalPath('to')?.value();
    if (typeof min === 'number' && !Number.isNaN(min)) from = String(min);
    if (typeof max === 'number' && !Number.isNaN(max)) to = String(max);
    if (typeof fromVal === 'number' && !Number.isNaN(fromVal)) from = String(fromVal);
    if (typeof toVal === 'number' && !Number.isNaN(toVal)) to = String(toVal);
    if (to === '' && from !== '') to = from;

    const currencyVal = salaryNav.getOptionalPath('currency')?.value();
    return {
      from,
      to,
      currency: typeof currencyVal === 'string' ? currencyVal : '',
      unit: this.normalizeSalaryUnit(salaryNav),
    };
  }
}
