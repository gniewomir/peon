import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../guards/AbstractGuard.js';
import type { Transformation } from '../AbstractTransformation.js';
import { StructureUnstructured } from './StructureUnstructured.js';
import { KnownArtifactsEnum } from '../../artifacts.js';
import type { StagingFileEvent } from '../../types.js';
import type { Logger } from '../../../lib/logger.js';
import { createMinimumExecutionTimeLimiter } from '../../lib/createMinimumExecutionTimeLimiter.js';
import { createConcurrencyLimiter } from '../../lib/createConcurrencyLimiter.js';
import { NotEmptyGuard } from '../guards/NotEmptyGuard.js';
import { dirname } from 'node:path';
import { stripRoot } from '../../../../lib/root.js';
import { LlmSchemaQualityGuard } from './LlmSchemaQualityGuard.js';

export class LlmStage extends AbstractStage {
  private readonly concurrencyLimiter;
  private readonly minimumExecutionTimeLimiter;

  /**
   * NOTE: concurrency and minimum execution time limit,
   *       to keep the laptop from running fans at 100% and throttling anyway
   *       when running local LLM
   */
  constructor(args: { logger: Logger; stagingDir: string; transformations: Transformation[] }) {
    super(args);
    this.concurrencyLimiter = createConcurrencyLimiter(1);
    this.minimumExecutionTimeLimiter = createMinimumExecutionTimeLimiter(1000 * 60);
  }

  public static transformations(): Transformation[] {
    return [new StructureUnstructured()];
  }

  protected inputArtifacts() {
    return [KnownArtifactsEnum.LLM_MARKDOWN];
  }

  protected outputArtifact() {
    return KnownArtifactsEnum.LLM_JSON;
  }

  protected guards(): AbstractGuard[] {
    return [new NotEmptyGuard(), new LlmSchemaQualityGuard(0.5)];
  }

  protected async transform(event: StagingFileEvent): Promise<string> {
    return this.concurrencyLimiter.run(() =>
      this.minimumExecutionTimeLimiter(async () => {
        const start = Date.now();
        this.logger.log(` 🤖 LLM request start: ${stripRoot(dirname(event.payload))}`);
        const result = await super.transform(event); // IMPORTANT PART
        const end = Date.now();
        this.logger.log(
          ` 🤖 LLM request end after ${(end - start) / 1000}s: ${stripRoot(dirname(event.payload))}`,
        );
        this.logger.warn(` 🤖 LLM requests pending: ${this.concurrencyLimiter.pendingCount()}`);
        return result;
      }),
    );
  }
}
