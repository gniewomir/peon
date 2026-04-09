import { AbstractGuardDecision } from './AbstractGuardDecision.js';

export class GuardDecisionAdvance extends AbstractGuardDecision {
  constructor(message: string) {
    super(message);
    this.name = 'GuardDecisionAdvance';
  }
}
