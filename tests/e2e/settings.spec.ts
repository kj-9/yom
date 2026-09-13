import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { tmpdir } from "node:os";
import { pngDifference } from "./png";

let fixture: string;
const servers: ChildProcessWithoutNullStreams[] = [];
const urls: string[] = [];
const bin = path.resolve("bin/yom");

test.beforeAll(async () => {
  fixture = await mkdtemp(path.join(tmpdir(), "yom-settings-"));
  await mkdir(path.join(fixture, "docs"));
  await writeFile(
    path.join(fixture, "docs", "README.md"),
    `# Settings guide\n\n${"A paragraph for scrolling.\n\n".repeat(60)}`,
  );
  await writeFile(
    path.join(fixture, "yom.config.ts"),
    'export default { theme: "dark", palette: "forest", fontSize: "large", contentWidth: "wide", outline: false };\n',
  );
  const build = spawnSync("bun", ["run", bin, "build", "--root", "docs"], {
    cwd: fixture,
    encoding: "utf-8",
  });
  if (build.status !== 0) throw new Error(build.stdout + build.stderr);
  for (const command of ["dev", "preview"]) {
    const port = await freePort();
    const server = spawn(
      "bun",
      [
        "run",
        bin,
        command,
        ...(command === "dev" ? ["--root", "docs"] : []),
        "--port",
        String(port),
      ],
      { cwd: fixture },
    );
    servers.push(server);
    const url = `http://127.0.0.1:${port}`;
    let output = "";
    server.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    server.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(output);
      try {
        if ((await fetch(url)).ok) {
          urls.push(url);
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!urls.includes(url)) throw new Error(`server did not start: ${output}`);
  }
});

test.afterAll(async () => {
  for (const server of servers) {
    if (server.exitCode !== null) continue;
    await new Promise<void>((resolve) => {
      server.once("exit", () => resolve());
      server.kill("SIGTERM");
    });
  }
  if (fixture) await rm(fixture, { recursive: true, force: true });
});

test("display settings stay in bounds and preserve site defaults", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  const screenshots = new Map<string, Buffer>();
  for (const [mode, url] of urls.entries()) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await expect(page.locator("#docRoot h1")).toHaveText("Settings guide");
    await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveAttribute(
      "data-font-size",
      "large",
    );
    const largeHeadingSize = await page
      .locator("#docRoot h1")
      .evaluate((heading) =>
        Number.parseFloat(getComputedStyle(heading).fontSize),
      );
    const trigger = page.locator("#settingsToggle");
    const card = page.locator(".settings-card");
    const textSize = page.locator(".segmented-setting").filter({
      has: page.getByText("Text size", { exact: true }),
    });
    await trigger.click();
    await textSize.getByRole("button", { name: "S", exact: true }).click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-font-size",
      "small",
    );
    const smallHeadingSize = await page
      .locator("#docRoot h1")
      .evaluate((heading) =>
        Number.parseFloat(getComputedStyle(heading).fontSize),
      );
    expect(smallHeadingSize).toBeLessThan(largeHeadingSize);
    await textSize.getByRole("button", { name: "L", exact: true }).click();
    await page.locator(".settings-back").click();
    for (const [width, height] of [
      [320, 568],
      [390, 320],
      [1024, 600],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      if (width < 900) await page.locator("#navigationToggle").click();
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(card).toBeVisible();
      await expect(page.locator("#treeSearch")).toBeHidden();
      await expect(page.locator("#treeRoot")).toBeHidden();
      expect(
        await card.evaluate((element) => getComputedStyle(element).position),
      ).toBe("static");
      expect(
        await card.evaluate((element) => {
          const parent = element.closest("#sidebar");
          if (!(parent instanceof HTMLElement)) return false;
          const cardRect = element.getBoundingClientRect();
          const sidebarRect = parent.getBoundingClientRect();
          return (
            cardRect.left >= sidebarRect.left &&
            cardRect.right <= sidebarRect.right
          );
        }),
      ).toBe(true);
      expect(
        await page
          .locator(".settings-control")
          .evaluateAll((controls) =>
            controls.every(
              (control, index) =>
                index === 0 ||
                control.getBoundingClientRect().top >=
                  controls[index - 1]!.getBoundingClientRect().bottom,
            ),
          ),
      ).toBe(true);
      expect(
        await card.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      await page.evaluate(() => document.fonts.ready);
      const key = `${width}-${height}`;
      await page.mouse.move(width - 1, height - 1);
      const shot = await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath(`${mode}-${key}.png`),
        mask: [page.locator(".sidebar-meta")],
      });
      if (mode === 0) screenshots.set(key, shot);
      else {
        const difference = pngDifference(shot, screenshots.get(key)!);
        expect(difference.maxChannelDelta).toBeLessThanOrEqual(1);
        expect(difference.differingPixelRatio).toBeLessThanOrEqual(0.000_05);
      }
      for (const theme of ["light", "dark"]) {
        await page.locator("#themeSelect").selectOption(theme);
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
      await page.locator("#resetDisplaySettings").click();
      await expect(page.locator("#themeSelect")).toHaveValue("dark");
      await expect(page.locator("#paletteSelect")).toHaveValue("forest");
      await expect(page.locator("#fontSizeSelect")).toHaveValue("large");
      await expect(page.locator("#contentWidthSelect")).toHaveValue("wide");
      await expect(page.locator("#outlineToggle")).not.toBeChecked();
      await page.keyboard.press("Escape");
      await expect(card).toBeHidden();
      await expect(trigger).toBeFocused();
      if (width < 900) {
        await expect(page.locator("#navigationToggle")).toHaveAttribute(
          "aria-expanded",
          "true",
        );
        await page.keyboard.press("Escape");
        await expect(page.locator("#navigationToggle")).toBeFocused();
      }
    }
    await trigger.click();
    await page.locator("#themeSelect").selectOption("light");
    await page.locator(".settings-back").click();
    await expect(trigger).toBeFocused();
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
    await trigger.click();
    await page.locator("#resetDisplaySettings").click();
    await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
    await page.locator("#docRoot h1").click();
    await expect(card).toBeVisible();
    await page.locator("#resetDisplaySettings").focus();
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.locator("#themeSelect").selectOption("system");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
    expect(errors).toEqual([]);
    await context.close();
  }
});

test("display settings prerender uses site defaults and preserves static entry pages", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(urls[1]);
  await expect(page.locator("#docRoot h1")).toHaveText("Settings guide");
  await expect(page.locator("#themeSelect")).toHaveValue("dark");
  await expect(page.locator("#fontSizeSelect")).toHaveValue("large");
  await page.goto(`${urls[1]}/404.html`);
  await expect(page.locator("#docRoot")).toHaveText("Page not found.");
  await context.close();
});

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("missing port"));
      server.close(() => resolve(address.port));
    });
  });
}
