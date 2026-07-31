#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
required=(package.json src/styles/index.css src/styles/shell.css src/styles/management.css scripts/check-f1-dynasty-ui.mjs DELETE_FILES_0.52.0.txt)
for path in "${required[@]}"; do [[ -e "$path" ]] || { echo "Required 0.52.0 file is missing: $path" >&2; exit 1; }; done
while IFS= read -r path; do
  [[ -z "$path" || "$path" == \#* ]] || rm -rf -- "$path"
done < DELETE_FILES_0.52.0.txt
grep -Eq '"version"[[:space:]]*:[[:space:]]*"0\.52\.0"' package.json || { echo "package.json is not 0.52.0" >&2; exit 1; }
echo "PROSPECT 0.52.0 installed. Retired UI files removed."
echo "Run: npm test; npm run build"
