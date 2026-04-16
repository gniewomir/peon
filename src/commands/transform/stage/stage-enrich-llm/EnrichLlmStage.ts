import { AbstractStage } from '../AbstractStage.js';
import type { AbstractGuard } from '../AbstractGuard.js';
import type { Transformation } from '../AbstractTransformation.js';
import { StructureUnstructured } from './StructureUnstructured.js';
import { KnownArtifactsEnum } from '../../../../lib/artifacts.js';
import type { Logger } from '../../../../lib/logger.js';
import { createMinimumExecutionTimeLimiter } from '../../lib/createMinimumExecutionTimeLimiter.js';
import { createConcurrencyLimiter } from '../../lib/createConcurrencyLimiter.js';
import { stripRoot } from '../../../../lib/root.js';
import { LlmSchemaQualityGuard } from './LlmSchemaQualityGuard.js';
import type { TLlmSchema } from '../../../../schema/schema.llm.js';
import { llmSchema } from '../../../../schema/schema.llm.js';
import { SchemaGuard } from '../SchemaGuard.js';

export class EnrichLlmStage extends AbstractStage<TLlmSchema> {
  private readonly concurrencyLimiter;
  private readonly minimumExecutionTimeLimiter;

  /**
   * NOTE: concurrency and minimum execution time limit,
   *       to keep the laptop from running fans at 100% and throttling anyway
   *       when running local LLM
   */
  constructor(args: {
    logger: Logger;
    stagingDir: string;
    trashDir: string;
    loadDir: string;
    transformations: Transformation<TLlmSchema>[];
  }) {
    super(args);
    this.concurrencyLimiter = createConcurrencyLimiter(1);
    this.minimumExecutionTimeLimiter = createMinimumExecutionTimeLimiter(1000 * 60);
  }

  public static transformations(): Transformation<TLlmSchema>[] {
    return [new StructureUnstructured()];
  }

  public inputArtifacts() {
    return [
      KnownArtifactsEnum.CLEAN_MARKDOWN,
      KnownArtifactsEnum.CLEAN_JOB_META_JSON,
      KnownArtifactsEnum.CLEAN_COMBINE_JSON,
    ];
  }

  public outputArtifact() {
    return KnownArtifactsEnum.ENRICH_LLM_JSON;
  }

  protected guards(): AbstractGuard<TLlmSchema>[] {
    return [new SchemaGuard(llmSchema), new LlmSchemaQualityGuard(0.5)];
  }

  protected async transformFromInputs(jobDir: string): Promise<TLlmSchema> {
    return this.concurrencyLimiter.run(() =>
      this.minimumExecutionTimeLimiter(async () => {
        const start = Date.now();
        this.logger.log(` 🤖 LLM request start: ${stripRoot(jobDir)}`);
        const result = await super.transformFromInputs(jobDir);
        const end = Date.now();
        this.logger.log(` 🤖 LLM request end after ${(end - start) / 1000}s: ${stripRoot(jobDir)}`);
        this.logger.warn(` 🤖 LLM requests pending: ${this.concurrencyLimiter.pendingCount()}`);
        return result;
      }),
    );
  }
}
