export abstract class AbstractGuardDecision extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = 'AbstractGuardDecision';
  }
}
