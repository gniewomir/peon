import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { JobMetadata } from '../../types/Job.js';

export function jobDirFromFilePath(filePath: string): string {
  return dirname(filePath);
}

export function missingPaths(paths: string[]): string[] {
  return paths.filter((filePath) => !existsSync(filePath));
}

export function cleanMissingInputs(meta: JobMetadata): string[] {
  return missingPaths([meta.files.job_meta, meta.files.job_json]);
}

export function combineMissingInputs(meta: JobMetadata): string[] {
  return missingPaths([
    meta.files.job_clean_json,
    meta.files.job_interrogated_json,
    meta.files.job_markdown,
  ]);
}
