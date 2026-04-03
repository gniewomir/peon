export abstract class AbstractHtmlPreparer {
  abstract strategy(): string;
  abstract prepare(dirtyContent: string): string;
}
