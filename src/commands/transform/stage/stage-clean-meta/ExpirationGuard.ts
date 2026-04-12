import { AbstractGuard } from '../guards/AbstractGuard.js';
import type { AbstractGuardDecision } from '../guards/decisions/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from '../guards/decisions/GuardDecisionAdvance.js';
import { GuardDecisionQuarantine } from '../guards/decisions/GuardDecisionQuarantine.js';
import { metaSchema } from '../../../../schema/schema.meta.js';
import { GuardDecisionTrash } from '../guards/decisions/GuardDecisionTrash.js';

export class ExpirationGuard extends AbstractGuard {
  async guard(result: string): Promise<AbstractGuardDecision> {
    try {
      const meta = metaSchema.parse(JSON.parse(result));
      const expiration = meta.offer.expiresAt;
      if (expiration === null) {
        return new GuardDecisionQuarantine('no expiration date in clean meta!');
      }
      if (new Date(expiration).getTime() <= new Date().getTime()) {
        return new GuardDecisionTrash('offer has expired - trashing it!');
      }
      return new GuardDecisionAdvance('offer is still fresh');
    } catch (error) {
      return new GuardDecisionQuarantine('invalid shape', { cause: error });
    }
  }

  name(): string {
    return 'expiration-guard';
  }
}
