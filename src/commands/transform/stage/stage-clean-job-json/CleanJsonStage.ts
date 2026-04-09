import { AbstractStage } from '../AbstractStage.js';
import type { StagingFileEvent } from '../../types.js';
import { type AbstractCleaner } from './AbstractCleaner.js';
import path, { dirname } from 'node:path';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import assert from 'node:assert';
import type { Logger } from '../../../lib/logger.js';
import { SchemaShapeGuard } from '../guards/SchemaShapeGuard.js';
import { NotEmptyGuard } from '../guards/NotEmptyGuard.js';

export class CleanJsonStage extends AbstractStage {
  private readonly cleaners = new Map<string, AbstractCleaner>();

  constructor({
    logger,
    cleaners,
    stagingDir,
  }: {
    logger: Logger;
    stagingDir: string;
    cleaners: AbstractCleaner[];
  }) {
    super({ logger, stagingDir });
    const map = new Map<string, AbstractCleaner>();
    cleaners.forEach((cleaner: AbstractCleaner) => {
      map.set(cleaner.strategy(), cleaner);
    });
    this.cleaners = map;
  }

  protected inputFiles(): string[] {
    return ['raw.job.json'];
  }

  protected outputFile(): string {
    return 'clean.job.json';
  }

  protected guards(): AbstractGuard[] {
    return [new NotEmptyGuard(), new SchemaShapeGuard()];
  }

  protected async payload(event: StagingFileEvent) {
    const jobDir = dirname(event.payload);
    const raw = await this.readJson(path.join(jobDir, this.inputFiles()[0]));
    const meta = await this.readRawMetadata(jobDir);
    const source = meta.offer.source;
    assert(source !== null, 'unknown offer source');
    const cleaner = this.cleaners.get(source);
    assert(cleaner, `no cleaner registered for source "${source}"`);
    return cleaner.clean(raw);
  }
}
