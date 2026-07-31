#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(package.json src/styles/operations.css src/components/career/teamBrand.ts src/components/career/RecruitingDashboard.tsx src/components/career/MarketDashboard.tsx src/components/career/LeagueDirectoryDashboard.tsx scripts/check-visual-workbench.mjs)
for path in "${required[@]}"; do [[ -e "$path" ]] || { echo "Required 0.51.0 file is missing: $path" >&2; exit 1; }; done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.51\.0"' package.json || { echo "package.json is not 0.51.0" >&2; exit 1; }
echo "PROSPECT 0.51.0 installed."
echo "Run: npm test; npm run build"
