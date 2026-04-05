import path, { dirname } from 'node:path';
import type { Logger } from '../../../types/Logger.js';
import { smartSave } from '../../../lib/smart-save.js';
import type { StagingFileEvent } from '../../types.js';
import { AbstractStage } from '../AbstractStage.js';
import type { AbstractJsonPreparer } from './AbstractJsonPreparer.js';
import { stripRootPath } from '../../../../root.js';
import type { AbstractGuard } from '../AbstractGuard.js';

export class PrepareJsonStage extends AbstractStage {
  private readonly preparers = new Map<string, AbstractJsonPreparer>();

  constructor({
    logger,
    stagingDir,
    preparers,
  }: {
    logger: Logger;
    stagingDir: string;
    preparers: AbstractJsonPreparer[];
  }) {
    super({ logger, stagingDir });
    for (const preparer of preparers) {
      this.preparers.set(preparer.strategy(), preparer);
    }
  }

  public name(): string {
    return 'prepare-json';
  }

  protected inputs(): string[] {
    return ['raw-job.json'];
  }

  protected outputs(): string[] {
    return ['job.json'];
  }

  protected guards(): AbstractGuard[] {
    return [];
  }

  protected async payload(event: StagingFileEvent): Promise<void> {
    const jobDir = dirname(event.payload);
    const meta = await this.readMetadata(jobDir);
    const preparer = this.preparers.get(meta.strategy_slug);
    if (!preparer) {
      throw new Error(`No JSON preparer registered for strategy "${meta.strategy_slug}"`);
    }

    const input = await this.readJson<unknown>(path.join(jobDir, 'raw-job.json'));
    const prepared = preparer.prepare(input, meta);
    const output = path.join(jobDir, 'job.json');
    await smartSave(output, prepared, false, this.logger);
    this.logger.log(
      `prepared job json: ${stripRootPath(event.payload)} => ${stripRootPath(output)}`,
    );
  }
}
