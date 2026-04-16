import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './outcomes/AbstractGuardDecision.js';
import { GuardDecisionQuarantine } from './outcomes/GuardDecisionQuarantine.js';
import { GuardDecisionAdvance } from './outcomes/GuardDecisionAdvance.js';

export class SchemaGuard<T = unknown> extends AbstractGuard<T> {
  constructor(private readonly schema: { parse: (data: unknown) => T }) {
    super();
  }

  async guard(result: T): Promise<AbstractGuardDecision> {
    try {
      this.schema.parse(result);
      return new GuardDecisionAdvance('valid shape');
    } catch (error) {
      return new GuardDecisionQuarantine('invalid shape', { cause: error });
    }
  }

  name(): string {
    return 'schema-guard';
  }
}
