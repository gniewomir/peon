import { AbstractGuard } from '../guards/AbstractGuard.js';
import type { AbstractGuardDecision } from '../guards/decisions/AbstractGuardDecision.js';
import { GuardDecisionLoad } from '../guards/decisions/GuardDecisionLoad.js';
import { GuardDecisionQuarantine } from '../guards/decisions/GuardDecisionQuarantine.js';
import { deepVisitor } from '../../lib/deepVisitor.js';
import { combined } from '../../../../schema/schema.combined.js';
import { nullSchema } from '../../../../schema/schema.js';

export class CombinedSchemaLoadGuard extends AbstractGuard {
  constructor(private readonly threshold: number) {
    super();
  }

  name(): string {
    return 'combined-schema-load-guard';
  }

  async guard(result: string): Promise<AbstractGuardDecision> {
    try {
      const parsed = combined.parse(JSON.parse(result));
      const quality = this.estimateQuality(this.pickSchemaPart(parsed));
      if (quality >= this.threshold) {
        return new GuardDecisionLoad(`combined schema quality >= ${this.threshold} (${quality})`);
      }
      return new GuardDecisionQuarantine(
        `combined schema quality < ${this.threshold} (${quality})`,
      );
    } catch (error) {
      return new GuardDecisionQuarantine('error while evaluating combined schema quality', {
        cause: error,
      });
    }
  }

  private pickSchemaPart(parsed: Record<string, unknown>): Record<string, unknown> {
    const schemaKeys = Object.keys(nullSchema());
    const out: Record<string, unknown> = {};
    for (const k of schemaKeys) {
      out[k] = parsed[k];
    }
    return out;
  }

  private estimateQuality(output: unknown): number {
    let valid = 0;
    let total = 0;

    deepVisitor(output, (value) => {
      if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
        // invalid
      } else {
        valid += 1;
      }
      total += 1;
    });

    if (total === 0 || valid === 0) return 0;
    return valid / total;
  }
}
