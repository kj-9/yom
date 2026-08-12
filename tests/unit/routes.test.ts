import { describe, expect, it } from "vitest";

import {
  assetRouteFromRelativePath,
  dataRouteFromRelativePath,
  docRouteFromRelativePath,
  normalizeBasePath,
  relativePathFromDocRoute,
} from "../../src/core/routes";

describe("routes", () => {
  it("maps markdown paths to static doc routes", () => {
    expect(docRouteFromRelativePath("README.md")).toBe("/docs/README.html");
    expect(docRouteFromRelativePath("docs/guide.md")).toBe(
      "/docs/docs/guide.html",
    );
    expect(docRouteFromRelativePath("docs/guide.md", "/project")).toBe(
      "/project/docs/docs/guide.html",
    );
    expect(dataRouteFromRelativePath("guide.md", "/project/")).toBe(
      "/project/data/guide.md.json",
    );
    expect(assetRouteFromRelativePath("image.png", "/project/")).toBe(
      "/project/assets/image.png",
    );
  });

  it("maps static doc routes back to markdown paths", () => {
    expect(relativePathFromDocRoute("/docs/README.html")).toBe("README.md");
    expect(relativePathFromDocRoute("/docs/docs/guide.html")).toBe(
      "docs/guide.md",
    );
    expect(relativePathFromDocRoute("/assets/image.png")).toBeNull();
    expect(
      relativePathFromDocRoute("/project/docs/docs/guide.html", "/project/"),
    ).toBe("docs/guide.md");
  });

  it("normalizes public base paths", () => {
    expect(normalizeBasePath()).toBe("/");
    expect(normalizeBasePath("project/docs")).toBe("/project/docs/");
    expect(() => normalizeBasePath("/docs?bad=true")).toThrow(
      "invalid base path",
    );
  });
});
