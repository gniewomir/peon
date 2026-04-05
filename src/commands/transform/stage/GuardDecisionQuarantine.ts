import { AbstractGuardDecision } from './AbstractGuardDecision.js';

export class GuardDecisionQuarantine extends AbstractGuardDecision {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = 'GuardDecisionQuarantine';
  }
}
