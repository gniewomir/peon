import type { StagingFileEvent } from '../../types.js';
import { AbstractStage } from '../AbstractStage.js';
import type { Logger } from '../../../types/Logger.js';
import { type ConcurrencyLimiter, createConcurrencyLimiter } from '../../lib/limiter.js';
import { readFile } from 'fs/promises';
import type { AbstractGuard } from '../AbstractGuard.js';
import { respond } from '../../../../schema/local-ollama.js';
import { deepVisitor } from '../../lib/deepVisitor.js';
import type { TSchema } from '../../../../schema/schema.js';
import { smartSave } from '../../../lib/smart-save.js';
import path, { dirname } from 'node:path';

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

  protected inputs(): string[] {
    return ['job.md'];
  }

  protected output(): string {
    return 'llm.job.json';
  }

  protected guards(): AbstractGuard[] {
    return [];
  }

  protected async payload(event: StagingFileEvent) {
    return await this.concurrencyLimiter.run(async () => {
      const markdown = await readFile(event.payload, 'utf8');
      const quality = (output: TSchema) => {
        let valid = 0;
        let total = 0;

        deepVisitor(output, (value) => {
          if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
            //
          } else {
            valid++;
          }
          total++;
        });

        return valid / total;
      };

      const { output, ...debug } = await respond({
        input: markdown,
        quality,
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
