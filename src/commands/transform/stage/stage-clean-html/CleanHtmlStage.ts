import path, { dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Logger } from '../../../types/Logger.js';
import type { StagingFileEvent } from '../../types.js';
import { AbstractStage } from '../AbstractStage.js';
import type { AbstractHtmlCleaner } from './AbstractHtmlCleaner.js';
import type { AbstractGuard } from '../AbstractGuard.js';
import assert from 'node:assert';

export class CleanHtmlStage extends AbstractStage {
  private readonly cleaners = new Map<string, AbstractHtmlCleaner>();

  constructor({
    logger,
    stagingDir,
    cleaners,
  }: {
    logger: Logger;
    stagingDir: string;
    cleaners: AbstractHtmlCleaner[];
  }) {
    super({ logger, stagingDir });
    for (const preparer of cleaners) {
      this.cleaners.set(preparer.strategy(), preparer);
    }
  }

  public name(): string {
    return 'clean-html';
  }

  protected inputs(): string[] {
    return ['raw.job.html'];
  }

  protected output(): string {
    return 'clean.job.html';
  }

  protected guards(): AbstractGuard[] {
    return [];
  }

  protected async payload(event: StagingFileEvent) {
    const jobDir = dirname(event.payload);
    const meta = await this.readMetadata(jobDir);
    const source = meta.offer.source;
    assert(source !== null, 'unknown offer source');
    const cleaner = this.cleaners.get(source);
    assert(cleaner, `no html cleaner registered for source "${source}"`);

    const input = await readFile(path.join(jobDir, 'raw.job.html'), 'utf8');
    return cleaner.clean(input);
  }
}
