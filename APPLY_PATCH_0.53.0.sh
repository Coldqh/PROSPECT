#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(package.json src/styles/dynasty.css src/components/career/TodayDashboard.tsx src/components/career/TeamProfileDashboard.tsx src/components/career/PlayerProfileDashboard.tsx scripts/check-f1-dynasty-ui.mjs)
for path in "${required[@]}"; do [[ -e "$path" ]] || { echo "Required 0.53.0 file is missing: $path" >&2; exit 1; }; done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.53\.0"' package.json || { echo "package.json is not 0.53.0" >&2; exit 1; }
grep -Fq 'dynasty-team-masthead' src/components/career/TeamProfileDashboard.tsx
grep -Fq 'dynasty-profile-hero' src/components/career/PlayerProfileDashboard.tsx
grep -Fq 'dynasty-week-panel' src/components/career/TodayDashboard.tsx
echo "PROSPECT 0.53.0 installed."
echo "Run: npm test; npm run build"
