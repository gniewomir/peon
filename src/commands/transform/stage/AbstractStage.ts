import path, { basename } from 'node:path';
import { stripRoot } from '../../../lib/root.js';
import type { AbstractGuard } from './AbstractGuard.js';
import { GuardDecisionQuarantine } from './outcomes/GuardDecisionQuarantine.js';
import { atomicWrite } from '../../../lib/atomicWrite.js';
import type { AbstractGuardDecision } from './outcomes/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from './outcomes/GuardDecisionAdvance.js';
import assert from 'node:assert';
import { type Artifact, artifactFilename } from '../../../lib/artifacts.js';
import { readFile } from 'fs/promises';
import { statsAddToCounter } from '../../../lib/stats.js';
import { isStrategySlug } from '../../../lib/types.js';
import { PipelineStage } from './PipelineStage.js';
import type { JobDirArtifacts } from './types.js';

/**
 * A transform stage whose in-memory value is `T` (defaults to `string` for text pipelines).
 * Persistence is {@link artifactPayload}; override when `T` is not what should be written as-is.
 */
export abstract class AbstractStage<T = string> extends PipelineStage {
  protected abstract guards(): AbstractGuard<T>[];

  public async run(jobDir: string, artifacts: JobDirArtifacts): Promise<AbstractGuardDecision> {
    try {
      if (!this.isApplicable(artifacts)) {
        statsAddToCounter('stage_not_applicable');
        statsAddToCounter(`stage_not_applicable_for_stage_${this.name().replaceAll('-', '_')}`);
        return new GuardDecisionAdvance('advance until preconditions met');
      }

      statsAddToCounter('stage');
      statsAddToCounter(`stage_${this.name().replaceAll('-', '_')}`);

      const result = await this.transformFromInputs(jobDir);
      const saved = await atomicWrite(
        path.join(jobDir, artifactFilename(this.outputArtifact())),
        this.artifactPayload(result),
        this.logger,
      );
      if (saved) {
        this.logger.debug(
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

  /** Resolved strategy transformation output for this job directory. */
  protected async transformFromInputs(jobDir: string): Promise<T> {
    const source = basename(jobDir).split('-').shift();
    assert(source && isStrategySlug(source), 'unrecognized offer source');

    const input = new Map<Artifact, string>();
    for (const artifact of this.inputArtifacts()) {
      input.set(artifact, await readFile(path.join(jobDir, artifactFilename(artifact)), 'utf8'));
    }
    const transformation = this.transformations.get(source);
    if (!transformation && this.transformations.has('all')) {
      const catchAll = this.transformations.get('all');
      assert(catchAll, 'catch-all transformation registered');
      return (await catchAll.transform(input)) as T;
    }
    assert(
      transformation,
      `no catch-all or source specific transformation for source "${source}" at stage ${this.name()}`,
    );
    return (await transformation.transform(input)) as T;
  }

  /**
   * Value passed to {@link atomicWrite}. Default passes through; override for buffers or custom encoding.
   */
  protected artifactPayload(value: T): unknown {
    return value;
  }
}
