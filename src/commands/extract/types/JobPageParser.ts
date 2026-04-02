export interface JobPageParser {
  extract(dirtyHtml: string): string;
}
