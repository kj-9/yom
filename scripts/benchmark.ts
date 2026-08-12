import { performance } from "node:perf_hooks";

import { buildSiteIndexFromPaths } from "../src/core/scan";

const scenarios = [
  { count: 100, limitMs: 100 },
  { count: 1_000, limitMs: 250 },
  { count: 10_000, limitMs: 1_500 },
];

for (const { count, limitMs } of scenarios) {
  const paths = Array.from(
    { length: count },
    (_, index) => `section-${index % 100}/document-${index}.md`,
  );
  const startedAt = performance.now();
  const snapshot = buildSiteIndexFromPaths(".", paths);
  const elapsed = performance.now() - startedAt;
  if (snapshot.firstPath === null) {
    throw new Error("benchmark did not produce a document tree");
  }
  console.log(
    `${count.toLocaleString()} Markdown files: ${elapsed.toFixed(2)} ms`,
  );
  if (elapsed > limitMs) {
    throw new Error(
      `${count.toLocaleString()} file tree exceeded ${limitMs} ms performance limit`,
    );
  }
}
