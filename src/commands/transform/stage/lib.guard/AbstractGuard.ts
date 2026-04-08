import type { AbstractGuardDecision } from './AbstractGuardDecision.js';

export abstract class AbstractGuard {
  abstract name(): string;
  abstract guard(result: unknown): Promise<AbstractGuardDecision>;
}
