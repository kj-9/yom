import path from "node:path";

import { defineConfig, type ViteDevServer } from "vite";

import { createYomDevMiddleware } from "./src/dev/server";

function configureYomDevServer(server: ViteDevServer, root: string): void {
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };
  const notifyIfMarkdown = (filePath: string): void => {
    if (!isMarkdownInsideRoot(filePath, root)) {
      return;
    }
    notify();
  };

  server.watcher.add(path.join(root, "**/*.md"));
  server.watcher.on("add", notifyIfMarkdown);
  server.watcher.on("change", notifyIfMarkdown);
  server.watcher.on("unlink", notifyIfMarkdown);

  server.middlewares.use(
    createYomDevMiddleware(root, {
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    }),
  );
}

function isMarkdownInsideRoot(filePath: string, root: string): boolean {
  const relativePath = path.relative(root, filePath);
  return (
    relativePath.length > 0 &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath) &&
    path.extname(filePath).toLowerCase() === ".md"
  );
}

export default defineConfig({
  plugins: [
    {
      name: "yom-dev-api",
      configureServer(server) {
        const root = process.env.YOM_ROOT
          ? path.resolve(process.env.YOM_ROOT)
          : path.resolve(".");
        configureYomDevServer(server, root);
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
