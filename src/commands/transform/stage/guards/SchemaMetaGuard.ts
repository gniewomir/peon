import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './decisions/AbstractGuardDecision.js';
import { GuardDecisionQuarantine } from './decisions/GuardDecisionQuarantine.js';
import { GuardDecisionAdvance } from './decisions/GuardDecisionAdvance.js';
import { metaSchema } from '../../../../schema/schema.meta.js';

export class SchemaMetaGuard extends AbstractGuard {
  async guard(result: string): Promise<AbstractGuardDecision> {
    try {
      metaSchema.parse(JSON.parse(result));
      return new GuardDecisionAdvance('valid shape');
    } catch (error) {
      return new GuardDecisionQuarantine('invalid shape', { cause: error });
    }
  }

  name(): string {
    return 'meta-shape-guard';
  }
}
