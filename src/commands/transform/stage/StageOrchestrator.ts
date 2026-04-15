import type { AbstractStage } from './AbstractStage.js';
import type { StagingFileEvent } from '../types.js';
import path, { dirname } from 'node:path';
import type { Logger } from '../../../lib/logger.js';
import { GuardDecisionLoad } from './guards/decisions/GuardDecisionLoad.js';
import { GuardDecisionQuarantine } from './guards/decisions/GuardDecisionQuarantine.js';
import { GuardDecisionTrash } from './guards/decisions/GuardDecisionTrash.js';
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
import { GuardDecisionAdvance } from './guards/decisions/GuardDecisionAdvance.js';
import { atomicMoveDir } from '../../../lib/atomicMoveDir.js';
import { atomicRemoveDir } from '../../../lib/atomicRemoveDir.js';
import { atomicWrite } from '../../../lib/atomicWrite.js';

export class StageOrchestrator {
  private readonly stages: Map<string, AbstractStage> = new Map();
  private readonly directoryQueues = new LRUHashMap<Promise<unknown>>(5000);
  private readonly enqueuedJobs = new Set<string>();
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
    this.enqueueJobDir(jobDir, event);
  }

  public async shutdown(): Promise<void> {
    this.listening = false;
    await Promise.allSettled(this.directoryQueues.values());
  }

  public enqueueJobDir(jobDir: string, cause?: StagingFileEvent): boolean {
    if (!this.listening) return false;
    if (this.enqueuedJobs.has(jobDir)) return false;
    this.enqueuedJobs.add(jobDir);
    const queue = this.directoryQueues.get(jobDir) || Promise.resolve();
    this.directoryQueues.set(
      jobDir,
      queue
        .then(() => this.processToFixpoint(jobDir, cause))
        .catch(async (error) => {
          this.logger.error(`Unhandled error during fixpoint processing for ${stripRoot(jobDir)}`, {
            error,
            cause,
            jobDir,
          });
          return error;
        })
        .finally(() => {
          this.enqueuedJobs.delete(jobDir);
        }),
    );
    return true;
  }

  private async processToFixpoint(jobDir: string, cause?: StagingFileEvent) {
    while (true) {
      let selected: AbstractStage | undefined;
      for (const stage of this.stages.values()) {
        if (await stage.isApplicable(jobDir)) {
          selected = stage;
          break;
        }
      }
      if (!selected) return;

      const decision = await selected.runForJob(jobDir);
      if (decision instanceof GuardDecisionAdvance) {
        continue;
      }

      if (decision instanceof GuardDecisionRemove) {
        this.inMemoryDirectoryTracker.moved(jobDir);
        await this.remove(jobDir);
        this.logger.log(`guard: Removed ${stripRoot(jobDir)} because of "${decision.message}"`);
        return;
      }

      if (decision instanceof GuardDecisionTrash) {
        this.inMemoryDirectoryTracker.moved(jobDir);
        await atomicWrite(
          path.join(jobDir, `errors.json`),
          this.parseError(decision, cause, selected.name()),
          this.logger,
        );
        await this.trash(jobDir);
        this.logger.warn(`guard: Trashed ${stripRoot(jobDir)} because of "${decision.message}"`);
        return;
      }

      if (decision instanceof GuardDecisionQuarantine) {
        this.inMemoryDirectoryTracker.moved(jobDir);
        await atomicWrite(
          path.join(jobDir, `errors.json`),
          this.parseError(decision, cause, selected.name()),
          this.logger,
        );
        await this.quarantine(jobDir);
        this.logger.error(
          `guard: Quarantined ${stripRoot(jobDir)} because of "${decision.message}"`,
        );
        return;
      }

      if (decision instanceof GuardDecisionLoad) {
        this.inMemoryDirectoryTracker.moved(jobDir);
        await this.load(jobDir);
        this.logger.log(`guard: Loaded ${stripRoot(jobDir)} because of "${decision.message}"`);
        return;
      }

      // Unknown decision type: stop processing this job to avoid tight loops.
      return;
    }
  }

  private async remove(jobDir: string) {
    try {
      const meta = JSON.parse(
        readFileSync(path.join(jobDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_META)), 'utf8'),
      );
      const nav = new JsonNavigator(meta);
      const cachePath = nav.getPath('offer.cachePath').toString();
      await atomicRemoveDir(cachePath, this.logger, { ignoreMissing: true });
      statsAddToCounter('job_cache_cleared');
      this.logger.log(`Cleared cache for ${stripRoot(jobDir)}`);
    } catch (error) {
      statsAddToCounter('job_cache_clear_failed');
      this.logger.error(`Error when clearing cache for ${stripRoot(jobDir)}`, error);
    } finally {
      await atomicRemoveDir(jobDir, this.logger, { ignoreMissing: true });
      statsAddToCounter('job_removed');
    }
  }

  private async quarantine(jobDir: string) {
    const quarantinedJobDir = path.join(this.quarantineDir, path.basename(jobDir));
    await atomicMoveDir(jobDir, quarantinedJobDir, this.logger, { overwrite: true });
    statsAddToCounter('job_quarantined');
  }

  private async trash(jobDir: string) {
    const trashedJobDir = path.join(this.trashDir, path.basename(jobDir));
    await atomicMoveDir(jobDir, trashedJobDir, this.logger, { overwrite: true });
    statsAddToCounter('job_trashed');
  }

  private async load(jobDir: string) {
    const loadedJobDir = path.join(this.loadDir, path.basename(jobDir));
    await atomicMoveDir(jobDir, loadedJobDir, this.logger, { overwrite: true });
    statsAddToCounter('job_loaded');
  }

  private parseError(
    error: unknown,
    event: StagingFileEvent | undefined,
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
