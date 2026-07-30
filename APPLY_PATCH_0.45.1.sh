#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ -f package.json ]] || { echo "package.json missing" >&2; exit 1; }
[[ -f src/styles/world.css ]] || { echo "src/styles/world.css missing" >&2; exit 1; }
[[ -f scripts/check-ui-architecture.mjs ]] || { echo "check-ui-architecture missing" >&2; exit 1; }
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.45\.1"' package.json || { echo "package.json is not 0.45.1" >&2; exit 1; }
echo "PROSPECT 0.45.1 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
