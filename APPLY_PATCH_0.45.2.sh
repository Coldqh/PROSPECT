#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(
  package.json
  src/styles/world.css
  src/components/career/LeagueDirectoryDashboard.tsx
  src/components/career/TeamProfileDashboard.tsx
  src/sports/football/ecosystem/coaching.ts
  src/sports/football/ecosystem/createEcosystem.ts
  src/sports/football/ecosystem/simulateEcosystem.ts
  src/sports/football/ecosystem/social.ts
  src/sports/football/ecosystem/stability.ts
  src/sports/football/ecosystem/tactics.ts
  src/sports/football/ecosystem/types.ts
  src/sports/football/ecosystem/upgradeEcosystem.ts
  src/sports/football/pro/coaching.ts
  src/sports/football/pro/createProfessionalState.ts
  src/sports/football/matches/usage.ts
  scripts/check-release-integrity.mjs
  scripts/release-required-files.json
)
for path in "${required[@]}"; do
  [[ -e "$path" ]] || { echo "Required 0.45.2 file is missing: $path" >&2; exit 1; }
done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.45\.2"' package.json || { echo "package.json is not 0.45.2" >&2; exit 1; }
if [[ -f DELETE_FILES_0.45.2.txt ]]; then
  while IFS= read -r path; do
    [[ -z "$path" ]] || rm -rf -- "$path"
  done < DELETE_FILES_0.45.2.txt
fi
node scripts/check-release-integrity.mjs
echo "PROSPECT 0.45.2 installed."
echo "Run: npm run test; npm run build; npm run dev"
