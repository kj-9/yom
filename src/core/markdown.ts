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

export function renderMarkdown(source: string): string {
  return markdown.render(source);
}
