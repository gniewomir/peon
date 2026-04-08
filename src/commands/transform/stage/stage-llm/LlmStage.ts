import type { StagingFileEvent } from '../../types.js';
import { AbstractStage } from '../lib.stage/AbstractStage.js';
import type { Logger } from '../../../types/Logger.js';
import {
  type ConcurrencyLimiter,
  createConcurrencyLimiter,
} from '../../lib/createConcurrencyLimiter.js';
import { readFile } from 'fs/promises';
import type { AbstractGuard } from '../lib.guard/AbstractGuard.js';
import { respond } from '../../../../schema/local-ollama.js';
import { smartSave } from '../../../lib/smart-save.js';
import path, { dirname } from 'node:path';
import { qualityEstimator } from '../lib.stage/qualityEstimator.js';

export class LlmStage extends AbstractStage {
  private readonly concurrencyLimit: number;
  private readonly concurrencyLimiter: ConcurrencyLimiter;

  constructor({
    logger,
    stagingDir,
    concurrencyLimit = 1,
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
    return 'llm';
  }

  protected inputFiles(): string[] {
    return ['job.md'];
  }

  protected outputFile(): string {
    return 'llm.job.json';
  }

  protected guards(): AbstractGuard[] {
    return [];
  }

  /**
   * NOTE: Rerunning transform script will repopulate this queue
   *       as long as chokidar ignoreInitial = false
   */
  protected async payload(event: StagingFileEvent) {
    if (this.concurrencyLimiter.pendingCount()) {
      this.logger.warn(`LLM:`, {
        pending: this.concurrencyLimiter.pendingCount(),
        active: this.concurrencyLimiter.activeCount(),
      });
    }
    return await this.concurrencyLimiter.run(async () => {
      const markdown = await readFile(event.payload, 'utf8');
      const { output, ...debug } = await respond({
        input: markdown,
        quality: qualityEstimator,
        model: 'qwen2.5:7b',
      });

      await smartSave(
        path.join(dirname(event.payload), 'debug.llm.json'),
        debug,
        true,
        this.logger,
      );

      return output;
    });
  }
}
