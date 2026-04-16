import { AbstractGuard } from '../AbstractGuard.js';
import type { AbstractGuardDecision } from '../../outcomes/AbstractGuardDecision.js';
import { GuardDecisionQuarantine } from '../../outcomes/GuardDecisionQuarantine.js';
import { GuardDecisionAdvance } from '../../outcomes/GuardDecisionAdvance.js';
import { deepVisitor } from '../../lib/deepVisitor.js';
import type { TLlmSchema } from '../../../../schema/schema.llm.js';

export class LlmSchemaQualityGuard extends AbstractGuard<TLlmSchema> {
  constructor(private readonly threshold: number) {
    super();
  }

  async guard(result: TLlmSchema): Promise<AbstractGuardDecision> {
    try {
      const quality = this.qualityEstimator(result.output);
      if (quality >= this.threshold) {
        return new GuardDecisionAdvance(`quality above ${this.threshold}`);
      } else {
        return new GuardDecisionQuarantine(`quality bellow ${this.threshold}, got ${quality}`);
      }
    } catch (error) {
      return new GuardDecisionQuarantine('error while calculating quality', { cause: error });
    }
  }

  name(): string {
    return 'llm-quality-guard';
  }

  private qualityEstimator = (output: unknown) => {
    let valid = 0;
    let total = 0;

    deepVisitor(output, (value) => {
      if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
        //
      } else {
        valid++;
      }
      total++;
    });

    if (total === 0 || valid === 0) return 0;

    return valid / total;
  };
}
