import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './decisions/AbstractGuardDecision.js';
import { schema } from '../../../../schema/schema.js';
import { GuardDecisionQuarantine } from './decisions/GuardDecisionQuarantine.js';
import { GuardDecisionAdvance } from './decisions/GuardDecisionAdvance.js';

export class SchemaShapeGuard extends AbstractGuard {
  async guard(result: string): Promise<AbstractGuardDecision> {
    try {
      schema.parse(JSON.parse(result));
      return new GuardDecisionAdvance('valid shape');
    } catch (error) {
      return new GuardDecisionQuarantine('invalid shape', { cause: error });
    }
  }

  name(): string {
    return 'shape-guard';
  }
}
