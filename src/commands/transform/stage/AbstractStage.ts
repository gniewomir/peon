import type { StagingFileEvent } from '../types.js';
import path, { dirname } from 'node:path';
import { constants } from 'node:fs';
import { stripRoot } from '../../../lib/root.js';
import type { AbstractGuard } from './guards/AbstractGuard.js';
import { GuardDecisionQuarantine } from './guards/decisions/GuardDecisionQuarantine.js';
import { smartSave } from '../../lib/smartSave.js';
import type { Logger } from '../../lib/logger.js';
import type { AbstractGuardDecision } from './guards/decisions/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from './guards/decisions/GuardDecisionAdvance.js';
import type { Transformation } from './AbstractTransformation.js';
import assert from 'node:assert';
import { type Artifact, artifactFilename, KnownArtifactsEnum } from '../artifacts.js';
import { access, readFile } from 'fs/promises';
import type { TMetaSchema } from '../../../schema/schema.meta.js';

export abstract class AbstractStage {
  protected readonly transformations = new Map<string, Transformation>();
  protected logger;
  protected stagingDir;

  constructor({
    logger,
    stagingDir,
    transformations,
  }: {
    logger: Logger;
    stagingDir: string;
    transformations: Transformation[];
  }) {
    for (const transformation of transformations) {
      this.transformations.set(transformation.strategy(), transformation);
    }
    this.logger = logger.withSuffix(this.name());
    this.stagingDir = stagingDir;
  }

  public name(): string {
    return artifactFilename(this.outputArtifact()).replaceAll('.', '-');
  }

  public async run(event: StagingFileEvent): Promise<AbstractGuardDecision> {
    const jobDir = dirname(event.payload);
    try {
      if (!(await this.preconditionsMeet(event)))
        return new GuardDecisionAdvance('keep until preconditions met');

      const result = await this.transform(event);
      await smartSave(
        path.join(jobDir, artifactFilename(this.outputArtifact())),
        result,
        false,
        this.logger,
      );
      for (const guard of this.guards()) {
        const guardDecision = await guard.guard(result);
        if (!(guardDecision instanceof GuardDecisionAdvance)) {
          return guardDecision;
        }
      }
    } catch (error) {
      return new GuardDecisionQuarantine('quarantine because unhanded error', { cause: error });
    } finally {
      this.logger.log(`[${event.type}:${stripRoot(event.payload)}] processed`);
    }
    return new GuardDecisionAdvance('advance because all guards passed');
  }

  protected abstract inputArtifacts(): Artifact[];

  protected abstract outputArtifact(): Artifact;

  protected abstract guards(): AbstractGuard[];

  protected async preconditionsMeet(event: StagingFileEvent): Promise<boolean> {
    const stagedJobDir = dirname(event.payload);

    if (event.type !== 'add' && event.type !== 'change') {
      this.logger.warn(`stage preconditions: unsupported event type '${event.type}'`);
      return false;
    }
    if (!(await this.pathExists(stagedJobDir))) {
      this.logger.debug(
        `stage preconditions: job directory does not exist '${stripRoot(stagedJobDir)}'`,
      );
      return false;
    }

    for (const artifact of this.inputArtifacts()) {
      const inputArtifactPath = path.join(stagedJobDir, artifactFilename(artifact));
      if (!(await this.pathExists(inputArtifactPath))) {
        this.logger.debug(
          `stage preconditions: artifact ${stripRoot(inputArtifactPath)} does not exist`,
        );
        return false;
      }
    }

    const outputArtifactPath = path.join(stagedJobDir, artifactFilename(this.outputArtifact()));

    if (await this.pathExists(outputArtifactPath)) {
      this.logger.warn(
        `stage preconditions: output artifact ${stripRoot(outputArtifactPath)} already exists`,
      );
      return false;
    }

    return true;
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  protected async transform(event: StagingFileEvent): Promise<string> {
    const stagedJobDir = dirname(event.payload);

    const input = new Map<Artifact, string>();
    for (const artifact of this.inputArtifacts()) {
      input.set(
        artifact,
        await readFile(path.join(stagedJobDir, artifactFilename(artifact)), 'utf8'),
      );
    }

    if (this.transformations.size === 1 && this.transformations.has('all')) {
      return this.transformations.get('all')?.transform(input) || '';
    }
    const meta = JSON.parse(
      await readFile(
        path.join(stagedJobDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_META_JSON)),
        'utf8',
      ),
    ) as TMetaSchema;
    const source = meta.offer.source;
    assert(source !== null, 'unrecognized offer source');
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
