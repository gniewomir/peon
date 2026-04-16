import type { AbstractStage, JobDirArtifactsIndex } from './AbstractStage.js';
import path from 'node:path';
import type { Logger } from '../../../lib/logger.js';
import { GuardDecisionLoad } from './guards/decisions/GuardDecisionLoad.js';
import { GuardDecisionQuarantine } from './guards/decisions/GuardDecisionQuarantine.js';
import { GuardDecisionTrash } from './guards/decisions/GuardDecisionTrash.js';
import { z, ZodError } from 'zod';
import { stripRoot } from '../../../lib/root.js';
import assert from 'node:assert';
import { statsAddToCounter } from '../../../lib/stats.js';
import { GuardDecisionRemove } from './guards/decisions/GuardDecisionRemove.js';
import { readFileSync } from 'fs';
import {
  artifactFilename,
  artifactFilenameToEnum,
  isArtifactFilename,
  KnownArtifactsEnum,
} from '../../../lib/artifacts.js';
import { JsonNavigator } from '../lib/JsonNavigator.js';
import { GuardDecisionAdvance } from './guards/decisions/GuardDecisionAdvance.js';
import { atomicMoveDir } from '../../../lib/atomicMoveDir.js';
import { atomicRemoveDir } from '../../../lib/atomicRemoveDir.js';
import { atomicWrite } from '../../../lib/atomicWrite.js';
import { readdir, stat } from 'node:fs/promises';
import { HashMap } from '../lib/HashMap.js';

export class StageOrchestrator {
  private readonly stages: Map<string, AbstractStage> = new Map();
  private readonly inFlight = new HashMap<Promise<void>>();
  private readonly jobDirArtifactsCache = new HashMap<JobDirArtifactsIndex>();
  private readonly stagingDir;
  private readonly quarantineDir;
  private readonly trashDir;
  private readonly loadDir;
  private readonly logger;
  private readonly limits;
  private readonly memoryCheckInterval: NodeJS.Timeout;
  private concurrency: number;

  constructor({
    logger,
    stagingDir,
    quarantineDir,
    trashDir,
    loadDir,
    autoScaling,
    stages,
  }: {
    logger: Logger;
    stagingDir: string;
    quarantineDir: string;
    trashDir: string;
    loadDir: string;
    autoScaling: {
      maxConcurrentStages: number;
      maxRssMemoryUsage: number;
      rssMemoryCheckMs: number;
      concurrencyUpRssLimit: number;
      concurrencyDownRssLimit: number;
    };
    stages: AbstractStage[];
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

    this.concurrency = 10;
    this.limits = { ...autoScaling };
    assert(
      Number.isInteger(this.limits.maxConcurrentStages) && this.limits.maxConcurrentStages < 500,
    );
    assert(this.limits.concurrencyUpRssLimit >= 0 && this.limits.concurrencyUpRssLimit <= 1);
    assert(this.limits.concurrencyDownRssLimit >= 0 && this.limits.concurrencyDownRssLimit <= 1);
    assert(this.limits.concurrencyUpRssLimit < this.limits.concurrencyDownRssLimit);
    this.memoryCheckInterval = setInterval(
      () => this.adjustConcurrency(),
      this.limits.rssMemoryCheckMs,
    );
  }

  private adjustConcurrency() {
    const currentRss = process.memoryUsage.rss();
    if (currentRss >= this.limits.maxRssMemoryUsage) {
      this.concurrency = Math.max(1, Math.round(this.concurrency * 0.5));
      this.logger.warn(
        `(${Math.round(currentRss / (1024 * 1024))}mb) At or above memory use limit - adjusting concurrent stages limit down (${this.concurrency})`,
      );
      return;
    }
    if (
      currentRss > Math.round(this.limits.maxRssMemoryUsage * this.limits.concurrencyDownRssLimit)
    ) {
      this.concurrency = Math.max(1, this.concurrency - 2);
      this.logger.warn(
        `(${Math.round(currentRss / (1024 * 1024))}mb) At or above memory use upper threshold - adjusting concurrent stages limit down (${this.concurrency})`,
      );
      return;
    }
    if (
      currentRss < Math.round(this.limits.maxRssMemoryUsage * this.limits.concurrencyUpRssLimit)
    ) {
      this.concurrency = Math.min(this.limits.maxConcurrentStages, this.concurrency + 1);
      this.logger.log(
        `(${Math.round(currentRss / (1024 * 1024))}mb) Bellow memory use lower threshold - adjusting concurrent stages limit up (${this.concurrency})`,
      );
      return;
    }
  }

  public async shutdown(): Promise<void> {
    clearInterval(this.memoryCheckInterval);
    await Promise.allSettled(this.inFlight.values());
  }

  public async enqueue(
    jobDir: string,
  ): Promise<'under-capacity' | 'at-capacity' | 'not-applicable'> {
    if (this.inFlight.size() === this.concurrency) return 'at-capacity';
    if (this.inFlight.has(jobDir)) return 'under-capacity';

    let jobDirArtifactsIndex = this.jobDirArtifactsCache.get(jobDir);
    if (!jobDirArtifactsIndex) {
      jobDirArtifactsIndex = await this.readJobDirArtifactsIndex(jobDir);
      assert(jobDirArtifactsIndex, 'Could not obtain jobDir artifacts index');
      this.jobDirArtifactsCache.set(jobDir, jobDirArtifactsIndex);
    }

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
            }),
        );
        return 'under-capacity';
      }
    }
    return 'not-applicable';
  }

  public hasWorkInProgress(): boolean {
    return this.inFlight.size() > 0;
  }

  private async executeSingleApplicableStage(
    stage: AbstractStage,
    jobDir: string,
    artifactsIndex: JobDirArtifactsIndex,
  ) {
    const decision = await stage.run(jobDir, artifactsIndex);

    // Keep in staging,
    // If so, all the following must be true:
    //    - stage was executed successfuly and without any errors
    //    - output artifact of this stage was emited
    //    - cached artifact index can be updated with emited artifact
    //    - we do not need to hit the disk, because of prior assertions
    if (decision instanceof GuardDecisionAdvance) {
      if (this.jobDirArtifactsCache.has(jobDir)) {
        const cached = this.jobDirArtifactsCache.get(jobDir);
        assert(cached);
        this.jobDirArtifactsCache.set(jobDir, {
          present: new Set([...cached.present, stage.outputArtifact()]),
          mtimeMs: new Map<KnownArtifactsEnum, number>([
            ...(Object.entries(cached.mtimeMs) as [KnownArtifactsEnum, number][]),
            [stage.outputArtifact(), Date.now()],
          ]),
        });
      }
      this.logger.log(`guard: Advanced ${stripRoot(jobDir)} because of "${decision.message}"`);
      return;
    }

    // Following decisions will remove directory from staging, so it should not be present in next scan
    this.jobDirArtifactsCache.delete(jobDir);

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

  private async readJobDirArtifactsIndex(jobDir: string): Promise<JobDirArtifactsIndex> {
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
    return { present, mtimeMs: mtimeMsByFilename };
  }
}
