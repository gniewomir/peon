import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './AbstractGuardDecision.js';
import { schema } from '../../../../schema/schema.js';
import { GuardDecisionQuarantine } from './GuardDecisionQuarantine.js';
import { GuardDecisionKeep } from './GuardDecisionKeep.js';

export class SchemaShapeGuard extends AbstractGuard {
  async guard(result: unknown): Promise<AbstractGuardDecision> {
    try {
      schema.parse(result);
      return new GuardDecisionKeep('valid shape');
    } catch (error) {
      return new GuardDecisionQuarantine('invalid shape', { cause: error });
    }
  }

  name(): string {
    return 'shape-guard';
  }
}
