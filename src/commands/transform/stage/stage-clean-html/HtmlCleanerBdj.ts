import { AbstractHtmlCleaner } from './AbstractHtmlCleaner.js';

export class HtmlCleanerBdj extends AbstractHtmlCleaner {
  strategy(): string {
    return 'bdj';
  }

  clean(dirtyContent: string): string {
    const $ = this.$(dirtyContent);

    $('.cookie-bar').remove();
    $('#main-menu').remove();
    $('.bg-action').remove();
    $('.bg-black ').remove();
    $('footer').remove();
    $('h3')
      .filter(function () {
        return $(this).text().startsWith('Similar offers');
      })
      .each(function () {
        $(this).parent().remove();
      });

    return $.html();
  }
}
