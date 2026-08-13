import { describe, expect, it } from "vitest";

import { assertReleaseRef, releaseTagForVersion } from "../../scripts/release";

describe("releaseTagForVersion", () => {
  it.each([
    ["0.1.0-alpha.3", "alpha"],
    ["0.1.0-beta.1", "beta"],
    ["0.1.0", "latest"],
  ] as const)("maps %s to %s", (version, expected) => {
    expect(releaseTagForVersion(version)).toBe(expected);
  });

  it("rejects unsupported prerelease labels", () => {
    expect(() => releaseTagForVersion("0.1.0-rc.1")).toThrow(
      "unsupported release version",
    );
  });

  it("requires a GitHub release tag matching the package version", () => {
    expect(() => assertReleaseRef("0.1.0-alpha.3", "v0.1.0-alpha.2")).toThrow(
      "expected v0.1.0-alpha.3",
    );
    expect(() =>
      assertReleaseRef("0.1.0-alpha.3", "v0.1.0-alpha.3"),
    ).not.toThrow();
    expect(() => assertReleaseRef("0.1.0-alpha.3", undefined)).not.toThrow();
  });
});
