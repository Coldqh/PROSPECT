#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(
  package.json
  src/sports/football/ecosystem/coaching.ts
  src/sports/football/pro/coaching.ts
  src/sports/football/matches/playbook.ts
  src/storage/saves/schema.ts
)
for path in "${required[@]}"; do
  [[ -e "$path" ]] || { echo "Required 0.44.0 file is missing: $path" >&2; exit 1; }
done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.44\.0"' package.json || { echo "package.json is not 0.44.0" >&2; exit 1; }
grep -Eq 'CURRENT_SCHEMA_VERSION[[:space:]]*=[[:space:]]*32' src/storage/saves/schema.ts || { echo "Save schema 32 is missing" >&2; exit 1; }
grep -Fq 'professionalSchemeFit' src/sports/football/pro/coaching.ts || { echo "Professional scheme fit is missing" >&2; exit 1; }
grep -Fq 'PlayCallStrategy' src/sports/football/matches/playbook.ts || { echo "Adaptive play-call strategy is missing" >&2; exit 1; }
if [[ -f DELETE_FILES_0.44.0.txt ]]; then
  while IFS= read -r path; do
    [[ -z "$path" ]] || rm -rf -- "$path"
  done < DELETE_FILES_0.44.0.txt
fi
echo "PROSPECT 0.44.0 installed."
echo "Run: npm install; npm run test; npm run build; npm run dev"
