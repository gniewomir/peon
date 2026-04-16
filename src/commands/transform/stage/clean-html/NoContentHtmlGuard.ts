import type { AbstractGuardDecision } from '../../outcomes/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from '../../outcomes/GuardDecisionAdvance.js';
import { AbstractGuard } from '../AbstractGuard.js';
import { GuardDecisionRemove } from '../../outcomes/GuardDecisionRemove.js';
import { GuardDecisionQuarantine } from '../../outcomes/GuardDecisionQuarantine.js';

export class NoContentHtmlGuard extends AbstractGuard<string> {
  constructor(private readonly minLength: number = 100) {
    super();
  }

  async guard(result: string): Promise<AbstractGuardDecision> {
    if (
      result.includes(
        'Application error: a client-side exception has occurred while loading justjoin.it',
      )
    ) {
      return new GuardDecisionRemove(`JJI application error - webpage was not fully rendered`);
    }
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
