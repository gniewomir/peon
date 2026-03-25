import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

execSync("npm run typecheck", { stdio: "inherit" });
execSync("npm run lint", { stdio: "inherit" });
execSync("npm run format:check", { stdio: "inherit" });
execSync("npm run test", { stdio: "inherit" });
