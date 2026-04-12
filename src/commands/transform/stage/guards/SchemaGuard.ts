import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './decisions/AbstractGuardDecision.js';
import { GuardDecisionQuarantine } from './decisions/GuardDecisionQuarantine.js';
import { GuardDecisionAdvance } from './decisions/GuardDecisionAdvance.js';

export class SchemaGuard extends AbstractGuard {
  constructor(private readonly schema: { parse: (data: unknown) => unknown }) {
    super();
  }

  async guard(result: string): Promise<AbstractGuardDecision> {
    try {
      this.schema.parse(JSON.parse(result));
      return new GuardDecisionAdvance('valid shape');
    } catch (error) {
      return new GuardDecisionQuarantine('invalid shape', { cause: error });
    }
  }

  name(): string {
    return 'schema-guard';
  }
}
