import { describe, expect, it } from "vitest";

import {
  hasMermaidBlocks,
  renderMermaidInDocument,
} from "../../src/site/mermaid";

describe("Mermaid rendering", () => {
  it("does not load Mermaid when the document has no diagram blocks", async () => {
    const root = {
      querySelectorAll: () => [],
    } as unknown as ParentNode;
    let loads = 0;

    expect(hasMermaidBlocks(root)).toBe(false);
    await renderMermaidInDocument(root, async () => {
      loads += 1;
      throw new Error("must not load Mermaid");
    });

    expect(loads).toBe(0);
  });
});
