#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
required=(
  package.json
  src/sports/football/matches/performanceEvaluation.ts
  src/sports/football/matches/realTimeEngine.ts
  src/sports/football/pro/league.ts
  scripts/check-performance-grading.mjs
)
for path in "${required[@]}"; do
  [[ -e "$path" ]] || { echo "Required 0.42.0 file is missing: $path" >&2; exit 1; }
done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.42\.0"' package.json || { echo "package.json is not 0.42.0" >&2; exit 1; }
if [[ -f DELETE_FILES_0.42.0.txt ]]; then
  while IFS= read -r path; do
    [[ -n "$path" ]] && rm -rf -- "$path"
  done < DELETE_FILES_0.42.0.txt
fi
echo "PROSPECT 0.42.0 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
