type Mermaid = (typeof import("mermaid"))["default"];
type MermaidLoader = () => Promise<Mermaid>;

let mermaidPromise: Promise<Mermaid> | null = null;

export function hasMermaidBlocks(root: ParentNode): boolean {
  return root.querySelectorAll("pre > code.language-mermaid").length > 0;
}

export async function renderMermaidInDocument(
  root: ParentNode,
  loader: MermaidLoader = loadMermaid,
): Promise<void> {
  const blocks = root.querySelectorAll("pre > code.language-mermaid");
  if (blocks.length === 0) return;
  const mermaid = await loader();
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "default",
  });
  for (const block of blocks) {
    const pre = block.parentElement;
    if (pre === null) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "mermaid-block";
    const graph = document.createElement("div");
    graph.className = "mermaid";
    graph.textContent = block.textContent ?? "";
    wrapper.append(graph);
    pre.replaceWith(wrapper);
  }
  await mermaid.run({ nodes: root.querySelectorAll(".mermaid") });
}

function loadMermaid(): Promise<Mermaid> {
  mermaidPromise ??= import("mermaid").then((module) => module.default);
  return mermaidPromise;
}
