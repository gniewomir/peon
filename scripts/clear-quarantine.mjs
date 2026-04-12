import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const quarantineDir = path.resolve(__dirname, '..', 'data', 'quarantine');

async function cleanQuarantineDirectory() {
  if (!existsSync(quarantineDir)) {
    return;
  }
  await fs.rm(quarantineDir, { recursive: true, force: true });
}

cleanQuarantineDirectory().catch((error) => {
  console.error('Failed to clean quarantine directory:', error);
  process.exitCode = 1;
});
