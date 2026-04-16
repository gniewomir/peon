import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './decisions/AbstractGuardDecision.js';
import { GuardDecisionQuarantine } from './decisions/GuardDecisionQuarantine.js';
import { GuardDecisionAdvance } from './decisions/GuardDecisionAdvance.js';

/**
 * Rejects values whose string form (raw for strings, JSON for objects) is below a length threshold.
 */
export class NotEmptySerializedGuard<T = unknown> extends AbstractGuard<T> {
  constructor(private readonly minLength: number = 100) {
    super();
  }

  async guard(result: T): Promise<AbstractGuardDecision> {
    const serialized = typeof result === 'string' ? result : JSON.stringify(result);
    if (serialized.trim().length < this.minLength) {
      return new GuardDecisionQuarantine(`Result empty or shorter than ${this.minLength}`);
    }
    return new GuardDecisionAdvance('Expected non-empty serialized payload');
  }

  name(): string {
    return 'not-empty-serialized-guard';
  }
}
