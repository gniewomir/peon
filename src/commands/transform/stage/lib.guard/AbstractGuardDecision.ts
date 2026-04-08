export abstract class AbstractGuardDecision extends Error {
  protected constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AbstractGuardDecision';
  }
}
