import { AbstractStage } from '../AbstractStage.js';
import type { StagingFileEvent } from '../../types.js';
import { readFile } from 'fs/promises';
import { convert } from '@kreuzberg/html-to-markdown-node';
import type { AbstractGuard } from '../AbstractGuard.js';

export class HtmlToMdStage extends AbstractStage {
  name(): string {
    return 'html-to-md';
  }

  protected inputs(): string[] {
    return ['clean.job.html'];
  }

  protected output(): string {
    return 'job.md';
  }

  protected guards(): AbstractGuard[] {
    return [];
  }

  protected async payload(event: StagingFileEvent) {
    const html = await readFile(event.payload, 'utf8');

    return convert(html, {
      // @ts-expect-error workaround: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
      headingStyle: 'Atx',
      // @ts-expect-error workaround: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
      codeBlockStyle: 'Backticks',
      wrap: true,
      wrapWidth: 100,
    });
  }
}
