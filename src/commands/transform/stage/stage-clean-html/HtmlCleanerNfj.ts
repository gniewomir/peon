import { AbstractHtmlCleaner } from './AbstractHtmlCleaner.js';

export class HtmlCleanerNfj extends AbstractHtmlCleaner {
  strategy(): string {
    return 'nfj';
  }

  clean(dirtyContent: string): string {
    const $ = this.$(dirtyContent);

    const $content = $('common-posting-content-wrapper');
    const $sidebar = $('common-apply-box');

    $sidebar.remove('nfj-posting-similar');

    return ($content.html() || '') + ($sidebar.html() || '');
  }
}
