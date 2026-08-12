import MarkdownIt from "markdown-it";

export const DEFAULT_MARKDOWN_FEATURES = [
  "fenced_code",
  "tables",
  "toc",
  "sane_lists",
] as const;

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
});

type MarkdownEnvironment = {
  headingIds: Map<string, number>;
  headings: MarkdownHeading[];
};

export type MarkdownHeading = {
  id: string;
  text: string;
  level: number;
};

export type MarkdownDocument = {
  html: string;
  body: string;
  title: string | null;
  headings: MarkdownHeading[];
  frontMatter: Record<string, string | number | boolean | string[]>;
};

markdown.renderer.rules.heading_open = (
  tokens,
  index,
  options,
  environment,
  renderer,
) => {
  const inline = tokens[index + 1];
  const env = environment as MarkdownEnvironment;
  const baseId = slugifyHeading(inline?.content ?? "section");
  const occurrence = env.headingIds.get(baseId) ?? 0;
  env.headingIds.set(baseId, occurrence + 1);
  const id = occurrence === 0 ? baseId : `${baseId}-${occurrence + 1}`;
  tokens[index].attrSet("id", id);
  env.headings.push({
    id,
    text: inline?.content ?? "",
    level: Number(tokens[index].tag.slice(1)),
  });
  return renderer.renderToken(tokens, index, options);
};

export function renderMarkdown(source: string): string {
  return renderMarkdownDocument(source).html;
}

export function renderMarkdownDocument(source: string): MarkdownDocument {
  const { body, frontMatter } = parseFrontMatter(source);
  const environment: MarkdownEnvironment = {
    headingIds: new Map<string, number>(),
    headings: [],
  };
  const html = markdown.render(body, environment);
  const configuredTitle = frontMatter.title;
  return {
    html,
    body,
    title:
      typeof configuredTitle === "string"
        ? configuredTitle
        : (environment.headings.find((heading) => heading.level === 1)?.text ??
          null),
    headings: environment.headings,
    frontMatter,
  };
}

function slugifyHeading(value: string): string {
  const slug = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, "-")
    .replace(/[^\p{Letter}\p{Number}_-]/gu, "")
    .replace(/^-+|-+$/gu, "");
  return slug || "section";
}

function parseFrontMatter(source: string): {
  body: string;
  frontMatter: MarkdownDocument["frontMatter"];
} {
  const normalized = source.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    return { body: source, frontMatter: {} };
  }
  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return { body: source, frontMatter: {} };
  }
  const frontMatter: MarkdownDocument["frontMatter"] = {};
  for (const line of normalized.slice(4, closingIndex).split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key.length > 0) frontMatter[key] = parseFrontMatterValue(value);
  }
  return {
    body: normalized.slice(closingIndex + 5),
    frontMatter,
  };
}

function parseFrontMatterValue(
  value: string,
): string | number | boolean | string[] {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/u.test(value)) return Number(value);
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean);
  }
  return stripQuotes(value);
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
