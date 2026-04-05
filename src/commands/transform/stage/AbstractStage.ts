import type { Logger } from '../../types/Logger.js';
import type { StagingFileEvent } from '../types.js';
import { readFile } from 'fs/promises';
import type { JobMetadata } from '../../types/Job.js';
import path, { dirname } from 'node:path';
import { constants, writeFileSync } from 'node:fs';
import { access, cp, mkdir, rename, rm } from 'node:fs/promises';
import { stripRootPath } from '../../../root.js';
import type { AbstractGuard } from './AbstractGuard.js';
import { GuardDecisionTrash } from './GuardDecisionTrash.js';
import { GuardDecisionQuarantine } from './GuardDecisionQuarantine.js';

export abstract class AbstractStage {
  protected logger;
  protected quarantineDir;
  protected stagingDir;
  protected trashDir;

  public constructor({ logger, stagingDir }: { logger: Logger; stagingDir: string }) {
    this.logger = logger.withSuffix(this.name());
    this.stagingDir = stagingDir;
    this.quarantineDir = path.join(dirname(stagingDir), 'quarantine');
    this.trashDir = path.join(dirname(stagingDir), 'trash');
  }

  public abstract name(): string;
  protected abstract inputs(): string[];
  protected abstract outputs(): string[];
  protected abstract payload(event: StagingFileEvent): Promise<void>;
  protected abstract guards(): AbstractGuard[];

  public async runIfPreconditionsMet(event: StagingFileEvent): Promise<void> {
    const jobDir = dirname(event.payload);
    const jobErrorPath = path.join(jobDir, 'errors.json');
    try {
      if (!this.isFileCreationOrUpdateEvent(event)) return;
      if (!(await this.exists(jobDir))) return;
      if (await this.exists(jobErrorPath)) return;
      if (!(await this.preconditionsMeet(event))) return;
      await this.payload(event);
      this.logger.log(`[${event.type}:${stripRootPath(event.payload)}] processed`);
      const guardDecisions = await Promise.all(
        this.guards().map((guard) => guard.guard({ jobDir, output_paths: this.outputs() })),
      );
      for (const decision of guardDecisions) {
        if (decision instanceof GuardDecisionQuarantine) {
          this.saveErrorChain({ jobErrorPath, error: decision, event });
          await this.quarantine(jobDir);
          this.logger.warn(`[${event.type}:${stripRootPath(event.payload)}] quarantined by guard`);
          return;
        }
        if (decision instanceof GuardDecisionTrash) {
          this.saveErrorChain({ jobErrorPath, error: decision, event });
          await this.trash(jobDir);
          this.logger.warn(`[${event.type}:${stripRootPath(event.payload)}] trashed by guard`);
          return;
        }
      }
    } catch (error) {
      this.saveErrorChain({ jobErrorPath, error, event });
      await this.quarantine(jobDir);
      this.logger.warn(`[${event.type}:${stripRootPath(event.payload)}] failed and was trashed`);
    }
  }

  protected async preconditionsMeet(event: StagingFileEvent): Promise<boolean> {
    const inputs = this.inputs();
    let inputsAlreadyExist: boolean;

    switch (inputs.length) {
      case 0:
        inputsAlreadyExist = true;
        break;
      case 1:
        inputsAlreadyExist = event.payload.endsWith(`/${this.inputs()[0]}`);
        break;
      default:
        inputsAlreadyExist = (
          await Promise.all(
            inputs
              .map((file) => path.join(dirname(event.payload), file))
              .map((filePath) => this.exists(filePath)),
          )
        ).every((val) => val);
    }

    if (!inputsAlreadyExist) {
      this.logger.debug(`Missing inputs: ${event.payload}`);
      return false;
    }

    const outputs = this.outputs();
    const outputsAlreadyExist = (
      await Promise.all(
        outputs
          .map((file) => path.join(dirname(event.payload), file))
          .map((filePath) => this.exists(filePath)),
      )
    ).every((val) => val);

    if (outputsAlreadyExist) {
      this.logger.debug(`Output already exists: ${event.payload}`);
      return false;
    }

    return inputsAlreadyExist && !outputsAlreadyExist;
  }

  private parseError(error: unknown, event: StagingFileEvent): Record<string, unknown> {
    const timestamp = new Date().toISOString();
    if (!(error instanceof Error)) {
      return {
        stage: this.name(),
        message: 'Not an error instance',
        event,
        timestamp,
        cause: undefined,
      };
    }
    return {
      stage: this.name(),
      message: error.message,
      event,
      timestamp,
      stack: error.stack,
      cause: error.cause,
    };
  }

  private parseErrorChain(error: unknown, event: StagingFileEvent) {
    if (!error) {
      return [];
    }
    if (!(error instanceof Error)) {
      return [this.parseError(error, event)];
    }
    const chain = this.parseError(error, event);
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
  }: {
    jobErrorPath: string;
    error: unknown;
    event: StagingFileEvent;
  }) {
    writeFileSync(
      jobErrorPath,
      JSON.stringify(this.parseErrorChain(error, event), null, 2),
      'utf8',
    );
  }

  private async quarantine(jobDir: string): Promise<void> {
    const quarantinedJobDir = path.join(
      this.quarantineDir,
      `${path.basename(jobDir)}-${Date.now()}`,
    );
    await mkdir(quarantinedJobDir, { recursive: true });
    try {
      await rename(jobDir, quarantinedJobDir);
      return;
    } catch {
      await cp(jobDir, quarantinedJobDir, { recursive: true });
      await rm(jobDir, { recursive: true, force: true });
    }
  }

  private async trash(jobDir: string): Promise<void> {
    const trashedJobDir = path.join(this.trashDir, `${path.basename(jobDir)}-${Date.now()}`);
    await mkdir(trashedJobDir, { recursive: true });
    try {
      await rename(jobDir, trashedJobDir);
      return;
    } catch {
      await cp(jobDir, trashedJobDir, { recursive: true });
      await rm(jobDir, { recursive: true, force: true });
    }
  }

  protected isFileCreationOrUpdateEvent(event: StagingFileEvent): boolean {
    return event.type === 'add' || event.type === 'change';
  }

  protected async exists(path: string): Promise<boolean> {
    try {
      await access(path, constants.R_OK | constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  async readJson<T>(filePath: string): Promise<T> {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  }

  async readMetadata(jobDir: string): Promise<JobMetadata> {
    const metaPath = `${jobDir}/meta.json`;
    const meta = await this.readJson<JobMetadata>(metaPath);
    if (typeof meta.strategy_slug !== 'string' || !meta.files || typeof meta.files !== 'object') {
      throw new Error(`Invalid metadata in ${metaPath}`);
    }
    return meta;
  }
}
