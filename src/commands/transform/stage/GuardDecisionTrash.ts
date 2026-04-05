export class GuardDecisionTrash extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = 'GuardDecisionTrash';
  }
}
