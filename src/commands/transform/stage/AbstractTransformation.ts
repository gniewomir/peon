import type { Artifact } from '../artifacts.js';
import type { CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';
import assert from 'node:assert';
import type { StrategySelector } from '../../lib/types.js';

export interface Transformation {
  strategy(): StrategySelector;
  transform(input: Map<Artifact, string>): Promise<string>;
}

export abstract class AbstractTransformation implements Transformation {
  abstract strategy(): StrategySelector;
  abstract transform(input: Map<Artifact, string>): Promise<string>;

  protected objectFromJson<T = Record<string, unknown>>(
    artifact: Artifact,
    input: Map<Artifact, string>,
  ): T {
    const content = input.get(artifact);
    assert(content, 'No input for artifact');
    return JSON.parse(content) as T;
  }

  protected objectFromSchema<T>(
    schema: { parse: (data: unknown) => T },
    artifact: Artifact,
    input: Map<Artifact, string>,
  ): T {
    return schema.parse(this.objectFromJson<T>(artifact, input));
  }

  protected toCheerio(artifact: Artifact, input: Map<Artifact, string>): CheerioAPI {
    let content = input.get(artifact);
    assert(content, 'No input for artifact');
    content = content.replaceAll('<!-- -->', '');
    content = content.replaceAll('<!---->', '');
    content = content.replaceAll('<!--$-->', '');
    content = content.replaceAll('<!--/$-->', '');
    return cheerio.load(content);
  }

  protected toPreprocessedCheerio(artifact: Artifact, input: Map<Artifact, string>): CheerioAPI {
    const $ = this.toCheerio(artifact, input);
    const removeTags = ['script', 'noscript', 'img', 'svg', 'style', 'iframe'];
    for (const tag of removeTags) {
      $(tag).remove();
    }

    $.root()
      .contents()
      .filter(function () {
        return this.type === 'comment';
      })
      .remove();

    $('*').each(function () {
      const $this = $(this);
      const attrs = Object.keys($this.attr() || {});

      if ($this.text().trim() === '' && $this.children().length === 0) {
        $this.remove();
      }

      attrs.forEach((attr) => {
        if (['href', 'id', 'class', 'type'].includes(attr)) {
          return;
        }
        $this.removeAttr(attr);
      });
    });

    return $;
  }

  protected toString(input: object) {
    return JSON.stringify(input, null, 2);
  }
}
