#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(
  "package.json"
  "src/sports/football/matches/realTimeEngine.test.ts"
)
for path in "${required[@]}"; do [[ -e "$path" ]] || { echo "Required 0.43.1 file is missing: $path" >&2; exit 1; }; done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.43\.1"' package.json || { echo "package.json is not 0.43.1" >&2; exit 1; }
grep -q 'frame < 1400' src/sports/football/matches/realTimeEngine.test.ts || { echo "Long-touchdown regression timeout fix is missing" >&2; exit 1; }
if [[ -f DELETE_FILES_0.43.1.txt ]]; then while IFS= read -r path; do [[ -z "$path" ]] || rm -rf -- "$path"; done < DELETE_FILES_0.43.1.txt; fi
echo "PROSPECT 0.43.1 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
