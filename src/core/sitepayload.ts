import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ResolvedYomConfig } from "./config.js";
import { rewriteRelativeLinks } from "./links.js";
import {
  renderMarkdownDocument,
  type MarkdownDocument,
  type MarkdownHeading,
} from "./markdown.js";
import { docRouteFromRelativePath } from "./routes.js";
import {
  buildSiteIndexFromPaths,
  listExistingPaths,
  type TreeNode,
} from "./scan.js";

export type { TreeNode } from "./scan.js";

/** A JSON-safe reference used by document pagination. */
export type DocumentReference = {
  path: string;
  route: string;
  title: string;
};

/** The metadata that the UI may display without reparsing Markdown. */
export type DocumentMetadata = {
  title: string;
  lang: string;
  frontMatter: MarkdownDocument["frontMatter"];
};

/** A JSON-safe document model shared by the browser and server renderers. */
export type DocumentPayload = {
  path: string;
  route: string;
  raw: string;
  html: string;
  metadata: DocumentMetadata;
  outline: MarkdownHeading[];
  pagination: {
    previous: DocumentReference | null;
    next: DocumentReference | null;
  };
};

/** A complete, JSON-safe view of a Markdown site for the shared UI. */
export type SiteSnapshot = {
  root: string;
  basePath: string;
  lang: string;
  firstPath: string | null;
  tree: TreeNode;
  documents: DocumentPayload[];
};

export type SitePayloadOptions = {
  config: Pick<
    ResolvedYomConfig,
    "include" | "exclude" | "initialPage" | "order" | "basePath" | "lang"
  >;
  mode?: "static" | "dev";
  existingPaths?: Iterable<string>;
  documentOrder?: readonly string[];
};

/** Serializes initial state for an inert JSON script without script-breakout characters. */
export function serializeSitePayload(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

/**
 * Builds the serializable UI boundary from existing Markdown, tree, and route
 * processing. Consumers never need to derive routes, outlines, or pagination.
 */
export async function buildSiteSnapshot(
  root: string,
  options: SitePayloadOptions,
): Promise<SiteSnapshot> {
  const resolvedRoot = path.resolve(root);
  const existingPaths = new Set(
    options.existingPaths ?? (await listExistingPaths(resolvedRoot)),
  );
  const index = buildSiteIndexFromPaths(
    resolvedRoot,
    existingPaths,
    options.config,
  );
  const discoveredPaths = collectDocumentPaths(index.tree);
  const paths = options.documentOrder
    ? options.documentOrder.filter((candidate) =>
        discoveredPaths.includes(candidate),
      )
    : discoveredPaths;
  const documents = await Promise.all(
    paths.map(async (relativePath, index) => {
      const document = await readMarkdownDocument(
        resolvedRoot,
        relativePath,
        existingPaths,
        options,
      );
      return toDocumentPayload(document, {
        previous: paths[index - 1] ?? null,
        next: paths[index + 1] ?? null,
      });
    }),
  );
  const references = new Map(
    documents.map((document) => [document.path, documentReference(document)]),
  );

  for (const document of documents) {
    const index = paths.indexOf(document.path);
    document.pagination = {
      previous:
        (paths[index - 1] === undefined
          ? null
          : references.get(paths[index - 1])) ?? null,
      next:
        (paths[index + 1] === undefined
          ? null
          : references.get(paths[index + 1])) ?? null,
    };
  }

  return {
    root: resolvedRoot,
    basePath: options.config.basePath,
    lang: options.config.lang,
    firstPath: index.firstPath,
    tree: index.tree,
    documents,
  };
}

type ParsedDocument = {
  path: string;
  raw: string;
  html: string;
  title: string;
  headings: MarkdownHeading[];
  frontMatter: MarkdownDocument["frontMatter"];
  route: string;
  lang: string;
};

async function readMarkdownDocument(
  root: string,
  relativePath: string,
  existingPaths: ReadonlySet<string>,
  options: SitePayloadOptions,
): Promise<ParsedDocument> {
  const raw = await readFile(path.join(root, relativePath), "utf-8");
  const document = renderMarkdownDocument(raw);
  return {
    path: relativePath,
    raw,
    html: rewriteRelativeLinks(document.html, {
      sourcePath: relativePath,
      existingPaths,
      mode: options.mode ?? "static",
      basePath: options.config.basePath,
    }),
    title: document.title ?? path.basename(relativePath, ".md"),
    headings: document.headings,
    frontMatter: document.frontMatter,
    route: docRouteFromRelativePath(relativePath, options.config.basePath),
    lang: options.config.lang,
  };
}

function toDocumentPayload(
  document: ParsedDocument,
  pagination: { previous: string | null; next: string | null },
): DocumentPayload {
  return {
    path: document.path,
    route: document.route,
    raw: document.raw,
    html: document.html,
    metadata: {
      title: document.title,
      lang: document.lang,
      frontMatter: document.frontMatter,
    },
    outline: document.headings,
    pagination: {
      previous:
        pagination.previous === null
          ? null
          : placeholderReference(pagination.previous),
      next:
        pagination.next === null ? null : placeholderReference(pagination.next),
    },
  };
}

function placeholderReference(path: string): DocumentReference {
  return { path, route: "", title: "" };
}

function documentReference(document: DocumentPayload): DocumentReference {
  return {
    path: document.path,
    route: document.route,
    title: document.metadata.title,
  };
}

export function collectDocumentPaths(node: TreeNode): string[] {
  if (node.type === "file") return [node.path];
  return node.children.flatMap(collectDocumentPaths);
}
