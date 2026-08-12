import { describe, expect, it } from "vitest";

import { isDirectExecution } from "../../src/cli/index";

describe("isDirectExecution", () => {
  it("treats bun-run ts entrypoints as direct execution", () => {
    expect(isDirectExecution(["bun", "/repo/src/cli/index.ts", "dev"])).toBe(
      true,
    );
  });

  it("ignores wrapper binary execution", () => {
    expect(isDirectExecution(["node", "/repo/bin/yom", "dev"])).toBe(false);
  });

  it("ignores imported module execution", () => {
    expect(
      isDirectExecution(["vitest", "/repo/tests/unit/cli-node.test.ts"]),
    ).toBe(false);
  });
});
