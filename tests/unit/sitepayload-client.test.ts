import { describe, expect, it } from "vitest";

import {
  documentFromLocation,
  documentFromPayload,
  parseClientPayload,
} from "../../src/site/payload";
import type { SiteSnapshot } from "../../src/core/sitepayload";

describe("client payload", () => {
  it("tolerates missing or malformed JSON", () => {
    expect(parseClientPayload(undefined)).toEqual({});
    expect(parseClientPayload("not json")).toEqual({});
  });

  it("selects the initial document from embedded data", () => {
    const snapshot: SiteSnapshot = {
      root: ".",
      basePath: "/",
      lang: "und",
      firstPath: "guide.md",
      tree: { name: ".", path: "", type: "directory", children: [] },
      documents: [
        {
          path: "guide.md",
          route: "/docs/guide.html",
          raw: "# Guide",
          html: "<h1>Guide</h1>",
          metadata: { title: "Guide", lang: "und", frontMatter: {} },
          outline: [],
          pagination: { previous: null, next: null },
        },
      ],
    };
    const payload = parseClientPayload(
      JSON.stringify({ snapshot, documentPath: "guide.md" }),
    );
    expect(documentFromPayload(payload)?.path).toBe("guide.md");
    expect(documentFromLocation(snapshot, "/docs/guide.html")?.path).toBe(
      "guide.md",
    );
    expect(documentFromLocation(snapshot, "/missing.html")).toBeNull();
  });
});
