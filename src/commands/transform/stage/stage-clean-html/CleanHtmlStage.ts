import path, { dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { StagingFileEvent } from '../../types.js';
import { AbstractStage } from '../AbstractStage.js';
import type { AbstractHtmlCleaner } from './AbstractHtmlCleaner.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import assert from 'node:assert';
import type { Logger } from '../../../lib/logger.js';
import { NotEmptyGuard } from '../guards/NotEmptyGuard.js';

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

  protected inputFiles(): string[] {
    return ['raw.job.html'];
  }

  protected outputFile(): string {
    return 'clean.job.html';
  }

  protected guards(): AbstractGuard[] {
    return [new NotEmptyGuard()];
  }

  protected async payload(event: StagingFileEvent) {
    const jobDir = dirname(event.payload);
    const input = await readFile(path.join(jobDir, this.inputFiles()[0]), 'utf8');
    const meta = await this.readRawMetadata(jobDir);
    const source = meta.offer.source;
    assert(source !== null, 'unknown offer source');
    const cleaner = this.cleaners.get(source);
    assert(cleaner, `no html cleaner registered for source "${source}"`);
    return cleaner.clean(input);
  }
}
