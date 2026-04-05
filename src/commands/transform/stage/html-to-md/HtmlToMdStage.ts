import { AbstractStage } from '../AbstractStage.js';
import type { StagingFileEvent } from '../../types.js';
import { readFile } from 'fs/promises';
import { convert } from '@kreuzberg/html-to-markdown-node';
import { smartSave } from '../../../lib/smart-save.js';
import path, { dirname } from 'node:path';
import { stripRootPath } from '../../../../root.js';
import type { AbstractGuard } from '../AbstractGuard.js';

export class HtmlToMdStage extends AbstractStage {
  name(): string {
    return 'html-to-md';
  }

  protected inputs(): string[] {
    return ['job.html'];
  }

  protected outputs(): string[] {
    return ['job.md'];
  }

  protected guards(): AbstractGuard[] {
    return [];
  }

  protected async payload(event: StagingFileEvent): Promise<void> {
    const html = await readFile(event.payload, 'utf8');
    const markdown = convert(html, {
      // @ts-expect-error workaround: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
      headingStyle: 'Atx',
      // @ts-expect-error workaround: TS2748: Cannot access ambient const enums when verbatimModuleSyntax is enabled
      codeBlockStyle: 'Backticks',
      wrap: true,
      wrapWidth: 100,
    });
    const output = path.join(dirname(event.payload), `job.md`);
    await smartSave(output, markdown, false, this.logger);
    this.logger.log(
      `html to markdown: ${stripRootPath(event.payload)} => ${stripRootPath(output)}`,
    );
  }
}
