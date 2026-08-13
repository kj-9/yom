import { spawnSync } from "node:child_process";

import packageJson from "../package.json" with { type: "json" };

export function releaseTagForVersion(
  version: string,
): "alpha" | "beta" | "latest" {
  const match = version.match(/^\d+\.\d+\.\d+(?:-(alpha|beta)\.\d+)?$/u);
  if (match === null) {
    throw new Error(`unsupported release version: ${version}`);
  }
  const prerelease = match[1];
  if (prerelease === "alpha" || prerelease === "beta") {
    return prerelease;
  }
  return "latest";
}

export function assertReleaseRef(
  version: string,
  refName: string | undefined,
): void {
  if (refName === undefined) return;
  const expected = `v${version}`;
  if (refName !== expected) {
    throw new Error(
      `release tag ${refName} does not match package version ${version}; expected ${expected}`,
    );
  }
}

if (import.meta.main) {
  try {
    assertReleaseRef(packageJson.version, process.env.GITHUB_REF_NAME);
    const tag = releaseTagForVersion(packageJson.version);
    const result = spawnSync("npm", ["publish", "--tag", tag], {
      stdio: "inherit",
    });
    process.exit(result.status ?? 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
