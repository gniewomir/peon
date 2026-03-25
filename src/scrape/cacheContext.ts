import path from 'node:path';

let cacheRoot: string | null = null;

export function setCacheRoot(root: string): void {
  cacheRoot = path.resolve(root);
}

export function getCacheRoot(): string {
  if (cacheRoot === null) {
    throw new Error('setCacheRoot must be called before cache operations');
  }
  return cacheRoot;
}
