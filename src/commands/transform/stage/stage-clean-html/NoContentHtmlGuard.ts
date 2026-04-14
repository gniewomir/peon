import type { AbstractGuardDecision } from '../guards/decisions/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from '../guards/decisions/GuardDecisionAdvance.js';
import { AbstractGuard } from '../guards/AbstractGuard.js';
import { GuardDecisionRemove } from '../guards/decisions/GuardDecisionRemove.js';
import { GuardDecisionQuarantine } from '../guards/decisions/GuardDecisionQuarantine.js';

export class NoContentHtmlGuard extends AbstractGuard {
  constructor(private readonly minLength: number = 100) {
    super();
  }

  async guard(result: string): Promise<AbstractGuardDecision> {
    if (result.trim().length < this.minLength) {
      return new GuardDecisionRemove(
        `Result empty or shorter than ${this.minLength} - webpage was not fully rendered?`,
      );
    }
    const $ = this.toCheerio(result);
    if ($('p').length === 0) {
      return new GuardDecisionQuarantine(
        `No paragraphs in content - webpage was not fully rendered?`,
      );
    }
    return new GuardDecisionAdvance('Non empty');
  }

  name(): string {
    return 'no-content-clean-html-guard';
  }
}
