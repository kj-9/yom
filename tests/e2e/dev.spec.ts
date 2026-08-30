import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

let child: ChildProcessWithoutNullStreams;
let callerRoot: string;
let docsRoot: string;
let baseUrl: string;
let port: number;
let preview: ChildProcessWithoutNullStreams;
let previewUrl: string;

test.beforeAll(async () => {
  callerRoot = await mkdtemp(path.join(tmpdir(), "yom-e2e-"));
  docsRoot = path.join(callerRoot, "docs");
  await mkdir(docsRoot, { recursive: true });
  await writeFile(path.join(docsRoot, "README.md"), markdown("Initial"));
  await writeFile(path.join(docsRoot, "pixel.svg"), svg("red"));
  await writeFile(
    path.join(callerRoot, "vite.config.ts"),
    'throw new Error("caller vite config must not be loaded");\n',
  );

  const build = spawnSync(
    "bun",
    [
      "run",
      path.resolve("bin/yom"),
      "build",
      "--root",
      docsRoot,
      "--out-dir",
      path.join(callerRoot, "dist"),
      "--base",
      "/site/",
    ],
    { cwd: callerRoot, encoding: "utf-8", env: { ...process.env } },
  );
  if (build.status !== 0) {
    throw new Error(`static build failed\n${build.stdout}\n${build.stderr}`);
  }

  port = await findOpenPort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = await startYom();
  const previewPort = await findOpenPort();
  previewUrl = `http://127.0.0.1:${previewPort}/site/`;
  preview = spawn(
    "bun",
    [
      "run",
      path.resolve("bin/yom"),
      "preview",
      "--port",
      String(previewPort),
      "--base",
      "/site/",
    ],
    { cwd: callerRoot, env: { ...process.env, FORCE_COLOR: "0" } },
  );
  await waitForServer(preview, previewUrl);
});

async function startYom(): Promise<ChildProcessWithoutNullStreams> {
  const serverProcess = spawn(
    "bun",
    [
      "run",
      path.resolve("bin/yom"),
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
      env: { ...globalThis.process.env, FORCE_COLOR: "0" },
    },
  );
  await waitForServer(serverProcess, `${baseUrl}/api/tree`);
  return serverProcess;
}

test.afterAll(async () => {
  if (child !== undefined) {
    await stopYom(child);
  }
  if (preview !== undefined) {
    await stopYom(preview);
  }
  if (callerRoot !== undefined) {
    await rm(callerRoot, { recursive: true, force: true });
  }
});

test("updates an external Markdown tree without periodic DOM replacement", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(baseUrl);
  await expect(page.locator("#docRoot h1")).toHaveText("Initial");
  await expect(page.locator("#statusText")).toHaveText("Watching");
  await expect(page.locator("#rootLabel")).toHaveCount(0);
  await expect(page.locator("#documentTitle")).toHaveText("Initial guide");
  await expect(page.locator("#frontMatter")).toBeVisible();
  await expect(page.locator("#frontMatterValues")).toContainText("title");
  await expect(page.locator("#frontMatterValues")).toContainText(
    "Initial guide",
  );
  await expect(page.locator("#outlinePanel")).toBeVisible();
  await expect(page.locator("#outlineList")).toContainText("Details");
  await expect(page.locator("html")).toHaveAttribute("lang", "und");
  await expect
    .poll(() =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.includes("mermaid")),
      ),
    )
    .toBe(false);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);

  const staticPage = await page.context().newPage();
  await staticPage.goto(previewUrl);
  await expect(staticPage.locator("#docRoot h1")).toHaveText("Initial");
  await expect(staticPage.locator("html")).toHaveAttribute("lang", "und");
  await Promise.all([
    page.evaluate(() => document.fonts.ready),
    staticPage.evaluate(() => document.fonts.ready),
  ]);
  await page.locator("#outlineList a").first().click();
  await staticPage.locator("#outlineList a").first().click();
  await expect(page.locator("#outlineList a").first()).toHaveClass(/active/u);
  await expect(staticPage.locator("#outlineList a").first()).toHaveClass(
    /active/u,
  );
  const devScreenshot = await page.locator(".reader-shell").screenshot({
    animations: "disabled",
  });
  const staticScreenshot = await staticPage
    .locator(".reader-shell")
    .screenshot({
      animations: "disabled",
    });
  expect(createHash("sha256").update(staticScreenshot).digest("hex")).toBe(
    createHash("sha256").update(devScreenshot).digest("hex"),
  );

  await page.locator(".content-panel").evaluate((panel) => {
    (panel as HTMLElement).style.minHeight = "2000px";
  });
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  await page.locator('#outlineList a[data-heading-id="details"]').click();
  await expect
    .poll(() =>
      page
        .locator("#details")
        .evaluate((heading) => heading.getBoundingClientRect().top),
    )
    .toBeLessThanOrEqual(1);
  await expect(page).toHaveURL(/#details$/u);
  await expect
    .poll(() =>
      page
        .locator("#outlinePanel")
        .evaluate((panel) => panel.getBoundingClientRect().top),
    )
    .toBe(24);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator(".content-panel").evaluate((panel) => {
    (panel as HTMLElement).style.minHeight = "";
  });

  await page.locator("#rawMode").click();
  await expect(page.locator("#docRoot")).toBeHidden();
  await expect(page.locator("#rawRoot")).toContainText("# Initial");
  await expect(page.locator("#rawRoot")).toContainText("title: Initial guide");
  await expect(page.locator("#outlinePanel")).toBeHidden();
  await page.locator("#renderedMode").click();
  await expect(page.locator("#docRoot h1")).toHaveText("Initial");
  await expect(page.locator("#outlinePanel")).toBeVisible();

  const resizer = page.locator("#sidebarResizer");
  const resizerBounds = await resizer.boundingBox();
  if (resizerBounds === null) throw new Error("sidebar resizer missing");
  await page.mouse.move(
    resizerBounds.x + resizerBounds.width / 2,
    resizerBounds.y + resizerBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(320, resizerBounds.y + resizerBounds.height / 2);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("yom-sidebar-width")))
    .toBe("320");

  await page.locator("#settingsToggle").click();
  const settingsBounds = await page.locator("#sidebar").evaluate((sidebar) => {
    const card = document.querySelector(".settings-card");
    if (!(card instanceof HTMLElement))
      throw new Error("settings card missing");
    const sidebarRect = sidebar.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      cardBottom: cardRect.bottom,
      cardLeft: cardRect.left,
      cardRight: cardRect.right,
      cardScrollWidth: card.scrollWidth,
      cardWidth: card.clientWidth,
      sidebarLeft: sidebarRect.left,
      sidebarRight: sidebarRect.right,
      viewportHeight: window.innerHeight,
    };
  });
  expect(settingsBounds.cardLeft).toBeGreaterThanOrEqual(
    settingsBounds.sidebarLeft,
  );
  expect(settingsBounds.cardRight).toBeLessThanOrEqual(
    settingsBounds.sidebarRight,
  );
  expect(settingsBounds.cardScrollWidth).toBeLessThanOrEqual(
    settingsBounds.cardWidth,
  );
  expect(settingsBounds.cardBottom).toBeLessThanOrEqual(
    settingsBounds.viewportHeight,
  );
  await page.locator("#themeSelect").selectOption("dark");
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
  await page.locator("#fontSizeSelect").selectOption("large");
  await page.locator("#contentWidthSelect").selectOption("wide");
  await expect(page.locator("body")).toHaveAttribute("data-font-size", "large");
  await expect(page.locator("body")).toHaveAttribute(
    "data-content-width",
    "wide",
  );
  await page.locator("#outlineToggle").uncheck();
  await expect(page.locator("body")).toHaveAttribute("data-outline", "hidden");
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveAttribute("data-font-size", "large");
  await expect(page.locator("body")).toHaveAttribute(
    "data-content-width",
    "wide",
  );
  await expect(page.locator("body")).toHaveAttribute("data-outline", "hidden");
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue(
          "--sidebar-width",
        ),
      ),
    )
    .toBe("320px");
  await page.locator("#settingsToggle").click();
  await page.locator("#resetDisplaySettings").click();
  await expect(page.locator("#themeSelect")).toHaveValue("system");
  await expect(page.locator("body")).toHaveAttribute(
    "data-font-size",
    "medium",
  );
  await expect(page.locator("body")).toHaveAttribute(
    "data-content-width",
    "comfortable",
  );
  await expect(page.locator("body")).toHaveAttribute("data-outline", "visible");
  await page.locator("#settingsToggle").click();

  await staticPage.getByRole("button", { name: "Copy code block" }).click();
  await expect(
    staticPage.getByRole("button", { name: "Copy code block" }),
  ).toHaveText("Copied");
  await staticPage
    .getByRole("button", { name: "Copy link to Details" })
    .click();
  await expect(staticPage).toHaveURL(/#details$/u);
  await staticPage.getByRole("link", { name: "Jump to details" }).click();
  await expect(staticPage).toHaveURL(`${previewUrl}?path=README.md#details`);
  await expect(
    staticPage.locator('#outlineList a[data-heading-id="details"]'),
  ).toHaveClass(/active/u);
  await staticPage
    .getByRole("searchbox", { name: "Filter" })
    .fill("fenced code");
  await expect(staticPage.locator("#treeRoot")).toContainText("README.md");
  await staticPage.emulateMedia({ media: "print" });
  await expect(staticPage.locator("#sidebar")).toBeHidden();
  await staticPage.emulateMedia({ media: "screen" });
  await staticPage.goto(`${previewUrl}404.html`);
  await expect(staticPage.locator("#docRoot")).toHaveText("Page not found.");
  await staticPage.close();

  await page.locator("#docRoot").evaluate((root) => {
    const pageWindow = window as typeof window & { yomMutationCount?: number };
    pageWindow.yomMutationCount = 0;
    new MutationObserver(() => {
      pageWindow.yomMutationCount = (pageWindow.yomMutationCount ?? 0) + 1;
    }).observe(root, { childList: true, subtree: true });
  });

  await page.waitForTimeout(2_200);
  await expect
    .poll(() => page.evaluate(() => window.yomMutationCount ?? 0))
    .toBe(0);

  await writeFile(path.join(docsRoot, "README.md"), markdown("Updated"));
  await expect(page.locator("#docRoot h1")).toHaveText("Updated");
  await expect
    .poll(() => page.evaluate(() => window.yomMutationCount ?? 0))
    .toBe(1);

  await writeFile(
    path.join(docsRoot, "second.md"),
    "# Second\n\nA unique searchable phrase.\n",
  );
  await expect(page.locator("#treeRoot")).toContainText("second.md");

  await mkdir(path.join(docsRoot, "guides"), { recursive: true });
  await writeFile(path.join(docsRoot, "guides", "nested.md"), "# Nested\n");
  const guidesFolder = page.locator("button.folder").filter({
    hasText: "guides",
  });
  await expect(guidesFolder).toBeVisible();
  await guidesFolder.click();
  await expect(page.getByRole("button", { name: "nested.md" })).toBeHidden();
  await guidesFolder.click();
  await expect(page.getByRole("button", { name: "nested.md" })).toBeVisible();

  await page.keyboard.press("/");
  await expect(page.locator("#treeSearch")).toBeFocused();
  await page.locator("#treeSearch").fill("unique searchable");
  await expect(page.locator("#treeRoot")).toContainText("second.md");
  await expect(page.locator("#treeRoot")).not.toContainText("README.md");
  await page.locator("#treeSearch").fill("");
  await expect(page.locator("#treeRoot")).toContainText("README.md");

  await page.locator("#treeSearch").blur();
  await expect(page.locator("#nextDocument")).toHaveAttribute(
    "data-path",
    "second.md",
  );
  await page.evaluate(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "]" }),
    );
  });
  await expect(page.locator("#docRoot h1")).toHaveText("Second");
  await page.evaluate(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "[" }),
    );
  });
  await expect(page.locator("#docRoot h1")).toHaveText("Updated");

  await writeFile(path.join(docsRoot, "pixel.svg"), svg("blue"));
  await expect(page.locator('#docRoot img[alt="pixel"]')).toHaveAttribute(
    "src",
    /[?&]v=\d+/u,
  );

  await stopYom(child);
  await expect(page.locator("#statusText")).toHaveText("Reconnecting");
  await writeFile(path.join(docsRoot, "README.md"), markdown("Reconnected"));
  child = await startYom();
  await expect(page.locator("#docRoot h1")).toHaveText("Reconnected");
  await expect(page.locator("#statusText")).toHaveText(/Watching|README\.md/u);

  await rm(path.join(docsRoot, "README.md"));
  await expect(page.locator("#docRoot h1")).toHaveText("Second");
  await expect(page.locator("#treeRoot")).not.toContainText("README.md");
});

function markdown(title: string): string {
  return `---\ntitle: ${title} guide\ntags: [e2e, markdown]\n---\n# ${title}\n\n![pixel](pixel.svg)\n\n## Details\n\n[Jump to details](README.md#details)\n\n\`\`\`ts\nconst message = "fenced code";\n\`\`\`\n`;
}

async function stopYom(process: ChildProcessWithoutNullStreams): Promise<void> {
  if (process.exitCode !== null) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("timed out stopping yom"));
    }, 5_000);
    process.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    process.kill("SIGTERM");
  });
}

function svg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="${color}"/></svg>`;
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

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (process.exitCode !== null) {
      throw new Error(`yom exited before startup\n${output}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for yom\n${output}`);
}

declare global {
  interface Window {
    yomMutationCount?: number;
  }
}
