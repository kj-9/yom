import path from "node:path";

import { loadConfigFromFile } from "vite";

import { normalizeBasePath } from "./routes.js";

export type YomConfig = {
  title?: string;
  lang?: string;
  include?: string[];
  exclude?: string[];
  initialPage?: string;
  order?: string[];
  base?: string;
  theme?: "system" | "light" | "dark";
  palette?: "paper" | "forest" | "sea";
  fontSize?: "small" | "medium" | "large";
  contentWidth?: "compact" | "comfortable" | "wide";
  outline?: boolean;
  outDir?: string;
  open?: boolean;
};

export type ResolvedYomConfig = {
  title: string;
  lang: string;
  include: string[];
  exclude: string[];
  initialPage: string | null;
  order: string[];
  basePath: string;
  theme: "system" | "light" | "dark";
  palette: "paper" | "forest" | "sea";
  fontSize: "small" | "medium" | "large";
  contentWidth: "compact" | "comfortable" | "wide";
  outline: boolean;
  outDir: string;
  open: boolean;
  configPath: string | null;
};

const CONFIG_NAMES = ["yom.config.ts", "yom.config.js", "yom.config.mjs"];
const ALLOWED_KEYS = new Set([
  "title",
  "lang",
  "include",
  "exclude",
  "initialPage",
  "order",
  "base",
  "theme",
  "palette",
  "fontSize",
  "contentWidth",
  "outline",
  "outDir",
  "open",
]);

export function defineConfig(config: YomConfig): YomConfig {
  return config;
}

export async function loadYomConfig(options: {
  cwd: string;
  root: string;
  configPath?: string;
}): Promise<ResolvedYomConfig> {
  const configPath = await findConfigPath(options);
  if (configPath === null) return resolveConfig({}, null);

  const loaded = await loadConfigFromFile(
    { command: "serve", mode: "production", isSsrBuild: false },
    configPath,
    options.cwd,
    "silent",
  );
  const value = loaded?.config;
  if (!isPlainObject(value)) {
    throw new Error(`invalid yom config: ${configPath} must export an object`);
  }
  return resolveConfig(value, configPath);
}

export function resolveConfig(
  value: Record<string, unknown>,
  configPath: string | null = null,
): ResolvedYomConfig {
  for (const key of Object.keys(value)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`invalid yom config: unknown option ${key}`);
    }
  }

  const title = optionalString(value.title, "title") ?? "yom";
  const lang = optionalString(value.lang, "lang") ?? "und";
  if (!/^(?:und|[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/u.test(lang)) {
    throw new Error("invalid yom config: lang must be a language tag");
  }
  const initialPage = optionalString(value.initialPage, "initialPage") ?? null;
  if (
    initialPage !== null &&
    (initialPage.startsWith("/") ||
      initialPage.startsWith("../") ||
      !initialPage.toLowerCase().endsWith(".md"))
  ) {
    throw new Error("invalid yom config: initialPage must be a Markdown path");
  }

  return {
    title,
    lang,
    include: stringArray(value.include, "include", ["**/*.md"]),
    exclude: stringArray(value.exclude, "exclude", []),
    initialPage,
    order: stringArray(value.order, "order", []),
    basePath: normalizeBasePath(optionalString(value.base, "base") ?? "/"),
    theme: enumValue(
      value.theme,
      "theme",
      ["system", "light", "dark"],
      "system",
    ),
    palette: enumValue(
      value.palette,
      "palette",
      ["paper", "forest", "sea"],
      "paper",
    ),
    fontSize: enumValue(
      value.fontSize,
      "fontSize",
      ["small", "medium", "large"],
      "medium",
    ),
    contentWidth: enumValue(
      value.contentWidth,
      "contentWidth",
      ["compact", "comfortable", "wide"],
      "comfortable",
    ),
    outline: optionalBoolean(value.outline, "outline") ?? true,
    outDir: optionalString(value.outDir, "outDir") ?? "dist",
    open: optionalBoolean(value.open, "open") ?? false,
    configPath,
  };
}

export function matchesConfigPath(
  relativePath: string,
  config: Pick<ResolvedYomConfig, "include" | "exclude">,
): boolean {
  return (
    config.include.some((pattern) => globMatches(relativePath, pattern)) &&
    !config.exclude.some((pattern) => globMatches(relativePath, pattern))
  );
}

async function findConfigPath(options: {
  cwd: string;
  root: string;
  configPath?: string;
}): Promise<string | null> {
  if (options.configPath !== undefined) {
    const explicit = path.resolve(options.cwd, options.configPath);
    await import("node:fs/promises")
      .then(({ access }) => access(explicit))
      .catch(() => {
        throw new Error(`yom config not found: ${explicit}`);
      });
    return explicit;
  }
  const directories = [
    ...new Set([path.resolve(options.cwd), path.resolve(options.root)]),
  ];
  for (const directory of directories) {
    for (const name of CONFIG_NAMES) {
      const candidate = path.join(directory, name);
      if (await exists(candidate)) return candidate;
    }
  }
  return null;
}

function globMatches(relativePath: string, pattern: string): boolean {
  let expression = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      index += 1;
      if (pattern[index + 1] === "/") {
        index += 1;
        expression += "(?:.*/)?";
      } else {
        expression += ".*";
      }
    } else if (character === "*") {
      expression += "[^/]*";
    } else if (character === "?") {
      expression += "[^/]";
    } else {
      expression += character.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
    }
  }
  return new RegExp(`${expression}$`, "u").test(relativePath);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await import("node:fs/promises").then(({ access }) => access(filePath));
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`invalid yom config: ${name} must be a non-empty string`);
  }
  return value.trim();
}

function optionalBoolean(value: unknown, name: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`invalid yom config: ${name} must be a boolean`);
  }
  return value;
}

function stringArray(
  value: unknown,
  name: string,
  fallback: string[],
): string[] {
  if (value === undefined) return fallback;
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new Error(`invalid yom config: ${name} must be a string array`);
  }
  return [...value];
}

function enumValue<const T extends string>(
  value: unknown,
  name: string,
  values: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(
      `invalid yom config: ${name} must be one of ${values.join(", ")}`,
    );
  }
  return value as T;
}
