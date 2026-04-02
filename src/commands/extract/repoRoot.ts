import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Project root (directory containing package.json), stable for `tsx` and compiled `dist/`. */
export function getPeonRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}
