import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

import { cac } from "cac";
import { createServer, preview } from "vite";

import packageJson from "../../package.json" with { type: "json" };
import { loadYomConfig, type ResolvedYomConfig } from "../core/config.js";
import { createYomViteConfig } from "../dev/vite.js";
import { buildStaticSite } from "./build.js";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
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
  assertSupportedNodeVersion();
  await cli.parse(["node", "yom", ...argv], { run: true });
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
    const server = await createServer({
      ...createYomViteConfig({
        contentRoot: path.resolve(options.root),
        config: options.siteConfig,
      }),
      configFile: false,
      root: packageRoot,
      server: {
        host: options.host,
        port: options.port,
        open: options.siteConfig?.open ?? false,
      },
    });
    await server.listen();
    server.printUrls();
    await waitForShutdown(server.close);
    return;
  }

  const server = await preview({
    configFile: false,
    root: process.cwd(),
    base: options.basePath,
    build: { outDir: path.resolve(options.outDir) },
    preview: { host: options.host, port: options.port },
  });
  server.printUrls();
  await waitForShutdown(server.close);
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

  return /(?:^|\/)index\.(?:ts|js)$/u.test(entrypoint);
}

export function assertSupportedNodeVersion(
  version = process.versions.node,
): void {
  const [major = 0, minor = 0] = version.split(".").map(Number);
  if (major > 22 || (major === 22 && minor >= 12)) return;
  throw new Error(
    `yom requires Node.js >= 22.12.0 (found v${version}). Please upgrade Node.js and try again.`,
  );
}

async function waitForShutdown(close: () => Promise<void>): Promise<void> {
  await new Promise<void>((resolve) => {
    const stop = (): void => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      void close().finally(resolve);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
