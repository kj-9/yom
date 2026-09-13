import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
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
const stressPath = `z${"long-path-".repeat(12)}.md`;

test.beforeAll(async () => {
  callerRoot = await mkdtemp(path.join(tmpdir(), "yom-e2e-"));
  docsRoot = path.join(callerRoot, "docs");
  await mkdir(docsRoot, { recursive: true });
  await writeFile(path.join(docsRoot, "README.md"), markdown("Initial"));
  await writeFile(path.join(docsRoot, "second.md"), "# Second\n");
  await mkdir(path.join(docsRoot, "archive"), { recursive: true });
  await writeFile(path.join(docsRoot, "archive", "old.md"), "# Old\n");
  await writeFile(path.join(docsRoot, "pixel.svg"), svg("red"));
  await writeFile(
    path.join(docsRoot, stressPath),
    `# Long content

${"unbroken".repeat(80)}

\`\`\`text
${"long code ".repeat(50)}
\`\`\`

| ${"Heading".repeat(40)} | Column |
| --- | --- |
| Value | ${"Cell".repeat(80)} |

![pixel](pixel.svg)
`,
  );
  await writeFile(
    path.join(callerRoot, "vite.config.ts"),
    'throw new Error("caller vite config must not be loaded");\n',
  );
  await writeFile(
    path.join(callerRoot, "yom.config.ts"),
    `export default { order: ["README.md", "second.md", ${JSON.stringify(stressPath)}, "archive"] };\n`,
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

test("hydrates shared markup without refetching or replacing the document", async ({
  page,
}) => {
  for (const url of [baseUrl, `${previewUrl}docs/README.html`]) {
    const errors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (/hydrat|mismatch/i.test(message.text())) errors.push(message.text());
    });
    page.on("request", (request) => {
      if (/\/api\/doc|\/data\//.test(request.url()))
        requests.push(request.url());
    });
    await page.route(/\.(?:tsx?|js)(?:\?|$)/, (route) => route.abort());
    await page.goto(url);
    await expect(page.locator("#docRoot h1")).toHaveText("Initial");
    await page.unrouteAll();
    await page.addInitScript(() => {
      new MutationObserver((_, observer) => {
        const root = document.getElementById("docRoot");
        if (root) {
          window.initialDocumentRoot = root;
          observer.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.reload();
    await expect(page.locator("#docRoot h1")).toHaveText("Initial");
    await page.locator("#settingsToggle").click();
    await expect(page.getByRole("group", { name: "Theme" })).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Color palette" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => window.initialDocumentRoot === document.getElementById("docRoot"),
      ),
    ).toBe(true);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await page.locator(".settings-back").click();
    await page.getByRole("link", { name: "second.md" }).click();
    await expect(page.locator("#docRoot h1")).toHaveText("Second");
    await page.getByRole("button", { name: "Source" }).click();
    await expect(page.locator("#rawRoot")).toContainText("# Second");
    await page.goBack();
    await expect(page.locator("#rawRoot")).toContainText("# Initial");
  }
});

test("responsive navigation shares layouts and modal interactions in dev and static", async ({
  browser,
}, testInfo) => {
  test.setTimeout(60_000);
  const captures = new Map<number, Buffer>();
  for (const [mode, url] of [
    ["dev", baseUrl],
    ["static", previewUrl],
  ] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    await expect(page.locator("#docRoot h1")).toHaveText("Initial");
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 390, 899, 900, 1024, 1199, 1200, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        )
        .toBe(true);
      if (width < 900) {
        await expect(page.locator("#sidebar")).toBeHidden();
        await expect(page.locator("#navigationToggle")).toBeVisible();
      } else {
        await expect(page.locator("#sidebar")).toBeVisible();
        expect(
          await page
            .locator("#sidebar")
            .evaluate((sidebar) => sidebar.scrollWidth <= sidebar.clientWidth),
        ).toBe(true);
        await expect(page.locator("#navigationToggle")).toBeHidden();
      }
      if (width === 1440) {
        await expect(
          page.getByRole("complementary", { name: "On this page" }),
        ).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "Documents" }),
        ).toBeVisible();
      } else if (width < 1200)
        await expect(page.locator("#outlinePanel")).toBeHidden();
      if ([390, 1024, 1440].includes(width)) {
        const shot = await page.screenshot({
          path: testInfo.outputPath(`${mode}-${width}.png`),
          mask: [page.locator(".sidebar-meta")],
        });
        await testInfo.attach(`${mode}-${width}`, {
          body: shot,
          contentType: "image/png",
        });
        if (mode === "dev") captures.set(width, shot);
        else {
          expect(shot.equals(captures.get(width)!)).toBe(true);
          await page.screenshot({
            path: testInfo.outputPath(`preview-${width}.png`),
          });
        }
      }
    }
    await page.evaluate(() => localStorage.setItem("yom-sidebar-width", "560"));
    await page.reload();
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect
      .poll(
        async () => (await page.locator("#mainContent").boundingBox())!.width,
      )
      .toBeGreaterThanOrEqual(640);
    await expect(page.locator("#outlinePanel")).toBeHidden();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect
      .poll(async () => (await page.locator("#sidebar").boundingBox())!.width)
      .toBe(560);
    expect(
      await page.evaluate(() => localStorage.getItem("yom-sidebar-width")),
    ).toBe("560");
    await page.setViewportSize({ width: 390, height: 900 });
    const toggle = page.locator("#navigationToggle");
    const mainBox = await page.locator("#mainContent").boundingBox();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("dialog", { name: "Documents" })).toBeVisible();
    expect(
      await page
        .locator("#sidebar")
        .evaluate((sidebar) => sidebar.scrollWidth <= sidebar.clientWidth),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Close documents" }),
    ).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Close documents" }),
    ).toHaveText("Close documents");
    expect(await page.locator("#mainContent").boundingBox()).toEqual(mainBox);
    expect(
      await page
        .locator("#mainContent")
        .evaluate((element) => (element as HTMLElement).inert),
    ).toBe(true);
    expect(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
    ).toBe("hidden");
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(() => {
        const active = document.activeElement;
        return [
          active?.tagName,
          active?.className,
          active?.textContent?.trim(),
        ];
      }),
    ).toEqual(["SUMMARY", "settings-toggle", "Display settings"]);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Close documents" }),
    ).toBeFocused();
    const drawerShot = await page.locator("#sidebar").screenshot({
      path: testInfo.outputPath(`${mode}-drawer.png`),
      mask: [page.locator(".sidebar-meta")],
    });
    expect(drawerShot.byteLength).toBeGreaterThan(0);
    await page.locator("#settingsToggle").click();
    for (const theme of ["light", "dark"]) {
      await page.locator("#themeSelect").selectOption(theme);
      await expect(page.locator("body")).toHaveAttribute("data-theme", theme);
      for (const palette of ["paper", "forest", "sea", "sand", "rose"]) {
        await page.locator("#paletteSelect").selectOption(palette);
        await expect(page.locator("body")).toHaveAttribute(
          "data-palette",
          palette,
        );
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
      }
    }
    await page.locator("#themeSelect").selectOption("system");
    await page.locator("#paletteSelect").selectOption("paper");
    await page.locator(".settings-back").click();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      await page
        .locator("#mainContent")
        .evaluate((element) => (element as HTMLElement).inert),
    ).toBe(false);
    expect(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
    ).not.toBe("hidden");
    await toggle.click();
    await page
      .locator(".navigation-backdrop")
      .click({ position: { x: 380, y: 400 } });
    await expect(toggle).toBeFocused();
    await toggle.click();
    await page.getByRole("link", { name: "second.md" }).click();
    await expect(page.locator("#docRoot h1")).toHaveText("Second");
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".navigation-backdrop")).toBeHidden();
    expect(
      await page.evaluate(
        () => document.activeElement?.getClientRects().length,
      ),
    ).toBeGreaterThan(0);
    await page.setViewportSize({ width: 320, height: 900 });
    await toggle.click();
    await page.getByRole("link", { name: stressPath }).click();
    await expect(page.locator("#docRoot h1")).toHaveText("Long content");
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator("#docRoot pre")
        .evaluate((element) => element.scrollWidth > element.clientWidth),
    ).toBe(true);
    expect(
      await page
        .locator("#docRoot table")
        .evaluate((element) => element.scrollWidth > element.clientWidth),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 300));
    const beforeScroll = await page.evaluate(() => window.scrollY);
    expect(beforeScroll).toBeGreaterThan(0);
    await toggle.click();
    await page.mouse.move(310, 700);
    await page.mouse.wheel(0, 200);
    expect(await page.evaluate(() => window.scrollY)).toBe(beforeScroll);
    await page.getByRole("button", { name: "Close documents" }).click();
    await expect(toggle).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(beforeScroll);
    await context.close();
  }
});

test("updates an external Markdown tree without periodic DOM replacement", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(baseUrl);
  await expect(page.locator("#docRoot h1")).toHaveText("Initial");
  await expect(page.locator("#statusText")).toHaveText("Watching");
  await expect(page.locator("#rootLabel")).toHaveCount(0);
  await expect(page.locator("#documentTitle")).toHaveCount(0);
  await expect(page.locator("#frontMatter")).toBeVisible();
  await expect(page.locator("#frontMatterValues")).toContainText("title");
  await expect(page.locator("#frontMatterValues")).toContainText(
    "Initial guide",
  );
  await expect(page.locator("#outlinePanel")).toBeVisible();
  await expect(page.locator("#outlineList")).toContainText("Details");
  await expect(page.locator("#outlineList .outline-list")).toHaveCount(2);
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
  await expect(
    staticPage.locator(".reader-shell .content-panel"),
  ).toContainText("Initial");
  await expect(staticPage.locator(".reader-shell #outlineList")).toContainText(
    "Details",
  );

  await page.locator(".content-panel").evaluate((panel) => {
    (panel as HTMLElement).style.minHeight = "2000px";
  });
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  await expect(
    page.locator('#outlineList a[data-heading-id="example"]'),
  ).toHaveAttribute("aria-current", "location");
  await expect(
    page.locator('#outlineList li:has(> a[data-heading-id="initial"])'),
  ).toHaveClass(/outline-ancestor/u);
  await expect(
    page.locator('#outlineList li:has(> a[data-heading-id="details"])'),
  ).toHaveClass(/outline-ancestor/u);
  await page.locator('#outlineList a[data-heading-id="details"]').click();
  await expect(
    page.locator('#outlineList a[data-heading-id="details"]'),
  ).toHaveAttribute("aria-current", "location");
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

  await page.getByRole("button", { name: "Source" }).click();
  await expect(page.locator("#docRoot")).toBeHidden();
  await expect(page.locator("#rawRoot")).toContainText("# Initial");
  await expect(page.locator("#rawRoot")).toContainText("title: Initial guide");
  await expect(page.locator("#outlinePanel")).toBeHidden();
  await page.getByRole("button", { name: "Rendered" }).click();
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
      cardLeft: cardRect.left,
      cardRight: cardRect.right,
      cardPosition: getComputedStyle(card).position,
      cardScrollWidth: card.scrollWidth,
      cardWidth: card.clientWidth,
      sidebarLeft: sidebarRect.left,
      sidebarRight: sidebarRect.right,
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
  expect(settingsBounds.cardPosition).toBe("static");
  await expect(page.locator("#treeRoot")).toBeHidden();
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
  await page.locator(".settings-back").click();

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

  const idleRequests: string[] = [];
  const recordIdleRequest = (request: import("@playwright/test").Request) => {
    if (request.url().includes("/api/")) idleRequests.push(request.url());
  };
  page.on("request", recordIdleRequest);
  await page.waitForTimeout(2_200);
  page.off("request", recordIdleRequest);
  expect(idleRequests).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => window.yomMutationCount ?? 0))
    .toBe(0);

  await writeFile(path.join(docsRoot, "README.md"), markdown("Updated"));
  await expect(page.locator("#docRoot h1")).toHaveText("Updated");
  await expect
    .poll(() => page.evaluate(() => window.yomMutationCount ?? 0))
    .toBe(1);

  const unchangedResponse = page.waitForResponse(
    (response) => response.url() === `${baseUrl}/api/site`,
  );
  await page.waitForTimeout(500);
  await writeFile(path.join(docsRoot, "README.md"), `${markdown("Updated")}\n`);
  await unchangedResponse;
  expect(await page.evaluate(() => window.yomMutationCount)).toBe(1);

  await writeFile(
    path.join(docsRoot, "second.md"),
    "# Second\n\nA unique searchable phrase.\n",
  );
  await expect(page.locator("#treeRoot")).toContainText("second.md");

  await page.getByRole("link", { name: "second.md" }).click();
  await expect(page).toHaveURL(/\/docs\/second\.html$/u);
  await expect(page.locator("#docRoot h1")).toHaveText("Second");
  await expect(page.locator("#documentTitle")).toHaveCount(0);
  await page.getByRole("button", { name: "Source" }).click();
  await expect(page.locator("#documentTitle")).toHaveCount(0);
  await expect(page.locator("#rawRoot")).toContainText("# Second");
  await page.goBack();
  await expect(page.locator("#rawRoot")).toContainText("# Updated");
  await page.goForward();
  await expect(page.locator("#rawRoot")).toContainText("# Second");
  await page.getByRole("button", { name: "Rendered" }).click();
  await page.getByRole("link", { name: "README.md" }).click();
  await expect(page.locator("#docRoot h1")).toHaveText("Updated");

  await mkdir(path.join(docsRoot, "guides"), { recursive: true });
  await writeFile(path.join(docsRoot, "guides", "nested.md"), "# Nested\n");
  const guidesFolder = page.locator("summary.folder").filter({
    hasText: "guides",
  });
  await expect(guidesFolder).toBeVisible();
  await guidesFolder.click();
  await expect(page.getByRole("link", { name: "nested.md" })).toBeHidden();
  await guidesFolder.click();
  await expect(page.getByRole("link", { name: "nested.md" })).toBeVisible();

  await page.keyboard.press("/");
  await expect(page.locator("#treeSearch")).toBeFocused();
  await page.locator("#treeSearch").fill("unique searchable");
  await expect(page.locator("#treeRoot")).toContainText("second.md");
  await expect(page.locator("#treeRoot")).not.toContainText("README.md");
  await page.locator("#treeSearch").fill("");
  await expect(page.locator("#treeRoot")).toContainText("README.md");

  await page.locator("#treeSearch").blur();
  await expect(page.locator(".document-pagination")).toHaveCount(0);
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

  await page.evaluate(() => {
    window.beforeReconnect = document.getElementById("app");
  });
  await stopYom(child);
  await expect(page.locator("#statusText")).toHaveText("Reconnecting");
  await writeFile(path.join(docsRoot, "README.md"), markdown("Reconnected"));
  child = await startYom();
  await expect(page.locator("#docRoot h1")).toHaveText("Reconnected");
  await expect(page.locator("#statusText")).toHaveText("Watching");
  expect(
    await page.evaluate(
      () => window.beforeReconnect === document.getElementById("app"),
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);

  await expect(page.locator(".document-pagination")).toHaveCount(0);
  const deletionRefresh = page.waitForResponse(async (response) => {
    if (response.url() !== `${baseUrl}/api/site` || !response.ok()) {
      return false;
    }
    const snapshot = (await response.json()) as {
      documents: { path: string }[];
    };
    return !snapshot.documents.some(
      (document) => document.path === "README.md",
    );
  });
  await rm(path.join(docsRoot, "README.md"));
  await deletionRefresh;
  expect(pageErrors).toEqual([]);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const response = await fetch("/api/site", { cache: "no-store" });
        const snapshot = (await response.json()) as {
          documents: { path: string }[];
        };
        return snapshot.documents.map((document) => document.path).sort();
      }),
    )
    .toEqual(["archive/old.md", "guides/nested.md", "second.md", stressPath]);
  await expect(page.locator("#treeRoot")).not.toContainText("README.md");
  await expect(page.locator("#docRoot h1")).toHaveText("Second");
  await expect(page).toHaveURL(/\/docs\/second\.html$/u);
});

test("reads prerendered static documents without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto(`${previewUrl}docs/README.html`);
    await expect(page.locator("#docRoot h1")).toHaveText("Initial");
    await expect(page.locator("#treeRoot")).toContainText("README.md");
    await expect(page.locator('#treeRoot [role="button"]')).toHaveCount(0);
    expect(
      await page
        .locator("#treeRoot .tree")
        .first()
        .evaluate((tree) => getComputedStyle(tree).listStyleType),
    ).toBe("none");
    expect(
      await page
        .locator("#treeRoot .tree-item")
        .first()
        .evaluate((item) => getComputedStyle(item, "::marker").content),
    ).toBe('""');
    const archive = page.locator("summary.folder").filter({
      hasText: "archive",
    });
    await expect(archive).toBeVisible();
    await expect(page.getByRole("link", { name: "old.md" })).toBeHidden();
    await archive.click();
    await page.getByRole("link", { name: "old.md" }).click();
    await expect(page).toHaveURL(`${previewUrl}docs/archive/old.html`);
    await expect(page.locator("#docRoot h1")).toHaveText("Old");
    await page.goto(`${previewUrl}docs/README.html`);
    await expect(page.locator("#outlinePanel")).toContainText("Details");
    await expect(page.locator(".document-pagination")).toHaveCount(0);
    await page.getByRole("link", { name: "second.md" }).click();
    await expect(page).toHaveURL(`${previewUrl}docs/second.html`);
    await expect(page.locator("#docRoot h1")).toHaveText("Second");
    await expect(page.locator(".document-pagination")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

function markdown(title: string): string {
  return `---\ntitle: ${title} guide\ntags: [e2e, markdown]\n---\n# ${title}\n\n![pixel](pixel.svg)\n\n## Details\n\n[Jump to details](README.md#details)\n\n### Example\n\nNested outline content.\n\n\`\`\`ts\nconst message = "fenced code";\n\`\`\`\n`;
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
    initialDocumentRoot?: HTMLElement;
    beforeReconnect?: HTMLElement | null;
    yomMutationCount?: number;
  }
}
