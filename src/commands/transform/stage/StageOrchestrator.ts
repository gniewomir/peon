import type { AbstractStage } from './AbstractStage.js';
import type { StagingFileEvent } from '../types.js';
import { HashMap } from '../lib/HashMap.js';
import path, { dirname } from 'node:path';
import type { Logger } from '../../lib/logger.js';
import { GuardDecisionLoad } from './guards/decisions/GuardDecisionLoad.js';
import { GuardDecisionQuarantine } from './guards/decisions/GuardDecisionQuarantine.js';
import { GuardDecisionTrash } from './guards/decisions/GuardDecisionTrash.js';
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { z, ZodError } from 'zod';
import { stripRoot } from '../../../lib/root.js';
import assert from 'node:assert';
import { statsAddToCounter } from '../../../lib/stats.js';
import { GuardDecisionRemove } from './guards/decisions/GuardDecisionRemove.js';
import type { InMemoryDirectoryTracker } from './InMemoryDirectoryTracker.js';

export class StageOrchestrator {
  private readonly stages: Map<string, AbstractStage> = new Map();
  private readonly directoryQueues = new HashMap<Promise<unknown>>();
  private listening = true;
  private readonly stagingDir;
  private readonly quarantineDir;
  private readonly trashDir;
  private readonly loadDir;
  private readonly logger;
  private readonly inMemoryDirectoryTracker: InMemoryDirectoryTracker;

  constructor({
    logger,
    stagingDir,
    quarantineDir,
    trashDir,
    loadDir,
    stages,
    inMemoryDirectoryTracker,
  }: {
    logger: Logger;
    stagingDir: string;
    quarantineDir: string;
    trashDir: string;
    loadDir: string;
    stages: AbstractStage[];
    inMemoryDirectoryTracker: InMemoryDirectoryTracker;
  }) {
    this.logger = logger.withSuffix('orchestrator');
    this.stagingDir = stagingDir;
    this.quarantineDir = quarantineDir;
    this.trashDir = trashDir;
    this.loadDir = loadDir;
    stages.forEach((stage) => {
      this.stages.set(stage.name(), stage);
    });
    assert(this.stages.size === stages.length, 'Duplicated stage names detected!');
    this.inMemoryDirectoryTracker = inMemoryDirectoryTracker;
  }

  public handleStagingEvent(event: StagingFileEvent | undefined) {
    if (!this.listening) return;
    if (!event) return;

    const jobDir = dirname(event.payload);

    for (const stage of this.stages.values()) {
      const queue = this.directoryQueues.get(jobDir) || Promise.resolve();

      this.directoryQueues.set(
        jobDir,
        queue
          .then(this.createPayload(jobDir, event, stage))
          .catch(this.createErrorHandler(jobDir, event, stage)),
      );
    }
  }

  public async shutdown(): Promise<void> {
    this.listening = false;
    await Promise.allSettled(this.directoryQueues.values());
  }

  private createPayload(jobDir: string, event: StagingFileEvent, stage: AbstractStage) {
    return async () => {
      const decision = await stage.run(event);

      if (decision instanceof GuardDecisionRemove) {
        this.inMemoryDirectoryTracker.moved(jobDir);
        this.remove(jobDir);
        this.logger.log(`guard: Removed ${stripRoot(jobDir)} because of "${decision.message}"`);
        return;
      }

      if (decision instanceof GuardDecisionTrash) {
        this.inMemoryDirectoryTracker.moved(jobDir);
        this.saveErrorChain({
          jobErrorPath: path.join(jobDir, `errors.json`),
          error: decision,
          event,
          stage: stage.name(),
        });
        this.trash(jobDir);
        this.logger.warn(`guard: Trashed ${stripRoot(jobDir)} because of "${decision.message}"`);
        return;
      }

      if (decision instanceof GuardDecisionQuarantine) {
        this.inMemoryDirectoryTracker.moved(jobDir);
        this.saveErrorChain({
          jobErrorPath: path.join(jobDir, `errors.json`),
          error: decision,
          event,
          stage: stage.name(),
        });
        this.quarantine(jobDir);
        this.logger.error(
          `guard: Quarantined ${stripRoot(jobDir)} because of "${decision.message}"`,
        );
        return;
      }

      if (decision instanceof GuardDecisionLoad) {
        this.inMemoryDirectoryTracker.moved(jobDir);
        this.load(jobDir);
        this.logger.log(`guard: Loaded ${stripRoot(jobDir)} because of "${decision.message}"`);
        return;
      }
    };
  }

  private createErrorHandler(jobDir: string, event: StagingFileEvent, stage: AbstractStage) {
    return async (error: unknown) => {
      this.logger.error(`Unhandled error during ${stage.name()}`, { error, event });
      return error;
    };
  }

  private remove(jobDir: string) {
    if (!existsSync(jobDir)) return;
    rmSync(jobDir, { recursive: true, force: true });
    statsAddToCounter('jobs_removed');
  }

  private quarantine(jobDir: string) {
    if (!existsSync(jobDir)) return;
    const quarantinedJobDir = path.join(this.quarantineDir, path.basename(jobDir));
    if (existsSync(quarantinedJobDir)) {
      rmSync(quarantinedJobDir, { recursive: true, force: true });
    }
    mkdirSync(quarantinedJobDir, { recursive: true });
    try {
      renameSync(jobDir, quarantinedJobDir);
      statsAddToCounter('jobs_quarantined');
    } catch {
      cpSync(jobDir, quarantinedJobDir, { recursive: true });
      rmSync(jobDir, { recursive: true, force: true });
    }
  }

  private trash(jobDir: string) {
    if (!existsSync(jobDir)) return;
    const trashedJobDir = path.join(this.trashDir, path.basename(jobDir));
    if (existsSync(trashedJobDir)) {
      rmSync(trashedJobDir, { recursive: true, force: true });
    }
    mkdirSync(trashedJobDir, { recursive: true });
    try {
      renameSync(jobDir, trashedJobDir);
      statsAddToCounter('jobs_trashed');
    } catch {
      cpSync(jobDir, trashedJobDir, { recursive: true });
      rmSync(jobDir, { recursive: true, force: true });
    }
  }

  private load(jobDir: string) {
    if (!existsSync(jobDir)) return;
    const loadedJobDir = path.join(this.loadDir, path.basename(jobDir));
    if (existsSync(loadedJobDir)) {
      rmSync(loadedJobDir, { recursive: true, force: true });
    }
    mkdirSync(loadedJobDir, { recursive: true });
    try {
      renameSync(jobDir, loadedJobDir);
      statsAddToCounter('jobs_loaded');
    } catch {
      cpSync(jobDir, loadedJobDir, { recursive: true });
      rmSync(jobDir, { recursive: true, force: true });
    }
  }

  private saveErrorChain({
    jobErrorPath,
    error,
    event,
    stage,
  }: {
    jobErrorPath: string;
    error: unknown;
    event: StagingFileEvent;
    stage: string;
  }) {
    const content = JSON.stringify(this.parseError(error, event, stage), null, 2);
    try {
      writeFileSync(jobErrorPath, content, 'utf8');
    } catch (saveError) {
      this.logger.error('Error during saving error file:', saveError);
      this.logger.warn('Previous error', error);
    }
  }

  private parseError(
    error: unknown,
    event: StagingFileEvent,
    stage: string,
  ): Record<string, unknown> | undefined {
    if (error === undefined) {
      return undefined;
    }

    const timestamp = new Date().toISOString();

    if (error instanceof ZodError) {
      return {
        stage: stage,
        name: 'name' in error ? error.name : 'no name',
        message: z.treeifyError(error),
        event,
        timestamp,
        stack: 'stack' in error ? error.stack : 'no stack',
        cause: 'cause' in error ? this.parseError(error.cause, event, stage) : undefined,
      };
    }

    if (error !== null && typeof error === 'object' && error instanceof Error) {
      return {
        stage: stage,
        name: 'name' in error ? error.name : 'no name',
        message: 'message' in error ? error.message : 'no message',
        event,
        timestamp,
        stack: 'stack' in error ? error.stack : 'no stack',
        cause: 'cause' in error ? this.parseError(error.cause, event, stage) : undefined,
      };
    }

    return {
      stage,
      error,
      event,
      timestamp,
    };
  }
}
