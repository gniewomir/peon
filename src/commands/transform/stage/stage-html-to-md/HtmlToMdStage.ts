import { AbstractStage } from '../lib.stage/AbstractStage.js';
import type { StagingFileEvent } from '../../types.js';
import { readFile } from 'fs/promises';
import { convert } from '@kreuzberg/html-to-markdown-node';
import type { AbstractGuard } from '../lib.guard/AbstractGuard.js';
import path, { dirname } from 'path';
import { NotEmptyGuard } from '../lib.guard/NotEmptyGuard.js';

export class HtmlToMdStage extends AbstractStage {
  protected inputFiles(): string[] {
    return ['clean.job.html'];
  }

  protected outputFile(): string {
    return 'job.md';
  }

  protected guards(): AbstractGuard[] {
    return [new NotEmptyGuard()];
  }

  protected async payload(event: StagingFileEvent) {
    const jobDir = dirname(event.payload);
    const html = await readFile(path.join(jobDir, this.inputFiles()[0]), 'utf8');

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
