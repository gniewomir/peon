import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './decisions/AbstractGuardDecision.js';
import { GuardDecisionQuarantine } from './decisions/GuardDecisionQuarantine.js';
import { GuardDecisionAdvance } from './decisions/GuardDecisionAdvance.js';

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
