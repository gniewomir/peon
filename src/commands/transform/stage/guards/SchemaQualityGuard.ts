import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './decisions/AbstractGuardDecision.js';
import { GuardDecisionQuarantine } from './decisions/GuardDecisionQuarantine.js';
import { GuardDecisionAdvance } from './decisions/GuardDecisionAdvance.js';
import { qualityEstimator } from '../../lib/qualityEstimator.js';

export class SchemaQualityGuard extends AbstractGuard {
  async guard(result: string): Promise<AbstractGuardDecision> {
    try {
      const quality = qualityEstimator(JSON.parse(result));
      if (quality > 0.5) {
        return new GuardDecisionAdvance('quality above 0.5');
      } else {
        return new GuardDecisionQuarantine('quality bellow 0.5', { cause: quality });
      }
    } catch (error) {
      return new GuardDecisionQuarantine('error while calculating quality', { cause: error });
    }
  }

  name(): string {
    return 'quality-guard';
  }
}
