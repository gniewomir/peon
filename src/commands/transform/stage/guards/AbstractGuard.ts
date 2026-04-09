import type { AbstractGuardDecision } from './decisions/AbstractGuardDecision.js';

export abstract class AbstractGuard {
  abstract name(): string;
  abstract guard(result: unknown): Promise<AbstractGuardDecision>;
}
