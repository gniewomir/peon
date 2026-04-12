import { AbstractGuard } from './AbstractGuard.js';
import type { AbstractGuardDecision } from './decisions/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from './decisions/GuardDecisionAdvance.js';
import { metaSchema } from '../../../../schema/schema.meta.js';
import { GuardDecisionTrash } from './decisions/GuardDecisionTrash.js';

export class DedupByUrlGuard extends AbstractGuard {
  async guard(result: string): Promise<AbstractGuardDecision> {
    const meta = metaSchema.parse(JSON.parse(result));
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
