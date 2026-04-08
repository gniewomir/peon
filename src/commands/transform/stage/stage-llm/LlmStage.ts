import type { StagingFileEvent } from '../../types.js';
import { AbstractStage } from '../lib.stage/AbstractStage.js';
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
import type { Logger } from '../../../lib/logger.js';
import { createMinimumExecutionTimeLimiter } from '../../lib/createMinimumExecutionTimeLimiter.js';

export class LlmStage extends AbstractStage {
  private readonly concurrencyLimit: number;
  private readonly concurrencyLimiter: ConcurrencyLimiter;
  private readonly minimumExecutionTimeLimit: number;
  private readonly minimumExecutionTimeLimiter: ReturnType<
    typeof createMinimumExecutionTimeLimiter
  >;

  /**
   * NOTE: concurrency and minimum execution time limit,
   *       to keep laptop from running fans at 100% and throttling anyway
   *       when running local LLM
   */
  constructor({
    logger,
    stagingDir,
    concurrencyLimit = 1,
    minimumExecutionTimeMs = 1000 * 60 * 2,
  }: {
    logger: Logger;
    stagingDir: string;
    concurrencyLimit?: number;
    minimumExecutionTimeMs?: number;
  }) {
    super({ logger, stagingDir });
    this.concurrencyLimit = concurrencyLimit;
    this.concurrencyLimiter = createConcurrencyLimiter(this.concurrencyLimit);
    this.minimumExecutionTimeLimit = minimumExecutionTimeMs;
    this.minimumExecutionTimeLimiter = createMinimumExecutionTimeLimiter(
      this.minimumExecutionTimeLimit,
    );
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
        minExecutionTimeMs: this.minimumExecutionTimeLimit,
        concurrencyLimit: this.concurrencyLimit,
      });
    }
    const result = await this.concurrencyLimiter.run(() =>
      this.minimumExecutionTimeLimiter(async () => {
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
      }),
    );
    if (this.concurrencyLimiter.pendingCount()) {
      this.logger.warn(`LLM:`, {
        pending: this.concurrencyLimiter.pendingCount(),
        active: this.concurrencyLimiter.activeCount(),
        minExecutionTimeMs: this.minimumExecutionTimeLimit,
        concurrencyLimit: this.concurrencyLimit,
      });
    }
    return result;
  }
}
