#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(
  package.json
  src/sports/football/pro/draft.test.ts
  src/sports/football/pro/camp.test.ts
  src/sports/football/pro/league.test.ts
  src/sports/football/pro/professionalTestFixtures.ts
  scripts/check-professional-league.mjs
  src/test/setup.ts
)
for path in "${required[@]}"; do
  [[ -e "$path" ]] || { echo "Required 0.42.2 file is missing: $path" >&2; exit 1; }
done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.42\.2"' package.json || { echo "package.json is not 0.42.2" >&2; exit 1; }
grep -Fq 'src/sports/football/pro/camp.test.ts' package.json || { echo "Separated professional test suite is missing." >&2; exit 1; }
grep -Fq -- '--environment=node' package.json || { echo "Professional tests are not configured for node." >&2; exit 1; }
if [[ -f DELETE_FILES_0.42.2.txt ]]; then
  while IFS= read -r path; do
    [[ -n "$path" ]] && rm -rf -- "$path"
  done < DELETE_FILES_0.42.2.txt
fi
echo "PROSPECT 0.42.2 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
