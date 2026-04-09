import type { StagingFileEvent } from '../../types.js';
import { AbstractStage } from '../lib.stage/AbstractStage.js';
import {
  type ConcurrencyLimiter,
  createConcurrencyLimiter,
} from '../../lib/createConcurrencyLimiter.js';
import { readFile } from 'fs/promises';
import type { AbstractGuard } from '../lib.guard/AbstractGuard.js';
import { smartSave } from '../../../lib/smart-save.js';
import path, { dirname } from 'node:path';
import type { ILogger } from '../../../lib/logger.js';
import { createMinimumExecutionTimeLimiter } from '../../lib/createMinimumExecutionTimeLimiter.js';
import { llmStructuredResponse } from '../../../../llm/llmStructuredResponse.js';
import { type TSchema } from '../../../../schema/schema.js';
import { SchemaShapeGuard } from '../lib.guard/SchemaShapeGuard.js';
import { SchemaQualityGuard } from '../lib.guard/SchemaQualityQuard.js';

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
    logger: ILogger;
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

  protected inputFiles(): string[] {
    return ['job.md'];
  }

  protected outputFile(): string {
    return 'llm.job.json';
  }

  protected guards(): AbstractGuard[] {
    return [new SchemaShapeGuard(), new SchemaQualityGuard()];
  }

  /**
   * NOTE: Rerunning transform script will repopulate this queue
   *       as long as chokidar ignoreInitial = false
   */
  protected async payload(event: StagingFileEvent) {
    if (this.concurrencyLimiter.pendingCount()) {
      this.logger.warn(
        `LLM: pending ${this.concurrencyLimiter.pendingCount()}; active: ${this.concurrencyLimiter.activeCount()}`,
      );
    }
    const result = await this.concurrencyLimiter.run(() =>
      this.minimumExecutionTimeLimiter(async () => {
        const jobDir = dirname(event.payload);
        const markdown = await readFile(path.join(jobDir, this.inputFiles()[0]), 'utf8');
        const { output, ...debug } = await llmStructuredResponse<TSchema>({
          fallback: false,
          input: markdown,
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
      this.logger.warn(
        `LLM: pending ${this.concurrencyLimiter.pendingCount()}; active: ${this.concurrencyLimiter.activeCount()}`,
      );
    }
    return result;
  }
}
