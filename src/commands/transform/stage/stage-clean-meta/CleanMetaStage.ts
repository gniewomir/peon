import { AbstractStage } from '../AbstractStage.js';
import type { StagingFileEvent } from '../../types.js';
import { type AbstractMetaCleaner } from './AbstractMetaCleaner.js';
import path, { dirname } from 'node:path';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import assert from 'node:assert';
import type { Logger } from '../../../lib/logger.js';
import { NotEmptyGuard } from '../guards/NotEmptyGuard.js';
import { CleanerMetaBdj } from './CleanerMetaBdj.js';
import { CleanerMetaJji } from './CleanerMetaJji.js';
import { CleanerMetaNfj } from './CleanerMetaNfj.js';
import { SchemaMetaGuard } from '../guards/SchemaMetaGuard.js';

export class CleanMetaStage extends AbstractStage {
  private readonly cleaners = new Map<string, AbstractMetaCleaner>();

  constructor({
    logger,
    cleaners,
    stagingDir,
  }: {
    logger: Logger;
    stagingDir: string;
    cleaners: AbstractMetaCleaner[];
  }) {
    super({ logger, stagingDir });
    const map = new Map<string, AbstractMetaCleaner>();
    cleaners.forEach((cleaner: AbstractMetaCleaner) => {
      map.set(cleaner.strategy(), cleaner);
    });
    this.cleaners = map;
  }

  public static cleaners(): AbstractMetaCleaner[] {
    return [new CleanerMetaBdj(), new CleanerMetaJji(), new CleanerMetaNfj()];
  }

  protected inputFiles(): string[] {
    return ['raw.meta.json'];
  }

  protected outputFile(): string {
    return 'clean.meta.json';
  }

  protected guards(): AbstractGuard[] {
    return [new NotEmptyGuard(), new SchemaMetaGuard()];
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
