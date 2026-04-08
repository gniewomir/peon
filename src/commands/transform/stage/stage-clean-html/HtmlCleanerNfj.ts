import { AbstractHtmlCleaner } from './AbstractHtmlCleaner.js';

export class HtmlCleanerNfj extends AbstractHtmlCleaner {
  strategy(): string {
    return 'nfj';
  }

  clean(dirtyContent: string): string {
    const $ = this.$(dirtyContent);

    $('common-image-blur').remove();
    $('common-posting-locations').remove();
    $('popover-content').remove();
    $('nfj-navbar-menu').remove();
    $('nfj-search-box').remove();
    $('nfj-posting-similar').remove();
    $('nfj-job-offer-survey-wrapper').remove();
    $('nfj-posting-apply-btn').remove();
    $('nfj-subscriptions-add-standalone').remove();
    $('nfj-footer').remove();
    $('#usercentrics-cmp-ui').remove();

    return $.html();
  }
}
