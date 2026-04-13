import { GuardDecisionTrash } from '../guards/decisions/GuardDecisionTrash.js';
import type { AbstractGuardDecision } from '../guards/decisions/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from '../guards/decisions/GuardDecisionAdvance.js';
import { AbstractGuard } from '../guards/AbstractGuard.js';

export class NotEmptyCleanHtmlGuard extends AbstractGuard {
  constructor(private readonly minLength: number = 100) {
    super();
  }

  async guard(result: string): Promise<AbstractGuardDecision> {
    if (result.trim().length < this.minLength) {
      return new GuardDecisionTrash(
        `Trash. Result empty or shorter than ${this.minLength} - webpage was not fully rendered?`,
      );
    }
    return new GuardDecisionAdvance('Non empty');
  }

  name(): string {
    return 'not-empty-clean-html-guard';
  }
}
