import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

let tempRoot: string;
let installRoot: string;
let executable: string;

beforeAll(async () => {
  tempRoot = await mkdtemp(path.join(tmpdir(), "yom-package-"));
  const packRoot = path.join(tempRoot, "pack");
  installRoot = path.join(tempRoot, "consumer");
  await mkdir(packRoot);
  await mkdir(path.join(tempRoot, "tmp"));
  await mkdir(path.join(installRoot, "docs"), { recursive: true });
  await writeFile(
    path.join(installRoot, "docs", "README.md"),
    "# Packed yom\n",
  );

  const packed = run("npm", [
    "pack",
    path.resolve("."),
    "--json",
    "--pack-destination",
    packRoot,
  ]);
  const entries = JSON.parse(packed.stdout) as Array<{
    filename: string;
    files: Array<{ path: string }>;
  }>;
  const packageInfo = entries[0];
  expect(packageInfo.files.map((file) => file.path)).toEqual(
    expect.arrayContaining([
      "bin/yom",
      "index.html",
      "lib/cli/index.js",
      "lib/core/config.js",
      "src/site/main.ts",
    ]),
  );

  const tarball = path.join(packRoot, packageInfo.filename);
  await writeFile(
    path.join(installRoot, "package.json"),
    JSON.stringify({
      private: true,
      dependencies: { "@kj-9/yom": `file:${tarball}` },
    }),
  );
  run("bun", ["install", "--offline"], installRoot);
  executable = path.join(installRoot, "node_modules", ".bin", "yom");
  await writeFile(
    path.join(installRoot, "yom.config.ts"),
    'import { defineConfig } from "@kj-9/yom";\nexport default defineConfig({ title: "Packed docs", lang: "ja", outDir: "packed-dist" });\n',
  );
}, 30_000);

afterAll(async () => {
  if (tempRoot !== undefined) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

describe("packed CLI", () => {
  it("runs help and builds from an installed tarball", async () => {
    const help = run(executable, ["--help"], installRoot);
    expect(help.stdout).toContain("$ yom <command> [options]");

    run(executable, ["build", "--root", "docs"], installRoot);
    const built = await stat(
      path.join(installRoot, "packed-dist", "docs", "README.html"),
    );
    expect(built.size).toBeGreaterThan(0);
    const index = await readFile(
      path.join(installRoot, "packed-dist", "index.html"),
      "utf-8",
    );
    expect(index).toContain('<html lang="ja">');
    expect(index).toContain("<title>Packed docs</title>");
  }, 15_000);

  it("runs dev and preview from an installed tarball", async () => {
    const devPort = await findOpenPort();
    const dev = start(["dev", "--root", "docs", "--port", String(devPort)]);
    try {
      await waitForServer(dev, `http://127.0.0.1:${devPort}/api/tree`);
      const response = await fetch(
        `http://127.0.0.1:${devPort}/api/doc?path=README.md`,
      );
      expect(await response.text()).toContain("Packed yom");
    } finally {
      await stop(dev);
    }

    const previewPort = await findOpenPort();
    const preview = start(["preview", "--port", String(previewPort)]);
    try {
      await waitForServer(preview, `http://127.0.0.1:${previewPort}/`);
      const response = await fetch(
        `http://127.0.0.1:${previewPort}/docs/README.html`,
      );
      expect(await response.text()).toContain('"initialPath":"README.md"');
      const payload = await fetch(
        `http://127.0.0.1:${previewPort}/data/README.md.json`,
      );
      expect(await payload.text()).toContain("Packed yom");
    } finally {
      await stop(preview);
    }
  });
});

function run(command: string, args: string[], cwd = path.resolve(".")) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      NO_UPDATE_NOTIFIER: "1",
      TMPDIR: path.join(tempRoot, "tmp"),
      npm_config_cache: path.join(tempRoot, "npm-cache"),
      npm_config_update_notifier: "false",
    },
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}

function start(args: string[]): ChildProcessWithoutNullStreams {
  return spawn(executable, args, {
    cwd: installRoot,
    env: { ...process.env, FORCE_COLOR: "0" },
  });
}

async function findOpenPort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("failed to allocate port"));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(
  process: ChildProcessWithoutNullStreams,
  url: string,
): Promise<void> {
  let output = "";
  process.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf-8");
  });
  process.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf-8");
  });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (process.exitCode !== null) {
      throw new Error(`server exited\n${output}`);
    }
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start\n${output}`);
}

async function stop(process: ChildProcessWithoutNullStreams): Promise<void> {
  if (process.exitCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("server did not stop")),
      5_000,
    );
    process.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    process.kill("SIGTERM");
  });
}
