import * as cheerio from 'cheerio';
import assert from 'node:assert';

const nonSemanticHtmlTags: string[] = [
  'tt',
  'font',
  'blink',
  'marquee',
  'nobr',
  'wbr',
  'xmp',
  'plaintext',
  'listing',
  'basefont',
  'dir',
  'menu',
  'isindex',
  'applet',
  'embed',
  'object',
  'param',
  'area',
  'map',
  'img',
  'iframe',
  'frame',
  'frameset',
  'noframes',
  'br',
  'hr',
  'meta',
  'link',
  'style',
  'script',
  'noscript',
  'template',
  'slot',
  'canvas',
  'svg',
  'math',
  'form',
  'input',
  'textarea',
  'select',
  'option',
  'optgroup',
  'button',
  'fieldset',
  'legend',
  'label',
  'output',
  'progress',
  'meter',
  'datalist',
  'keygen',
  'caption',
];

const layoutAndNavigationTags: string[] = ['header', 'footer', 'nav'];

export function clean(html: string): string {
  let $ = cheerio.load(html);
  const payload = $('body').html();
  assert(
    typeof payload === 'string' && payload.length > 0,
    'clean: payload must be a non empty string',
  );

  $ = cheerio.load(payload);

  for (const selector of [...nonSemanticHtmlTags, ...layoutAndNavigationTags]) {
    $(selector).remove();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cheerio each() binds loose Element
  $('*').each(function (this: any) {
    const attrs = Object.keys(this.attribs || {});
    const $this = $(this);

    if ($this.text().trim() === '' && $this.children().length === 0) {
      $this.remove();
      return;
    }

    attrs.forEach((attr) => {
      if (['href', 'id', 'class'].includes(attr)) {
        return;
      }
      $this.removeAttr(attr);
    });
  });

  return $.html();
}
