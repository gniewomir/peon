import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './AbstractGuardDecision.js';
import { GuardDecisionQuarantine } from './GuardDecisionQuarantine.js';
import { GuardDecisionAdvance } from './GuardDecisionAdvance.js';
import { qualityEstimator } from '../lib.stage/qualityEstimator.js';

export class SchemaQualityGuard extends AbstractGuard {
  async guard(result: unknown): Promise<AbstractGuardDecision> {
    try {
      const quality = qualityEstimator(result);
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
