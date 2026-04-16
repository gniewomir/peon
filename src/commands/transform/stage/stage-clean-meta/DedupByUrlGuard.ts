import { AbstractGuard } from '../guards/AbstractGuard.js';
import type { AbstractGuardDecision } from '../guards/decisions/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from '../guards/decisions/GuardDecisionAdvance.js';
import type { TMetaSchema } from '../../../../schema/schema.meta.js';
import { GuardDecisionTrash } from '../guards/decisions/GuardDecisionTrash.js';

export class DedupByUrlGuard extends AbstractGuard<TMetaSchema> {
  async guard(meta: TMetaSchema): Promise<AbstractGuardDecision> {
    if (!meta.offer.canonicalUrl || meta.offer.alternateUrls.length === 0) {
      return new GuardDecisionAdvance('No data to dedup by url');
    }
    if (meta.offer.url === meta.offer.canonicalUrl) {
      return new GuardDecisionAdvance('Not a duplicate');
    }
    return new GuardDecisionTrash('Trash duplicate', {
      cause: {
        url: meta.offer.url,
        canonicalUrl: meta.offer.url,
        alternateUrls: meta.offer.alternateUrls,
      },
    });
  }

  name(): string {
    return 'dedup-by-url-guard';
  }
}
