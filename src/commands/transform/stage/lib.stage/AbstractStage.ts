import type { StagingFileEvent } from '../../types.js';
import { readFile } from 'fs/promises';
import path, { dirname } from 'node:path';
import {
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { access } from 'node:fs/promises';
import { stripRootPath } from '../../../../root.js';
import type { AbstractGuard } from '../lib.guard/AbstractGuard.js';
import { GuardDecisionTrash } from '../lib.guard/GuardDecisionTrash.js';
import { GuardDecisionQuarantine } from '../lib.guard/GuardDecisionQuarantine.js';
import type { TMetaSchema } from '../../../../schema/schema.meta.js';
import { smartSave } from '../../../lib/smart-save.js';
import { GuardDecisionLoad } from '../lib.guard/GuardDecisionLoad.js';
import type { Logger } from '../../../lib/logger.js';

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
  protected abstract inputFiles(): string[];
  protected abstract outputFile(): string;
  protected abstract payload(
    event: StagingFileEvent,
  ): Promise<string | Record<string, unknown> | unknown[]>;
  protected abstract guards(): AbstractGuard[];

  public async runIfPreconditionsMet(event: StagingFileEvent): Promise<void> {
    const jobDir = dirname(event.payload);
    try {
      if (!(await this.preconditionsMeet(event))) return;
      const result = await this.payload(event);
      const guardDecisions = await Promise.all(this.guards().map((guard) => guard.guard(result)));
      await smartSave(path.join(jobDir, this.outputFile()), result, false, this.logger);
      this.logger.log(`[${event.type}:${stripRootPath(event.payload)}] processed`);
      for (const decision of guardDecisions) {
        if (decision instanceof GuardDecisionQuarantine) {
          this.saveErrorChain({
            jobErrorPath: path.join(jobDir, `errors.json`),
            error: decision,
            event,
          });
          this.quarantine(jobDir);
          this.logger.warn(
            `[${event.type}:${stripRootPath(event.payload)}] was quarantined by guard`,
          );
          break;
        }
        if (decision instanceof GuardDecisionTrash) {
          this.saveErrorChain({
            jobErrorPath: path.join(jobDir, `errors.json`),
            error: decision,
            event,
          });
          this.logger.warn(`[${event.type}:${stripRootPath(event.payload)}] was trashed by guard`);
          this.trash(jobDir);
          break;
        }
        if (decision instanceof GuardDecisionLoad) {
          this.logger.log(`[${event.type}:${stripRootPath(event.payload)}] was loaded by guard`);
          this.load(jobDir);
          break;
        }
      }
    } catch (error) {
      this.saveErrorChain({ jobErrorPath: path.join(jobDir, `errors.json`), error, event });
      this.quarantine(jobDir);
      this.logger.error(
        `[${event.type}:${stripRootPath(event.payload)}] was quarantined by unhanded error`,
      );
    }
  }

  protected async preconditionsMeet(event: StagingFileEvent): Promise<boolean> {
    const jobDir = dirname(event.payload);

    if (!this.isFileCreationOrUpdateEvent(event)) return false;
    if (!(await this.exists(jobDir))) return false;

    const inputs = this.inputFiles();
    let inputsAlreadyExist: boolean;

    switch (inputs.length) {
      case 0:
        inputsAlreadyExist = true;
        break;
      case 1:
        inputsAlreadyExist = event.payload.endsWith(`/${this.inputFiles()[0]}`);
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

    const outputAlreadyExist = await this.exists(
      path.join(dirname(event.payload), this.outputFile()),
    );

    if (outputAlreadyExist) {
      this.logger.debug(`Output already exists: ${event.payload}`);
      return false;
    }

    return inputsAlreadyExist && !outputAlreadyExist;
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

  private quarantine(jobDir: string) {
    const quarantinedJobDir = path.join(
      this.quarantineDir,
      `${path.basename(jobDir)}-${Date.now()}`,
    );
    if (existsSync(quarantinedJobDir)) {
      this.logger.warn(`${stripRootPath(quarantinedJobDir)} was already quarantined!`);
      return;
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
    const loadJobDir = path.join(this.trashDir, `${path.basename(jobDir)}}`);
    if (existsSync(loadJobDir)) {
      rmdirSync(loadJobDir, { recursive: true });
    }
    mkdirSync(loadJobDir, { recursive: true });
    try {
      renameSync(jobDir, loadJobDir);
      return;
    } catch {
      cpSync(jobDir, loadJobDir, { recursive: true });
      rmSync(jobDir, { recursive: true, force: true });
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

  async readMetadata(jobDir: string): Promise<TMetaSchema> {
    return await this.readJson<TMetaSchema>(`${jobDir}/raw.meta.json`);
  }
}
