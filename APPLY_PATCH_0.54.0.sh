#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(package.json src/components/career/ManagerPageHeader.tsx src/components/career/RecruitingDashboard.tsx src/components/career/MarketDashboard.tsx src/components/career/LeagueDirectoryDashboard.tsx src/components/career/WorldDashboard.tsx src/components/career/ProfessionalTransitionDashboard.tsx src/components/career/MatchDashboard.tsx scripts/check-complete-ui-migration.mjs)
for path in "${required[@]}"; do [[ -e "$path" ]] || { echo "Required 0.54.0 file is missing: $path" >&2; exit 1; }; done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.54\.0"' package.json || { echo "package.json is not 0.54.0" >&2; exit 1; }
node scripts/check-complete-ui-migration.mjs
echo "PROSPECT 0.54.0 installed."
echo "Run: npm test; npm run build"
