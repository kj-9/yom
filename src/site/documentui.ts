import type { MarkdownHeading } from "../core/markdown.js";

export type OutlineNode = {
  heading: MarkdownHeading;
  children: OutlineNode[];
};

export function hasEquivalentPrimaryHeading(
  title: string,
  headings: readonly MarkdownHeading[],
): boolean {
  const first = headings[0];
  return (
    first?.level === 1 && normalizeTitle(first.text) === normalizeTitle(title)
  );
}

export function buildOutlineTree(
  headings: readonly MarkdownHeading[],
): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];
  for (const heading of headings) {
    const node: OutlineNode = { heading, children: [] };
    while (
      stack.length > 0 &&
      stack[stack.length - 1].heading.level >= heading.level
    ) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    (parent?.children ?? roots).push(node);
    stack.push(node);
  }
  return roots;
}

export function outlineAncestorIds(
  nodes: readonly OutlineNode[],
  activeId: string | null | undefined,
): ReadonlySet<string> {
  if (!activeId) return new Set();
  const find = (
    candidates: readonly OutlineNode[],
    ancestors: string[],
  ): string[] | null => {
    for (const node of candidates) {
      if (node.heading.id === activeId) return ancestors;
      const nested = find(node.children, [...ancestors, node.heading.id]);
      if (nested !== null) return nested;
    }
    return null;
  };
  return new Set(find(nodes, []) ?? []);
}

function normalizeTitle(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}
