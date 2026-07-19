import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

import { cac } from "cac";

import packageJson from "../../package.json" with { type: "json" };
import { buildStaticSite } from "./build";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const viteConfigPath = path.join(packageRoot, "vite.config.ts");

type Command = "dev" | "build" | "preview";

export type CliOptions = {
  command: Command;
  root: string;
  outDir: string;
  host: string;
  port: number;
};

const cli = cac("yom");

cli
  .command("dev", "Run the Vite development server")
  .option("--root <path>", "Root directory to serve", { default: "." })
  .option("--host <host>", "Host to bind the dev server", {
    default: "127.0.0.1",
  })
  .option("--port <port>", "Port to bind the dev server", {
    default: 4173,
  })
  .action(async (options) => {
    await run({
      command: "dev",
      root: options.root,
      outDir: "dist",
      host: options.host,
      port: Number(options.port),
    });
  });

cli
  .command("build", "Build the static site into the output directory")
  .option("--root <path>", "Root directory to build", { default: "." })
  .option("--out-dir <path>", "Output directory for build artifacts", {
    default: "dist",
  })
  .action(async (options) => {
    await run({
      command: "build",
      root: options.root,
      outDir: options.outDir,
      host: "127.0.0.1",
      port: 4173,
    });
  });

cli
  .command("preview", "Preview the built site with Vite")
  .option("--host <host>", "Host to bind the preview server", {
    default: "127.0.0.1",
  })
  .option("--port <port>", "Port to bind the preview server", {
    default: 4173,
  })
  .action(async (options) => {
    await run({
      command: "preview",
      root: ".",
      outDir: "dist",
      host: options.host,
      port: Number(options.port),
    });
  });

cli.help();
cli.version(packageJson.version);

if (isDirectExecution(process.argv)) {
  await main(process.argv.slice(2));
}

export async function main(argv: string[]): Promise<void> {
  await cli.parse(["bun", "yom", ...argv], { run: true });
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
    await spawnBun(
      [
        "x",
        "vite",
        "--config",
        viteConfigPath,
        "--host",
        options.host,
        "--port",
        String(options.port),
      ],
      {
        env: {
          YOM_ROOT: path.resolve(options.root),
        },
      },
    );
    return;
  }

  await spawnBun(
    [
      "x",
      "vite",
      "preview",
      "--config",
      viteConfigPath,
      "--host",
      options.host,
      "--port",
      String(options.port),
    ],
    {
      cwd: process.cwd(),
    },
  );
}

export function parseArgs(argv: string[]): CliOptions {
  const [command = "dev", ...rest] = argv;
  if (command === "dev") {
    const options = parseNamedOptions(rest);
    return {
      command,
      root: String(options.root ?? "."),
      outDir: "dist",
      host: String(options.host ?? "127.0.0.1"),
      port: Number(options.port ?? 4173),
    };
  }

  if (command === "build") {
    const options = parseNamedOptions(rest);
    return {
      command,
      root: String(options.root ?? "."),
      outDir: String(options.outDir ?? "dist"),
      host: String(options.host ?? "127.0.0.1"),
      port: Number(options.port ?? 4173),
    };
  }

  if (command === "preview") {
    const options = parseNamedOptions(rest);
    return {
      command,
      root: ".",
      outDir: "dist",
      host: String(options.host ?? "127.0.0.1"),
      port: Number(options.port ?? 4173),
    };
  }

  throw new Error(`Unsupported command: ${command}`);
}

function parseNamedOptions(argv: string[]): Record<string, string | number> {
  const parsed: Record<string, string | number> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (
      !token.startsWith("--") ||
      value === undefined ||
      value.startsWith("--")
    ) {
      throw new Error(`Unsupported option: ${token}`);
    }

    const key = token
      .slice(2)
      .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

export function isDirectExecution(argv: string[]): boolean {
  const entrypoint = argv[1];
  if (!entrypoint) {
    return false;
  }

  return /(?:^|\/)index\.ts$/u.test(entrypoint);
}

async function spawnBun(
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("bun", args, {
      cwd: options.cwd ?? packageRoot,
      env: {
        ...process.env,
        ...options.env,
      },
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
