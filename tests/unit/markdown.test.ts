import { describe, expect, it } from "vitest";

import { rewriteRelativeLinks } from "../../src/core/links";
import {
  renderMarkdown,
  renderMarkdownDocument,
} from "../../src/core/markdown";

describe("renderMarkdown", () => {
  it("renders tables", () => {
    const html = renderMarkdown("| a |\n| - |\n| b |");
    expect(html).toContain("<table>");
  });

  it("keeps mermaid fences as code blocks", () => {
    const html = renderMarkdown("```mermaid\ngraph TD\n  A-->B\n```");
    expect(html).toContain('class="language-mermaid"');
    expect(html).toContain("graph TD");
  });

  it("adds stable and unique heading anchors", () => {
    const html = renderMarkdown(
      "# Hello world\n\n## Hello world\n\n# 日本語 見出し",
    );
    expect(html).toContain('<h1 id="hello-world">');
    expect(html).toContain('<h2 id="hello-world-2">');
    expect(html).toContain('<h1 id="日本語-見出し">');
  });

  it("extracts front matter, title, and heading metadata", () => {
    const document = renderMarkdownDocument(
      '---\ntitle: "Configured title"\ndraft: false\ntags: [one, two]\n---\n# Body title\n\n## Details\n',
    );
    expect(document.title).toBe("Configured title");
    expect(document.frontMatter).toEqual({
      title: "Configured title",
      draft: false,
      tags: ["one", "two"],
    });
    expect(document.headings).toEqual([
      { id: "body-title", text: "Body title", level: 1 },
      { id: "details", text: "Details", level: 2 },
    ]);
    expect(document.html).not.toContain("title:");
  });
});

describe("rewriteRelativeLinks", () => {
  it("rewrites markdown links and asset paths", () => {
    const html = rewriteRelativeLinks(
      '<p><a href="../guide.md">guide</a> <img src="image.png" alt="img"></p>',
      {
        sourcePath: "docs/page.md",
        existingPaths: new Set(["guide.md", "docs/image.png"]),
      },
    );

    expect(html).toContain('href="/?path=guide.md"');
    expect(html).toContain('src="/assets/docs/image.png"');
  });

  it("preserves query strings and fragments under a static base path", () => {
    const html = rewriteRelativeLinks(
      '<a href="../guide.md?view=full#intro">guide</a>',
      {
        sourcePath: "docs/page.md",
        existingPaths: new Set(["guide.md"]),
        basePath: "/project/",
      },
    );
    expect(html).toContain(
      'href="/project/?path=guide.md&amp;view=full#intro"',
    );
  });

  it("rewrites dev-mode links with query-string routes", () => {
    const html = rewriteRelativeLinks(
      '<p><a href="../guide.md">guide</a> <img src="image.png" alt="img"></p>',
      {
        sourcePath: "docs/page.md",
        existingPaths: new Set(["guide.md", "docs/image.png"]),
        mode: "dev",
      },
    );

    expect(html).toContain('href="/?path=guide.md"');
    expect(html).toContain('src="/assets?path=docs/image.png"');
  });

  it("leaves invalid and external links untouched", () => {
    const html = rewriteRelativeLinks(
      [
        '<p><a href="https://example.com">ext</a>',
        '<a href="../missing.md">missing</a>',
        '<img src="../secret.png"></p>',
      ].join(" "),
      {
        sourcePath: "docs/page.md",
        existingPaths: new Set(["docs/page.md"]),
      },
    );

    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="../missing.md"');
    expect(html).toContain('src="../secret.png"');
  });
});
