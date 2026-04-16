import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { KnownArtifactsEnum, artifactFilename } from '../../lib/artifacts.js';
import type { Logger } from '../../lib/logger.js';
import { statsContext } from '../../lib/stats.js';
import type { AbstractGuardDecision } from './outcomes/AbstractGuardDecision.js';
import { GuardDecisionAdvance } from './outcomes/GuardDecisionAdvance.js';
import { StageOrchestrator } from './StageOrchestrator.js';
import type { StageConcurrency } from './stage/PipelineStage.js';
import { PipelineStage } from './stage/PipelineStage.js';
import type { Transformation } from './stage/AbstractTransformation.js';

const silentLogger: Logger = {
  withSuffix: () => silentLogger,
  debug: () => {},
  log: () => {},
  warn: () => {},
  error: () => {},
};

const emptyTransforms = [] as Transformation<unknown>[];

describe('StageOrchestrator', () => {
  it('throws when a stage returns invalid concurrency', () => {
    class BadStage extends PipelineStage {
      constructor() {
        super({
          logger: silentLogger,
          stagingDir: '/tmp',
          trashDir: '/tmp',
          loadDir: '/tmp',
          transformations: emptyTransforms,
        });
      }

      run(): Promise<AbstractGuardDecision> {
        throw new Error('unused');
      }

      inputArtifacts() {
        return [];
      }

      outputArtifact() {
        return KnownArtifactsEnum.CLEAN_JOB_JSON;
      }

      concurrency(): StageConcurrency {
        return 1.5 as StageConcurrency;
      }
    }

    expect(
      () =>
        new StageOrchestrator({
          logger: silentLogger,
          quarantineDir: '/tmp/q',
          trashDir: '/tmp/t',
          loadDir: '/tmp/l',
          autoScaling: {
            minConcurrentStages: 2,
            maxConcurrentStages: 10,
            rssMemorySoftCap: 512 * 1024 * 1024,
          },
          stages: [new BadStage()],
        }),
    ).toThrow(/Invalid concurrency for stage/);
  });

  it('skips a saturated stage and schedules the next stage with inputs present', async () => {
    await statsContext('orch_test_').withStats(async () => {
      let releaseFirst!: () => void;
      const firstBlocking = new Promise<void>((r) => {
        releaseFirst = r;
      });

      const order: string[] = [];

      class StageFirst extends PipelineStage {
        constructor() {
          super({
            logger: silentLogger,
            stagingDir: '/tmp',
            trashDir: '/tmp',
            loadDir: '/tmp',
            transformations: emptyTransforms,
          });
        }

        async run() {
          order.push('first');
          await firstBlocking;
          return new GuardDecisionAdvance('test');
        }

        inputArtifacts() {
          return [KnownArtifactsEnum.RAW_JOB_JSON];
        }

        outputArtifact() {
          return KnownArtifactsEnum.CLEAN_JOB_JSON;
        }

        concurrency(): StageConcurrency {
          return 1;
        }
      }

      class StageSecond extends PipelineStage {
        constructor() {
          super({
            logger: silentLogger,
            stagingDir: '/tmp',
            trashDir: '/tmp',
            loadDir: '/tmp',
            transformations: emptyTransforms,
          });
        }

        async run() {
          order.push('second');
          return new GuardDecisionAdvance('test');
        }

        inputArtifacts() {
          return [KnownArtifactsEnum.RAW_JOB_JSON];
        }

        outputArtifact() {
          return KnownArtifactsEnum.CLEAN_JOB_HTML;
        }

        concurrency(): StageConcurrency {
          return 'unlimited';
        }
      }

      const root = await mkdtemp(path.join(os.tmpdir(), 'peon-stage-orch-'));
      const jobA = path.join(root, 'job-a');
      const jobB = path.join(root, 'job-b');
      await mkdir(jobA, { recursive: true });
      await mkdir(jobB, { recursive: true });
      await writeFile(path.join(jobA, artifactFilename(KnownArtifactsEnum.RAW_JOB_JSON)), '{}');
      await writeFile(path.join(jobB, artifactFilename(KnownArtifactsEnum.RAW_JOB_JSON)), '{}');

      const orchestrator = new StageOrchestrator({
        logger: silentLogger,
        quarantineDir: path.join(root, 'q'),
        trashDir: path.join(root, 't'),
        loadDir: path.join(root, 'l'),
        autoScaling: {
          minConcurrentStages: 10,
          maxConcurrentStages: 100,
          rssMemorySoftCap: 512 * 1024 * 1024,
        },
        stages: [new StageFirst(), new StageSecond()],
      });

      await orchestrator.enqueue(jobA);
      await orchestrator.enqueue(jobB);

      expect(order).toEqual(['first', 'second']);

      releaseFirst();
      await orchestrator.shutdown();
    });
  });
});
