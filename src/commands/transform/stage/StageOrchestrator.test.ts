import { describe, expect, it } from 'vitest';

import { StageOrchestrator } from './StageOrchestrator.js';
import { AbstractStage } from './AbstractStage.js';
import { InMemoryDirectoryTracker } from './InMemoryDirectoryTracker.js';
import type { Logger } from '../../../lib/logger.js';
import { KnownArtifactsEnum, artifactFilename } from '../../../lib/artifacts.js';
import { statsContext } from '../../../lib/stats.js';

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function createTestLogger(): Logger {
  const base: Logger = {
    withSuffix: () => base,
    debug: () => {},
    log: () => {},
    warn: () => {},
    error: () => {},
  };
  return base;
}

describe('StageOrchestrator (job-dir fixpoint)', () => {
  it('treats a stage as applicable when an input is newer than output', async () => {
    await statsContext('test_').withStats(async () => {
      const logger = createTestLogger();
      const root = mkdtempSync(path.join(tmpdir(), 'peon-orch-'));
      const stagingDir = path.join(root, 'staging');
      const jobDir = path.join(stagingDir, 'all-test-mtime');

      mkdirSync(jobDir, { recursive: true });

      class StageA extends AbstractStage {
        protected inputArtifacts() {
          return [KnownArtifactsEnum.RAW_JOB_JSON];
        }
        protected outputArtifact() {
          return KnownArtifactsEnum.CLEAN_JOB_JSON;
        }
        protected guards() {
          return [];
        }
      }

      const inMemoryDirectoryTracker = new InMemoryDirectoryTracker(100);
      const stageA = new StageA({
        logger,
        stagingDir,
        trashDir: path.join(root, 'trash'),
        loadDir: path.join(root, 'load'),
        transformations: [],
        inMemoryDirectoryTracker,
      });

      const inputPath = path.join(jobDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_JSON));
      const outputPath = path.join(jobDir, artifactFilename(KnownArtifactsEnum.CLEAN_JOB_JSON));

      writeFileSync(inputPath, '{}', 'utf8');
      writeFileSync(outputPath, '{"out":1}', 'utf8');

      // Output written after input => not applicable.
      await expect(stageA.isApplicable(jobDir)).resolves.toBe(false);

      // Make input newer than output.
      await new Promise((r) => setTimeout(r, 5));
      writeFileSync(inputPath, '{"changed":true}', 'utf8');

      await expect(stageA.isApplicable(jobDir)).resolves.toBe(true);
    });
  });

  it('runs stages to fixpoint in registration order', async () => {
    await statsContext('test_').withStats(async () => {
      const logger = createTestLogger();
      const root = mkdtempSync(path.join(tmpdir(), 'peon-orch-'));
      const stagingDir = path.join(root, 'staging');
      const jobDir = path.join(stagingDir, 'all-test-1');

      // Make job dir + seed initial input artifact.
      mkdirSync(jobDir, { recursive: true });
      writeFileSync(
        path.join(jobDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_JSON)),
        '{}',
        'utf8',
      );

      const runs: string[] = [];
      const inMemoryDirectoryTracker = new InMemoryDirectoryTracker(100);

      class StageA extends AbstractStage {
        protected inputArtifacts() {
          return [KnownArtifactsEnum.RAW_JOB_JSON];
        }
        protected outputArtifact() {
          return KnownArtifactsEnum.CLEAN_JOB_JSON;
        }
        protected guards() {
          return [];
        }
        protected async transformForJob(): Promise<string> {
          runs.push('A');
          return '{"a":1}';
        }
      }

      class StageB extends AbstractStage {
        protected inputArtifacts() {
          return [KnownArtifactsEnum.CLEAN_JOB_JSON];
        }
        protected outputArtifact() {
          return KnownArtifactsEnum.CLEAN_COMBINE_JSON;
        }
        protected guards() {
          return [];
        }
        protected async transformForJob(): Promise<string> {
          runs.push('B');
          return '{"b":1}';
        }
      }

      const stageA = new StageA({
        logger,
        stagingDir,
        trashDir: path.join(root, 'trash'),
        loadDir: path.join(root, 'load'),
        transformations: [],
        inMemoryDirectoryTracker,
      });

      const stageB = new StageB({
        logger,
        stagingDir,
        trashDir: path.join(root, 'trash'),
        loadDir: path.join(root, 'load'),
        transformations: [],
        inMemoryDirectoryTracker,
      });

      const orchestrator = new StageOrchestrator({
        logger,
        stagingDir,
        quarantineDir: path.join(root, 'quarantine'),
        trashDir: path.join(root, 'trash'),
        loadDir: path.join(root, 'load'),
        stages: [stageA, stageB],
        inMemoryDirectoryTracker,
      });

      orchestrator.enqueueJobDir(jobDir);
      await orchestrator.shutdown();

      expect(runs).toEqual(['A', 'B']);
    });
  });

  it('serializes work per jobDir (no concurrent execution)', async () => {
    await statsContext('test_').withStats(async () => {
      const logger = createTestLogger();
      const root = mkdtempSync(path.join(tmpdir(), 'peon-orch-'));
      const stagingDir = path.join(root, 'staging');
      const jobDir = path.join(stagingDir, 'all-test-2');

      mkdirSync(jobDir, { recursive: true });
      writeFileSync(
        path.join(jobDir, artifactFilename(KnownArtifactsEnum.RAW_JOB_JSON)),
        '{}',
        'utf8',
      );

      const inMemoryDirectoryTracker = new InMemoryDirectoryTracker(100);

      let active = 0;
      let maxActive = 0;

      class SlowStage extends AbstractStage {
        protected inputArtifacts() {
          return [KnownArtifactsEnum.RAW_JOB_JSON];
        }
        protected outputArtifact() {
          return KnownArtifactsEnum.CLEAN_JOB_JSON;
        }
        protected guards() {
          return [];
        }
        protected async transformForJob(): Promise<string> {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((r) => setTimeout(r, 25));
          active -= 1;
          return '{"ok":true}';
        }
      }

      const slowStage = new SlowStage({
        logger,
        stagingDir,
        trashDir: path.join(root, 'trash'),
        loadDir: path.join(root, 'load'),
        transformations: [],
        inMemoryDirectoryTracker,
      });
      const orchestrator = new StageOrchestrator({
        logger,
        stagingDir,
        quarantineDir: path.join(root, 'quarantine'),
        trashDir: path.join(root, 'trash'),
        loadDir: path.join(root, 'load'),
        stages: [slowStage],
        inMemoryDirectoryTracker,
      });

      orchestrator.enqueueJobDir(jobDir);
      orchestrator.enqueueJobDir(jobDir);
      await orchestrator.shutdown();

      expect(maxActive).toBe(1);
    });
  });
});
