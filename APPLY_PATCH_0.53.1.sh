#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(package.json src/styles/controls.css src/styles/career.css src/styles/management.css src/styles/match.css src/styles/flows.css src/styles/shell.css scripts/check-f1-dynasty-ui.mjs)
for path in "${required[@]}"; do [[ -e "$path" ]] || { echo "Required 0.53.1 file is missing: $path" >&2; exit 1; }; done
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.53\.1"' package.json || { echo "package.json is not 0.53.1" >&2; exit 1; }
if grep -RIEq 'background:[[:space:]]*(#fff|#ffffff|#f8fafb|#f6f8fa|#edf3f8|#e9edf1)|%,[[:space:]]*white\)' src/styles; then
  echo "Legacy light surface remains in active CSS" >&2
  exit 1
fi
echo "PROSPECT 0.53.1 installed."
echo "Run: npm test; npm run build"
