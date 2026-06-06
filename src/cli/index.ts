import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

import { buildStaticSite } from "./build";

type Command = "dev" | "build" | "preview";

type CliOptions = {
  command: Command;
  root: string;
  outDir: string;
  host: string;
  port: number;
};

if (import.meta.main) {
  const options = parseArgs(process.argv.slice(2));
  await run(options);
}

export async function run(options: CliOptions): Promise<void> {
  if (options.command === "build") {
    await buildStaticSite({
      root: path.resolve(options.root),
      outDir: path.resolve(options.outDir),
    });
    return;
  }

  if (options.command === "dev") {
    await spawnBun([
      "x",
      "vite",
      "--host",
      options.host,
      "--port",
      String(options.port),
    ]);
    return;
  }

  await spawnBun([
    "x",
    "vite",
    "preview",
    "--host",
    options.host,
    "--port",
    String(options.port),
  ]);
}

export function parseArgs(argv: string[]): CliOptions {
  const [commandToken = "dev", ...rest] = argv;
  if (!isCommand(commandToken)) {
    throw new Error(`Unsupported command: ${commandToken}`);
  }

  const options: CliOptions = {
    command: commandToken,
    root: ".",
    outDir: "dist",
    host: "127.0.0.1",
    port: 4173,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    const value = rest[index + 1];

    if (token === "--root" && value !== undefined) {
      options.root = value;
      index += 1;
      continue;
    }

    if (token === "--out-dir" && value !== undefined) {
      options.outDir = value;
      index += 1;
      continue;
    }

    if (token === "--host" && value !== undefined) {
      options.host = value;
      index += 1;
      continue;
    }

    if (token === "--port" && value !== undefined) {
      options.port = Number.parseInt(value, 10);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported option: ${token}`);
  }

  return options;
}

async function spawnBun(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("bun", args, {
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `bun ${args.join(" ")} failed with code ${code ?? "unknown"}`,
        ),
      );
    });
  });
}

function isCommand(value: string): value is Command {
  return value === "dev" || value === "build" || value === "preview";
}
