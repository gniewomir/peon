import { AbstractGuardDecision } from './AbstractGuardDecision.js';

export class GuardDecisionKeep extends AbstractGuardDecision {
  constructor(message: string) {
    super(message, { cause: undefined });
    this.name = 'GuardDecisionKeep';
  }
}
