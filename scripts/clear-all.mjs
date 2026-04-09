import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");

async function cleanAllDataDirectories() {
  const entries = await readdir(dataDir, { withFileTypes: true });

  const directoriesToRemove = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dataDir, entry.name));

  await Promise.all(
    directoriesToRemove.map((directoryPath) =>
      rm(directoryPath, { recursive: true, force: true }),
    ),
  );

  console.log(
    `Removed ${directoriesToRemove.length} subdirector${
      directoriesToRemove.length === 1 ? "y" : "ies"
    } from data/`,
  );
}

cleanAllDataDirectories().catch((error) => {
  console.error("Failed to clean data directory:", error);
  process.exitCode = 1;
});
