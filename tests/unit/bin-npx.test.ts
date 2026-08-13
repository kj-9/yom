import { mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("npx package bin", () => {
  it("runs yom from a local package path", () => {
    const cwd = createTempRoot();
    const repoRoot = path.resolve(process.cwd());
    const result = spawnSync(
      "npx",
      ["--yes", "--package", repoRoot, "yom", "--help"],
      {
        cwd,
        encoding: "utf-8",
        env: {
          ...process.env,
          NO_UPDATE_NOTIFIER: "1",
          npm_config_cache: path.join(cwd, ".npm-cache"),
          npm_config_dry_run: undefined,
          npm_config_update_notifier: "false",
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("$ yom <command> [options]");
    expect(result.stderr).toBe("");
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "yom-npx-"));
  tempRoots.push(root);
  return root;
}
