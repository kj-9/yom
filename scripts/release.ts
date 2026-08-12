import { spawnSync } from "node:child_process";

import packageJson from "../package.json" with { type: "json" };

export function releaseTagForVersion(
  version: string,
): "alpha" | "beta" | "latest" {
  const prerelease = version.match(/-(alpha|beta)(?:\.|$)/u)?.[1];
  if (prerelease === "alpha" || prerelease === "beta") {
    return prerelease;
  }
  return "latest";
}

if (import.meta.main) {
  const tag = releaseTagForVersion(packageJson.version);
  const result = spawnSync(
    "bun",
    ["publish", "--tag", tag, "--access", "public"],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}
