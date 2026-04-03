import * as cheerio from 'cheerio';

export function stripAllAttributesAndPruneEmpty($: cheerio.CheerioAPI): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cheerio each() binds loose Element
  $('*').each(function (this: any) {
    const $this = $(this);
    const attrs = Object.keys(this.attribs || {});

    attrs.forEach((attr) => {
      $this.removeAttr(attr);
    });

    if ($this.text().trim() === '' && $this.children().length === 0) {
      $this.remove();
    }
  });
}
