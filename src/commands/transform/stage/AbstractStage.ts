import { quarantineJobDirectory } from '../lib/quarantine.js';
import type { Logger } from '../../types/Logger.js';
import type { StagingFileEvent } from '../types.js';
import { readFile } from 'fs/promises';
import type { JobMetadata } from '../../types/Job.js';
import path, { dirname } from 'node:path';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';

export abstract class AbstractStage {
  protected logger;
  protected quarantineDir;
  protected stagingDir;

  public constructor({ logger, stagingDir }: { logger: Logger; stagingDir: string }) {
    this.logger = logger.withSuffix(this.name());
    this.stagingDir = stagingDir;
    this.quarantineDir = dirname(stagingDir);
  }

  protected abstract inputs(): string[];
  protected abstract outputs(): string[];

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
      this.logger.warn(`Missing inputs: ${event.payload}`);
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
      this.logger.warn(`Output already exists: ${event.payload}`);
      return false;
    }

    return inputsAlreadyExist && !outputsAlreadyExist;
  }

  protected abstract payload(event: StagingFileEvent): Promise<void>;
  public abstract name(): string;

  public async runIfPreconditionsMet(event: StagingFileEvent): Promise<void> {
    try {
      if (!this.isFileCreationOrUpdateEvent(event)) return;
      if (!(await this.jobDirectoryExists(event))) return;
      if (!(await this.preconditionsMeet(event))) return;
      await this.payload(event);
    } catch (error) {
      await quarantineJobDirectory({
        logger: this.logger,
        jobDir: dirname(event.payload),
        quarantineDir: this.quarantineDir,
        stage: this.name(),
        error,
        event,
      });
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

  protected async jobDirectoryExists(event: StagingFileEvent): Promise<boolean> {
    return this.exists(dirname(event.payload));
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
