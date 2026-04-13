export class GuardDecisionRemove extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GuardDecisionRemove';
  }
}
