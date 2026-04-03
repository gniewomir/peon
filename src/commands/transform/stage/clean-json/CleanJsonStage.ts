import { AbstractStage } from '../AbstractStage.js';
import type { StagingFileEvent } from '../../types.js';
import { type AbstractCleaner } from './AbstractCleaner.js';
import { smartSave } from '../../../lib/smart-save.js';
import type { Logger } from '../../../types/Logger.js';
import path, { dirname } from 'node:path';

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

  name(): string {
    return 'clean-json';
  }

  protected inputs(): string[] {
    return ['job.json'];
  }

  protected outputs(): string[] {
    return ['job.clean.json'];
  }

  protected async payload(event: StagingFileEvent): Promise<void> {
    const meta = await this.readMetadata(dirname(event.payload));
    const listing = await this.readJson<Record<string, unknown>>(
      path.join(dirname(event.payload), `job.json`),
    );
    const cleaner = this.cleaners.get(meta.strategy_slug);
    if (!cleaner) {
      throw new Error(`No cleaner registered for strategy "${meta.strategy_slug}"`);
    }
    const cleaned = cleaner.clean(listing, meta);
    const output = path.join(dirname(event.payload), `job.clean.json`);
    await smartSave(output, cleaned, false, this.logger);
    this.logger.log(`cleaned job json: ${event.payload} => ${output}`);
  }
}
