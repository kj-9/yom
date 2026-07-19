import { mkdir, writeFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import packageJson from "../../package.json" with { type: "json" };

const tempRoots: string[] = [];
const children: ChildProcessWithoutNullStreams[] = [];

afterEach(() => {
  for (const child of children.splice(0)) {
    if (!child.killed) {
      child.kill();
    }
  }

  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Vite cwd isolation", () => {
  it("ships the runtime files needed by dev and preview", () => {
    expect(packageJson.files).toEqual(
      expect.arrayContaining(["bin", "index.html", "src", "vite.config.ts"]),
    );
  });

  it("uses yom's Vite config instead of the caller project's config", async () => {
    const callerRoot = createTempRoot();
    const docsRoot = path.join(callerRoot, "docs");
    await mkdir(docsRoot);
    await writeFile(path.join(docsRoot, "README.md"), "# Isolated docs\n");
    await writeFile(
      path.join(callerRoot, "vite.config.ts"),
      'throw new Error("caller vite config must not be loaded");\n',
    );

    const repoRoot = path.resolve(process.cwd());
    const port = await findOpenPort();
    const child = spawn(
      "bun",
      [
        "run",
        path.join(repoRoot, "bin/yom"),
        "dev",
        "--root",
        docsRoot,
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: callerRoot,
        env: {
          ...process.env,
          FORCE_COLOR: "0",
        },
      },
    );
    children.push(child);

    const output = await waitForDevServer(child);

    expect(output).toContain(`http://127.0.0.1:${port}/`);
    expect(output).not.toContain("caller vite config must not be loaded");
  }, 15_000);

  it("previews the caller project's dist without loading its Vite config", async () => {
    const callerRoot = createTempRoot();
    const distRoot = path.join(callerRoot, "dist");
    await mkdir(distRoot);
    await writeFile(
      path.join(distRoot, "index.html"),
      "<!doctype html><p>caller preview dist</p>",
    );
    await writeFile(
      path.join(callerRoot, "vite.config.ts"),
      'throw new Error("caller vite config must not be loaded");\n',
    );

    const repoRoot = path.resolve(process.cwd());
    const port = await findOpenPort();
    const child = spawn(
      "bun",
      [
        "run",
        path.join(repoRoot, "bin/yom"),
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: callerRoot,
        env: {
          ...process.env,
          FORCE_COLOR: "0",
        },
      },
    );
    children.push(child);

    const output = await waitForDevServer(child);
    const response = await fetch(`http://127.0.0.1:${port}/`);

    expect(output).toContain(`http://127.0.0.1:${port}/`);
    expect(output).not.toContain("caller vite config must not be loaded");
    expect(await response.text()).toContain("caller preview dist");
  }, 15_000);
});

function createTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "yom-dev-cwd-"));
  tempRoots.push(root);
  return root;
}

async function findOpenPort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("failed to allocate test port"));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function waitForDevServer(
  child: ChildProcessWithoutNullStreams,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => {
      reject(new Error(`timed out waiting for Vite startup\n${output}`));
    }, 10_000);

    const onData = (chunk: Buffer) => {
      output += chunk.toString("utf-8");
      if (output.includes("Local:")) {
        clearTimeout(timeout);
        resolve(output);
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (output.includes("Local:")) {
        return;
      }
      clearTimeout(timeout);
      reject(
        new Error(
          `Vite exited before startup with code ${code ?? "unknown"} and signal ${
            signal ?? "unknown"
          }\n${output}`,
        ),
      );
    });
  });
}
