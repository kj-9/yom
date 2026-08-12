import { describe, expect, it } from "vitest";

import { releaseTagForVersion } from "../../scripts/release";

describe("releaseTagForVersion", () => {
  it.each([
    ["0.1.0-alpha.3", "alpha"],
    ["0.1.0-beta.1", "beta"],
    ["0.1.0", "latest"],
  ] as const)("maps %s to %s", (version, expected) => {
    expect(releaseTagForVersion(version)).toBe(expected);
  });
});
