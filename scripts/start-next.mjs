import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const host = process.env.HOST?.trim() || "0.0.0.0";
const port = process.env.PORT?.trim() || "3000";

const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "start", "-H", host, "-p", port],
  {
    stdio: "inherit",
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
