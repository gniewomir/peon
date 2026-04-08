export abstract class AbstractHtmlCleaner {
  abstract strategy(): string;
  abstract clean(dirtyContent: string): string;
}
