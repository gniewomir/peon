import path, { dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Logger } from '../../../types/Logger.js';
import { smartSave } from '../../../lib/smart-save.js';
import type { StagingFileEvent } from '../../types.js';
import { AbstractStage } from '../AbstractStage.js';
import type { AbstractHtmlPreparer } from './AbstractHtmlPreparer.js';
import { stripRootPath } from '../../../../root.js';
import type { AbstractGuard } from '../AbstractGuard.js';

export class PrepareHtmlStage extends AbstractStage {
  private readonly preparers = new Map<string, AbstractHtmlPreparer>();

  constructor({
    logger,
    stagingDir,
    preparers,
  }: {
    logger: Logger;
    stagingDir: string;
    preparers: AbstractHtmlPreparer[];
  }) {
    super({ logger, stagingDir });
    for (const preparer of preparers) {
      this.preparers.set(preparer.strategy(), preparer);
    }
  }

  public name(): string {
    return 'prepare-html';
  }

  protected inputs(): string[] {
    return ['raw-job.html'];
  }

  protected outputs(): string[] {
    return ['job.html'];
  }

  protected guards(): AbstractGuard[] {
    return [];
  }

  protected async payload(event: StagingFileEvent): Promise<void> {
    const jobDir = dirname(event.payload);
    const meta = await this.readMetadata(jobDir);
    const preparer = this.preparers.get(meta.strategy_slug);
    if (!preparer) {
      throw new Error(`No HTML preparer registered for strategy "${meta.strategy_slug}"`);
    }

    const input = await readFile(path.join(jobDir, 'raw-job.html'), 'utf8');
    const prepared = preparer.prepare(input);
    const output = path.join(jobDir, 'job.html');
    await smartSave(output, prepared, false, this.logger);
    this.logger.log(
      `prepared job html: ${stripRootPath(event.payload)} => ${stripRootPath(output)}`,
    );
  }
}
