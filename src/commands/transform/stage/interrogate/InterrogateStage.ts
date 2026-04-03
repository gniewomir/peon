import type { StagingFileEvent } from '../../types.js';
import { AbstractStage } from '../AbstractStage.js';
import { interrogateJobOffer } from './interrogate.js';
import { smartSave } from '../../../lib/smart-save.js';
import type { Logger } from '../../../types/Logger.js';
import { type ConcurrencyLimiter, createConcurrencyLimiter } from '../../lib/limiter.js';
import { readFile } from 'fs/promises';
import path, { dirname } from 'path';

export class InterrogateStage extends AbstractStage {
  private readonly concurrencyLimit: number;
  private readonly concurrencyLimiter: ConcurrencyLimiter;

  constructor({
    logger,
    stagingDir,
    concurrencyLimit = 2,
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

  protected async payload(event: StagingFileEvent): Promise<void> {
    /**
     * ATM locally we have to accept 30+ sec for prompt while running with local LLM
     * Diminishings returns from concurrent request above two, maybe three could be expected
     */
    await this.concurrencyLimiter.run(async () => {
      const markdown = await readFile(event.payload, 'utf8');
      const confession = await interrogateJobOffer(markdown);
      const output = path.join(dirname(event.payload), `job.interrogated.json`);
      await smartSave(output, confession, false, this.logger);
      this.logger.log(`interrogated markdown: ${event.payload} => ${output}`);
    });
  }
}
