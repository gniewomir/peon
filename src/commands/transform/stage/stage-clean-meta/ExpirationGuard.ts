import { AbstractGuard } from '../guards/AbstractGuard.js';
import type { AbstractGuardDecision } from '../guards/decisions/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from '../guards/decisions/GuardDecisionAdvance.js';
import { GuardDecisionQuarantine } from '../guards/decisions/GuardDecisionQuarantine.js';
import type { TMetaSchema } from '../../../../schema/schema.meta.js';
import { GuardDecisionTrash } from '../guards/decisions/GuardDecisionTrash.js';

export class ExpirationGuard extends AbstractGuard<TMetaSchema> {
  async guard(meta: TMetaSchema): Promise<AbstractGuardDecision> {
    try {
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
