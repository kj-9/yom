import path from "node:path";

import { defineConfig } from "vite";

import { createYomDevMiddleware } from "./src/dev/server";

export default defineConfig({
  plugins: [
    {
      name: "yom-dev-api",
      configureServer(server) {
        server.middlewares.use(createYomDevMiddleware(path.resolve(".")));
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
