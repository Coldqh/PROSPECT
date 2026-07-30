#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(package.json src/sports/football/pro/professionalTestFixtures.ts src/sports/football/pro/leagueStructure.test.ts)
for path in "${required[@]}"; do [[ -e "$path" ]] || { echo "Required 0.43.2 file is missing: $path" >&2; exit 1; }; done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.43\.2"' package.json || { echo "package.json is not 0.43.2" >&2; exit 1; }
grep -Eq 'position:[[:space:]]*"EDGE"' src/sports/football/pro/professionalTestFixtures.ts || { echo "EDGE fixture missing" >&2; exit 1; }
if [[ -f DELETE_FILES_0.43.2.txt ]]; then while IFS= read -r path; do [[ -z "$path" ]] || rm -rf -- "$path"; done < DELETE_FILES_0.43.2.txt; fi
echo "PROSPECT 0.43.2 installed."
