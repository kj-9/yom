import path from "node:path";

import type { Plugin, UserConfig, ViteDevServer } from "vite";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";

import { resolveConfig, type ResolvedYomConfig } from "../core/config.js";
import { DevContentRepository } from "./repository.js";
import { createYomDevMiddleware, type DevFileEvent } from "./server.js";
import { StaticSitePage } from "../site/static.js";
import { serializeSitePayload } from "../core/sitepayload.js";

export function createYomViteConfig(
  options: {
    contentRoot?: string;
    config?: ResolvedYomConfig;
  } = {},
): UserConfig {
  const contentRoot = options.contentRoot ?? path.resolve(".");
  const config = options.config ?? resolveConfig({});
  return {
    esbuild: { jsx: "automatic", jsxImportSource: "preact" },
    // Mermaid is loaded only by the document renderer after it finds a diagram.
    // Keeping it out of dependency optimisation prevents the dev client from
    // requesting its prebundle while opening an ordinary Markdown document.
    optimizeDeps: { exclude: ["mermaid"] },
    plugins: [createYomDevPlugin(contentRoot, config)],
    server: { host: "127.0.0.1", port: 4173 },
    preview: { host: "127.0.0.1", port: 4173 },
  };
}

function createYomDevPlugin(root: string, config: ResolvedYomConfig): Plugin {
  const content = new DevContentRepository(root, config);
  return {
    name: "yom-dev-api",
    apply: "serve",
    async transformIndexHtml(html) {
      const snapshot = await content.getSiteSnapshot();
      const document = snapshot.documents.find(
        (candidate) => candidate.path === config.initialPage,
      );
      const serialized = serializeSitePayload({
        mode: "dev",
        basePath: config.basePath,
        documentPath: document?.path ?? snapshot.firstPath,
        snapshot,
        title: config.title,
        lang: config.lang,
        theme: config.theme,
        palette: config.palette,
        fontSize: config.fontSize,
        contentWidth: config.contentWidth,
        outline: config.outline,
      });
      return html
        .replace(
          /<div id="app"><\/div>/u,
          `<div id="app">${renderToString(
            h(StaticSitePage, {
              snapshot,
              document: document ?? snapshot.documents[0] ?? null,
              title: config.title,
              mode: "dev",
            }),
          )}</div>`,
        )
        .replace(/<html lang="[^"]*">/u, `<html lang="${config.lang}">`)
        .replace(
          /<title>[^<]*<\/title>/u,
          `<title>${escapeHtml(config.title)}</title>`,
        )
        .replace(
          /<script id="yom-config" type="application\/json">[\s\S]*?<\/script>/u,
          () =>
            `<script id="yom-config" type="application/json">${serialized}</script>`,
        );
    },
    configureServer(server) {
      configureYomDevServer(server, root, config, content);
    },
  };
}

function configureYomDevServer(
  server: ViteDevServer,
  root: string,
  config: ResolvedYomConfig,
  content = new DevContentRepository(root, config),
): void {
  const listeners = new Set<(event: DevFileEvent) => void>();
  const notify = (event: DevFileEvent): void => {
    for (const listener of listeners) listener(event);
  };
  const notifyIfInsideRoot = (
    action: DevFileEvent["action"],
    filePath: string,
  ): void => {
    const relativePath = relativeFilePath(filePath, root);
    if (relativePath === null) return;
    if (relativePath === ".gitignore") {
      void content
        .reload()
        .then(() => notify({ kind: "document", action: "change", path: "" }));
      return;
    }
    const event: DevFileEvent = {
      kind:
        path.extname(relativePath).toLowerCase() === ".md"
          ? "document"
          : "asset",
      action,
      path: relativePath,
    };
    void content.apply(event).then((accepted) => {
      if (accepted) notify(event);
    });
  };
  server.watcher.add(root);
  server.watcher.on("add", (filePath) => notifyIfInsideRoot("add", filePath));
  server.watcher.on("change", (filePath) =>
    notifyIfInsideRoot("change", filePath),
  );
  server.watcher.on("unlink", (filePath) =>
    notifyIfInsideRoot("remove", filePath),
  );
  server.middlewares.use(
    createYomDevMiddleware(root, {
      content,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
  );
}

function relativeFilePath(filePath: string, root: string): string | null {
  const relativePath = path.relative(root, filePath);
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    (relativePath !== ".gitignore" &&
      relativePath.split(path.sep).some((part) => part.startsWith(".")))
  )
    return null;
  return relativePath.split(path.sep).join(path.posix.sep);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
