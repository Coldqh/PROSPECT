#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(
  package.json
  src/storage/saves/worldSlices.ts
  src/storage/indexedDb/database.ts
  src/sports/football/matches/participation.ts
  src/components/career/ProfessionalSeasonDashboard.tsx
  scripts/check-core-consolidation.mjs
)
for path in "${required[@]}"; do [[ -e "$path" ]] || { echo "Required 0.46.0 file is missing: $path" >&2; exit 1; }; done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.46\.0"' package.json || { echo "package.json is not 0.46.0" >&2; exit 1; }
grep -Fq 'openDB<ProspectDatabase>("prospect-db", 2' src/storage/indexedDb/database.ts || { echo "IndexedDB schema 2 is missing" >&2; exit 1; }
grep -Eq 'CURRENT_SCHEMA_VERSION[[:space:]]*=[[:space:]]*33' src/storage/saves/schema.ts || { echo "Save schema 33 is missing" >&2; exit 1; }
if [[ -f DELETE_FILES_0.46.0.txt ]]; then
  while IFS= read -r path; do [[ -z "$path" ]] || rm -rf -- "$path"; done < DELETE_FILES_0.46.0.txt
fi
echo "PROSPECT 0.46.0 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
