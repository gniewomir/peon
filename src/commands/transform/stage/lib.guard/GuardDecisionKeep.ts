import { AbstractGuardDecision } from './AbstractGuardDecision.js';

export class GuardDecisionKeep extends AbstractGuardDecision {
  constructor(message: string) {
    super(message);
    this.name = 'GuardDecisionKeep';
  }
}
