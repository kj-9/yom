#!/usr/bin/env bash

set -euo pipefail

bun run check
bun run compile
bun run format
bun run test
bun run benchmark
bun run test:package
bun run test:e2e
