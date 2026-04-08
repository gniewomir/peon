import { AbstractGuardDecision } from './AbstractGuardDecision.js';

export class GuardDecisionLoad extends AbstractGuardDecision {
  constructor(message: string) {
    super(message, { cause: undefined });
    this.name = 'GuardDecisionLoad';
  }
}
