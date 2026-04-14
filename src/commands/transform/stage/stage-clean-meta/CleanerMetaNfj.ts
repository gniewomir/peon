import { type DeepPartial, merge } from '../../../../schema/schema.utils.js';
import { metaSchema, type TMetaSchema } from '../../../../schema/schema.meta.js';
import { AbstractTransformation } from '../AbstractTransformation.js';
import type { StrategySelector } from '../../../../lib/types.js';
import { type Artifact, KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import { JsonNavigator } from '../../lib/JsonNavigator.js';
import assert from 'node:assert';
import { normalizeDMYDateWtPeriodSep } from '../lib/normalizeDMYDateWtPeriodSep.js';

export class CleanerMetaNfj extends AbstractTransformation {
  strategy(): StrategySelector {
    return 'nfj';
  }

  async transform(input: Map<Artifact, string>): Promise<string> {
    const meta = this.objectFromSchema<TMetaSchema>(
      metaSchema,
      KnownArtifactsEnum.RAW_JOB_META_JSON,
      input,
    );
    const json = this.objectFromJson(KnownArtifactsEnum.RAW_JOB_JSON, input);
    const nav = new JsonNavigator(json);

    return this.toString(
      merge(metaSchema.parse(meta), {
        offer: {
          publishedAt: nav.getPath('posted').toDateFromTimestamp().toISOString(),
          expiresAt: this.findExpiration(input.get(KnownArtifactsEnum.CLEAN_MARKDOWN)),
          updatedAt: nav.getOptionalPath('renewed')?.toDateFromTimestamp().toISOString() ?? null,
          canonicalUrl:
            this.slugsToUrls(meta.offer.url || '', [this.establishCanonicalUrlSlug(nav)]).pop() ||
            null,
          alternateUrls: this.slugsToUrls(
            meta.offer.url || '',
            this.establishAlternateUrlSlugs(nav),
          ),
        },
      } satisfies DeepPartial<TMetaSchema>),
    );
  }

  private findExpiration(markdown: string | undefined): string | null {
    if (!markdown) {
      return null;
    }

    const todayMatches = markdown.match(/^- Offer expires today$/m);
    if (todayMatches && todayMatches[0]) {
      const expirationDate = new Date();
      expirationDate.setHours(23);
      expirationDate.setMinutes(59);
      return expirationDate.toISOString();
    }

    const matches = markdown.match(/^- Offer valid until: (.+)$/m);
    const match =
      matches && matches[0] ? matches[0].split(' ').filter((w) => w.includes('.'))[0] : null;
    return match ? normalizeDMYDateWtPeriodSep(match) : null;
  }

  private slugsToUrls(offerUrl: string, slugs: string[]): string[] {
    const baseSlug = offerUrl.split('/').pop();
    assert(baseSlug, 'Could not establish url base from offer url');
    const result: string[] = [];
    for (const slug of slugs) {
      result.push(new URL(offerUrl.replace(baseSlug, slug)).toString().toLowerCase().trim());
    }
    return result;
  }

  private establishCanonicalUrlSlug(nav: JsonNavigator): string {
    const urls = nav
      .getPath('location.places')
      .toArray()
      .map((place) => place.getPath('url').toString().toLowerCase().trim())
      .sort((a, b) => a.length - b.length);
    const urlIncludeRemote = urls.filter((url: string) => url.includes('remote'));
    if (urlIncludeRemote.length > 0) {
      return urlIncludeRemote[0];
    }
    assert(urls[0], 'Url cannot be undefined');
    return urls[0];
  }

  private establishAlternateUrlSlugs(nav: JsonNavigator): string[] {
    return nav
      .getPath('location.places')
      .toArray()
      .map((place) => place.getPath('url').toString());
  }
}
