import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');

async function cleanDistDirectory() {
  if (!existsSync(distDir)) {
    return;
  }
  await fs.rm(distDir, { recursive: true, force: true });
}

cleanDistDirectory().catch((error) => {
  console.error('Failed to clean dist directory:', error);
  process.exitCode = 1;
});
