import type { CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';

export abstract class AbstractHtmlCleaner {
  abstract strategy(): string;
  abstract clean(dirtyContent: string): string;

  protected $(dirtyContent: string): CheerioAPI {
    const $ = cheerio.load(dirtyContent);
    const removeTags = ['script', 'noscript', 'img', 'svg', 'style', 'iframe'];
    for (const tag of removeTags) {
      $(tag).remove();
    }

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
}
