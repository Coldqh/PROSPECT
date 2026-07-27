#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$ROOT/DELETE_FILES_0.31.0.txt" ]; then
  while IFS= read -r relative_path; do
    [ -n "$relative_path" ] || continue
    if [ -e "$ROOT/$relative_path" ]; then
      rm -f "$ROOT/$relative_path"
      printf 'Deleted %s\n' "$relative_path"
    fi
  done < "$ROOT/DELETE_FILES_0.31.0.txt"
fi
printf 'PROSPECT 0.31.0 patch applied. Run: npm install; npm run dev\n'
