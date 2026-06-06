import { describe, expect, it } from "vitest";

import { parseArgs } from "../../src/cli/index";

describe("parseArgs", () => {
  it("parses build options", () => {
    expect(
      parseArgs([
        "build",
        "--root",
        "docs",
        "--out-dir",
        ".output",
        "--host",
        "0.0.0.0",
        "--port",
        "9000",
      ]),
    ).toEqual({
      command: "build",
      root: "docs",
      outDir: ".output",
      host: "0.0.0.0",
      port: 9000,
    });
  });

  it("uses defaults for dev", () => {
    expect(parseArgs(["dev"])).toEqual({
      command: "dev",
      root: ".",
      outDir: "dist",
      host: "127.0.0.1",
      port: 4173,
    });
  });

  it("rejects unsupported options", () => {
    expect(() => parseArgs(["preview", "--bad"])).toThrow();
    expect(() => parseArgs(["ship"])).toThrow();
  });
});
