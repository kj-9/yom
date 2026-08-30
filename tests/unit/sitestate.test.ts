import { describe, expect, it } from "vitest";

import type { SiteSnapshot } from "../../src/core/sitepayload.js";
import { createSiteState, siteReducer } from "../../src/site/state";

const snapshot: SiteSnapshot = {
  root: "/notes",
  basePath: "/",
  lang: "und",
  firstPath: "first.md",
  tree: {
    name: "notes",
    path: "",
    type: "directory",
    children: [
      { name: "first.md", path: "first.md", type: "file", children: [] },
      { name: "second.md", path: "second.md", type: "file", children: [] },
    ],
  },
  documents: [
    document("first.md", null, "second.md"),
    document("second.md", "first.md", null),
  ],
};

describe("siteReducer", () => {
  it("returns the same state for an equivalent snapshot", () => {
    const state = createSiteState(snapshot);
    const equivalentSnapshot = JSON.parse(
      JSON.stringify(snapshot),
    ) as SiteSnapshot;

    expect(
      siteReducer(state, {
        type: "snapshot-received",
        snapshot: equivalentSnapshot,
      }),
    ).toBe(state);
  });

  it("preserves reading state while replacing a changed snapshot", () => {
    let state = createSiteState(snapshot);
    state = siteReducer(state, { type: "navigate", path: "second.md" });
    state = siteReducer(state, { type: "set-view-mode", viewMode: "raw" });
    state = siteReducer(state, { type: "toggle-directory", path: "guide" });
    state = siteReducer(state, {
      type: "set-preferences",
      preferences: { sidebarWidth: 420, outline: false },
    });

    const changedSnapshot = {
      ...snapshot,
      documents: snapshot.documents.map((document) =>
        document.path === "first.md"
          ? { ...document, raw: "updated" }
          : document,
      ),
    };
    const next = siteReducer(state, {
      type: "snapshot-received",
      snapshot: changedSnapshot,
    });

    expect(next).not.toBe(state);
    expect(next.currentPath).toBe("second.md");
    expect(next.viewMode).toBe("raw");
    expect(next.collapsedPaths).toBe(state.collapsedPaths);
    expect(next.preferences).toBe(state.preferences);
  });

  it("ignores unchanged dev events and applies a typed snapshot event", () => {
    const state = createSiteState(snapshot);
    expect(
      siteReducer(state, {
        type: "dev-event",
        event: { kind: "document", action: "change", path: "first.md" },
      }),
    ).toBe(state);
    const changed = { ...snapshot, firstPath: "second.md" };
    expect(
      siteReducer(state, {
        type: "dev-event",
        event: { kind: "document", action: "add", path: "new.md" },
        snapshot: changed,
      }).snapshot,
    ).toBe(changed);
  });
});

function document(
  path: string,
  previous: string | null,
  next: string | null,
): SiteSnapshot["documents"][number] {
  return {
    path,
    route: `/docs/${path.replace(/\.md$/u, ".html")}`,
    raw: `# ${path}`,
    html: `<h1>${path}</h1>`,
    metadata: { title: path, lang: "und", frontMatter: {} },
    outline: [],
    pagination: {
      previous:
        previous === null
          ? null
          : { path: previous, route: `/docs/${previous}`, title: previous },
      next:
        next === null
          ? null
          : { path: next, route: `/docs/${next}`, title: next },
    },
  };
}
