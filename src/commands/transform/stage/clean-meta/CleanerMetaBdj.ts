import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { metaSchema, type TMetaSchema } from '../../../../schema/schema.meta.js';
import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { normalizeDMYDateWtPeriodSep } from '../lib/normalizeDMYDateWtPeriodSep.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';
import type { THtmlJsonSchema } from '../../../../schema/schema.html-json.js';

export class CleanerMetaBdj extends AbstractTransformation<TMetaSchema> {
  strategy(): StrategySelector {
    return 'bdj';
  }

  async transform(input: Map<Artifact, string>): Promise<TMetaSchema> {
    const meta = this.objectFromSchema<TMetaSchema>(
      metaSchema,
      KnownArtifactsEnum.RAW_JOB_META,
      input,
    );
    const htmlJson = this.objectFromJson<THtmlJsonSchema>(
      KnownArtifactsEnum.CLEAN_JOB_HTML_JSON,
      input,
    );
    const nav = new JsonNavigator(htmlJson);
    const fallbackExpiration = new Date(
      new Date().getTime() + 1000 * 60 * 60 * 24 * 31,
    ).toISOString();

    return merge(meta, {
      offer: {
        publishedAt:
          nav
            .getOptionalPath('application/json.0.props.pageProps.data.job.publishedAt')
            ?.toString() || null,
        expiresAt:
          this.findExpiration(input) ||
          nav.getOptionalPath('application/json.0.props.pageProps.data.job.endsAt')?.toString() ||
          fallbackExpiration,
        updatedAt: null,
        canonicalUrl: meta.offer.url,
        alternateUrls: [],
      },
    } satisfies DeepPartial<TMetaSchema>) as TMetaSchema;
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
