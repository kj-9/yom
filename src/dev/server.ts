import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

import type { Connect } from "vite";

import { resolveConfig } from "../core/config.js";
import {
  loadDocument,
  loadSiteSnapshot,
  resolveAssetPath,
  type DocumentPayload,
} from "../core/content.js";
import { buildSiteSnapshot, type SiteSnapshot } from "../core/sitepayload.js";
import type { SiteIndexSnapshot } from "../core/scan.js";
import type { SearchResult } from "./repository.js";

export type DevFileEvent = {
  kind: "document" | "asset";
  action: "add" | "change" | "remove";
  path: string;
};

export type DevEventSubscription = (
  listener: (event: DevFileEvent) => void,
) => () => void;

export type DevContentSource = {
  getSnapshot(): Promise<SiteIndexSnapshot>;
  getSiteSnapshot?(): Promise<SiteSnapshot>;
  getDocument(relativePath: string): Promise<DocumentPayload>;
  getAssetPath(relativePath: string): Promise<string>;
  search(query: string): Promise<SearchResult[]>;
};

export function createYomDevMiddleware(
  root: string,
  options: {
    subscribe?: DevEventSubscription;
    content?: DevContentSource;
  } = {},
): Connect.NextHandleFunction {
  const resolvedRoot = path.resolve(root);

  return async (req, res, next) => {
    const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");

    try {
      if (requestUrl.pathname === "/api/tree") {
        const snapshot = options.content
          ? await options.content.getSnapshot()
          : await loadSiteSnapshot(resolvedRoot);
        return sendJson(res, {
          root: snapshot.root,
          version: Date.now(),
          first_path: snapshot.firstPath,
          firstPath: snapshot.firstPath,
          tree: snapshot.tree,
        });
      }

      if (requestUrl.pathname === "/api/site") {
        return sendJson(
          res,
          options.content
            ? await options.content.getSiteSnapshot?.()
            : await buildSiteSnapshot(resolvedRoot, {
                config: resolveConfig({}),
                mode: "dev",
              }),
        );
      }

      if (requestUrl.pathname === "/api/doc") {
        const rawPath = requestUrl.searchParams.get("path") ?? "";
        return sendJson(
          res,
          options.content
            ? await options.content.getDocument(rawPath)
            : await loadDocument(resolvedRoot, rawPath, { mode: "dev" }),
        );
      }

      if (requestUrl.pathname === "/api/search" && options.content) {
        return sendJson(
          res,
          await options.content.search(requestUrl.searchParams.get("q") ?? ""),
        );
      }

      if (
        requestUrl.pathname === "/assets" ||
        requestUrl.pathname.startsWith("/assets/")
      ) {
        const assetPath =
          requestUrl.pathname === "/assets"
            ? (requestUrl.searchParams.get("path") ?? "")
            : requestUrl.pathname.replace(/^\/assets\//u, "");
        return sendAsset(
          res,
          options.content
            ? await options.content.getAssetPath(assetPath)
            : await resolveAssetPath(resolvedRoot, assetPath),
        );
      }

      if (requestUrl.pathname === "/events") {
        return sendEvents(res, options.subscribe);
      }
    } catch (error) {
      return sendError(res, error);
    }

    return next();
  };
}

function sendEvents(
  res: ServerResponse<IncomingMessage>,
  subscribe: DevEventSubscription | undefined,
): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write("retry: 1000\n\n");

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15_000);
  const unsubscribe =
    subscribe?.((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }) ?? (() => {});

  res.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

async function sendAsset(
  res: ServerResponse<IncomingMessage>,
  filePath: string,
): Promise<void> {
  const buffer = await readFile(filePath);
  const type = guessContentType(filePath);

  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  res.end(buffer);
}

function sendJson(
  res: ServerResponse<IncomingMessage>,
  payload: unknown,
): void {
  const body = JSON.stringify(payload);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}

function sendError(res: ServerResponse<IncomingMessage>, error: unknown): void {
  const message = error instanceof Error ? error.message : "unexpected error";
  const statusCode = message.startsWith("invalid") ? 400 : 404;

  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: message }));
}

function guessContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".gif") return "image/gif";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}
