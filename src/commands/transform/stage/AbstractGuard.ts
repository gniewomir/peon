import type { AbstractGuardDecision } from './AbstractGuardDecision.js';

export abstract class AbstractGuard {
  abstract name(): string;
  abstract guard(args: { jobDir: string; output_paths: string[] }): Promise<AbstractGuardDecision>;
}
