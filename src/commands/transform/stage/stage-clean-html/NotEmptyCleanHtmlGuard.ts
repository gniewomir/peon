import type { AbstractGuardDecision } from '../guards/decisions/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from '../guards/decisions/GuardDecisionAdvance.js';
import { AbstractGuard } from '../guards/AbstractGuard.js';
import { GuardDecisionRemove } from '../guards/decisions/GuardDecisionRemove.js';

export class NotEmptyCleanHtmlGuard extends AbstractGuard {
  constructor(private readonly minLength: number = 100) {
    super();
  }

  async guard(result: string): Promise<AbstractGuardDecision> {
    if (result.trim().length < this.minLength) {
      return new GuardDecisionRemove(
        `Remove. Result empty or shorter than ${this.minLength} - webpage was not fully rendered?`,
      );
    }
    return new GuardDecisionAdvance('Non empty');
  }

  name(): string {
    return 'not-empty-clean-html-guard';
  }
}
