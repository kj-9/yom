import path from "node:path";

import { defineConfig } from "vite";

import { createYomDevMiddleware } from "./src/dev/server";

export default defineConfig({
  plugins: [
    {
      name: "yom-dev-api",
      configureServer(server) {
        const root = process.env.YOM_ROOT
          ? path.resolve(process.env.YOM_ROOT)
          : path.resolve(".");
        server.middlewares.use(createYomDevMiddleware(root));
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
