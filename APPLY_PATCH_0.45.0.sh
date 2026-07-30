#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(
  package.json
  src/sports/football/matches/usage.ts
  src/sports/football/matches/realTimeEngine.ts
  src/sports/football/matches/simulateMatch.ts
  src/storage/saves/schema.ts
)
for path in "${required[@]}"; do
  [[ -e "$path" ]] || { echo "Required 0.45.0 file is missing: $path" >&2; exit 1; }
done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.45\.0"' package.json || { echo "package.json is not 0.45.0" >&2; exit 1; }
grep -Eq 'CURRENT_SCHEMA_VERSION[[:space:]]*=[[:space:]]*33' src/storage/saves/schema.ts || { echo "Save schema 33 is missing" >&2; exit 1; }
grep -Fq 'buildMatchUsagePlan' src/sports/football/matches/usage.ts || { echo "Usage plan is missing" >&2; exit 1; }
grep -Fq 'behindCoverage' src/sports/football/matches/realTimeEngine.ts || { echo "QB coverage read is missing" >&2; exit 1; }
if [[ -f DELETE_FILES_0.45.0.txt ]]; then
  while IFS= read -r path; do
    [[ -z "$path" ]] || rm -rf -- "$path"
  done < DELETE_FILES_0.45.0.txt
fi
echo "PROSPECT 0.45.0 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
