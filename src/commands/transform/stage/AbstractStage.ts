import type { StagingFileEvent } from '../types.js';
import path, { basename, dirname } from 'node:path';
import { constants } from 'node:fs';
import { stripRoot } from '../../../lib/root.js';
import type { AbstractGuard } from './guards/AbstractGuard.js';
import { GuardDecisionQuarantine } from './guards/decisions/GuardDecisionQuarantine.js';
import { smartSave } from '../../../lib/smartSave.js';
import type { Logger } from '../../../lib/logger.js';
import type { AbstractGuardDecision } from './guards/decisions/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from './guards/decisions/GuardDecisionAdvance.js';
import type { Transformation } from './AbstractTransformation.js';
import assert from 'node:assert';
import { type Artifact, artifactFilename } from '../../../lib/artifacts.js';
import { access, readFile, stat } from 'fs/promises';
import { statsAddToCounter } from '../../../lib/stats.js';
import { isStrategySlug } from '../../../lib/types.js';
import type { InMemoryDirectoryTracker } from './InMemoryDirectoryTracker.js';

export abstract class AbstractStage {
  protected logger;
  protected stagingDir;
  protected loadDir;
  protected trashDir;
  private readonly transformations = new Map<string, Transformation>();
  private readonly inMemoryDirectoryTracker: InMemoryDirectoryTracker;

  constructor({
    logger,
    stagingDir,
    trashDir,
    loadDir,
    transformations,
    inMemoryDirectoryTracker,
  }: {
    logger: Logger;
    stagingDir: string;
    trashDir: string;
    loadDir: string;
    transformations: Transformation[];
    inMemoryDirectoryTracker: InMemoryDirectoryTracker;
  }) {
    for (const transformation of transformations) {
      this.transformations.set(transformation.strategy(), transformation);
    }
    this.logger = logger.withSuffix(this.name());
    this.stagingDir = stagingDir;
    this.loadDir = loadDir;
    this.trashDir = trashDir;
    this.inMemoryDirectoryTracker = inMemoryDirectoryTracker;
  }

  public name(): string {
    return artifactFilename(this.outputArtifact()).replaceAll('.', '-');
  }

  /**
   * Job-dir applicability used by the scan-cycle orchestrator.
   */
  public async isApplicable(jobDir: string): Promise<boolean> {
    if (!(await this.pathExists(jobDir))) return false;

    const outputPath = path.join(jobDir, artifactFilename(this.outputArtifact()));
    const hasOutput = await this.pathExists(outputPath);
    const outputStat = hasOutput ? await stat(outputPath) : undefined;

    for (const artifact of this.inputArtifacts()) {
      const inputArtifactPath = path.join(jobDir, artifactFilename(artifact));
      if (!(await this.pathExists(inputArtifactPath))) return false;
      if (outputStat) {
        const inputStat = await stat(inputArtifactPath);
        if (inputStat.mtimeMs > outputStat.mtimeMs) return true;
      }
    }

    // Output missing => applicable. Output present => applicable only if any input newer (checked above).
    return !hasOutput;
  }

  public async runForJob(jobDir: string): Promise<AbstractGuardDecision> {
    try {
      if (!(await this.isApplicable(jobDir))) {
        statsAddToCounter('stage_precondition_not_met');
        statsAddToCounter(
          `stage_precondition_not_met_for_stage_${this.name().replaceAll('-', '_')}`,
        );
        return new GuardDecisionAdvance('advance until preconditions met');
      }

      statsAddToCounter('stage');
      statsAddToCounter(`stage_${this.name().replaceAll('-', '_')}`);

      const result = await this.transformForJob(jobDir);
      const saved = await smartSave(
        path.join(jobDir, artifactFilename(this.outputArtifact())),
        result,
        this.logger,
      );
      if (saved) {
        this.logger.log(
          `Artifact created ${stripRoot(jobDir)}/${artifactFilename(this.outputArtifact())}`,
        );
      }
      for (const guard of this.guards()) {
        const guardDecision = await guard.guard(result);
        if (!(guardDecision instanceof GuardDecisionAdvance)) {
          return guardDecision;
        }
      }
      return new GuardDecisionAdvance('advance because all guards passed');
    } catch (error) {
      return new GuardDecisionQuarantine('quarantine because unhandled error', { cause: error });
    }
  }

  public async run(event: StagingFileEvent): Promise<AbstractGuardDecision> {
    const jobDir = path.resolve(dirname(event.payload));
    try {
      if (!(await this.preconditionsMeet(event))) {
        statsAddToCounter('stage_precondition_not_met');
        statsAddToCounter(
          `stage_precondition_not_met_for_stage_${this.name().replaceAll('-', '_')}`,
        );
        return new GuardDecisionAdvance('advance until preconditions met');
      }
      statsAddToCounter('stage');
      statsAddToCounter(`stage_${this.name().replaceAll('-', '_')}`);

      const result = await this.transform(event);
      /**
       * NOTE: saving the result before guards, so it is available for debugging
       *       in the quarantined / trashed job directory
       */
      const saved = await smartSave(
        path.join(jobDir, artifactFilename(this.outputArtifact())),
        result,
        this.logger,
      );
      if (saved) {
        this.logger.log(
          `Artifact ${event.type === 'add' ? 'created' : 'updated'} ${stripRoot(jobDir)}/${artifactFilename(this.outputArtifact())}`,
        );
      }
      for (const guard of this.guards()) {
        const guardDecision = await guard.guard(result);
        if (!(guardDecision instanceof GuardDecisionAdvance)) {
          return guardDecision;
        }
      }
      return new GuardDecisionAdvance('advance because all guards passed');
    } catch (error) {
      return new GuardDecisionQuarantine('quarantine because unhandled error', { cause: error });
    } finally {
      this.logger.debug(`[${event.type}:${stripRoot(event.payload)}] processed`);
    }
  }

  protected abstract inputArtifacts(): Artifact[];

  protected abstract outputArtifact(): Artifact;

  protected abstract guards(): AbstractGuard[];

  protected async preconditionsMeet(event: StagingFileEvent): Promise<boolean> {
    const stagedJobDir = dirname(event.payload);
    const trashedJobDir = path.join(this.trashDir, basename(event.payload));

    if (event.type !== 'add' && event.type !== 'change') {
      statsAddToCounter('stage_precondition_event_unknown');
      this.logger.warn(`stage preconditions: unsupported event type '${event.type}'`);
      return false;
    }

    if (
      !this.inputArtifacts()
        .map((artifact) => artifactFilename(artifact))
        .some((artifactName) => event.payload.includes(artifactName))
    ) {
      statsAddToCounter('stage_precondition_event_no_input_artifact');
      this.logger.debug(`stage preconditions: event doesn't contain input artifact`);
      return false;
    }

    if (this.inMemoryDirectoryTracker.wasMoved(stagedJobDir)) {
      statsAddToCounter('stage_precondition_memory_directory_was_moved');
      this.logger.debug(
        `stage preconditions: job directory was moved already '${stripRoot(stagedJobDir)}'`,
      );
      return false;
    }

    if (!(await this.pathExists(stagedJobDir))) {
      statsAddToCounter('stage_precondition_disk_staging_dir_not_exists');
      this.logger.debug(
        `stage preconditions: job directory does not exist '${stripRoot(stagedJobDir)}'`,
      );
      return false;
    }

    if (await this.pathExists(trashedJobDir)) {
      statsAddToCounter('stage_precondition_disk_trashed');
      this.logger.debug(`stage preconditions: job was trashed '${stripRoot(stagedJobDir)}'`);
      return false;
    }

    for (const artifact of this.inputArtifacts()) {
      const inputArtifactPath = path.join(stagedJobDir, artifactFilename(artifact));
      if (!(await this.pathExists(inputArtifactPath))) {
        statsAddToCounter('stage_precondition_disk_input_artifact_missing');
        this.logger.debug(
          `stage preconditions: artifact ${stripRoot(inputArtifactPath)} does not exist`,
        );
        return false;
      }
    }
    return true;
  }

  protected async transform(event: StagingFileEvent): Promise<string> {
    return this.transformForJob(dirname(event.payload));
  }

  protected async transformForJob(jobDir: string): Promise<string> {
    const source = basename(jobDir).split('-').shift();
    assert(source && isStrategySlug(source), 'unrecognized offer source');

    const input = new Map<Artifact, string>();
    for (const artifact of this.inputArtifacts()) {
      input.set(artifact, await readFile(path.join(jobDir, artifactFilename(artifact)), 'utf8'));
    }
    const transformation = this.transformations.get(source);
    if (!transformation && this.transformations.has('all')) {
      return this.transformations.get('all')?.transform(input) || '';
    }
    assert(
      transformation,
      `no catch-all or source specific transformation for source "${source}" at stage ${this.name()}`,
    );
    return transformation.transform(input);
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
