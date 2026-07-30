#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(package.json src/storage/saves/checksum.ts src/sports/football/relationships/relationshipEvents.ts src/hooks/useCareerSave.ts)
for path in "${required[@]}"; do [[ -e "$path" ]] || { echo "Required 0.43.3 file is missing: $path" >&2; exit 1; }; done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.43\.3"' package.json || { echo "package.json is not 0.43.3" >&2; exit 1; }
grep -Fq 'hash.write("undefined")' src/storage/saves/checksum.ts || { echo "Undefined checksum support is missing" >&2; exit 1; }
grep -Fq 'relationshipStateWithoutPending' src/sports/football/relationships/relationshipEvents.ts || { echo "Resolved event cleanup is missing" >&2; exit 1; }
if [[ -f DELETE_FILES_0.43.3.txt ]]; then while IFS= read -r path; do [[ -z "$path" ]] || rm -rf -- "$path"; done < DELETE_FILES_0.43.3.txt; fi
echo "PROSPECT 0.43.3 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
