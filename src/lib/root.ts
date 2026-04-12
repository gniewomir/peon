import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Project root (directory containing package.json), stable for `tsx` and compiled `dist/`. */
export function rootPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/**
 * Remove the project root prefix from a file/directory path.
 * Returns the original path when it is outside the project root.
 */
export function stripRoot(targetPath: string): string {
  const root = rootPath();
  const absoluteTarget = path.resolve(targetPath);
  const relativeTarget = path.relative(root, absoluteTarget);

  if (relativeTarget === '') {
    return '.';
  }

  if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    return targetPath;
  }

  return relativeTarget;
}
