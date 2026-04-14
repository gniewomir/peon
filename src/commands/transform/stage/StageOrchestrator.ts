import type { AbstractStage } from './AbstractStage.js';
import type { StagingFileEvent } from '../types.js';
import path, { dirname } from 'node:path';
import type { Logger } from '../../../lib/logger.js';
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
import { LRUHashMap } from '../lib/LRUHashMap.js';
import { readFileSync } from 'fs';
import { artifactFilename, KnownArtifactsEnum } from '../../../lib/artifacts.js';
import { JsonNavigator } from '../lib/JsonNavigator.js';

export class StageOrchestrator {
  private readonly stages: Map<string, AbstractStage> = new Map();
  private readonly directoryQueues = new LRUHashMap<Promise<unknown>>(5000);
  private listening = true;
  private readonly stagingDir;
  private readonly quarantineDir;
  private readonly trashDir;
  private readonly loadDir;
  private readonly logger;
  private readonly inMemoryDirectoryTracker: InMemoryDirectoryTracker;
  private lastActivityTimestamp: number;

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
    this.lastActivityTimestamp = new Date().getTime();
  }

  public async waitUntilIdle(idleMs: number): Promise<void> {
    const checkEveryMs = 1000 * 60;
    assert(
      idleMs >= checkEveryMs && Number.isInteger(idleMs),
      `Idle time must be a positive integer above or equal ${checkEveryMs}`,
    );
    while (true) {
      const now = new Date().getTime();
      if (now > this.lastActivityTimestamp + idleMs) {
        this.logger.log(` ⏳ Idle for more than ${Math.round(idleMs / 1000)}s.`, {
          idleMs,
          now,
          lastActivityTimestamp: this.lastActivityTimestamp,
        });
        return;
      }
      if (now - this.lastActivityTimestamp > checkEveryMs) {
        this.logger.log(` ⏳ Idle for ${Math.round((now - this.lastActivityTimestamp) / 1000)}s`);
      }
      await new Promise((resolve) => setTimeout(resolve, checkEveryMs));
    }
  }

  public handleStagingEvent(event: StagingFileEvent | undefined) {
    if (!this.listening) return;
    if (!event) return;
    this.lastActivityTimestamp = new Date().getTime();

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
      this.logger.error(`Unhandled error during ${stage.name()} for ${stripRoot(jobDir)}`, {
        error,
        event,
        jobDir,
      });
      return error;
    };
  }

  private remove(jobDir: string) {
    if (!existsSync(jobDir)) return;
    try {
      const meta = JSON.parse(
        readFileSync(
          path.join(jobDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_META_JSON)),
          'utf8',
        ),
      );
      const nav = new JsonNavigator(meta);
      const cachePath = nav.getPath('offer.cachePath').toString();
      rmSync(cachePath, { recursive: true, force: true });
      statsAddToCounter('job_cache_cleared');
      this.logger.log(`Cleared cache for ${stripRoot(jobDir)}`);
    } catch (error) {
      statsAddToCounter('job_cache_clear_failed');
      this.logger.error(`Error when clearing cache for ${stripRoot(jobDir)}`, error);
    } finally {
      rmSync(jobDir, { recursive: true, force: true });
      statsAddToCounter('job_removed');
    }
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
      statsAddToCounter('job_quarantined');
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
      statsAddToCounter('job_trashed');
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
      statsAddToCounter('job_loaded');
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
