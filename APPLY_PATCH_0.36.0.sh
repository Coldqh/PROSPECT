#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if [ ! -f "$ROOT/package.json" ]; then
  printf 'package.json not found. Extract the patch into the PROSPECT project root.\n' >&2
  exit 1
fi
if ! grep -q '"version": "0.36.0"' "$ROOT/package.json"; then
  printf 'Patch files were not copied completely. Expected package version 0.36.0.\n' >&2
  exit 1
fi

if [ "${1:-}" != "--skip-dependencies" ]; then
  if [ ! -f "$ROOT/node_modules/fdir/dist/index.mjs" ]; then
    printf 'Incomplete dependencies detected. Rebuilding node_modules...\n'
    rm -rf "$ROOT/node_modules"
    (cd "$ROOT" && npm cache verify && npm ci --no-audit --no-fund)
  fi
  if [ ! -f "$ROOT/node_modules/fdir/dist/index.mjs" ]; then
    printf 'Dependency repair failed: node_modules/fdir/dist/index.mjs is missing.\n' >&2
    exit 1
  fi
fi

printf 'PROSPECT 0.36.0 MATCH EXPERIENCE REBUILD applied.\nRun: npm run test; npm run build; npm run dev\n'
