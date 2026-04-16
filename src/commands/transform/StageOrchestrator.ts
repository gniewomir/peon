import path from 'node:path';
import type { Logger } from '../../lib/logger.js';
import { GuardDecisionLoad } from './outcomes/GuardDecisionLoad.js';
import { GuardDecisionQuarantine } from './outcomes/GuardDecisionQuarantine.js';
import { GuardDecisionTrash } from './outcomes/GuardDecisionTrash.js';
import { z, ZodError } from 'zod';
import { stripRoot } from '../../lib/root.js';
import assert from 'node:assert';
import { statsAddToCounter, statsGetValue, statsSetValue } from '../../lib/stats.js';
import { GuardDecisionRemove } from './outcomes/GuardDecisionRemove.js';
import { readFileSync } from 'fs';
import {
  artifactFilename,
  artifactFilenameToEnum,
  isArtifactFilename,
  KnownArtifactsEnum,
} from '../../lib/artifacts.js';
import { JsonNavigator } from './lib/JsonNavigator.js';
import { GuardDecisionAdvance } from './outcomes/GuardDecisionAdvance.js';
import { atomicMoveDir } from '../../lib/atomicMoveDir.js';
import { atomicRemoveDir } from '../../lib/atomicRemoveDir.js';
import { atomicWrite } from '../../lib/atomicWrite.js';
import { readdir, stat } from 'node:fs/promises';
import { HashMap } from './lib/HashMap.js';
import { LRUHashMap } from './lib/LRUHashMap.js';
import { PipelineStage } from './stage/PipelineStage.js';
import type { JobDirArtifacts } from './types.js';

export class StageOrchestrator {
  private readonly stages: Map<string, PipelineStage> = new Map();
  private readonly inFlight = new HashMap<Promise<void>>();
  private readonly jobDirArtifactsCache = new LRUHashMap<JobDirArtifacts>(25_000);
  private readonly quarantineDir;
  private readonly trashDir;
  private readonly loadDir;
  private readonly logger;
  private readonly limits;
  private concurrency: number;
  private progressAt: number = Date.now();
  private shuttingDown = false;

  constructor({
    logger,
    quarantineDir,
    trashDir,
    loadDir,
    autoScaling,
    stages,
  }: {
    logger: Logger;
    quarantineDir: string;
    trashDir: string;
    loadDir: string;
    autoScaling: {
      maxConcurrentStages: number;
      minConcurrentStages: number;
      rssMemorySoftCap: number;
    };
    stages: PipelineStage[];
  }) {
    this.logger = logger.withSuffix('orchestrator');

    this.quarantineDir = quarantineDir;
    this.trashDir = trashDir;
    this.loadDir = loadDir;

    stages.forEach((stage) => {
      this.stages.set(stage.name(), stage);
    });
    assert(this.stages.size === stages.length, 'Duplicated stage names detected!');

    this.limits = { ...autoScaling };
    this.concurrency = this.limits.minConcurrentStages;
  }

  public lastProgressAt(): number {
    return this.progressAt;
  }

  public async shutdown(): Promise<void> {
    this.shuttingDown = true;
    await Promise.allSettled(this.inFlight.values());
  }

  public async enqueue(jobDir: string): Promise<'denied' | null> {
    if (this.shuttingDown) return 'denied';
    if (this.inFlight.size() >= this.concurrency) return 'denied';
    if (this.inFlight.has(jobDir)) return null;
    const jobDirArtifactsIndex = await this.readJobDirArtifactsIndex(jobDir);

    for (const stage of this.stages.values()) {
      if (stage.isApplicable(jobDirArtifactsIndex)) {
        this.inFlight.set(
          jobDir,
          this.executeSingleApplicableStage(stage, jobDir, jobDirArtifactsIndex)
            .catch(async (error) => {
              this.logger.error(`Unhandled error processing for ${stripRoot(jobDir)}`, {
                error,
                jobDir,
              });
              return error;
            })
            .finally(() => {
              this.inFlight.delete(jobDir);
              this.progressAt = Date.now();
            }),
        );
        this.progressAt = Date.now();
        return null;
      }
    }
    return null;
  }

  public adjustConcurrency() {
    const currentRss = process.memoryUsage.rss();
    const currentRssMb = Math.round(currentRss / (1024 * 1024));
    const oldConcurrency = this.concurrency;
    const maxHistoricalUtilisation = statsGetValue('max_rss_memory_utilisation_mb', 0);
    statsSetValue(
      'max_rss_memory_utilisation_mb',
      Math.max(maxHistoricalUtilisation, currentRssMb),
    );

    const maxHistoricalInFlight = statsGetValue('max_in_flight', 0);
    statsSetValue('max_in_flight', Math.max(maxHistoricalInFlight, this.inFlight.size()));

    this.logger.debug(`[${currentRssMb}mb] RSS memory soft cap utilization`);
    if (currentRss >= this.limits.rssMemorySoftCap) {
      this.concurrency = Math.max(
        this.limits.minConcurrentStages,
        Math.floor(statsGetValue('max_in_flight', 1) * 0.8),
        Math.floor(this.concurrency * 0.8),
      );
      this.logger.warn(
        `[${currentRssMb}mb] Close to RSS memory soft cap - adjusting concurrency down (${this.concurrency})`,
      );
      return;
    }
    this.concurrency = Math.min(
      this.limits.maxConcurrentStages,
      Math.ceil(statsGetValue('max_in_flight', 1) * 1.2),
      Math.ceil(this.concurrency * 1.2),
    );

    const maxHistoricalConcurency = statsGetValue('max_concurency', 0);
    statsSetValue('max_concurency', Math.max(maxHistoricalConcurency, this.concurrency));
    const message = `[${currentRssMb}mb] RSS memory soft cap underutilized - adjusting concurrency up (${this.concurrency})`;

    if (oldConcurrency !== this.concurrency) {
      assert(message.length);
      this.logger.warn(message);
    }
  }

  private async executeSingleApplicableStage(
    stage: PipelineStage,
    jobDir: string,
    artifactsIndex: JobDirArtifacts,
  ) {
    const decision = await stage.run(jobDir, artifactsIndex);

    this.jobDirArtifactsCache.delete(jobDir);

    if (decision instanceof GuardDecisionAdvance) {
      this.logger.debug(`guard: Advanced ${stripRoot(jobDir)} because of "${decision.message}"`);
      return;
    }

    if (decision instanceof GuardDecisionRemove) {
      await this.remove(jobDir);
      this.logger.log(`guard: Removed ${stripRoot(jobDir)} because of "${decision.message}"`);
      return;
    }

    if (decision instanceof GuardDecisionTrash) {
      await atomicWrite(
        path.join(jobDir, `errors.json`),
        this.parseError(decision, stage.name()),
        this.logger,
      );
      await this.trash(jobDir);
      this.logger.warn(`guard: Trashed ${stripRoot(jobDir)} because of "${decision.message}"`);
      return;
    }

    if (decision instanceof GuardDecisionQuarantine) {
      await atomicWrite(
        path.join(jobDir, `errors.json`),
        this.parseError(decision, stage.name()),
        this.logger,
      );
      await this.quarantine(jobDir);
      this.logger.error(`guard: Quarantined ${stripRoot(jobDir)} because of "${decision.message}"`);
      return;
    }

    if (decision instanceof GuardDecisionLoad) {
      await this.load(jobDir);
      this.logger.log(`guard: Loaded ${stripRoot(jobDir)} because of "${decision.message}"`);
      return;
    }

    // Unknown decision type: stop processing this job to avoid tight loops.
    throw new Error(`Unknown decision type: ${decision.constructor.name}`);
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

  private parseError(error: unknown, stageName: string): Record<string, unknown> | undefined {
    if (error === undefined) {
      return undefined;
    }

    const timestamp = new Date().toISOString();

    if (error instanceof ZodError) {
      return {
        stage: stageName,
        name: 'name' in error ? error.name : 'no name',
        message: z.treeifyError(error),
        timestamp,
        stack: 'stack' in error ? error.stack : 'no stack',
        cause: 'cause' in error ? this.parseError(error.cause, stageName) : undefined,
      };
    }

    if (error !== null && typeof error === 'object' && error instanceof Error) {
      return {
        stage: stageName,
        name: 'name' in error ? error.name : 'no name',
        message: 'message' in error ? error.message : 'no message',
        timestamp,
        stack: 'stack' in error ? error.stack : 'no stack',
        cause: 'cause' in error ? this.parseError(error.cause, stageName) : undefined,
      };
    }

    return {
      stage: stageName,
      error,
      timestamp,
    };
  }

  private async readJobDirArtifactsIndex(jobDir: string): Promise<JobDirArtifacts> {
    if (this.jobDirArtifactsCache.has(jobDir)) {
      const cached = this.jobDirArtifactsCache.get(jobDir);
      assert(cached);
      return cached;
    }
    const entries = await readdir(jobDir, { withFileTypes: true, encoding: 'utf8' });
    const present = new Set<KnownArtifactsEnum>();
    const mtimeMsByFilename = new Map<KnownArtifactsEnum, number>();
    await Promise.all(
      entries
        .filter((e) => e.isFile())
        .filter((e) => isArtifactFilename(e.name))
        .map(async (e) => {
          present.add(artifactFilenameToEnum(e.name));
          try {
            const s = await stat(path.join(jobDir, e.name));
            mtimeMsByFilename.set(artifactFilenameToEnum(e.name), s.mtimeMs);
          } catch {
            // best-effort: keep presence even if stat fails
          }
        }),
    );
    this.jobDirArtifactsCache.set(jobDir, { present, mtimeMs: mtimeMsByFilename });
    return { present, mtimeMs: mtimeMsByFilename };
  }
}
