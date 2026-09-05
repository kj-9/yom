import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { build as viteBuild } from "vite";

import { rewriteRelativeLinks } from "../core/links.js";
import { renderMarkdownDocument } from "../core/markdown.js";
import { resolveConfig, type ResolvedYomConfig } from "../core/config.js";
import {
  assetRouteFromRelativePath,
  dataRouteFromRelativePath,
  docRouteFromRelativePath,
  normalizeBasePath,
} from "../core/routes.js";
import {
  buildSiteIndexFromPaths,
  listExistingPaths,
  type TreeNode,
} from "../core/scan.js";
import {
  buildSiteSnapshot,
  serializeSitePayload,
} from "../core/sitepayload.js";
import { renderSitePage } from "../site/server.js";
import { createYomViteConfig } from "../dev/vite.js";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

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
  basePath?: string;
  config?: ResolvedYomConfig;
};

export type BuildResult = {
  warnings: string[];
};

export async function buildStaticSite(
  options: BuildOptions,
): Promise<BuildResult> {
  const config = options.config ?? resolveConfig({});
  const basePath = normalizeBasePath(options.basePath ?? config.basePath);
  const siteConfig = { ...config, basePath };
  const existingPaths = await listExistingPaths(options.root);
  const snapshot = buildSiteIndexFromPaths(options.root, existingPaths, config);
  const sharedSnapshot = await buildSiteSnapshot(options.root, {
    config: siteConfig,
    mode: "static",
  });
  const referencedAssets = new Set<string>();
  const warnings = new Set<string>();
  const searchEntries: Array<{ path: string; title: string; text: string }> =
    [];

  await viteBuild({
    ...createYomViteConfig(),
    configFile: false,
    root: packageRoot,
    base: basePath,
    logLevel: "silent",
    build: {
      outDir: options.outDir,
      assetsDir: "_yom",
      emptyOutDir: true,
    },
  });
  const appShell = await readFile(
    path.join(options.outDir, "index.html"),
    "utf-8",
  );

  for (const markdownPath of collectMarkdownPaths(snapshot.tree)) {
    const source = await readFile(
      path.join(options.root, markdownPath),
      "utf-8",
    );
    const document = renderMarkdownDocument(source);
    searchEntries.push({
      path: markdownPath,
      title: document.title ?? path.basename(markdownPath, ".md"),
      text: document.body.replace(/\s+/gu, " ").trim(),
    });
    const rendered = rewriteRelativeLinks(document.html, {
      sourcePath: markdownPath,
      existingPaths,
      mode: "static",
      basePath,
      onMissingReference(value) {
        warnings.add(`${markdownPath}: unresolved reference ${value}`);
      },
    });
    for (const assetPath of collectAssetReferences(rendered, basePath)) {
      referencedAssets.add(assetPath);
    }
    const dataPath = outputPath(
      options.outDir,
      dataRouteFromRelativePath(markdownPath, basePath),
      basePath,
    );
    const documentPath = outputPath(
      options.outDir,
      docRouteFromRelativePath(markdownPath, basePath),
      basePath,
    );

    await mkdir(path.dirname(dataPath), { recursive: true });
    await writeFile(
      dataPath,
      JSON.stringify({
        path: markdownPath,
        raw: source,
        html: rendered,
        title: document.title ?? path.basename(markdownPath, ".md"),
        headings: document.headings,
        frontMatter: document.frontMatter,
      }),
      "utf-8",
    );
    await mkdir(path.dirname(documentPath), { recursive: true });
    const sharedDocument = sharedSnapshot.documents.find(
      (candidate) => candidate.path === markdownPath,
    );
    await writeFile(
      documentPath,
      configureAppShell(appShell, {
        basePath,
        initialPath: markdownPath,
        documentPath: markdownPath,
        snapshot: sharedSnapshot,
        appMarkup: renderSitePage({
          snapshot: sharedSnapshot,
          document: sharedDocument ?? null,
          title: config.title,
          mode: "static",
        }),
        ...siteConfigValues(config),
      }),
      "utf-8",
    );
  }

  for (const assetPath of [...referencedAssets].sort()) {
    const sourcePath = path.join(options.root, assetPath);
    const assetOutputPath = outputPath(
      options.outDir,
      assetRouteFromRelativePath(assetPath),
    );

    await mkdir(path.dirname(assetOutputPath), { recursive: true });
    await cp(sourcePath, assetOutputPath);
  }

  await writeFile(
    path.join(options.outDir, "index.html"),
    configureAppShell(appShell, {
      basePath,
      initialPath: snapshot.firstPath,
      documentPath: sharedSnapshot.firstPath,
      snapshot: sharedSnapshot,
      appMarkup: renderSitePage({
        snapshot: sharedSnapshot,
        document: sharedSnapshot.documents[0] ?? null,
        title: config.title,
        mode: "static",
        notFound: true,
      }),
      ...siteConfigValues(config),
    }),
    "utf-8",
  );
  await writeFile(
    path.join(options.outDir, "404.html"),
    configureAppShell(appShell, {
      basePath,
      initialPath: null,
      notFound: true,
      documentPath: null,
      snapshot: sharedSnapshot,
      appMarkup: renderSitePage({
        snapshot: sharedSnapshot,
        document: null,
        title: config.title,
        mode: "static",
      }),
      ...siteConfigValues(config),
    }),
    "utf-8",
  );
  await writeFile(
    path.join(options.outDir, "tree.json"),
    JSON.stringify({ ...snapshot, root: "." }, null, 2),
    "utf-8",
  );
  await writeFile(
    path.join(options.outDir, "search.json"),
    JSON.stringify(searchEntries),
    "utf-8",
  );

  for (const warning of warnings) console.warn(`[yom] ${warning}`);
  return { warnings: [...warnings].sort() };
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

function collectAssetReferences(content: string, basePath: string): string[] {
  const prefix = assetRouteFromRelativePath("", basePath);
  const pattern = new RegExp(
    `(?:href|src)="${escapeRegExp(prefix)}([^"?#]+)`,
    "giu",
  );
  const matches = content.matchAll(pattern);
  return [...matches].map((match) => match[1]);
}

function configureAppShell(
  shell: string,
  config: {
    basePath: string;
    initialPath: string | null;
    notFound?: boolean;
    title?: string;
    lang?: string;
    theme?: ResolvedYomConfig["theme"];
    palette?: ResolvedYomConfig["palette"];
    fontSize?: ResolvedYomConfig["fontSize"];
    contentWidth?: ResolvedYomConfig["contentWidth"];
    outline?: boolean;
    appMarkup?: string;
    documentPath?: string | null;
    snapshot?: unknown;
  },
): string {
  const serialized = serializeSitePayload({ mode: "static", ...config });
  return shell
    .replace(
      /<div id="app"><\/div>/u,
      `<div id="app">${config.appMarkup ?? ""}</div>`,
    )
    .replace(/<html lang="[^"]*">/u, `<html lang="${config.lang ?? "und"}">`)
    .replace(
      /<title>[^<]*<\/title>/u,
      `<title>${escapeHtml(config.title ?? "yom")}</title>`,
    )
    .replace(
      /<script id="yom-config" type="application\/json">[\s\S]*?<\/script>/u,
      () =>
        `<script id="yom-config" type="application/json">${serialized}</script>`,
    );
}

function siteConfigValues(config: ResolvedYomConfig) {
  return {
    title: config.title,
    lang: config.lang,
    theme: config.theme,
    palette: config.palette,
    fontSize: config.fontSize,
    contentWidth: config.contentWidth,
    outline: config.outline,
  };
}

function outputPath(outDir: string, route: string, basePath = "/"): string {
  const normalizedBase = normalizeBasePath(basePath);
  const relativeRoute = route.startsWith(normalizedBase)
    ? route.slice(normalizedBase.length)
    : route.replace(/^\/+/, "");
  return path.join(outDir, relativeRoute);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
