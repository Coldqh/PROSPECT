#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(
  package.json
  src/sports/football/matches/realTimeEngine.ts
  src/sports/football/matches/performanceEvaluation.ts
  src/sports/football/matches/realTimeEngine.test.ts
  src/sports/football/matches/performanceEvaluation.test.ts
)
for path in "${required[@]}"; do
  [[ -e "$path" ]] || { echo "Required 0.42.1 file is missing: $path" >&2; exit 1; }
done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.42\.1"' package.json || { echo "package.json is not 0.42.1" >&2; exit 1; }
if [[ -f DELETE_FILES_0.42.1.txt ]]; then
  while IFS= read -r path; do
    [[ -n "$path" ]] && rm -rf -- "$path"
  done < DELETE_FILES_0.42.1.txt
fi
echo "PROSPECT 0.42.1 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
