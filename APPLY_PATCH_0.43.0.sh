#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(
  package.json
  src/sports/football/matches/performanceEvaluation.ts
  src/sports/football/matches/realTimeEngine.ts
  src/components/career/MatchDashboard.tsx
  src/components/career/LeagueDirectoryDashboard.tsx
  src/storage/saves/CareerRepository.ts
  scripts/check-functional-copy.mjs
)
for path in "${required[@]}"; do [[ -e "$path" ]] || { echo "Required 0.43.0 file is missing: $path" >&2; exit 1; }; done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.43\.0"' package.json || { echo "package.json is not 0.43.0" >&2; exit 1; }
grep -q 'gameCriteria' src/sports/football/matches/performanceEvaluation.ts || { echo "Full-game grading is missing" >&2; exit 1; }
grep -q 'qbEscapeTarget' src/sports/football/matches/realTimeEngine.ts || { echo "QB escape fix is missing" >&2; exit 1; }
if [[ -f DELETE_FILES_0.43.0.txt ]]; then while IFS= read -r path; do [[ -z "$path" ]] || rm -rf -- "$path"; done < DELETE_FILES_0.43.0.txt; fi
echo "PROSPECT 0.43.0 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
