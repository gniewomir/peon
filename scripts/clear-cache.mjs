import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheDir = path.resolve(__dirname, "..", "data", "cache");

async function cleanCacheDirectory() {
  const entries = await readdir(cacheDir, { withFileTypes: true });

  const entriesToRemove = entries.map((entry) => path.join(cacheDir, entry.name));

  await Promise.all(
    entriesToRemove.map((entryPath) =>
      rm(entryPath, { recursive: true, force: true }),
    ),
  );

  console.log(`Removed ${entriesToRemove.length} entr${entriesToRemove.length === 1 ? "y" : "ies"} from data/cache/`);
}

cleanCacheDirectory().catch((error) => {
  console.error("Failed to clean cache directory:", error);
  process.exitCode = 1;
});
