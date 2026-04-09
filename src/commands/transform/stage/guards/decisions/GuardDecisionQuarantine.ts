import { AbstractGuardDecision } from './AbstractGuardDecision.js';

export class GuardDecisionQuarantine extends AbstractGuardDecision {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GuardDecisionQuarantine';
  }
}
