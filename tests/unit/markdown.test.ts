import { describe, expect, it } from "vitest";

import { rewriteRelativeLinks } from "../../src/core/links";
import { renderMarkdown } from "../../src/core/markdown";

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

    expect(html).toContain('href="/docs/guide.html"');
    expect(html).toContain('src="/assets/docs/image.png"');
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
