import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { metaSchema, type TMetaSchema } from '../../../../schema/schema.meta.js';
import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../artifacts.js';
import { normalizeDMYDateWtPeriodSep } from '../lib/normalizeDMYDateWtPeriodSep.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';

export class CleanerMetaBdj extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'bdj';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const meta = this.objectFromSchema<TMetaSchema>(
      metaSchema,
      KnownArtifactsEnum.RAW_JOB_META_JSON,
      input,
    );
    const htmlJson = this.objectFromJson(KnownArtifactsEnum.RAW_JOB_HTML_JSON, input);
    const nav = new JsonNavigator(htmlJson);

    return this.toString(
      merge(meta, {
        offer: {
          publishedAt: nav.getPath('hydration.0.props.pageProps.data.job.publishedAt').toString(),
          expiresAt:
            this.findExpiration(input) ||
            nav.getPath('hydration.0.props.pageProps.data.job.endsAt').toString(),
          updatedAt: null,
          canonicalUrl: meta.offer.url,
          alternateUrls: [],
        },
      } satisfies DeepPartial<TMetaSchema>),
    );
  }

  private findExpiration(input: Map<Artifact, string>): string | null {
    const $ = this.toCheerio(KnownArtifactsEnum.CLEAN_JOB_HTML, input);

    let expiration: string | null = null;
    $('p').each((_, el) => {
      const $this = $(el);
      const text = $this.text();
      if (text.startsWith('Valid for') || text.startsWith('Ważna do')) {
        const siblingDate = $this.next('div').find('p').first().text().trim();
        expiration = normalizeDMYDateWtPeriodSep(siblingDate);
      }
    });

    return expiration;
  }
}
