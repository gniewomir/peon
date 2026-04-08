import type { AbstractStage } from './AbstractStage.js';
import type { StagingFileEvent } from '../../types.js';
import { HashMap } from '../../lib/HashMap.js';
import path, { dirname } from 'node:path';
import type { ILogger } from '../../../lib/logger.js';
import { GuardDecisionLoad } from '../lib.guard/GuardDecisionLoad.js';
import { GuardDecisionQuarantine } from '../lib.guard/GuardDecisionQuarantine.js';
import { GuardDecisionTrash } from '../lib.guard/GuardDecisionTrash.js';
import {
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

export class StageOrchestrator {
  private readonly stages: Map<string, AbstractStage> = new Map();
  private readonly directoryMutex = new HashMap<Promise<unknown>>();
  private listening = true;
  private readonly loadDir;
  private readonly quarantineDir;
  private readonly trashDir;
  private readonly logger;

  constructor({ logger, stagingDir }: { logger: ILogger; stagingDir: string }) {
    this.logger = logger.withSuffix('orchestrator');
    this.loadDir = path.join(dirname(stagingDir), 'load');
    this.quarantineDir = path.join(dirname(stagingDir), 'quarantine');
    this.trashDir = path.join(dirname(stagingDir), 'trash');
  }

  public register(stage: AbstractStage): void {
    this.stages.set(stage.name(), stage);
  }

  public handleStagingEvent(event: StagingFileEvent | undefined) {
    if (!this.listening) return;
    if (!event) return;

    const jobDir = dirname(event.payload);

    for (const stage of this.stages.values()) {
      const mutex = this.directoryMutex.get(jobDir) || Promise.resolve();

      this.directoryMutex.set(
        jobDir,
        mutex
          .then(this.createPayload(jobDir, event, stage))
          .catch(this.createErrorHandler(jobDir, event, stage)),
      );
    }
  }

  public async shutdown(): Promise<void> {
    this.listening = false;
    await Promise.allSettled(this.directoryMutex.values());
  }

  private createPayload(jobDir: string, event: StagingFileEvent, stage: AbstractStage) {
    return async () => {
      const decisions = await stage.run(event);

      for (const decision of decisions) {
        if (decision instanceof GuardDecisionTrash) {
          this.saveErrorChain({
            jobErrorPath: path.join(jobDir, `errors.json`),
            error: decision,
            event,
            stage: stage.name(),
          });
          this.directoryMutex.delete(jobDir);
          this.trash(jobDir);
        }
        if (decision instanceof GuardDecisionQuarantine) {
          this.saveErrorChain({
            jobErrorPath: path.join(jobDir, `errors.json`),
            error: decision,
            event,
            stage: stage.name(),
          });
          this.directoryMutex.delete(jobDir);
          this.quarantine(jobDir);
        }
        if (decision instanceof GuardDecisionLoad) {
          this.directoryMutex.delete(jobDir);
          this.load(jobDir);
        }
      }
    };
  }

  private createErrorHandler(jobDir: string, event: StagingFileEvent, stage: AbstractStage) {
    return async (error: unknown) => {
      this.logger.error(`Unhandled error during ${stage.name()}`, { error, event });
      return error;
    };
  }

  private quarantine(jobDir: string) {
    const quarantinedJobDir = path.join(
      this.quarantineDir,
      `${path.basename(jobDir)}-${Date.now()}`,
    );
    if (existsSync(quarantinedJobDir)) {
      rmdirSync(quarantinedJobDir, { recursive: true });
    }
    mkdirSync(quarantinedJobDir, { recursive: true });
    try {
      renameSync(jobDir, quarantinedJobDir);
      return;
    } catch {
      cpSync(jobDir, quarantinedJobDir, { recursive: true });
      rmSync(jobDir, { recursive: true, force: true });
    }
  }

  private trash(jobDir: string) {
    const trashedJobDir = path.join(this.trashDir, `${path.basename(jobDir)}-${Date.now()}`);
    if (existsSync(trashedJobDir)) {
      rmdirSync(trashedJobDir, { recursive: true });
    }
    mkdirSync(trashedJobDir, { recursive: true });
    try {
      renameSync(jobDir, trashedJobDir);
      return;
    } catch {
      cpSync(jobDir, trashedJobDir, { recursive: true });
      rmSync(jobDir, { recursive: true, force: true });
    }
  }

  private load(jobDir: string) {
    const loadedJobDir = path.join(this.loadDir, `${path.basename(jobDir)}}`);
    if (existsSync(loadedJobDir)) {
      rmdirSync(loadedJobDir, { recursive: true });
    }
    mkdirSync(loadedJobDir, { recursive: true });
    try {
      renameSync(jobDir, loadedJobDir);
      return;
    } catch {
      cpSync(jobDir, loadedJobDir, { recursive: true });
      rmSync(jobDir, { recursive: true, force: true });
    }
  }

  private parseErrorChain(error: unknown, event: StagingFileEvent, stage: string) {
    if (!error) {
      return [];
    }
    if (!(error instanceof Error)) {
      return [this.parseError(error, event, stage)];
    }
    const chain = this.parseError(error, event, stage);
    while (Array.isArray(chain) && chain[chain.length - 1] instanceof Error) {
      const last = chain[chain.length - 1];
      if (!last.cause) {
        break;
      }
      chain.push(last.cause);
    }
    return chain;
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
    writeFileSync(
      jobErrorPath,
      JSON.stringify(this.parseErrorChain(error, event, stage), null, 2),
      'utf8',
    );
  }

  private parseError(
    error: unknown,
    event: StagingFileEvent,
    stage: string,
  ): Record<string, unknown> {
    const timestamp = new Date().toISOString();
    if (!(error instanceof Error)) {
      return {
        stage,
        message: 'Not an error instance',
        event,
        timestamp,
        cause: undefined,
      };
    }
    return {
      stage: stage,
      message: error.message,
      event,
      timestamp,
      stack: error.stack,
      cause: error.cause,
    };
  }
}
