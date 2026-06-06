import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { scanMarkdownMtimes } from "../core/scan";

import type { Connect } from "vite";

import {
  loadDocument,
  loadSiteSnapshot,
  resolveAssetPath,
} from "../core/content";

export function createYomDevMiddleware(
  root: string,
): Connect.NextHandleFunction {
  const resolvedRoot = path.resolve(root);

  return async (req, res, next) => {
    const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");

    try {
      if (requestUrl.pathname === "/api/tree") {
        const snapshot = await loadSiteSnapshot(resolvedRoot);
        return sendJson(res, {
          root: snapshot.root,
          version: Date.now(),
          first_path: snapshot.firstPath,
          firstPath: snapshot.firstPath,
          tree: snapshot.tree,
        });
      }

      if (requestUrl.pathname === "/api/doc") {
        const rawPath = requestUrl.searchParams.get("path") ?? "";
        return sendJson(
          res,
          await loadDocument(resolvedRoot, rawPath, { mode: "dev" }),
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
        return sendAsset(res, await resolveAssetPath(resolvedRoot, assetPath));
      }

      if (requestUrl.pathname === "/events") {
        return sendEvents(resolvedRoot, res);
      }
    } catch (error) {
      return sendError(res, error);
    }

    return next();
  };
}

async function sendEvents(
  root: string,
  res: ServerResponse<IncomingMessage>,
): Promise<void> {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write("retry: 1000\n\n");

  let lastSnapshot = JSON.stringify(await scanMarkdownMtimes(root));
  const timer = setInterval(async () => {
    try {
      const nextSnapshot = JSON.stringify(await scanMarkdownMtimes(root));
      if (nextSnapshot === lastSnapshot) {
        return;
      }
      lastSnapshot = nextSnapshot;
      res.write(
        `data: ${JSON.stringify({ version: Date.now(), timestamp: Date.now() / 1000 })}\n\n`,
      );
    } catch {
      // Ignore transient scan errors during polling.
    }
  }, 1000);

  res.on("close", () => {
    clearInterval(timer);
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
