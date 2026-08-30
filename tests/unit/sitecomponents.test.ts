import { renderToString } from "preact-render-to-string";
import { h } from "preact";
import { describe, expect, it } from "vitest";

import type { SiteSnapshot } from "../../src/core/sitepayload";
import {
  DocumentTree,
  DocumentView,
  Outline,
  SettingsPanel,
} from "../../src/site/components";

const document = {
  path: "guide.md",
  route: "/docs/guide.html",
  raw: "# Guide",
  html: '<h1 id="guide">Guide</h1>',
  metadata: { title: "Guide", lang: "und", frontMatter: {} },
  outline: [{ id: "guide", text: "Guide", level: 1 }],
  pagination: {
    previous: null,
    next: { path: "next.md", route: "/docs/next.html", title: "Next" },
  },
} satisfies SiteSnapshot["documents"][number];

const tree: SiteSnapshot["tree"] = {
  name: ".",
  path: "",
  type: "directory",
  children: [
    { name: "guide.md", path: "guide.md", type: "file", children: [] },
  ],
};

describe("shared site components", () => {
  it("renders active document navigation and nested outline", () => {
    const html = renderToString(
      h(
        "div",
        null,
        h(DocumentTree, { node: tree, currentPath: "guide.md" }),
        h(Outline, { document, activeHeading: "guide" }),
      ),
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-label="On this page"');
    expect(html).toContain('href="#guide"');
    expect(html).toContain('class="active"');
  });

  it("exposes directory collapse state through aria-expanded", () => {
    const directory: SiteSnapshot["tree"] = {
      name: ".",
      path: "",
      type: "directory",
      children: [
        {
          name: "guide",
          path: "guide",
          type: "directory",
          children: tree.children,
        },
      ],
    };
    const html = renderToString(
      h(DocumentTree, {
        node: directory,
        currentPath: "guide.md",
        collapsedPaths: new Set(["guide"]),
      }),
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("guide.md");
  });

  it("renders both document modes and pagination", () => {
    const rendered = renderToString(h(DocumentView, { document }));
    const raw = renderToString(h(DocumentView, { document, viewMode: "raw" }));
    expect(rendered).toContain('id="docRoot"');
    expect(rendered).toContain('href="/docs/next.html"');
    expect(raw).toContain('id="rawRoot"');
    expect(raw).toContain("# Guide");
  });

  it("renders controlled display settings", () => {
    const html = renderToString(
      h(SettingsPanel, {
        preferences: {
          theme: "dark",
          palette: "paper",
          fontSize: "medium",
          contentWidth: "comfortable",
          outline: true,
          sidebarWidth: 304,
        },
        onChange: () => {},
      }),
    );
    expect(html).toContain('aria-label="Display settings"');
    expect(html).toContain('value="dark"');
  });
});
