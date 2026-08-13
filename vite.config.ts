import path from "node:path";

import { defineConfig, type ViteDevServer } from "vite";

import { createYomDevMiddleware, type DevFileEvent } from "./src/dev/server";
import { DevContentRepository } from "./src/dev/repository";
import { resolveConfig, type ResolvedYomConfig } from "./src/core/config";

function configureYomDevServer(
  server: ViteDevServer,
  root: string,
  config: ResolvedYomConfig,
): void {
  const content = new DevContentRepository(root, config);
  const listeners = new Set<(event: DevFileEvent) => void>();
  const notify = (event: DevFileEvent): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };
  const notifyIfInsideRoot = (
    action: DevFileEvent["action"],
    filePath: string,
  ): void => {
    const relativePath = relativeFilePath(filePath, root);
    if (relativePath === null) {
      return;
    }
    if (relativePath === ".gitignore") {
      void content.reload().then(() => {
        notify({ kind: "document", action: "change", path: "" });
      });
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
        return () => {
          listeners.delete(listener);
        };
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
  ) {
    return null;
  }
  return relativePath.split(path.sep).join(path.posix.sep);
}

export default defineConfig({
  plugins: [
    {
      name: "yom-dev-api",
      transformIndexHtml(html) {
        const config = runtimeConfig();
        const serialized = JSON.stringify({
          mode: "dev",
          basePath: "/",
          initialPath: config.initialPage,
          title: config.title,
          lang: config.lang,
          theme: config.theme,
          palette: config.palette,
          fontSize: config.fontSize,
          contentWidth: config.contentWidth,
          outline: config.outline,
        }).replaceAll("<", "\\u003c");
        return html
          .replace(/<html lang="[^"]*">/u, `<html lang="${config.lang}">`)
          .replace(
            /<title>[^<]*<\/title>/u,
            `<title>${escapeHtml(config.title)}</title>`,
          )
          .replace(
            /<script id="yom-config" type="application\/json">[\s\S]*?<\/script>/u,
            `<script id="yom-config" type="application/json">${serialized}</script>`,
          );
      },
      configureServer(server) {
        const root = process.env.YOM_ROOT
          ? path.resolve(process.env.YOM_ROOT)
          : path.resolve(".");
        configureYomDevServer(server, root, runtimeConfig());
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});

function runtimeConfig(): ResolvedYomConfig {
  const serialized = process.env.YOM_CONFIG;
  if (!serialized) return resolveConfig({});
  return JSON.parse(serialized) as ResolvedYomConfig;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
