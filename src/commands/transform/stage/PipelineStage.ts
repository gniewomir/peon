import type { Transformation } from './AbstractTransformation.js';
import type { Logger } from '../../../lib/logger.js';
import { type Artifact, artifactFilename } from '../../../lib/artifacts.js';
import type { AbstractGuardDecision } from './guards/decisions/AbstractGuardDecision.js';

import type { JobDirArtifacts } from './types.js';

/**
 * Type-erased stage contract used by {@link StageOrchestrator}. Concrete stages extend
 * {@link AbstractStage} with a typed pipeline value.
 */
export abstract class PipelineStage {
  protected logger;
  protected stagingDir;
  protected loadDir;
  protected trashDir;
  protected readonly transformations = new Map<string, Transformation<unknown>>();

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
    transformations: Transformation<unknown>[];
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

  public isApplicable(artifacts: JobDirArtifacts) {
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

  public abstract run(jobDir: string, artifacts: JobDirArtifacts): Promise<AbstractGuardDecision>;

  public abstract inputArtifacts(): Artifact[];

  public abstract outputArtifact(): Artifact;
}
