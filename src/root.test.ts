import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { rootPath } from './root.js';

describe('rootPath', () => {
  it('returns repository root regardless of src/dist module directory', () => {
    const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const expectedRepoRoot = path.dirname(packageJsonPath);

    expect(rootPath()).toBe(expectedRepoRoot);
  });
});
