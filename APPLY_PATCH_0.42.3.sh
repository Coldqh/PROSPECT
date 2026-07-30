#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(
  package.json
  src/components/career/RealTimeMatchField.tsx
  src/sports/football/pro/camp.test.ts
  src/sports/football/pro/campFreeAgency.test.ts
  src/sports/football/pro/leagueStructure.test.ts
  src/sports/football/pro/league.test.ts
  src/sports/football/pro/leaguePractice.test.ts
  src/sports/football/pro/leagueSeason.test.ts
  scripts/run-professional-tests.mjs
)
for path in "${required[@]}"; do
  [[ -e "$path" ]] || { echo "Required 0.42.3 file is missing: $path" >&2; exit 1; }
done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.42\.3"' package.json || { echo "package.json is not 0.42.3" >&2; exit 1; }
grep -Fq '#35c96f' src/components/career/RealTimeMatchField.tsx || { echo "Green hero marker is missing." >&2; exit 1; }
grep -Fq 'leagueSeason.test.ts' scripts/run-professional-tests.mjs || { echo "Isolated professional test runner is missing." >&2; exit 1; }
if [[ -f DELETE_FILES_0.42.3.txt ]]; then
  while IFS= read -r path; do
    [[ -n "$path" ]] && rm -rf -- "$path"
  done < DELETE_FILES_0.42.3.txt
fi
echo "PROSPECT 0.42.3 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
