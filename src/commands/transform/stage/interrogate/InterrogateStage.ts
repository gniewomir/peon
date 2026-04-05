import type { StagingFileEvent } from '../../types.js';
import { AbstractStage } from '../AbstractStage.js';
import { interrogateJobOffer } from './interrogate.js';
import { smartSave } from '../../../lib/smart-save.js';
import type { Logger } from '../../../types/Logger.js';
import { type ConcurrencyLimiter, createConcurrencyLimiter } from '../../lib/limiter.js';
import { readFile } from 'fs/promises';
import path, { dirname } from 'path';
import { stripRootPath } from '../../../../root.js';
import type { AbstractGuard } from '../AbstractGuard.js';

export class InterrogateStage extends AbstractStage {
  private readonly concurrencyLimit: number;
  private readonly concurrencyLimiter: ConcurrencyLimiter;

  constructor({
    logger,
    stagingDir,
    concurrencyLimit = 3,
  }: {
    logger: Logger;
    stagingDir: string;
    concurrencyLimit?: number;
  }) {
    super({ logger, stagingDir });
    this.concurrencyLimit = concurrencyLimit;
    this.concurrencyLimiter = createConcurrencyLimiter(this.concurrencyLimit);
  }

  public name(): string {
    return 'interrogate';
  }

  protected inputs(): string[] {
    return ['job.md'];
  }

  protected outputs(): string[] {
    return ['job.interrogated.json'];
  }

  protected guards(): AbstractGuard[] {
    return [];
  }

  protected async payload(event: StagingFileEvent): Promise<void> {
    await this.concurrencyLimiter.run(async () => {
      const markdown = await readFile(event.payload, 'utf8');
      const confession = await interrogateJobOffer(markdown);
      const output = path.join(dirname(event.payload), `job.interrogated.json`);
      await smartSave(output, confession, false, this.logger);
      this.logger.log(
        `interrogated markdown: ${stripRootPath(event.payload)} => ${stripRootPath(output)}`,
        {
          active: this.concurrencyLimiter.activeCount(),
          pending: this.concurrencyLimiter.pendingCount(),
        },
      );
    });
  }
}
