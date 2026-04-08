import type { StagingFileEvent } from '../../types.js';
import { readFile } from 'fs/promises';
import path, { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { stripRootPath } from '../../../../root.js';
import type { AbstractGuard } from '../lib.guard/AbstractGuard.js';
import { GuardDecisionQuarantine } from '../lib.guard/GuardDecisionQuarantine.js';
import type { TMetaSchema } from '../../../../schema/schema.meta.js';
import { smartSave } from '../../../lib/smart-save.js';
import type { ILogger } from '../../../lib/logger.js';
import type { AbstractGuardDecision } from '../lib.guard/AbstractGuardDecision.js';
import { GuardDecisionKeep } from '../lib.guard/GuardDecisionKeep.js';

export abstract class AbstractStage {
  protected logger;
  protected stagingDir;

  public constructor({ logger, stagingDir }: { logger: ILogger; stagingDir: string }) {
    this.logger = logger.withSuffix(this.name());
    this.stagingDir = stagingDir;
  }

  public abstract name(): string;
  protected abstract inputFiles(): string[];
  protected abstract outputFile(): string;
  protected abstract payload(
    event: StagingFileEvent,
  ): Promise<string | Record<string, unknown> | unknown[]>;
  protected abstract guards(): AbstractGuard[];

  public async run(event: StagingFileEvent): Promise<AbstractGuardDecision[]> {
    const jobDir = dirname(event.payload);
    try {
      if (!this.preconditionsMeet(event)) return [new GuardDecisionKeep('Preconditions not met')];
      const result = await this.payload(event);
      const guardDecisions = await Promise.all(this.guards().map((guard) => guard.guard(result)));
      await smartSave(path.join(jobDir, this.outputFile()), result, false, this.logger);
      this.logger.log(`[${event.type}:${stripRootPath(event.payload)}] processed`);
      return guardDecisions;
    } catch (error) {
      return [new GuardDecisionQuarantine('quarantined because unhanded error', error)];
    }
  }

  public preconditionsMeet(event: StagingFileEvent): boolean {
    const jobDir = dirname(event.payload);

    if (event.type !== 'add' && event.type !== 'change') return false;
    if (!existsSync(jobDir)) return false;

    for (const file of this.inputFiles()) {
      if (!existsSync(path.join(dirname(event.payload), file))) {
        return false;
      }
    }

    return !existsSync(path.join(dirname(event.payload), this.outputFile()));
  }

  async readJson<T>(filePath: string): Promise<T> {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  }

  async readMetadata(jobDir: string): Promise<TMetaSchema> {
    return await this.readJson<TMetaSchema>(`${jobDir}/raw.meta.json`);
  }
}
