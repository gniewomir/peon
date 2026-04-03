import { cp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { Logger } from '../../types/Logger.js';

function utcTimestamp(): string {
  return new Date()
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function quarantineDirFromStagingDir(stagingDir: string): string {
  return path.join(path.dirname(stagingDir), 'quarantine');
}

async function moveWithFallback(sourceDir: string, destDir: string): Promise<void> {
  try {
    await rename(sourceDir, destDir);
    return;
  } catch {
    await cp(sourceDir, destDir, { recursive: true });
    await rm(sourceDir, { recursive: true, force: true });
  }
}

export async function quarantineJobDirectory(params: {
  logger: Logger;
  stagingDir: string;
  jobDir: string;
  stage: string;
  error: unknown;
  inputPaths: string[];
}): Promise<void> {
  const { logger, stagingDir, jobDir, stage, error, inputPaths } = params;
  const quarantineDir = quarantineDirFromStagingDir(stagingDir);
  await mkdir(quarantineDir, { recursive: true });

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const errorPath = path.join(jobDir, 'transform.error.json');
  await writeFile(
    errorPath,
    JSON.stringify(
      {
        stage,
        error: message,
        stack,
        timestamp: new Date().toISOString(),
        inputPaths,
      },
      null,
      2,
    ),
    'utf8',
  );

  const destinationName = `${path.basename(jobDir)}__${utcTimestamp()}`;
  const destination = path.join(quarantineDir, destinationName);
  try {
    await moveWithFallback(jobDir, destination);
    logger.error(`quarantined ${jobDir} -> ${destination}`);
  } catch (moveError) {
    logger.error(`critical: failed to quarantine ${jobDir}`, moveError);
  }
}
