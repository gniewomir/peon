import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const msgFile = process.argv[2];
if (!msgFile) {
    console.error("commit-msg hook: missing commit message file argument.");
    process.exit(2);
}

const raw = readFileSync(msgFile, "utf8");
const firstLine = raw.split(/\r?\n/)[0]?.trim() ?? "";

// Allow git-generated commits that don't follow Conventional Commits.
if (firstLine === "" || firstLine.startsWith("Merge ") || firstLine.startsWith("Revert ")) {
    process.exit(0);
}

// Conventional Commits 1.0.0 header:
// <type>[optional scope][optional !]: <description>
const type = "(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)";
const scope = "(\\([\\w\\-./]+\\))?";
const breaking = "(!)?";
const header = new RegExp(`^${type}${scope}${breaking}:\\s\\S+`);

if (!header.test(firstLine)) {
    console.error("");
    console.error("Invalid commit message.");
    console.error(
        "Expected Conventional Commits 1.0.0 format: <type>(optional-scope)!: <description>",
    );
    console.error("");
    console.error(`Got: ${firstLine}`);
    console.error("");
    console.error("Examples:");
    console.error("  feat: add auto-close snooze");
    console.error("  fix(options): persist excluded domains");
    console.error("  refactor!: drop legacy timer storage");
    console.error("");
    console.error("Spec: https://www.conventionalcommits.org/en/v1.0.0/");
    process.exit(1);
}
