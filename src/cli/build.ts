import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { rewriteRelativeLinks } from "../core/links";
import { renderMarkdown } from "../core/markdown";
import { assetRouteFromRelativePath } from "../core/routes";
import { docRouteFromRelativePath } from "../core/routes";
import { renderStaticDocumentPage, renderStaticIndexPage } from "../core/site";
import { buildSiteIndex, listExistingPaths, type TreeNode } from "../core/scan";

if (import.meta.main) {
  const [rootArg = ".", outDirArg = "dist"] = process.argv.slice(2);

  await buildStaticSite({
    root: path.resolve(rootArg),
    outDir: path.resolve(outDirArg),
  });
}

type BuildOptions = {
  root: string;
  outDir: string;
};

export async function buildStaticSite(options: BuildOptions): Promise<void> {
  const snapshot = await buildSiteIndex(options.root);
  const existingPaths = await listExistingPaths(options.root);
  const referencedAssets = new Set<string>();

  await rm(options.outDir, { recursive: true, force: true });
  await mkdir(options.outDir, { recursive: true });

  for (const markdownPath of collectMarkdownPaths(snapshot.tree)) {
    const source = await readFile(
      path.join(options.root, markdownPath),
      "utf-8",
    );
    const rendered = rewriteRelativeLinks(renderMarkdown(source), {
      sourcePath: markdownPath,
      existingPaths,
    });
    for (const assetPath of collectAssetReferences(rendered)) {
      referencedAssets.add(assetPath);
    }
    const outputPath = path.join(
      options.outDir,
      docRouteFromRelativePath(markdownPath),
    );

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      renderStaticDocumentPage({
        title: path.basename(markdownPath, ".md"),
        content: rendered,
        tree: snapshot.tree,
        activePath: markdownPath,
      }),
      "utf-8",
    );
  }

  for (const assetPath of [...referencedAssets].sort()) {
    const sourcePath = path.join(options.root, assetPath);
    const outputPath = path.join(
      options.outDir,
      assetRouteFromRelativePath(assetPath),
    );

    await mkdir(path.dirname(outputPath), { recursive: true });
    await cp(sourcePath, outputPath);
  }

  await writeFile(
    path.join(options.outDir, "index.html"),
    renderStaticIndexPage(snapshot.firstPath),
    "utf-8",
  );
  await writeFile(
    path.join(options.outDir, "tree.json"),
    JSON.stringify(snapshot, null, 2),
    "utf-8",
  );
}

function collectMarkdownPaths(node: TreeNode): string[] {
  const collected: string[] = [];

  for (const child of node.children) {
    if (child.type === "file") {
      collected.push(child.path);
      continue;
    }

    collected.push(...collectMarkdownPaths(child));
  }

  return collected;
}

function collectAssetReferences(content: string): string[] {
  const matches = content.matchAll(/(?:href|src)="\/assets\/([^"]+)"/giu);
  return [...matches].map((match) => match[1]);
}
