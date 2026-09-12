import { describe, expect, it } from "vitest";

import {
  buildOutlineTree,
  hasEquivalentPrimaryHeading,
  outlineAncestorIds,
} from "../../src/site/documentui";

describe("document UI helpers", () => {
  it("compares the first H1 with normalized whitespace", () => {
    expect(
      hasEquivalentPrimaryHeading("Guide title", [
        { id: "guide", text: "  Guide   title ", level: 1 },
      ]),
    ).toBe(true);
    expect(
      hasEquivalentPrimaryHeading("Guide title", [
        { id: "intro", text: "Intro", level: 2 },
        { id: "guide", text: "Guide title", level: 1 },
      ]),
    ).toBe(false);
    expect(hasEquivalentPrimaryHeading("Guide title", [])).toBe(false);
  });

  it("builds nesting without placeholder nodes across level jumps", () => {
    const tree = buildOutlineTree([
      { id: "guide", text: "Guide", level: 1 },
      { id: "details", text: "Details", level: 3 },
      { id: "details-2", text: "Details", level: 4 },
      { id: "next", text: "Next", level: 2 },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((node) => node.heading.id)).toEqual([
      "details",
      "next",
    ]);
    expect(tree[0].children[0].children[0].heading.id).toBe("details-2");
    expect(outlineAncestorIds(tree, "details-2")).toEqual(
      new Set(["guide", "details"]),
    );
  });
});
