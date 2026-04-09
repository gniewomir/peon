import { spawn } from "node:child_process";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`"${command} ${args.join(" ")}" exited with code ${code}`));
      } else {
        resolve();
      }
    });
    child.on("error", reject);
  });
}

function runParallel(commands) {
  const children = commands.map(([command, args]) =>
    spawn(command, args, { stdio: "inherit", shell: true }),
  );

  const cleanup = (signal) => {
    for (const child of children) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => cleanup("SIGINT"));
  process.on("SIGTERM", () => cleanup("SIGTERM"));

  return Promise.all(
    children.map(
      (child, i) =>
        new Promise((resolve, reject) => {
          child.on("close", (code) => {
            if (code !== 0) {
              const [command, args] = commands[i];
              reject(
                new Error(`"${command} ${args.join(" ")}" exited with code ${code}`),
              );
            } else {
              resolve();
            }
          });
          child.on("error", reject);
        }),
    ),
  );
}

async function cleanRun() {
  console.log("--- overkill ---");
  await run("npm", ["run", "overkill"]);

  console.log("--- stage:clear ---");
  await run("npm", ["run", "stage:clear"]);

  console.log("--- extract + transform (parallel) ---");
  await runParallel([
    ["npm", ["run", "extract"]],
    ["npm", ["run", "transform"]],
  ]);
}

cleanRun().catch((error) => {
  console.error("Clean run failed:", error.message);
  process.exitCode = 1;
});
