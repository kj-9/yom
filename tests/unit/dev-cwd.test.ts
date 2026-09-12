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
      expect.arrayContaining(["bin", "index.html", "lib", "src/site"]),
    );
  });

  it("uses yom's Vite config instead of the caller project's config", async () => {
    const callerRoot = createTempRoot();
    const docsRoot = path.join(callerRoot, "docs");
    await mkdir(docsRoot);
    await writeFile(path.join(docsRoot, "README.md"), "# Isolated docs\n");
    await mkdir(path.join(docsRoot, "guides"));
    await writeFile(
      path.join(docsRoot, "guides", "nested.md"),
      "# Nested $& guide\n",
    );
    await writeFile(
      path.join(callerRoot, "vite.config.ts"),
      'throw new Error("caller vite config must not be loaded");\n',
    );
    await writeFile(
      path.join(callerRoot, "yom.config.ts"),
      'export default { title: "Caller docs", lang: "ja" };\n',
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
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const html = await response.text();

    expect(output).toContain(`http://127.0.0.1:${port}/`);
    expect(output).not.toContain("caller vite config must not be loaded");
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain("<title>Caller docs</title>");
    expect(html).toContain('id="docRoot"');
    expect(html).toContain('aria-label="Documents"');
    expect(html).toContain('aria-label="On this page"');
    const payload = JSON.parse(
      html.match(
        /<script id="yom-config" type="application\/json">([\s\S]*?)<\/script>/u,
      )![1],
    );
    expect(payload.documentPath).toBe("guides/nested.md");
    expect(html).toContain("Nested $&amp; guide");
    const direct = await fetch(`http://127.0.0.1:${port}/docs/README.html`);
    const directHtml = await direct.text();
    expect(directHtml).toContain('"documentPath":"README.md"');
    expect(directHtml).toContain('id="isolated-docs"');
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

  it("prints and serves the automatically selected port when the requested port is busy", async () => {
    const callerRoot = createTempRoot();
    await writeFile(path.join(callerRoot, "README.md"), "# Port fallback\n");
    const requestedPort = await findOpenPort();
    const blocker = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(requestedPort, "127.0.0.1", resolve);
    });

    try {
      const repoRoot = path.resolve(process.cwd());
      const child = spawn(
        "bun",
        [
          "run",
          path.join(repoRoot, "bin/yom"),
          "dev",
          "--root",
          callerRoot,
          "--host",
          "127.0.0.1",
          "--port",
          String(requestedPort),
        ],
        {
          cwd: callerRoot,
          env: { ...process.env, FORCE_COLOR: "0" },
        },
      );
      children.push(child);

      const output = await waitForDevServer(child);
      const url = output.match(/Local:\s+(http:\/\/[^\s]+)/u)?.[1];
      expect(url).toBeDefined();
      expect(url).not.toContain(`:${requestedPort}/`);
      const response = await fetch(url!);
      expect(response.ok).toBe(true);
      expect(await response.text()).toContain("Port fallback");
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
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
      const normalized = stripAnsi(output);
      if (normalized.includes("Local:")) {
        clearTimeout(timeout);
        resolve(normalized);
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (stripAnsi(output).includes("Local:")) {
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

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/gu, "");
}
