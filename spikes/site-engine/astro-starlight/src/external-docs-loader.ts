import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import type { Loader, LoaderContext } from "astro/loaders";

export interface ExternalDoc {
  body: string;
  filePath: string;
  id: string;
  language: string;
  rawSource: string;
  title: string;
  frontmatter: Record<string, unknown>;
}

export interface ExternalDocsLoaderOptions {
  root: string;
}

async function markdownFiles(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(root, absolutePath);
      return entry.isFile() && entry.name.endsWith(".md") ? [absolutePath] : [];
    })
  );
  return files.flat();
}

function firstH1(markdown: string): string | undefined {
  const match = markdown.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/m);
  return match?.[1]?.trim();
}

function withoutLeadingH1(markdown: string): string {
  return markdown.replace(/^\s{0,3}#\s+.+?\s*#*\s*\n+/, "");
}

function docId(root: string, filePath: string): string {
  return path
    .relative(root, filePath)
    .replace(/\\/g, "/")
    .replace(/\.md$/, "");
}

/**
 * Reads Markdown from any directory. The language default is explicit: it is
 * never inferred from the Markdown body.
 */
export async function readExternalDocs(root: string): Promise<ExternalDoc[]> {
  const absoluteRoot = path.resolve(root);
  const files = await markdownFiles(absoluteRoot);

  return Promise.all(
    files.sort().map(async (filePath) => {
      const rawSource = await readFile(filePath, "utf8");
      const parsed = matter(rawSource);
      const frontmatter = parsed.data as Record<string, unknown>;
      const hasFrontmatterTitle =
        typeof frontmatter.title === "string" && frontmatter.title.trim().length > 0;
      const title = hasFrontmatterTitle
        ? String(frontmatter.title)
        : firstH1(parsed.content) ?? docId(absoluteRoot, filePath);
      const language = typeof frontmatter.lang === "string" ? frontmatter.lang : "und";
      const { lang: _lang, title: _title, ...remainingFrontmatter } = frontmatter;

      return {
        id: docId(absoluteRoot, filePath),
        filePath,
        title,
        language,
        rawSource,
        body: withoutLeadingH1(parsed.content),
        frontmatter: remainingFrontmatter
      };
    })
  );
}

export function externalDocsLoader({ root }: ExternalDocsLoaderOptions): Loader {
  let watcherAttached = false;
  const absoluteRoot = path.resolve(root);

  return {
    name: "yom-external-docs-loader",
    async load(context: LoaderContext) {
      const sync = async () => {
        const docs = await readExternalDocs(absoluteRoot);
        context.store.clear();

        for (const doc of docs) {
          const data = await context.parseData({
            id: doc.id,
            filePath: doc.filePath,
            data: {
              ...doc.frontmatter,
              title: doc.title,
              language: doc.language,
              rawSource: doc.rawSource
            }
          });
          const rendered = await context.renderMarkdown(doc.body, {
            fileURL: pathToFileURL(doc.filePath)
          });
          context.store.set({
            id: doc.id,
            data,
            body: doc.body,
            filePath: path.relative(context.config.root.pathname, doc.filePath),
            digest: context.generateDigest(doc.rawSource),
            rendered
          });
        }
      };

      await sync();

      if (!context.watcher || watcherAttached) return;
      watcherAttached = true;
      context.watcher.add(absoluteRoot);
      context.watcher.on("all", (event, changedPath) => {
        if (
          (event === "add" || event === "change" || event === "unlink") &&
          changedPath.startsWith(absoluteRoot) &&
          changedPath.endsWith(".md")
        ) {
          void sync().catch((error: unknown) => {
            context.logger.error(`Could not refresh external Markdown: ${String(error)}`);
          });
        }
      });
    }
  };
}
