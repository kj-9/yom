import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

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
        return sendJson(res, await loadSiteSnapshot(resolvedRoot));
      }

      if (requestUrl.pathname === "/api/doc") {
        const rawPath = requestUrl.searchParams.get("path") ?? "";
        return sendJson(res, await loadDocument(resolvedRoot, rawPath));
      }

      if (requestUrl.pathname.startsWith("/assets/")) {
        const assetPath = requestUrl.pathname.replace(/^\/assets\//u, "");
        return sendAsset(res, await resolveAssetPath(resolvedRoot, assetPath));
      }
    } catch (error) {
      return sendError(res, error);
    }

    return next();
  };
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
