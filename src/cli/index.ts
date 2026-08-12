import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

import { cac } from "cac";

import packageJson from "../../package.json" with { type: "json" };
import { loadYomConfig, type ResolvedYomConfig } from "../core/config";
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
  basePath: string;
  siteConfig?: ResolvedYomConfig;
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
  .option("--config <path>", "Path to yom.config.ts")
  .option("--open", "Open the browser after startup")
  .option("--no-open", "Do not open the browser after startup")
  .action(async (options) => {
    await runConfigured("dev", options);
  });

cli
  .command("build", "Build the static site into the output directory")
  .option("--root <path>", "Root directory to build", { default: "." })
  .option("--out-dir <path>", "Output directory for build artifacts")
  .option("--base <path>", "Base public path for the static site")
  .option("--config <path>", "Path to yom.config.ts")
  .action(async (options) => {
    await runConfigured("build", options);
  });

cli
  .command("preview", "Preview the built site with Vite")
  .option("--base <path>", "Base public path used during build")
  .option("--out-dir <path>", "Directory containing build artifacts")
  .option("--host <host>", "Host to bind the preview server", {
    default: "127.0.0.1",
  })
  .option("--port <port>", "Port to bind the preview server", {
    default: 4173,
  })
  .option("--config <path>", "Path to yom.config.ts")
  .action(async (options) => {
    await runConfigured("preview", options);
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
      basePath: options.basePath,
      config: options.siteConfig,
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
        ...(options.siteConfig?.open ? ["--open"] : []),
      ],
      {
        env: {
          YOM_ROOT: path.resolve(options.root),
          YOM_CONFIG: JSON.stringify(options.siteConfig),
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
      "--base",
      options.basePath,
      "--outDir",
      options.outDir,
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

async function runConfigured(
  command: Command,
  options: Record<string, unknown>,
): Promise<void> {
  const root = String(options.root ?? ".");
  const siteConfig = await loadYomConfig({
    cwd: process.cwd(),
    root: path.resolve(root),
    configPath: typeof options.config === "string" ? options.config : undefined,
  });
  if (typeof options.open === "boolean") {
    siteConfig.open = options.open;
  }
  await run({
    command,
    root,
    outDir: String(options.outDir ?? siteConfig.outDir),
    host: String(options.host ?? "127.0.0.1"),
    port: Number(options.port ?? 4173),
    basePath: String(options.base ?? siteConfig.basePath),
    siteConfig,
  });
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

    let forwardedSignal = false;
    const forwardSignal = (signal: NodeJS.Signals): void => {
      forwardedSignal = true;
      child.kill(signal);
    };
    const forwardInterrupt = (): void => forwardSignal("SIGINT");
    const forwardTermination = (): void => forwardSignal("SIGTERM");
    process.once("SIGINT", forwardInterrupt);
    process.once("SIGTERM", forwardTermination);

    const cleanup = (): void => {
      process.off("SIGINT", forwardInterrupt);
      process.off("SIGTERM", forwardTermination);
    };

    child.on("error", (error) => {
      cleanup();
      reject(error);
    });
    child.on("exit", (code, signal) => {
      cleanup();
      if (code === 0 || (forwardedSignal && signal !== null)) {
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
