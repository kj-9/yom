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
  it("closes navigation on document selection including the current document", () => {
    const closed = createSiteState(snapshot);
    expect(closed.navigationOpen).toBe(false);
    const open = siteReducer(closed, {
      type: "set-navigation-open",
      open: true,
    });
    expect(open.navigationOpen).toBe(true);
    expect(siteReducer(open, { type: "set-navigation-open", open: true })).toBe(
      open,
    );
    for (const path of ["first.md", "second.md"]) {
      const selected = siteReducer(open, { type: "navigate", path });
      expect(selected.navigationOpen).toBe(false);
      expect(selected.currentPath).toBe(path);
    }
    expect(
      siteReducer(open, { type: "set-navigation-open", open: false })
        .navigationOpen,
    ).toBe(false);
  });
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

  it("repairs an invalid current path from an equivalent snapshot", () => {
    const state = { ...createSiteState(snapshot), currentPath: "missing.md" };
    const next = siteReducer(state, {
      type: "snapshot-received",
      snapshot: JSON.parse(JSON.stringify(snapshot)) as SiteSnapshot,
    });

    expect(next.currentPath).toBe("first.md");
    expect(next).not.toBe(state);
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

    const expanded = siteReducer(next, {
      type: "toggle-directory",
      path: "guide",
    });
    expect(expanded.collapsedPaths.has("guide")).toBe(false);
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

    const removed = {
      ...snapshot,
      firstPath: "second.md",
      documents: [snapshot.documents[1]],
    };
    expect(
      siteReducer(state, {
        type: "dev-event",
        event: { kind: "document", action: "remove", path: "first.md" },
        snapshot: removed,
        currentPath: "second.md",
      }).currentPath,
    ).toBe("second.md");
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
