import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './decisions/AbstractGuardDecision.js';
import { GuardDecisionQuarantine } from './decisions/GuardDecisionQuarantine.js';
import { GuardDecisionAdvance } from './decisions/GuardDecisionAdvance.js';

export class NotEmptyGuard extends AbstractGuard {
  constructor(private readonly minLength: number = 100) {
    super();
  }

  async guard(result: string): Promise<AbstractGuardDecision> {
    if (result.trim().length < this.minLength) {
      return new GuardDecisionQuarantine(`Result empty or shorter than ${this.minLength}`);
    }
    return new GuardDecisionAdvance('Expected type and non empty');
  }

  name(): string {
    return 'not-empty-guard';
  }
}
