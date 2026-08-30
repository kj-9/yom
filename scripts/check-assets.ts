import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");
const files = await collect(root);
const generatedAssets = files.filter((file) =>
  file.includes(`${path.sep}_yom${path.sep}`),
);
if (generatedAssets.some((file) => /pagefind/iu.test(file))) {
  throw new Error("Pagefind assets are not allowed in this migration");
}

const html = await readFile(path.join(root, "index.html"), "utf-8");
const initialUrls = [
  ...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/gu),
].map((match) => match[1]);
const initial = initialUrls
  .map((url) => path.join(root, url.replace(/^\/+/, "")))
  .filter((file) => generatedAssets.includes(file));
const totals = new Map<string, number>();
for (const file of initial) {
  const extension = path.extname(file).slice(1);
  const compressed = gzipSync(await readFile(file)).byteLength;
  totals.set(extension, (totals.get(extension) ?? 0) + compressed);
}
for (const extension of ["js", "css"]) {
  const size = totals.get(extension) ?? 0;
  if (size > 50 * 1024) {
    throw new Error(`initial ${extension} exceeds 50 KiB: ${size} bytes gzip`);
  }
  console.log(`initial ${extension}: ${size} bytes gzip`);
}

async function collect(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await collect(file)));
    else paths.push(file);
  }
  return paths;
}
