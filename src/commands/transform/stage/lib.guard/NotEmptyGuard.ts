import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './AbstractGuardDecision.js';
import { GuardDecisionQuarantine } from './GuardDecisionQuarantine.js';
import { GuardDecisionAdvance } from './GuardDecisionAdvance.js';

export class NotEmptyGuard extends AbstractGuard {
  constructor(private readonly minLength: number = 100) {
    super();
  }

  async guard(result: unknown): Promise<AbstractGuardDecision> {
    if (typeof result === 'string' && result.trim().length < this.minLength) {
      return new GuardDecisionQuarantine(`Result empty or shorter than ${this.minLength}`);
    }
    if (typeof result === 'object' && (!result || Object.keys(result).length === 0)) {
      return new GuardDecisionQuarantine(`Result empty or shorter than ${this.minLength}`);
    }
    if (typeof result === 'string' || typeof result === 'object') {
      return new GuardDecisionAdvance('Expected type and non empty');
    }
    return new GuardDecisionQuarantine('Unexpected type', { cause: typeof result });
  }

  name(): string {
    return 'not-empty-guard';
  }
}
