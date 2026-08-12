import path from "node:path";
import { readFile } from "node:fs/promises";

import {
  loadDocument,
  resolveAssetPath,
  type DocumentPayload,
} from "../core/content";
import {
  buildSiteIndexFromPaths,
  isGitIgnored,
  listExistingPaths,
  type SiteIndexSnapshot,
} from "../core/scan";
import type { DevFileEvent } from "./server";
import {
  matchesConfigPath,
  resolveConfig,
  type ResolvedYomConfig,
} from "../core/config";
import { renderMarkdownDocument } from "../core/markdown";

export type SearchResult = {
  path: string;
  title: string;
  excerpt: string;
};

export class DevContentRepository {
  readonly root: string;
  private existingPaths = new Set<string>();
  private snapshot: SiteIndexSnapshot;
  private readonly ready: Promise<void>;
  private updates = Promise.resolve();
  private readonly config: ResolvedYomConfig;
  private readonly searchCache = new Map<
    string,
    { title: string; text: string }
  >();

  constructor(root: string, config: ResolvedYomConfig = resolveConfig({})) {
    this.root = path.resolve(root);
    this.config = config;
    this.snapshot = buildSiteIndexFromPaths(this.root, [], config);
    this.ready = this.initialize();
  }

  async getSnapshot(): Promise<SiteIndexSnapshot> {
    await this.ready;
    await this.updates;
    return this.snapshot;
  }

  async getDocument(relativePath: string): Promise<DocumentPayload> {
    await this.ready;
    await this.updates;
    if (!matchesConfigPath(relativePath, this.config)) {
      throw new Error("missing markdown file");
    }
    return loadDocument(this.root, relativePath, {
      mode: "dev",
      existingPaths: this.existingPaths,
    });
  }

  async getAssetPath(relativePath: string): Promise<string> {
    await this.ready;
    await this.updates;
    return resolveAssetPath(this.root, relativePath, {
      existingPaths: this.existingPaths,
    });
  }

  async search(query: string): Promise<SearchResult[]> {
    await this.ready;
    await this.updates;
    const terms = query.toLocaleLowerCase().split(/\s+/u).filter(Boolean);
    if (terms.length === 0) return [];
    const results: SearchResult[] = [];
    for (const relativePath of this.existingPaths) {
      if (
        !relativePath.toLowerCase().endsWith(".md") ||
        !matchesConfigPath(relativePath, this.config)
      ) {
        continue;
      }
      const document = await this.searchDocument(relativePath);
      const haystack =
        `${relativePath}\n${document.title}\n${document.text}`.toLocaleLowerCase();
      if (!terms.every((term) => haystack.includes(term))) continue;
      results.push({
        path: relativePath,
        title: document.title,
        excerpt: excerpt(document.text, terms[0]),
      });
      if (results.length === 100) break;
    }
    return results;
  }

  async apply(event: DevFileEvent): Promise<boolean> {
    let accepted = false;
    this.updates = this.updates.then(async () => {
      await this.ready;
      accepted = this.applyNow(event);
    });
    await this.updates;
    return accepted;
  }

  async reload(): Promise<void> {
    this.updates = this.updates.then(async () => {
      await this.initialize();
    });
    await this.updates;
  }

  private applyNow(event: DevFileEvent): boolean {
    if (
      event.kind === "document" &&
      !matchesConfigPath(event.path, this.config)
    ) {
      return false;
    }
    if (event.kind === "document") this.searchCache.delete(event.path);
    if (event.action === "change") {
      return this.existingPaths.has(event.path);
    }

    if (event.action === "add") {
      if (this.existingPaths.has(event.path)) {
        return false;
      }
      if (isGitIgnored(this.root, event.path)) {
        return false;
      }
      this.existingPaths.add(event.path);
    } else {
      if (!this.existingPaths.has(event.path)) {
        return false;
      }
      this.existingPaths.delete(event.path);
    }
    if (event.kind === "document") {
      this.snapshot = buildSiteIndexFromPaths(
        this.root,
        this.existingPaths,
        this.config,
      );
    }
    return true;
  }

  private async initialize(): Promise<void> {
    this.searchCache.clear();
    this.existingPaths = await listExistingPaths(this.root);
    this.snapshot = buildSiteIndexFromPaths(
      this.root,
      this.existingPaths,
      this.config,
    );
  }

  private async searchDocument(relativePath: string) {
    const cached = this.searchCache.get(relativePath);
    if (cached) return cached;
    const raw = await readFile(path.join(this.root, relativePath), "utf-8");
    const document = renderMarkdownDocument(raw);
    const value = {
      title: document.title ?? path.basename(relativePath, ".md"),
      text: document.body.replace(/\s+/gu, " ").trim(),
    };
    this.searchCache.set(relativePath, value);
    return value;
  }
}

function excerpt(text: string, term: string): string {
  const index = text.toLocaleLowerCase().indexOf(term);
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + term.length + 100);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
