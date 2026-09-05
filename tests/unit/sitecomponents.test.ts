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
import { StaticSitePage } from "../../src/site/static";

const document = {
  path: "guide.md",
  route: "/docs/guide.html",
  raw: "# Guide",
  html: '<h1 id="guide">Guide</h1><p><a href="/?path=next.md#details">Next</a></p><img src="/assets/images/guide.png" alt="Guide image">',
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
    expect(rendered).toContain('href="/?path=next.md#details"');
    expect(rendered).toContain('src="/assets/images/guide.png"');
    expect(raw).toContain('id="rawRoot"');
    expect(raw).toContain("# Guide");
    expect(raw).not.toContain('id="docRoot"');
  });

  it("renders front matter metadata in the document view", () => {
    const withFrontMatter = {
      ...document,
      metadata: {
        ...document.metadata,
        frontMatter: { title: "Guide", draft: false, tags: ["docs"] },
      },
    };
    const html = renderToString(h(DocumentView, { document: withFrontMatter }));

    expect(html).toContain('id="frontMatter"');
    expect(html).toContain("title");
    expect(html).toContain("Guide");
    expect(html).toContain("draft");
    expect(html).toContain("false");
    expect(html).toContain("docs");
  });

  it("selects an adjacent document when the active document was removed", () => {
    const nextDocument = {
      ...document,
      path: "next.md",
      route: "/docs/next.html",
      raw: "# Next",
      html: '<h1 id="next">Next</h1>',
      metadata: { ...document.metadata, title: "Next" },
      pagination: { previous: null, next: null },
    };
    const snapshot: SiteSnapshot = {
      root: "/notes",
      basePath: "/",
      lang: "und",
      firstPath: "next.md",
      tree: {
        ...tree,
        children: [
          { name: "next.md", path: "next.md", type: "file", children: [] },
        ],
      },
      documents: [nextDocument],
    };
    const html = renderToString(
      h(StaticSitePage, {
        snapshot,
        document,
        title: "yom",
        mode: "dev",
      }),
    );

    expect(html).toContain('<h1 id="next">Next</h1>');
    expect(html).not.toContain('<h1 id="guide">Guide</h1>');
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
    expect(html).toContain('value="large"');
    expect(html).toContain('id="outlineToggle"');
  });
});
