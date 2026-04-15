import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, "..", "data");
const stagingDir = path.join(dataDir, "staging");
const sources = ["trash", "quarantine", "load"].map((name) => ({
  name,
  dir: path.join(dataDir, name),
}));

async function isDirectory(p) {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function moveDirectory(sourcePath, targetPath) {
  try {
    await fs.rename(sourcePath, targetPath);
    return { movedVia: "rename" };
  } catch (error) {
    // Cross-device rename fallback (EXDEV) or other rename failure.
    await fs.cp(sourcePath, targetPath, { recursive: true, force: false });
    await fs.rm(sourcePath, { recursive: true, force: true });
    return { movedVia: "copy+rm", renameError: error };
  }
}

async function repopulateStaging() {
  await fs.mkdir(stagingDir, { recursive: true });

  let movedCount = 0;
  let skippedCount = 0;

  for (const source of sources) {
    if (!existsSync(source.dir)) {
      continue;
    }

    const entries = await fs.readdir(source.dir, { withFileTypes: true });
    const subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    for (const name of subdirs) {
      const from = path.join(source.dir, name);
      if (!(await isDirectory(from))) {
        skippedCount += 1;
        continue;
      }

      let to = path.join(stagingDir, name);

      if (await pathExists(to)) {
        const uniqueName = `${name}__from_${source.name}__${Date.now()}_${Math.random()
          .toString(16)
          .slice(2, 8)}`;
        to = path.join(stagingDir, uniqueName);
      }

      await moveDirectory(from, to);
      movedCount += 1;
    }
  }

  console.log(
    `Repopulated staging/: moved ${movedCount} director${
      movedCount === 1 ? "y" : "ies"
    }, skipped ${skippedCount}`,
  );
}

repopulateStaging().catch((error) => {
  console.error("Failed to repopulate staging directory:", error);
  process.exitCode = 1;
});
