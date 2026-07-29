#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
required=(
  package.json
  src/sports/football/ecosystem/lifecycle.ts
  src/sports/football/pro/draft.ts
  src/sports/football/matches/realTimeEngine.ts
  scripts/check-player-lifecycle.mjs
)
for path in "${required[@]}"; do
  [[ -e "$path" ]] || { echo "Required 0.41.0 file is missing: $path" >&2; exit 1; }
done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.41\.0"' package.json || { echo "package.json is not 0.41.0" >&2; exit 1; }
if [[ -f DELETE_FILES_0.41.0.txt ]]; then
  while IFS= read -r path; do
    [[ -n "$path" ]] && rm -rf -- "$path"
  done < DELETE_FILES_0.41.0.txt
fi
echo "PROSPECT 0.41.0 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
