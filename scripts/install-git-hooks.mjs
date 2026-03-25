import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (!existsSync(join(root, ".git"))) {
    process.exit(0);
}

try {
    execSync("git config core.hooksPath .githooks", { cwd: root, stdio: "pipe" });
} catch {
    process.exit(0);
}
