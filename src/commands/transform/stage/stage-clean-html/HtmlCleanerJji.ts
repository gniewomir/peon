import { AbstractHtmlCleaner } from './AbstractHtmlCleaner.js';

export class HtmlCleanerJji extends AbstractHtmlCleaner {
  strategy(): string {
    return 'jji';
  }

  clean(dirtyContent: string): string {
    const $ = this.$(dirtyContent);

    $('span').each((_, el) => {
      const $this = $(el);
      if ($this.text().trim().startsWith('#1 Job Board for tech industry in Europe')) {
        $this.parent().parent().parent().parent().parent().remove();
      }
      if ($this.text().trim().startsWith('ADVERTISEMENT: Recommended by Just Join IT')) {
        $this.parent().parent().remove();
      }
    });
    $('#cookiescript_injected_wrapper').remove();
    $('footer').remove();
    $('a[href="/job-offers/all-locations"]').parent().parent().remove();

    return $.html();
  }
}
