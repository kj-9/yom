import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

await rm(new URL("../lib", import.meta.url), { recursive: true, force: true });

const result = spawnSync(
  process.platform === "win32" ? "tsc.cmd" : "tsc",
  ["--project", "tsconfig.build.json"],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
