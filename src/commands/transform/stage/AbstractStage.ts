import path, { basename } from 'node:path';
import { stripRoot } from '../../../lib/root.js';
import type { AbstractGuard } from './guards/AbstractGuard.js';
import { GuardDecisionQuarantine } from './guards/decisions/GuardDecisionQuarantine.js';
import { atomicWrite } from '../../../lib/atomicWrite.js';
import type { Logger } from '../../../lib/logger.js';
import type { AbstractGuardDecision } from './guards/decisions/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from './guards/decisions/GuardDecisionAdvance.js';
import type { Transformation } from './AbstractTransformation.js';
import assert from 'node:assert';
import { type Artifact, artifactFilename, KnownArtifactsEnum } from '../../../lib/artifacts.js';
import { readFile } from 'fs/promises';
import { statsAddToCounter } from '../../../lib/stats.js';
import { isStrategySlug } from '../../../lib/types.js';

export type JobDirArtifactsIndex = {
  /**
   * File names present in the job directory (e.g. "raw.job.json").
   */
  present: Set<KnownArtifactsEnum>;
  /**
   * Best-effort mtime (ms) for present files.
   */
  mtimeMs: Map<KnownArtifactsEnum, number>;
};

export abstract class AbstractStage {
  protected logger;
  protected stagingDir;
  protected loadDir;
  protected trashDir;
  private readonly transformations = new Map<string, Transformation>();

  constructor({
    logger,
    stagingDir,
    trashDir,
    loadDir,
    transformations,
  }: {
    logger: Logger;
    stagingDir: string;
    trashDir: string;
    loadDir: string;
    transformations: Transformation[];
  }) {
    for (const transformation of transformations) {
      this.transformations.set(transformation.strategy(), transformation);
    }
    this.logger = logger.withSuffix(this.name());
    this.stagingDir = stagingDir;
    this.loadDir = loadDir;
    this.trashDir = trashDir;
  }

  public name(): string {
    return artifactFilename(this.outputArtifact()).replaceAll('.', '-');
  }

  public isApplicable(artifacts: JobDirArtifactsIndex) {
    const hasOutput = artifacts.present.has(this.outputArtifact());
    const outputMtimeMs = hasOutput ? artifacts.mtimeMs.get(this.outputArtifact()) : undefined;

    for (const artifact of this.inputArtifacts()) {
      if (!artifacts.present.has(artifact)) return false;
      if (outputMtimeMs !== undefined) {
        const inputMtimeMs = artifacts.mtimeMs.get(artifact);
        if (inputMtimeMs !== undefined && inputMtimeMs > outputMtimeMs) return true;
      }
    }

    // Output missing => applicable. Output present => applicable only if any input newer (checked above).
    return !hasOutput;
  }

  public async run(
    jobDir: string,
    artifacts: JobDirArtifactsIndex,
  ): Promise<AbstractGuardDecision> {
    try {
      if (!this.isApplicable(artifacts)) {
        statsAddToCounter('stage_not_applicable');
        statsAddToCounter(`stage_not_applicable_for_stage_${this.name().replaceAll('-', '_')}`);
        return new GuardDecisionAdvance('advance until preconditions met');
      }

      statsAddToCounter('stage');
      statsAddToCounter(`stage_${this.name().replaceAll('-', '_')}`);

      const result = await this.transform(jobDir);
      const saved = await atomicWrite(
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
      return new GuardDecisionAdvance('all guards green-lit results');
    } catch (error) {
      return new GuardDecisionQuarantine('quarantine because unhandled error', { cause: error });
    }
  }

  public abstract inputArtifacts(): Artifact[];

  public abstract outputArtifact(): Artifact;

  protected abstract guards(): AbstractGuard[];

  protected async transform(jobDir: string): Promise<string> {
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
}
