import { describe, expect, it } from "vitest";

import {
  docRouteFromRelativePath,
  relativePathFromDocRoute,
} from "../../src/core/routes";

describe("routes", () => {
  it("maps markdown paths to static doc routes", () => {
    expect(docRouteFromRelativePath("README.md")).toBe("/docs/README.html");
    expect(docRouteFromRelativePath("docs/guide.md")).toBe(
      "/docs/docs/guide.html",
    );
  });

  it("maps static doc routes back to markdown paths", () => {
    expect(relativePathFromDocRoute("/docs/README.html")).toBe("README.md");
    expect(relativePathFromDocRoute("/docs/docs/guide.html")).toBe(
      "docs/guide.md",
    );
    expect(relativePathFromDocRoute("/assets/image.png")).toBeNull();
  });
});
