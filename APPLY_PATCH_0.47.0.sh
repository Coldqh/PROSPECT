#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(package.json src/sports/football/ecosystem/history.ts src/sports/football/ecosystem/history.test.ts scripts/check-world-history.mjs)
for path in "${required[@]}"; do [[ -e "$path" ]] || { echo "Required 0.47.0 file is missing: $path" >&2; exit 1; }; done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.47\.0"' package.json || { echo "package.json is not 0.47.0" >&2; exit 1; }
grep -Eq 'CURRENT_SCHEMA_VERSION[[:space:]]*=[[:space:]]*34' src/storage/saves/schema.ts || { echo "Save schema 34 is missing" >&2; exit 1; }
grep -Eq 'ECOSYSTEM_MODULE_VERSION[[:space:]]*=[[:space:]]*13' src/sports/football/ecosystem/types.ts || { echo "Ecosystem module 13 is missing" >&2; exit 1; }
echo "PROSPECT 0.47.0 installed."
echo "Run: npm test; npm run build"
