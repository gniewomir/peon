import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './AbstractGuardDecision.js';
import { GuardDecisionQuarantine } from './GuardDecisionQuarantine.js';
import { GuardDecisionKeep } from './GuardDecisionKeep.js';
import { qualityEstimator } from '../lib.stage/qualityEstimator.js';

export class SchemaQualityGuard extends AbstractGuard {
  async guard(result: unknown): Promise<AbstractGuardDecision> {
    try {
      const quality = qualityEstimator(result);
      if (quality > 0.5) {
        return new GuardDecisionKeep('quality above 0.5');
      } else {
        return new GuardDecisionQuarantine('quality bellow 0.5', undefined);
      }
    } catch (error) {
      return new GuardDecisionQuarantine('error while calculating quality', error);
    }
  }

  name(): string {
    return 'shape-guard';
  }
}
