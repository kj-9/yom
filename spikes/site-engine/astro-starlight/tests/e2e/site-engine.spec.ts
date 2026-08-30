import { expect, test, type Page } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fixtureRoot = path.join(root, "fixtures", "external-docs");
const rawFixture = path.join(fixtureRoot, "raw.md");
const liveFixture = path.join(fixtureRoot, "live.md");

function start(command: "dev" | "preview", port: number): ChildProcess {
  return spawn(
    process.execPath,
    [
      path.join(root, "node_modules", "astro", "bin", "astro.mjs"),
      command,
      "--host",
      "127.0.0.1",
      "--port",
      String(port)
    ],
    {
    cwd: root,
    detached: true,
    stdio: "pipe"
    }
  );
}

function stop(server: ChildProcess, port: number): void {
  if (!server.pid) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
  }

  // Astro's CLI starts a detached JSON-mode server. Stop that child by its
  // dedicated test port as well so this self-contained check leaves no server.
  try {
    const pids = execFileSync("lsof", ["-nP", "-tiTCP:" + port, "-sTCP:LISTEN"], {
      encoding: "utf8"
    });
    for (const pid of pids.trim().split("\n")) {
      if (pid) process.kill(Number(pid), "SIGTERM");
    }
  } catch {
    // The listener may already have stopped.
  }
}

async function waitFor(url: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError;
}

async function visitWhenReady(page: Page, url: string, text: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await page.goto(url);
      await expect(
        page.locator("main").getByText(text, { exact: false }).first()
      ).toBeVisible({ timeout: 750 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

test.describe("Astro + Starlight external docs spike", () => {
  test.describe.configure({ mode: "serial" });

  let devServer: ChildProcess;
  let originalRaw: string;

  test.beforeAll(async () => {
    originalRaw = await readFile(rawFixture, "utf8");
    devServer = start("dev", 4321);
    await waitFor("http://127.0.0.1:4321/");
  });

  test.afterAll(async () => {
    await writeFile(rawFixture, originalRaw);
    if (existsSync(liveFixture)) await rm(liveFixture);
    stop(devServer, 4321);
  });

  test("updates documents and generated navigation after add, change, and remove without restart", async ({ page }) => {
    await writeFile(liveFixture, "# Live document\n\nAdded body.\n");
    await visitWhenReady(page, "http://127.0.0.1:4321/live/", "Added body.");
    await expect(page.locator('a[href="/live/"]')).toBeVisible();

    await writeFile(rawFixture, "# Raw source document\n\nChanged body from the watcher.\n");
    await visitWhenReady(page, "http://127.0.0.1:4321/raw/", "Changed body from the watcher.");

    await rm(liveFixture);
    await visitWhenReady(page, "http://127.0.0.1:4321/", "External root title");
    await expect(page.locator('a[href="/live/"]')).toHaveCount(0);
    await page.goto("http://127.0.0.1:4321/live/");
    await expect(page.getByText("404", { exact: true })).toBeVisible();
  });

  test("switches between rendered Markdown and its raw source with one shallow override", async ({ page }) => {
    await writeFile(rawFixture, originalRaw);
    await visitWhenReady(page, "http://127.0.0.1:4321/raw/", "bold marker");
    await expect(page.locator("[data-rendered-content] strong")).toHaveText("bold marker");
    await expect(page.locator("[data-raw-source]")).toBeHidden();

    await page.getByRole("button", { name: "View source" }).click();
    await expect(page.locator("[data-rendered-content]")).toBeHidden();
    await expect(page.locator("[data-raw-source]")).toContainText("# Raw source document");
    await expect(page.getByRole("button", { name: "View rendered" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.getByRole("button", { name: "View rendered" }).click();
    await expect(page.locator("[data-rendered-content]")).toBeVisible();
    await expect(page.locator("[data-raw-source]")).toBeHidden();
    await expect(page.getByRole("button", { name: "View source" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  test("keeps H1 fallback, body, and document navigation readable without JavaScript", async ({ browser }) => {
    const build = start("preview", 4322);
    try {
      await waitFor("http://127.0.0.1:4322/");
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:4322/");
      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(page.locator("main h1")).toHaveText("External root title");

      await page.goto("http://127.0.0.1:4322/raw/");
      await expect(
        page
          .locator("[data-rendered-content]")
          .getByText("This rendered paragraph has a", { exact: false })
          .first()
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Nested document", exact: true })).toBeVisible();
      await context.close();
    } finally {
      stop(build, 4322);
    }
  });
});
