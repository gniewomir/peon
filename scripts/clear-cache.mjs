import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheDir = path.resolve(__dirname, '..', 'data', 'cache');

async function cleanCacheDirectory() {
  if (!existsSync(cacheDir)) {
    return;
  }
  await fs.rm(cacheDir, { recursive: true, force: true });
}

cleanCacheDirectory().catch((error) => {
  console.error('Failed to clean cache directory:', error);
  process.exitCode = 1;
});
